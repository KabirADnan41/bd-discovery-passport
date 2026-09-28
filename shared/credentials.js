// Shared by the browser (src/lib/authClient.js) and the Pages Functions (server/auth.js), so both
// sides always agree on what a valid username is and how derived keys are encoded.

export const USERNAME_RE = /^[a-z0-9_-]{3,24}$/;

export const normalizeUsername = u => (typeof u === 'string' ? u.trim().toLowerCase() : '');

export function base64url(buffer) {
  let s = '';
  for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
