import { json } from '../../server/http.js';
import { getDiscovered, getSession } from '../../server/auth.js';

// GET /api/me: who is signed in. Being a guest is a normal state, so it is a 200, not an error.
export async function onRequestGet({ request, env }) {
  const session = await getSession(env, request);
  if (!session) return json({ signedIn: false });
  return json({ signedIn: true, username: session.username, discovered: await getDiscovered(env.DB, session.userId) });
}
