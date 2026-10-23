// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, SESSION_COOKIE } from '../../server/http.js';
import { SESSION_SECONDS, addStamps, createSession, getSession, guessKeys, readCredentials, sha256 } from '../../server/auth.js';
import { onRequestDelete as deleteAccount } from '../../functions/api/account.js';
import { onRequestPost as loginPost } from '../../functions/api/auth/login.js';
import { onRequestPost as signupPost } from '../../functions/api/auth/signup.js';
import { KEY, ORIGIN, addUser, apiRequest, createDb, makeEnv } from './apiHarness.js';

const WRONG = 'B'.repeat(43); // a well-formed password key that is nobody's password
const NOTHING_WRITTEN = { rows: 0, batch: 0, run: 0 };
const SESSION_CAP = 10; // docs/security.md: at most 10 sessions per user

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.99); // no random housekeeping while a test counts rows
});
afterEach(() => vi.restoreAllMocks());

const network = ip => (ip ? { 'CF-Connecting-IP': ip } : {});
const meRequest = cookie => new Request(`${ORIGIN}/api/me`, { headers: cookie ? { Cookie: cookie } : {} });
const signIn = (env, username, passwordKey, ip) => loginPost({ request: apiRequest('POST', '/api/auth/login', { username, passwordKey }, network(ip)), env });
const signUp = (env, username, ip, more) => signupPost({ request: apiRequest('POST', '/api/auth/signup', { username, passwordKey: KEY, ...more }, network(ip)), env });
const deleteWith = (env, user, passwordKey, ip) => deleteAccount({ request: apiRequest('DELETE', '/api/account', { passwordKey }, { Cookie: user.cookie, ...network(ip) }), env });
const statusesOf = async (count, call) => {
  const out = [];
  for (let i = 0; i < count; i++) out.push((await call(i)).status);
  return out;
};
/** Runs `action` and reports what it wrote: rows changed by INSERT/UPDATE/DELETE, and batch() and run() calls. */
const writtenBy = async (db, action) => {
  const before = { rows: db.writes(), ...db.calls };
  const result = await action();
  return { result, rows: db.writes() - before.rows, batch: db.calls.batch - before.batch, run: db.calls.run - before.run };
};

