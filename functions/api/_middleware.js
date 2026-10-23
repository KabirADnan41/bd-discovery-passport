import { HttpError, error, ipNetwork, json } from '../../server/http.js';

// Per-IP pre-filter, local to this isolate: a cheap first line that turns a single-IP flood away before
// any D1 work. Each isolate counts on its own, so the D1 limits in server/auth.js stay the real limits.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const MAX_TRACKED_IPS = 5_000;
const recent = new Map(); // network -> { n, t }: requests seen since window start t

function tooManyFrom(ip) {
  // Local dev (wrangler pages dev sends the loopback address) and the test suites are not throttled.
  if (!ip || ip === '127.0.0.1' || ip === '::1') return false;
  const now = Date.now();
  const key = ipNetwork(ip);
  const seen = recent.get(key);
  const fresh = !seen || now - seen.t >= WINDOW_MS;
  if (fresh && recent.size >= MAX_TRACKED_IPS) recent.clear();
  const entry = fresh ? { n: 1, t: now } : { n: seen.n + 1, t: seen.t };
  recent.set(key, entry);
  return entry.n > MAX_PER_WINDOW;
}

// Runs before every /api/* route.
export async function onRequest(context) {
  const { request, env } = context;

  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: 'GET, POST, DELETE' } });
  }
  // Only state changes are counted: GET /api/me runs on every page load, and many users can share one IP (carrier-grade NAT).
  if (request.method !== 'GET' && tooManyFrom(request.headers.get('CF-Connecting-IP'))) return error(429, 'Too many requests. Please slow down.');

  // Fail closed if the deployment is missing its database binding or secret.
  if (!env.DB || typeof env.AUTH_PEPPER !== 'string' || env.AUTH_PEPPER.length < 32) {
    return error(503, 'Accounts are not available right now.');
  }

  // CSRF defence on top of SameSite=Strict cookies: state changes must come from this origin, as JSON.
  if (request.method !== 'GET') {
    if (request.headers.get('Origin') !== new URL(request.url).origin) return error(403, 'Cross-origin request refused.');
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return error(415, 'Requests must be JSON.');
  }

  try {
    return await context.next();
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message);
    // One short JSON line, never the error object: D1 errors carry SQLite text in `cause`. No body, cookie, token, key or IP.
    console.error(
      JSON.stringify({
        event: 'api_error',
        method: request.method,
        route: new URL(request.url).pathname,
        error: e?.name ?? null,
        // quoted parts can echo values (a D1 type error quotes the bound value, a JSON error a piece of its input)
        message: String(e?.message ?? '')
          .replace(/'[^']*'|"[^"]*"/g, quoted => `${quoted[0]}…${quoted[0]}`)
          .slice(0, 200),
        ray: request.headers.get('cf-ray'),
      }),
    );
    return error(500, 'Something went wrong. Please try again.');
  }
}
