// Small HTTP helpers shared by the Pages Functions in functions/api.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

export const error = (status, message) => json({ error: message }, { status });

/** Parse a small JSON body. Bodies are tiny here, so anything large is refused. */
export async function readJson(request, maxBytes = 2048) {
  // Refuse oversized bodies before reading them into memory.
  if (Number(request.headers.get('Content-Length') || 0) > maxBytes) throw new HttpError(413, 'Request too large.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large.');
  try {
    const body = JSON.parse(text || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return body;
  } catch {
    throw new HttpError(400, 'Invalid request body.');
  }
}

/** Rate-limit key for a client address: an IPv6 address becomes its /64 (one subscriber's block), IPv4 stays as it is. */
export function ipNetwork(ip) {
  if (!ip?.includes(':') || ip.includes('.')) return ip;
  const [head, tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const hextets = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return hextets.slice(0, 4).map(h => parseInt(h, 16).toString(16)).join(':');
}

// __Host- prefix: the browser only accepts it with Secure, Path=/ and no Domain (no subdomain can set it).
export const SESSION_COOKIE = '__Host-bdp_session';

export const sessionCookie = (token, maxAgeSeconds) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;

export const clearedSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}
