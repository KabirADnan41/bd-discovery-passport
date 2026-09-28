// Browser side of the account system. The password never leaves the browser: it is stretched
// here with PBKDF2-SHA256 (600,000 iterations, OWASP 2023) and only the derived key is sent.
// The server then stores HMAC(pepper, key). See server/auth.js for why the work is split this way.

import { USERNAME_RE, base64url, normalizeUsername } from '../../shared/credentials.js';

export const PBKDF2_ITERATIONS = 600_000;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const enc = new TextEncoder();

/** Per-username salt, so the same password gives different keys for different people. */
export async function derivePasswordKey(username, password, iterations = PBKDF2_ITERATIONS) {
  const salt = await crypto.subtle.digest('SHA-256', enc.encode(`bd-discovery-passport:v1:${normalizeUsername(username)}`));
  const material = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256);
  return base64url(bits);
}

/** Returns { field, message } for the first problem in the sign-up form, or null when it is acceptable. */
export function checkNewCredentials(username, password) {
  const u = normalizeUsername(username);
  if (!USERNAME_RE.test(u)) return { field: 'username', message: 'Usernames are 3 to 24 characters: a to z, 0 to 9, hyphen or underscore.' };
  if (password.length < PASSWORD_MIN) return { field: 'password', message: `Use at least ${PASSWORD_MIN} characters for your password.` };
  if (password.length > PASSWORD_MAX) return { field: 'password', message: `Passwords can be at most ${PASSWORD_MAX} characters.` };
  if (password.toLowerCase().includes(u)) return { field: 'password', message: 'Your password should not contain your username.' };
  return null;
}

/** fetch wrapper: never throws; returns { ok, status, data }. status 0 means the network failed. */
async function api(path, method = 'GET', body) {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const isJson = (res.headers.get('Content-Type') || '').includes('application/json');
    const data = isJson ? await res.json() : null;
    return { ok: res.ok && isJson, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export const fetchMe = () => api('/api/me');
export const signUp = (username, passwordKey) => api('/api/auth/signup', 'POST', { username: normalizeUsername(username), passwordKey });
export const logIn = (username, passwordKey) => api('/api/auth/login', 'POST', { username: normalizeUsername(username), passwordKey });
export const logOut = () => api('/api/auth/logout', 'POST', {});
export const addStamps = ids => api('/api/passport', 'POST', { ids });
export const clearStamps = () => api('/api/passport', 'DELETE', {});
export const deleteAccount = passwordKey => api('/api/account', 'DELETE', { passwordKey });

/** A readable message for a failed call. */
export const errorMessage = result =>
  result.data?.error ?? (result.status === 0 ? 'Could not reach the server. Check your connection.' : 'Something went wrong. Please try again.');
