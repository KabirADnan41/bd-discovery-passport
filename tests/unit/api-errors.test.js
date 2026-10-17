// @vitest-environment node
import { inspect } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../server/http.js';
import { onRequest } from '../../functions/api/_middleware.js';

const ORIGIN = 'https://x.test';
const SECRET = 'SECRET-9f3a1c'; // stands for anything that must never reach a log line
const GENERIC_500 = { error: 'Something went wrong. Please try again.' };
const env = { DB: {}, AUTH_PEPPER: 'p'.repeat(32) };

const post = (url = `${ORIGIN}/api/passport`, headers = {}) =>
  new Request(url, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers }, body: '{}' });

const run = (next, request = post(), context = env) => onRequest({ request, env: context, next });

describe('unexpected API errors', () => {
  let log;
  beforeEach(() => {
    log = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  // Everything the logger was given, including hidden and nested properties such as `cause`.
  const logged = () => inspect(log.mock.calls, { depth: null, showHidden: true });
  // A D1-style failure: SQL text in `cause`, more detail in an extra property.
  const d1Failure = () =>
    Object.assign(new RangeError('query failed', { cause: new Error(`SQLITE_ERROR ${SECRET}`) }), { sql: `SELECT ${SECRET}`, params: [SECRET] });
  const oneLine = () => {
    expect(log).toHaveBeenCalledTimes(1);
    const [line, ...rest] = log.mock.calls[0];
    expect(rest).toEqual([]);
    expect(typeof line).toBe('string');
    return JSON.parse(line);
  };

  it('answers with the generic 500 and logs one JSON line without the cause, the extra properties or any request data', async () => {
    const request = post(`${ORIGIN}/api/passport?token=${SECRET}`, {
      'cf-ray': '8a1b2c3d4e5f6a7b-DAC',
      Cookie: `__Host-bdp_session=${SECRET}`,
      Authorization: `Bearer ${SECRET}`,
      'CF-Connecting-IP': '203.0.113.9',
    });
    const res = await run(() => {
      throw d1Failure();
    }, request);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(GENERIC_500);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(log).toHaveBeenCalledTimes(1);
    expect(logged()).not.toContain(SECRET);
    expect(logged()).not.toContain('203.0.113.9');
    expect(oneLine()).toEqual({ event: 'api_error', method: 'POST', route: '/api/passport', error: 'RangeError', message: 'query failed', ray: '8a1b2c3d4e5f6a7b-DAC' });
  });

  it('blanks quoted values in the message: a D1 type error quotes the bound value, a JSON error a piece of its input', async () => {
    await run(() => {
      throw new TypeError(`D1_TYPE_ERROR: Type 'object' not supported for value '${SECRET}'`);
    });
    expect(oneLine().message).toBe("D1_TYPE_ERROR: Type '…' not supported for value '…'");
    log.mockClear();
    await run(() => {
      throw new SyntaxError(`Unexpected token 'p', "${SECRET}" is not valid JSON`);
    });
    expect(oneLine().message).toBe(`Unexpected token '…', "…" is not valid JSON`);
    expect(logged()).not.toContain(SECRET);
  });

  it('cuts the message at 200 characters', async () => {
    await run(() => {
      throw new Error('x'.repeat(500));
    });
    expect(oneLine().message).toBe('x'.repeat(200));
  });

  it('records no ray id when Cloudflare sent none', async () => {
    await run(() => {
      throw new Error('boom');
    });
    expect(oneLine().ray).toBeNull();
  });

  it.each([['a string', 'plain text'], ['null', null], ['undefined', undefined]])('survives a thrown %s and still answers 500', async (_, thrown) => {
    const res = await run(() => {
      throw thrown;
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(GENERIC_500);
    expect(oneLine()).toMatchObject({ event: 'api_error', route: '/api/passport', error: null, message: '' });
  });

  it('maps an HttpError to its status and message and logs nothing', async () => {
    const res = await run(() => {
      throw new HttpError(401, 'Please sign in again.');
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Please sign in again.' });
    expect(log).not.toHaveBeenCalled();
  });
});

describe('fail closed when the deployment is incomplete', () => {
  afterEach(() => vi.restoreAllMocks());

  const incomplete = [
    ['no database binding', { AUTH_PEPPER: 'p'.repeat(32) }],
    ['no pepper', { DB: {} }],
    ['a pepper of 31 characters', { DB: {}, AUTH_PEPPER: 'p'.repeat(31) }],
    ['a pepper that is not a string', { DB: {}, AUTH_PEPPER: 42 }],
  ];

  it.each(incomplete)('answers 503 before any route runs with %s', async (_, context) => {
    const next = vi.fn(async () => new Response('route ran'));
    for (const request of [post(), new Request(`${ORIGIN}/api/me`)]) {
      const res = await run(next, request, context);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'Accounts are not available right now.' });
    }
    expect(next).not.toHaveBeenCalled();
  });

  it('lets a complete deployment through', async () => {
    const next = vi.fn(async () => new Response('route ran'));
    expect(await (await run(next)).text()).toBe('route ran');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
