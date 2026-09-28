import { HttpError, error } from '../../server/http.js';

// Runs before every /api/* route.
export async function onRequest(context) {
  const { request, env } = context;

  // Fail closed if the deployment is missing its database binding or secret.
  if (!env.DB || typeof env.AUTH_PEPPER !== 'string' || env.AUTH_PEPPER.length < 32) {
    return error(503, 'Accounts are not available right now.');
  }

  // CSRF defence on top of SameSite=Strict cookies: state changes must come from this origin, as JSON.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (request.headers.get('Origin') !== new URL(request.url).origin) return error(403, 'Cross-origin request refused.');
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return error(415, 'Requests must be JSON.');
  }

  try {
    return await context.next();
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message);
    console.error('api error', e);
    return error(500, 'Something went wrong. Please try again.');
  }
}
