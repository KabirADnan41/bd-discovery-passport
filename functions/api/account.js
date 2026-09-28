import { clearedSessionCookie, error, json, readJson } from '../../server/http.js';
import {
  PASSWORD_KEY_RE,
  canGuess,
  clearGuessCounters,
  guessKeys,
  makeVerifier,
  nowSeconds,
  recordFailedGuess,
  requireSession,
  safeEqual,
} from '../../server/auth.js';

// DELETE /api/account { passwordKey }: permanently removes the user, their stamps, sessions and counters.
// The password check shares the sign-in guess limits, so it cannot be used as an unlimited guessing oracle.
export async function onRequestDelete({ request, env }) {
  const now = nowSeconds();
  const session = await requireSession(env, request);
  const { passwordKey } = await readJson(request);
  if (typeof passwordKey !== 'string' || !PASSWORD_KEY_RE.test(passwordKey)) return error(400, 'Invalid password data.');

  const keys = await guessKeys(env, request, session.username);
  if (!(await canGuess(env.DB, keys, now))) return error(429, 'Too many wrong passwords. Please wait 15 minutes and try again.');

  const user = await env.DB.prepare('SELECT verifier FROM users WHERE id = ?1').bind(session.userId).first();
  if (!user || !safeEqual(await makeVerifier(env.AUTH_PEPPER, passwordKey), user.verifier)) {
    await recordFailedGuess(env.DB, keys, now);
    return error(401, 'Password is incorrect.');
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(session.userId),
    env.DB.prepare('DELETE FROM passports WHERE user_id = ?1').bind(session.userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(session.userId),
    clearGuessCounters(env.DB, keys),
  ]);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedSessionCookie() } });
}
