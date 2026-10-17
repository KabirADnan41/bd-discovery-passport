// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, ipNetwork, readCookie, sessionCookie } from '../../server/http.js';
import { cleanIds, makeVerifier, readCredentials, safeEqual, withinRateLimit } from '../../server/auth.js';
import { onRequest } from '../../functions/api/_middleware.js';
import { onRequestPost as loginPost } from '../../functions/api/auth/login.js';
import { onRequestPost as signupPost } from '../../functions/api/auth/signup.js';
import { checkNewCredentials, derivePasswordKey } from '../../src/lib/authClient.js';
import { validate } from '../../scripts/validate-map-data.mjs';

const json = p => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));

describe('server auth helpers', () => {
  it('safeEqual compares exactly and rejects length or type mismatches', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', undefined)).toBe(false);
  });

  it('verifier is deterministic per pepper and changes with it', async () => {
    const key = 'A'.repeat(43);
    expect(await makeVerifier('p'.repeat(32), key)).toBe(await makeVerifier('p'.repeat(32), key));
    expect(await makeVerifier('q'.repeat(32), key)).not.toBe(await makeVerifier('p'.repeat(32), key));
  });

  it('cleanIds accepts 1..64 only and dedupes', () => {
    expect(cleanIds(['1', 54, '54', '64'])).toEqual(['1', '54', '64']);
    for (const bad of [['0'], ['65'], ['01'], ['<b>'], [null], 'nope', Array(65).fill('1')]) {
      expect(() => cleanIds(bad)).toThrow(HttpError);
    }
  });

  it('readCredentials normalises usernames and validates the key shape', () => {
    expect(readCredentials({ username: '  Amina_1 ', passwordKey: 'x'.repeat(43) }).username).toBe('amina_1');
    expect(() => readCredentials({ username: 'a', passwordKey: 'x'.repeat(43) })).toThrow(HttpError);
    expect(() => readCredentials({ username: 'amina', passwordKey: 'short' })).toThrow(HttpError);
    expect(() => readCredentials({ username: 'bad name!', passwordKey: 'x'.repeat(43) })).toThrow(HttpError);
  });

  it('session cookie is __Host-, HttpOnly, Secure, SameSite=Strict and parsable', () => {
    const header = sessionCookie('t'.repeat(43), 60);
    expect(header).toMatch(/^__Host-bdp_session=t{43}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=60$/);
    const req = new Request('https://x.test/', { headers: { Cookie: `other=1; ${header.split(';')[0]}` } });
    expect(readCookie(req, '__Host-bdp_session')).toBe('t'.repeat(43));
  });

  // Fake D1 holding one counter, plus the count both guess counters read; records every statement it runs.
  const counterDb = (count, guessCount = count) => {
    const ran = [];
    const prepare = sql => ({
      bind: (...args) => ({
        first: async () => {
          ran.push({ sql: sql.trim().split(' ')[0], args });
          if (sql.startsWith('SELECT')) return count === undefined ? null : { count };
          count = (count ?? 0) + 1;
          return { count };
        },
        all: async () => {
          ran.push({ sql: sql.trim().split(' ')[0], args });
          return { results: args.slice(0, 2).map(key => ({ key, count: guessCount })) };
        },
      }),
    });
    return { ran, prepare };
  };

  it('rate limit: a blocked call only reads and writes nothing', async () => {
    const db = counterDb(10);
    expect(await withinRateLimit(db, 'login:x', 10, 900, 1000)).toBe(false);
    expect(db.ran).toEqual([{ sql: 'SELECT', args: ['login:x', 100] }]);
  });

  it('rate limit: an allowed call counts the attempt with the key, now and window start', async () => {
    const db = counterDb(9);
    expect(await withinRateLimit(db, 'login:x', 10, 900, 1000)).toBe(true);
    expect(db.ran.map(s => s.sql)).toEqual(['SELECT', 'INSERT']);
    expect(db.ran[1].args).toEqual(['login:x', 1000, 100]);
    expect(await withinRateLimit(counterDb(), 'login:x', 10, 900, 1000)).toBe(true); // first attempt
  });

  it('login: a sign-in blocked by the per-username limit only reads and writes nothing', async () => {
    const db = counterDb(undefined, 100); // the network budget is untouched, the guess counters are full
    const body = JSON.stringify({ username: 'amina', passwordKey: 'A'.repeat(43) });
    const res = await loginPost({ request: new Request('https://x.test/api/auth/login', { method: 'POST', body }), env: { AUTH_PEPPER: 'p'.repeat(32), DB: db } });
    expect(res.status).toBe(429);
    expect(db.ran.map(s => s.sql)).toEqual(['SELECT']);
  });

  it('sign-up honeypot: a filled "hp_note" gets a normal 201, no cookie and no database use', async () => {
    const env = { AUTH_PEPPER: 'p'.repeat(32), DB: { prepare: () => expect.fail('D1 was used') } };
    const body = JSON.stringify({ username: 'amina', passwordKey: 'A'.repeat(43), hp_note: 'http://spam.example' });
    const res = await signupPost({ request: new Request('https://x.test/api/auth/signup', { method: 'POST', body }), env });
    expect(res.status).toBe(201);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(await res.json()).toEqual({ username: 'amina', discovered: [] });
  });
});

