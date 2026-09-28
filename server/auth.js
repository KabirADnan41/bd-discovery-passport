// Account logic for Cloudflare Pages Functions (Workers runtime, Web Crypto only).
//
// Password handling ("server relief"): the browser stretches the password with PBKDF2-SHA256,
// 600,000 iterations, salted per username (src/lib/authClient.js). The server stores only
// HMAC-SHA256(AUTH_PEPPER, key). Heavy stretching cannot run on the server because the
// Workers free plan allows 10 ms of CPU per request and caps PBKDF2 at 100,000 iterations.
import { HttpError, SESSION_COOKIE, readCookie } from './http.js';
import { USERNAME_RE, base64url, normalizeUsername } from '../shared/credentials.js';

const enc = new TextEncoder();

export const PASSWORD_KEY_RE = /^[A-Za-z0-9_-]{43}$/; // base64url of 32 bytes
export const DISTRICT_ID_RE = /^(?:[1-9]|[1-5][0-9]|6[0-4])$/; // ids 1..64 from bd-districts.json
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

export const sha256 = async text => base64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));

/** Constant-time comparison of two strings of equal expected length. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const makeVerifier = (pepper, passwordKey) => hmac(pepper, `verifier:v1:${passwordKey}`);

/** Keep only valid district ids, as strings, without duplicates, in their given order. */
export function cleanIds(list) {
  if (!Array.isArray(list) || list.length > 64) throw new HttpError(400, 'Invalid district list.');
  const out = [];
  for (const id of list) {
    const s = typeof id === 'number' ? String(id) : id;
    if (typeof s !== 'string' || !DISTRICT_ID_RE.test(s)) throw new HttpError(400, 'Invalid district id.');
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export function readCredentials(body) {
  const username = normalizeUsername(body.username);
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Usernames are 3 to 24 characters: a to z, 0 to 9, hyphen or underscore.');
  if (typeof body.passwordKey !== 'string' || !PASSWORD_KEY_RE.test(body.passwordKey)) throw new HttpError(400, 'Invalid password data.');
  return { username, passwordKey: body.passwordKey };
}

/** Bucket for per-network limits: an HMAC of the client IP, so raw IPs are never stored. */
export const ipBucket = (env, request) => hmac(env.AUTH_PEPPER, `ip:${request.headers.get('CF-Connecting-IP') || 'local'}`);

/** One fixed-window counter increment (a new window starts once the old one has expired). */
const countAttempt = (db, key, windowSeconds, now) =>
  db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start <= ?3 THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start <= ?3 THEN ?2 ELSE rate_limits.window_start END
       RETURNING count`,
    )
    .bind(key, now, now - windowSeconds);

/** Counts this attempt and returns true while the caller is within `limit` attempts per window. */
export async function withinRateLimit(db, key, limit, windowSeconds, now = nowSeconds()) {
  const row = await countAttempt(db, key, windowSeconds, now).first();
  return row.count <= limit;
}

/**
 * Password-guess limits shared by sign-in and account deletion. Only FAILED guesses count, keyed per
 * (username, network): a flood from one network cannot lock the owner out from another, while the
 * per-username cap still stops guessing spread across many networks. Usernames are stored only as HMACs.
 */
export const GUESS_WINDOW = 15 * 60;
const GUESSES_PER_USER_NETWORK = 10;
const GUESSES_PER_USER = 100;

export async function guessKeys(env, request, username) {
  const user = await hmac(env.AUTH_PEPPER, `user:${username}`);
  return { user: `fail:${user}`, pair: `fail:${user}:${await ipBucket(env, request)}` };
}

/** Read-only check (one query for both counters): true while another guess is allowed. */
export async function canGuess(db, keys, now = nowSeconds()) {
  const { results } = await db
    .prepare('SELECT key, count FROM rate_limits WHERE key IN (?1, ?2) AND window_start > ?3')
    .bind(keys.pair, keys.user, now - GUESS_WINDOW)
    .all();
  const count = key => results.find(r => r.key === key)?.count ?? 0;
  return count(keys.pair) < GUESSES_PER_USER_NETWORK && count(keys.user) < GUESSES_PER_USER;
}

export const recordFailedGuess = (db, keys, now = nowSeconds()) =>
  db.batch([countAttempt(db, keys.pair, GUESS_WINDOW, now), countAttempt(db, keys.user, GUESS_WINDOW, now)]);

/** Statement that removes every guess counter of one user (used when the account is deleted). */
export const clearGuessCounters = (db, keys) =>
  // exact prefix match: base64url HMACs contain '_', which LIKE would treat as a wildcard
  db.prepare('DELETE FROM rate_limits WHERE key = ?1 OR substr(key, 1, length(?2)) = ?2').bind(keys.user, `${keys.user}:`);

/** Small site, so housekeeping piggybacks on sign-in and sign-up requests instead of a scheduled job. */
export const housekeeping = (db, now = nowSeconds()) =>
  db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(now),
    db.prepare('DELETE FROM rate_limits WHERE window_start <= ?1').bind(now - 24 * 60 * 60),
  ]);

export const MAX_SESSIONS_PER_USER = 10;

export async function createSession(db, userId, now = nowSeconds()) {
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  await db.batch([
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)').bind(await sha256(token), userId, now + SESSION_SECONDS),
    // Keep only the newest sessions per user (by insertion order; expiry times tie within one second),
    // so repeated sign-ins cannot grow the database without bound.
    db
      .prepare(
        `DELETE FROM sessions WHERE user_id = ?1 AND token_hash NOT IN (
           SELECT token_hash FROM sessions WHERE user_id = ?1 ORDER BY rowid DESC LIMIT ?2)`,
      )
      .bind(userId, MAX_SESSIONS_PER_USER),
  ]);
  return token;
}

/** The signed-in user for this request, or null. */
export async function getSession(env, request, now = nowSeconds()) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT u.id AS userId, u.username AS username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
  )
    .bind(tokenHash, now)
    .first();
  return row ? { ...row, tokenHash } : null;
}

export async function requireSession(env, request) {
  const session = await getSession(env, request);
  if (!session) throw new HttpError(401, 'Please sign in again.');
  return session;
}

export async function getDiscovered(db, userId) {
  const row = await db.prepare('SELECT discovered FROM passports WHERE user_id = ?1').bind(userId).first();
  return row ? JSON.parse(row.discovered) : [];
}

/** Add ids to a passport in one statement (keeps discovery order, no duplicates, no lost updates). */
export async function addStamps(db, userId, ids, now = nowSeconds()) {
  const row = await db
    .prepare(
      `INSERT INTO passports (user_id, discovered, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (user_id) DO UPDATE SET
         discovered = (
           SELECT json_group_array(value) FROM (
             SELECT value FROM json_each(passports.discovered)
             UNION ALL
             SELECT value FROM json_each(excluded.discovered)
             WHERE value NOT IN (SELECT value FROM json_each(passports.discovered))
           )
         ),
         updated_at = excluded.updated_at
       RETURNING discovered`,
    )
    .bind(userId, JSON.stringify(ids), now)
    .first();
  return JSON.parse(row.discovered);
}
