import { error, json, readJson, sessionCookie } from '../../../server/http.js';
import {
  GUESS_WINDOW,
  SESSION_SECONDS,
  canGuess,
  createSession,
  getDiscovered,
  guessKeys,
  housekeeping,
  ipBucket,
  makeVerifier,
  nowSeconds,
  readCredentials,
  recordFailedGuess,
  safeEqual,
  withinRateLimit,
} from '../../../server/auth.js';

// POST /api/auth/login { username, passwordKey }
export async function onRequestPost({ request, env }) {
  const now = nowSeconds();
  const { username, passwordKey } = readCredentials(await readJson(request));
  await housekeeping(env.DB, now);

  // Overall request budget per network, then failed-guess limits per (username, network) and per username.
  if (!(await withinRateLimit(env.DB, `login:${await ipBucket(env, request)}`, 30, GUESS_WINDOW, now))) {
    return error(429, 'Too many sign-in attempts from this network. Please wait 15 minutes and try again.');
  }
  const keys = await guessKeys(env, request, username);
  if (!(await canGuess(env.DB, keys, now))) {
    return error(429, 'Too many wrong passwords for this account. Please wait 15 minutes and try again.');
  }

  const user = await env.DB.prepare('SELECT id, verifier FROM users WHERE username = ?1').bind(username).first();
  const verifier = await makeVerifier(env.AUTH_PEPPER, passwordKey); // computed either way, so timing reveals nothing
  if (!user || !safeEqual(verifier, user.verifier)) {
    await recordFailedGuess(env.DB, keys, now);
    return error(401, 'Username or password is incorrect. Check both and try again.');
  }

  const token = await createSession(env.DB, user.id, now);
  return json(
    { username, discovered: await getDiscovered(env.DB, user.id) },
    { headers: { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) } },
  );
}
