// End-to-end API check against `wrangler pages dev` (local D1). Usage: node tests/api/smoke.mjs [baseUrl]
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const ORIGIN = new URL(BASE).origin;
const key = () => crypto.randomBytes(32).toString('base64url');
const username = `tester_${crypto.randomBytes(3).toString('hex')}`;
const passwordKey = key();
let cookie = '';
const bodies = []; // every JSON response body seen, checked for secrets at the end

async function call(path, { method = 'GET', body, headers = {}, useCookie = true } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: ORIGIN } : {}),
      ...(useCookie && cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0].endsWith('=') ? '' : setCookie.split(';')[0];
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (data) bodies.push(JSON.stringify(data));
  return { status: res.status, data, setCookie, headers: res.headers };
}

const check = (name, cond) => {
  assert.ok(cond, name);
  console.log(`  ok  ${name}`);
};

let r = await call('/api/me');
check('guest /api/me is 200 signedIn:false', r.status === 200 && r.data.signedIn === false);
check('API responses are no-store', r.headers.get('cache-control') === 'no-store');

r = await call('/api/auth/signup', { method: 'POST', body: { username: 'ab', passwordKey } });
check('short username rejected', r.status === 400);
r = await call('/api/auth/signup', { method: 'POST', body: { username, passwordKey: 'not-a-key' } });
check('malformed password key rejected', r.status === 400);

r = await call('/api/auth/signup', { method: 'POST', body: { username: username.toUpperCase(), passwordKey } });
check('signup 201', r.status === 201 && r.data.username === username);
check('session cookie is __Host-, HttpOnly, Secure, SameSite=Strict', /^__Host-bdp_session=[\w-]{43}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=\d+$/.test(r.setCookie));

r = await call('/api/auth/signup', { method: 'POST', body: { username, passwordKey: key() } });
check('duplicate username 409', r.status === 409);

r = await call('/api/me');
check('/api/me returns the user', r.status === 200 && r.data.username === username && r.data.discovered.length === 0);

r = await call('/api/passport', { method: 'POST', body: { ids: ['54', '1', '54'] } });
check('add stamps dedupes and keeps order', JSON.stringify(r.data.discovered) === '["54","1"]');
r = await call('/api/passport', { method: 'POST', body: { ids: ['1', '45'] } });
check('add is a union', JSON.stringify(r.data.discovered) === '["54","1","45"]');
r = await call('/api/passport', { method: 'POST', body: { ids: ['65'] } });
check('unknown district id rejected', r.status === 400);
r = await call('/api/passport', { method: 'POST', body: { ids: ['<script>'] } });
check('markup id rejected', r.status === 400);

// CSRF defences
r = await call('/api/passport', { method: 'POST', body: { ids: ['2'] }, headers: { Origin: 'https://evil.example' } });
check('cross-origin POST refused (403)', r.status === 403);
r = await call('/api/passport', { method: 'DELETE', body: {}, headers: { 'Content-Type': 'text/plain' } });
check('non-JSON state change refused (415)', r.status === 415);

const sessionCookie = cookie;
r = await call('/api/auth/logout', { method: 'POST', body: {} });
check('logout clears cookie', r.status === 200 && /Max-Age=0/.test(r.setCookie));
cookie = sessionCookie;
r = await call('/api/me');
check('old session token no longer works', r.data.signedIn === false);
cookie = '';

r = await call('/api/auth/login', { method: 'POST', body: { username, passwordKey: key() } });
check('wrong password 401', r.status === 401 && r.data.error.startsWith('Username or password is incorrect.'));
r = await call('/api/auth/login', { method: 'POST', body: { username: 'nobody_here', passwordKey } });
check('unknown user gives the same message', r.status === 401 && r.data.error.startsWith('Username or password is incorrect.'));
r = await call('/api/auth/login', { method: 'POST', body: { username, passwordKey } });
check('login restores stamps', r.status === 200 && JSON.stringify(r.data.discovered) === '["54","1","45"]');

