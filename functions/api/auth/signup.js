import { error, json, readJson, sessionCookie } from '../../../server/http.js';
import { SESSION_SECONDS, createSession, housekeeping, ipBucket, makeVerifier, nowSeconds, readCredentials, withinRateLimit } from '../../../server/auth.js';

// POST /api/auth/signup { username, passwordKey }
export async function onRequestPost({ request, env }) {
  const now = nowSeconds();
  const { username, passwordKey } = readCredentials(await readJson(request));
  await housekeeping(env.DB, now);

  if (!(await withinRateLimit(env.DB, `signup:${await ipBucket(env, request)}`, 5, 60 * 60, now))) {
    return error(429, 'Too many new accounts from this network. Please try again later.');
  }

  const user = await env.DB.prepare(
    'INSERT INTO users (username, verifier, created_at) VALUES (?1, ?2, ?3) ON CONFLICT (username) DO NOTHING RETURNING id',
  )
    .bind(username, await makeVerifier(env.AUTH_PEPPER, passwordKey), now)
    .first();
  if (!user) return error(409, 'That username is taken. Please choose another.');

  const token = await createSession(env.DB, user.id, now);
  return json({ username, discovered: [] }, { status: 201, headers: { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) } });
}
