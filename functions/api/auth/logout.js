import { clearedSessionCookie, json } from '../../../server/http.js';
import { getSession } from '../../../server/auth.js';

// POST /api/auth/logout: ends this session only.
export async function onRequestPost({ request, env }) {
  const session = await getSession(env, request);
  if (session) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(session.tokenHash).run();
  return json({ ok: true }, { headers: { 'Set-Cookie': clearedSessionCookie() } });
}