describe('api middleware', () => {
  const env = { DB: {}, AUTH_PEPPER: 'p'.repeat(32) };
  const call = (method, ip) =>
    onRequest({
      request: new Request('https://x.test/api/me', {
        method,
        headers: { ...(ip ? { 'CF-Connecting-IP': ip } : {}), Origin: 'https://x.test', 'Content-Type': 'application/json' },
      }),
      env,
      next: async () => new Response('ok'),
    });

  afterEach(() => vi.restoreAllMocks());

  it('ipNetwork keeps IPv4 and maps IPv6 to its /64', () => {
    expect(ipNetwork('203.0.113.7')).toBe('203.0.113.7');
    expect(ipNetwork('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:db8:85a3:0'); // full form
    expect(ipNetwork('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8:85a3:0'); // compressed form, same /64
    expect(ipNetwork('2001:db8::1')).toBe('2001:db8:0:0');
    expect(ipNetwork('::ffff:203.0.113.7')).toBe('::ffff:203.0.113.7'); // IPv4-mapped: one host, not the shared ::/64
  });

  it('refuses methods other than GET, POST and DELETE', async () => {
    for (const method of ['PUT', 'PATCH', 'OPTIONS', 'HEAD']) expect((await call(method, '203.0.113.1')).status).toBe(405);
  });

  it('turns one IP away after 60 state changes a minute, then lets it back in; GET is never counted', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    for (let i = 0; i < 60; i++) expect((await call('POST', '203.0.113.7')).status).toBe(200);
    const blocked = await call('POST', '203.0.113.7');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect((await call('GET', '203.0.113.7')).status).toBe(200); // page loads (GET /api/me) pass, even from a shared IP
    expect((await call('POST', '203.0.113.8')).status).toBe(200); // other IPs are unaffected
    Date.now.mockReturnValue(1_060_000);
    expect((await call('POST', '203.0.113.7')).status).toBe(200);
  });

  it('does not throttle local dev or requests without an IP header', async () => {
    for (const ip of ['127.0.0.1', '::1', undefined]) {
      for (let i = 0; i < 61; i++) expect((await call('POST', ip)).status).toBe(200);
    }
  });
});

describe('browser password stretching', () => {
  it('derives a 32-byte base64url key, salted per (case-insensitive) username', async () => {
    const a = await derivePasswordKey('Amina', 'correct horse battery', 1000);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await derivePasswordKey('amina', 'correct horse battery', 1000)).toBe(a);
    expect(await derivePasswordKey('rahim', 'correct horse battery', 1000)).not.toBe(a);
  });

  it('sign-up rules point at the field that needs fixing', () => {
    expect(checkNewCredentials('ab', 'long-enough-pass')?.field).toBe('username');
    expect(checkNewCredentials('amina', 'short')?.field).toBe('password');
    expect(checkNewCredentials('amina', 'amina-is-me-123')?.field).toBe('password');
    expect(checkNewCredentials('amina', 'river-padma-2026')).toBeNull();
  });
});

