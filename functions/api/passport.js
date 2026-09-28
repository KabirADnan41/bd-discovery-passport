import { json, readJson } from '../../server/http.js';
import { addStamps, cleanIds, nowSeconds, requireSession } from '../../server/auth.js';

// POST /api/passport { ids }: add stamps (union), safe to retry and safe across devices.
export async function onRequestPost({ request, env }) {
  const session = await requireSession(env, request);
  const ids = cleanIds((await readJson(request)).ids);
  return json({ discovered: await addStamps(env.DB, session.userId, ids) });
}

// DELETE /api/passport: clear all stamps (the "Reset passport" action).
export async function onRequestDelete({ request, env }) {
  const session = await requireSession(env, request);
  await env.DB.prepare('UPDATE passports SET discovered = ?1, updated_at = ?2 WHERE user_id = ?3')
    .bind('[]', nowSeconds(), session.userId)
    .run();
  return json({ discovered: [] });
}