r = await call('/api/passport', { method: 'DELETE', body: {} });
check('reset passport', r.status === 200 && r.data.discovered.length === 0);

r = await call('/api/account', { method: 'DELETE', body: { passwordKey: key() } });
check('account delete needs the right password', r.status === 401);
r = await call('/api/account', { method: 'DELETE', body: { passwordKey } });
check('account deleted', r.status === 200);
r = await call('/api/auth/login', { method: 'POST', body: { username, passwordKey } });
check('deleted account cannot sign in', r.status === 401);

// Rate limit: 10 attempts per username per 15 minutes (the attempts above already count).
let limited = false;
for (let i = 0; i < 12 && !limited; i++) {
  r = await call('/api/auth/login', { method: 'POST', body: { username, passwordKey: key() } });
  limited = r.status === 429;
}
check('failed guesses are rate limited (429)', limited);

// A correct password never counts against the limit, so the owner is not locked out by their own sign-ins.
const owner = `owner_${crypto.randomBytes(3).toString('hex')}`;
const ownerKey = key();
cookie = '';
r = await call('/api/auth/signup', { method: 'POST', body: { username: owner, passwordKey: ownerKey } });
check('owner signup 201', r.status === 201);
let okCount = 0;
for (let i = 0; i < 12; i++) {
  cookie = '';
  r = await call('/api/auth/login', { method: 'POST', body: { username: owner, passwordKey: ownerKey } });
  if (r.status === 200) okCount++;
}
check('successful sign-ins are never limited per user', okCount === 12);
r = await call('/api/me');
check('the newest session survives the 10-session cap (same-second sign-ins)', r.data.signedIn === true);
r = await call('/api/auth/signup', { method: 'POST', body: { username: 'x'.repeat(4000), passwordKey: key() } });
check('oversized request body refused (413)', r.status === 413);
r = await call('/api/account', { method: 'DELETE', body: { passwordKey: ownerKey } });
check('cleanup: owner account deleted', r.status === 200);

// --- Identity comes from the session, GET changes nothing, sessions end and are capped, bodies hold no secrets.
// This part runs from its own network: local dev honours a client-sent CF-Connecting-IP, so the sign-up and sign-in
// budgets spent above stay out of its way. Cloudflare sets that header itself when deployed.
const NET = { 'CF-Connecting-IP': `198.51.100.${1 + Math.floor(Math.random() * 250)}` };
const fromNet = (path, opts = {}) => call(path, { ...opts, useCookie: false, headers: { ...NET, ...opts.headers } });
const as = (session, path, opts = {}) => fromNet(path, { ...opts, headers: { Cookie: session, ...opts.headers } });
const sessionFrom = res => res.setCookie.split(';')[0];
const stamps = res => JSON.stringify(res.data.discovered);

// Account data follows the session, not the request.
const nameA = `acct_a_${crypto.randomBytes(3).toString('hex')}`;
const nameB = `acct_b_${crypto.randomBytes(3).toString('hex')}`;
const keyA = key();
const keyB = key();
r = await fromNet('/api/auth/signup', { method: 'POST', body: { username: nameA, passwordKey: keyA } });
check('account A signed up', r.status === 201);
const sessionA = sessionFrom(r);
r = await fromNet('/api/auth/signup', { method: 'POST', body: { username: nameB, passwordKey: keyB } });
check('account B signed up', r.status === 201);
const sessionB = sessionFrom(r);