describe('map data validator', () => {
  const inputs = () => ({
    generated: json('src/generated/districtPaths.generated.json'),
    enriched: json('src/data/districts.enriched.json'),
    sourceDistricts: json('data/source/bd-districts.json').districts,
    sourceDivisions: json('data/source/bd-divisions.json').divisions,
    places: json('src/data/places.json'),
  });

  it('passes on the committed data', () => {
    expect(validate(inputs())).toEqual([]);
  });

  it('catches a missing district, unsourced claims and markup in content', () => {
    const bad = inputs();
    bad.generated.districts = bad.generated.districts.filter(d => d.id !== '30');
    bad.enriched['1'].landmarks[0].sources = [];
    bad.enriched['1'].landmarks[1].note = '<img src=x onerror=alert(1)>';
    const errors = validate(bad).join('\n');
    expect(errors).toMatch(/expected 64 districts/);
    expect(errors).toMatch(/Nilphamari\) missing/);
    expect(errors).toMatch(/needs at least one source/);
    expect(errors).toMatch(/markup-like text/);
  });

  it('catches bad places: missing district, wrong count, long or dashed note, wrong address, http source', () => {
    const bad = inputs();
    delete bad.places['30'];
    bad.places['2'] = bad.places['2'].slice(0, 2);
    const [first, second, third] = bad.places['1'];
    bad.places['1'][0] = { ...first, note: 'x'.repeat(141) };
    bad.places['1'][1] = { ...second, note: 'Old fort \u2014 now a museum.', address: 'Somewhere, Gazipur', category: '' };
    bad.places['1'][2] = { ...third, sources: [{ label: 'Plain', url: 'http://example.com' }] };
    bad.places['22'][0] = { ...bad.places['22'][0], address: 'Shibganj, Chapai Nawabganj' };
    const errors = validate(bad).join('\n');
    expect(errors).toMatch(/places: district 30 is missing/);
    expect(errors).toMatch(/places 2: needs 3 to 6 places, found 2/);
    expect(errors).toMatch(/places 1\[0\]: note is over 140 characters/);
    expect(errors).toMatch(/places 1\[1\]: use a hyphen/);
    expect(errors).toMatch(/places 1\[1\]: address must end with Dhaka/);
    expect(errors).toMatch(/places 1\[1\]\.category: empty text/);
    expect(errors).toMatch(/places 1\[2\]: source url must be https/);
    expect(errors).not.toMatch(/places 22/);
  });

  it('catches a place with a missing or malformed id', () => {
    const bad = inputs();
    delete bad.places['1'][0].id;
    bad.places['1'][1].id = '1-Not A Slug';
    const errors = validate(bad).join('\n');
    expect(errors).toMatch(/places 1\[0\]: id is missing or malformed.*but found undefined/);
    expect(errors).toMatch(/places 1\[1\]: id is missing or malformed.*but found "1-Not A Slug"/);
  });

  it('catches a place id that starts with another district', () => {
    const bad = inputs();
    bad.places['2'][0].id = '3-wrong-district';
    const errors = validate(bad).join('\n');
    expect(errors).toMatch(/places 2\[0\]: id 3-wrong-district must start with its district id "2-"/);
  });

  it('catches two places that share an id', () => {
    const bad = inputs();
    const shared = bad.places['1'][0].id;
    bad.places['1'][1].id = shared;
    const errors = validate(bad).join('\n');
    expect(errors).toMatch(new RegExp(`places 1\\[1\\]: id ${shared} is already used by places 1\\[0\\]`));
  });

  it('catches a place id over 64 characters, too long for a share link', () => {
    const bad = inputs();
    const long = `1-${'a'.repeat(63)}`; // well formed, 65 characters
    bad.places['1'][0].id = long;
    const errors = validate(bad).join('\n');
    expect(errors).toMatch(new RegExp(`places 1\\[0\\]: id ${long} is over 64 characters`));
  });
});
