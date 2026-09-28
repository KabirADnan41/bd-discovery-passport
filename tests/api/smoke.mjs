// End-to-end API check against `wrangler pages dev` (local D1). Usage: node tests/api/smoke.mjs [baseUrl]
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const ORIGIN = new URL(BASE).origin;
const key = () => crypto.randomBytes(32).toString('base64url');
const username = `tester_${crypto.randomBytes(3).toString('hex')}`;
const passwordKey = key();
let cookie = '';

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

console.log('API smoke test passed');