r = await as(sessionB, '/api/passport', { method: 'POST', body: { ids: ['10'] } });
check('B starts with stamp 10', stamps(r) === '["10"]');
// B's internal id is not visible to clients, so A names every small id an attacker would try, and B by name.
let followsSession = true;
for (let id = 1; id <= 8; id++) {
  r = await as(sessionA, '/api/passport', { method: 'POST', body: { ids: ['20', '21'], userId: id, user_id: id, username: nameB, passwordKey: keyB } });
  followsSession &&= r.status === 200 && stamps(r) === '["20","21"]';
}
check('stamps go to the signed-in account, whatever the body names', followsSession);
r = await as(sessionB, '/api/me');
check("B's passport is untouched by A's request", stamps(r) === '["10"]');
r = await as(sessionA, '/api/passport', { method: 'DELETE', body: { username: nameB, userId: 1 } });
check("a reset clears only the signed-in account's stamps", r.status === 200 && r.data.discovered.length === 0);
r = await as(sessionB, '/api/me');
check("B's stamps survive A's reset", stamps(r) === '["10"]');
r = await as(sessionA, '/api/account', { method: 'DELETE', body: { username: nameB, passwordKey: keyB } });
check("B's password cannot delete B through A's session (401)", r.status === 401);
r = await as(sessionB, '/api/me');
check('B is still there after that attempt', r.data.signedIn === true && r.data.username === nameB);

// GET cannot change state: without a GET handler the route falls through to the static site (HTML), and nothing happens.
r = await as(sessionA, '/api/passport', { method: 'POST', body: { ids: ['30'] } });
check('A has stamp 30', stamps(r) === '["30"]');
const getTries = [
  ['/api/passport', '/api/passport'],
  ['/api/passport with ids in the query', '/api/passport?ids=31'],
  ['/api/account', '/api/account'],
  ['/api/account with the password key in the query', `/api/account?passwordKey=${keyA}`],
];
for (const [label, path] of getTries) {
  r = await as(sessionA, path);
  check(`GET ${label} is not an API operation`, r.data === null || r.status >= 400);
}
r = await as(sessionA, '/api/me');
check('after those GETs the account and its stamps are unchanged', r.data.signedIn === true && stamps(r) === '["30"]');

// Deleting an account ends its other sessions too.
r = await fromNet('/api/auth/login', { method: 'POST', body: { username: nameB, passwordKey: keyB } });
const deviceOne = sessionFrom(r);
r = await fromNet('/api/auth/login', { method: 'POST', body: { username: nameB, passwordKey: keyB } });
const deviceTwo = sessionFrom(r);
r = await as(deviceTwo, '/api/me');
check('B is signed in on two devices', r.data.signedIn === true);
r = await as(deviceOne, '/api/account', { method: 'DELETE', body: { passwordKey: keyB } });
check('B deletes the account from the first device', r.status === 200);
r = await as(deviceTwo, '/api/me');
check("the other device's session ended with the account", r.data.signedIn === false);

// The session cap evicts the oldest session: A has its sign-up session plus 11 sign-ins, and 10 may stay.
const devices = [];
for (let i = 0; i < 11; i++) {
  r = await fromNet('/api/auth/login', { method: 'POST', body: { username: nameA, passwordKey: keyA } });
  devices.push(sessionFrom(r));
}
r = await as(devices[0], '/api/me');
check('the oldest of 11 sign-ins no longer works', r.data.signedIn === false);
r = await as(devices[10], '/api/me');
check('the newest sign-in works', r.data.signedIn === true && r.data.username === nameA);
let alive = 0;
for (const s of [sessionA, ...devices]) alive += (await as(s, '/api/me')).data.signedIn ? 1 : 0;
check('exactly 10 of the 12 sessions are left', alive === 10);
r = await as(devices[10], '/api/account', { method: 'DELETE', body: { passwordKey: keyA } });
check('cleanup: account A deleted', r.status === 200);

// No JSON response carries a password key or a verifier. A verifier is an HMAC-SHA256 value, 43 base64url characters
// like a password key, so a leaked one shows by its shape as well as by the word "verifier".
const knownKeys = [passwordKey, ownerKey, keyA, keyB];
const leaks = bodies.filter(b => /verifier/i.test(b) || /[A-Za-z0-9_-]{43}/.test(b) || knownKeys.some(k => b.includes(k)));
check(`none of ${bodies.length} JSON response bodies carries a password key or verifier`, bodies.length > 40 && leaks.length === 0);

console.log('API smoke test passed');