describe('sessions', () => {
  it('a session lasts 30 days and is accepted until the second before its expiry, never from the expiry second on', async () => {
    const db = createDb();
    const env = makeEnv(db);
    const start = 1_800_000_000;
    const user = await addUser(db, 'amina', { now: start });
    const expiresAt = start + SESSION_SECONDS;
    expect(SESSION_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(db.rows('sessions')[0].expires_at).toBe(expiresAt);

    const at = now => getSession(env, meRequest(user.cookie), now);
    expect(await at(start)).toMatchObject({ userId: user.id, username: 'amina' });
    expect(await at(expiresAt - 1)).toMatchObject({ userId: user.id, username: 'amina' });
    expect(await at(expiresAt)).toBeNull();
    expect(await at(expiresAt + 1)).toBeNull();
  });

  const malformed = [
    ['no cookie', null],
    ['another cookie only', 'theme=dark'],
    ['an empty token', `${SESSION_COOKIE}=`],
    ['a token one character short', `${SESSION_COOKIE}=${'a'.repeat(42)}`],
    ['a token one character long', `${SESSION_COOKIE}=${'a'.repeat(44)}`],
    ['a token with base64 padding', `${SESSION_COOKIE}=${'a'.repeat(42)}=`],
    ['a token with + and /', `${SESSION_COOKIE}=${'a'.repeat(41)}+/`],
    ['markup', `${SESSION_COOKIE}=<script>${'a'.repeat(35)}`],
    ['SQL-like text', `${SESSION_COOKIE}=' OR '1'='1' --${'a'.repeat(28)}`],
    ['letters outside a to z', `${SESSION_COOKIE}=${'é'.repeat(43)}`],
    ['the cookie name without the __Host- prefix', `bdp_session=${'a'.repeat(43)}`],
  ];

  it.each(malformed)('a request with %s is rejected without a database query', async (_, cookie) => {
    const env = makeEnv({ prepare: () => expect.fail('D1 was used') });
    expect(await getSession(env, meRequest(cookie), 1000)).toBeNull();
  });

  it('a well-formed token is looked up in the database, and one nobody holds gets nothing', async () => {
    const prepare = vi.fn(() => ({ bind: () => ({ first: async () => null }) }));
    expect(await getSession(makeEnv({ prepare }), meRequest(`${SESSION_COOKIE}=${'a'.repeat(43)}`), 1000)).toBeNull();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('session tokens are random 256-bit values kept only as a SHA-256 hash', async () => {
    const db = createDb();
    const amina = await addUser(db, 'amina');
    const rahim = await addUser(db, 'rahim');
    expect(amina.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(amina.token).not.toBe(rahim.token);
    expect(db.rows('sessions').map(s => s.token_hash).sort()).toEqual([await sha256(amina.token), await sha256(rahim.token)].sort());
    expect(JSON.stringify([db.rows('sessions'), db.rows('users')])).not.toContain(amina.token);
  });

  it(`a user keeps at most ${SESSION_CAP} sessions: the oldest goes, other users keep theirs`, async () => {
    const db = createDb();
    const env = makeEnv(db);
    const amina = await addUser(db, 'amina');
    const rahim = await addUser(db, 'rahim');
    const tokens = [amina.token];
    for (let i = 0; i < SESSION_CAP; i++) tokens.push(await createSession(db, amina.id)); // one more than the cap
    const whose = token => getSession(env, meRequest(`${SESSION_COOKIE}=${token}`));

    expect(await whose(tokens[0])).toBeNull();
    for (const token of tokens.slice(1)) expect(await whose(token)).toMatchObject({ username: 'amina' });
    expect(await whose(rahim.token)).toMatchObject({ username: 'rahim' });
  });
});

describe('account deletion', () => {
  const setup = async () => {
    const db = createDb();
    return { db, env: makeEnv(db), amina: await addUser(db, 'amina') };
  };

  it('answers 429 and writes nothing once the guesses for this user and network are used up, even for the right password', async () => {
    const { db, env, amina } = await setup();
    expect(await statusesOf(10, () => signIn(env, 'amina', WRONG))).toEqual(Array(10).fill(401));

    const { result, ...written } = await writtenBy(db, () => deleteWith(env, amina, KEY));
    expect(result.status).toBe(429);
    expect((await result.json()).error).toMatch(/wrong passwords/);
    expect(written).toEqual(NOTHING_WRITTEN);
    expect(db.rows('users')).toHaveLength(1);
    expect(db.rows('sessions')).toHaveLength(1);
  });

  it('records a failed guess on both counters for a wrong password and answers 401', async () => {
    const { db, env, amina } = await setup();
    const { result, ...written } = await writtenBy(db, () => deleteWith(env, amina, WRONG));
    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({ error: 'Password is incorrect.' });
    expect(written).toEqual({ rows: 2, batch: 1, run: 0 });

    const keys = await guessKeys(env, apiRequest('DELETE', '/api/account'), 'amina'); // same network: no address header
    expect(Object.fromEntries(db.rows('rate_limits').map(r => [r.key, r.count]))).toEqual({ [keys.pair]: 1, [keys.user]: 1 });
    expect(db.rows('users')).toHaveLength(1);
  });

  it('shares one limit with sign-in: wrong passwords from either count together', async () => {
    const { env, amina } = await setup();
    for (let i = 0; i < 5; i++) {
      expect((await deleteWith(env, amina, WRONG)).status).toBe(401);
      expect((await signIn(env, 'amina', WRONG)).status).toBe(401);
    }
    expect((await signIn(env, 'amina', KEY)).status).toBe(429);
    expect((await deleteWith(env, amina, KEY)).status).toBe(429);
  });

  it('deletes only the signed-in account: its passport, all its sessions and its guess counters', async () => {
    const { db, env, amina } = await setup();
    const rahim = await addUser(db, 'rahim');
    await addStamps(db, amina.id, ['1']);
    await addStamps(db, rahim.id, ['2']);
    const otherDevice = `${SESSION_COOKIE}=${await createSession(db, amina.id)}`;
    expect((await deleteWith(env, amina, WRONG)).status).toBe(401); // leaves failed-guess counters behind
    expect(db.rows('rate_limits')).toHaveLength(2);

    const res = await deleteWith(env, amina, KEY);
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);
    expect(db.rows('users').map(u => u.username)).toEqual(['rahim']);
    expect(db.rows('passports').map(p => p.user_id)).toEqual([rahim.id]);
    expect(db.rows('sessions').map(s => s.user_id)).toEqual([rahim.id]);
    expect(db.rows('rate_limits')).toEqual([]);
    expect(await getSession(env, meRequest(otherDevice))).toBeNull();
    expect(await getSession(env, meRequest(rahim.cookie))).toMatchObject({ username: 'rahim' });
  });

  it('needs a session and a well-formed key before it touches the database', async () => {
    const { db, env, amina } = await setup();
    const signedOut = deleteAccount({ request: apiRequest('DELETE', '/api/account', { passwordKey: KEY }), env });
    await expect(signedOut).rejects.toMatchObject({ status: 401 });
    for (const passwordKey of ['short', undefined, 42]) {
      const { result, ...written } = await writtenBy(db, () => deleteWith(env, amina, passwordKey));
      expect(result.status).toBe(400);
      expect(written).toEqual(NOTHING_WRITTEN);
    }
  });
});

describe('sign-up limit', () => {
  it('allows 5 new accounts per network per hour; the next answers 429 and creates no user', async () => {
    const db = createDb();
    const env = makeEnv(db);
    const oneNetwork = [1, 2, 3, 4, 5].map(n => `2001:db8:1:2::${n}`); // addresses of one IPv6 /64 are one network
    for (const [i, ip] of oneNetwork.entries()) expect((await signUp(env, `user_${i}`, ip)).status).toBe(201);

    const { result, ...written } = await writtenBy(db, () => signUp(env, 'user_late', '2001:db8:1:2:ffff:ffff:ffff:ffff'));
    expect(result.status).toBe(429);
    expect(result.headers.get('Set-Cookie')).toBeNull();
    expect(written).toEqual(NOTHING_WRITTEN);
    expect(db.rows('users').map(u => u.username)).not.toContain('user_late');
    expect(db.rows('users')).toHaveLength(5);

    expect((await signUp(env, 'user_late', '2001:db8:1:3::1')).status).toBe(201); // another network is not affected
  });
});

describe('sign-in limits', () => {
  it('allow 30 attempts per network per 15 minutes; then even the right password gets 429 and only reads', async () => {
    const db = createDb();
    const env = makeEnv(db);
    await addUser(db, 'amina');
    // thirty different names, so no single username comes near its own guess limit
    expect(await statusesOf(30, i => signIn(env, `nobody_${i}`, WRONG))).toEqual(Array(30).fill(401));

    const { result, ...written } = await writtenBy(db, () => signIn(env, 'amina', KEY));
    expect(result.status).toBe(429);
    expect((await result.json()).error).toMatch(/from this network/); // the network budget, not the guess limit
    expect(written).toEqual(NOTHING_WRITTEN);
    expect(db.rows('sessions')).toHaveLength(1); // the refused sign-in made no session

    expect((await signIn(env, 'amina', KEY, '198.51.100.7')).status).toBe(200); // another network is not affected
  });

  it('count failed guesses for a username that does not exist exactly as for one that does', async () => {
    const db = createDb();
    const env = makeEnv(db);
    await addUser(db, 'amina');
    const eleven = async username => {
      const out = [];
      for (let i = 0; i < 11; i++) {
        const res = await signIn(env, username, WRONG);
        out.push([res.status, (await res.json()).error]);
      }
      return out;
    };

    const real = await eleven('amina');
    const ghost = await eleven('nobody_here');
    expect(real.map(([status]) => status)).toEqual([...Array(10).fill(401), 429]);
    expect(ghost).toEqual(real); // same statuses and same messages: lockout does not reveal which names exist
  });

  it('lock a username out per network, so an attacker cannot lock the owner out elsewhere', async () => {
    const db = createDb();
    const env = makeEnv(db);
    await addUser(db, 'amina');
    const attacker = '203.0.113.50';
    expect(await statusesOf(10, () => signIn(env, 'amina', WRONG, attacker))).toEqual(Array(10).fill(401));
    expect((await signIn(env, 'amina', WRONG, attacker)).status).toBe(429);
    expect((await signIn(env, 'amina', KEY, '198.51.100.9')).status).toBe(200);
  });

  it('stop guessing spread over many networks once a username has failed 100 times', async () => {
    const db = createDb();
    const env = makeEnv(db);
    await addUser(db, 'amina');
    for (let n = 1; n <= 10; n++) {
      expect(await statusesOf(10, () => signIn(env, 'amina', WRONG, `203.0.113.${n}`))).toEqual(Array(10).fill(401));
    }
    const fresh = await signIn(env, 'amina', KEY, '198.51.100.99'); // a network that has never failed
    expect(fresh.status).toBe(429);
    expect((await fresh.json()).error).toMatch(/wrong passwords/);
  });
});

describe('credentials', () => {
  const markup = [
    '<img src=x onerror=alert(1)>',
    '<script>',
    '<b>',
    'a<b>c',
    '"><svg/onload=alert(1)>',
    "x'); drop table users;--",
    'amina smith',
    'amina@example.com',
    '../../etc',
    'аmina', // Cyrillic a
    'ab',
    'x'.repeat(25),
  ];

  it('refuses markup-like and malformed usernames with a fixed message that does not echo them', () => {
    for (const username of markup) {
      let refused;
      try {
        readCredentials({ username, passwordKey: KEY });
      } catch (e) {
        refused = e;
      }
      expect(refused, username).toBeInstanceOf(HttpError);
      expect(refused.status).toBe(400);
      expect(refused.message).not.toContain(username);
    }
    for (const username of [undefined, null, 42, ['amina'], { toString: () => 'amina' }]) {
      expect(() => readCredentials({ username, passwordKey: KEY })).toThrow(HttpError);
    }
  });

  it('takes lowercase letters, digits, hyphen and underscore, 3 to 24 long, after trimming and lowercasing', () => {
    for (const [given, stored] of [['amina', 'amina'], [' AMINA_1 ', 'amina_1'], ['a-b', 'a-b'], ['abc', 'abc'], ['x'.repeat(24), 'x'.repeat(24)]]) {
      expect(readCredentials({ username: given, passwordKey: KEY }).username).toBe(stored);
    }
  });

  it('is enforced at sign-up and sign-in before any database work, even with the honeypot filled', async () => {
    const env = makeEnv({ prepare: () => expect.fail('D1 was used') });
    for (const username of ['<script>', '<img src=x onerror=alert(1)>']) {
      await expect(signUp(env, username)).rejects.toMatchObject({ status: 400 });
      await expect(signUp(env, username, undefined, { hp_note: 'spam' })).rejects.toMatchObject({ status: 400 });
      await expect(signIn(env, username, KEY)).rejects.toMatchObject({ status: 400 });
    }
  });
});
