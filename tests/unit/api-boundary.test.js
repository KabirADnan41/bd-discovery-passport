// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { HttpError, readJson } from '../../server/http.js';
import { addStamps, getDiscovered, readCredentials } from '../../server/auth.js';
import { onRequest } from '../../functions/api/_middleware.js';
import * as account from '../../functions/api/account.js';
import * as login from '../../functions/api/auth/login.js';
import * as logout from '../../functions/api/auth/logout.js';
import * as signup from '../../functions/api/auth/signup.js';
import * as me from '../../functions/api/me.js';
import * as passport from '../../functions/api/passport.js';
import { KEY, ORIGIN, addUser, apiRequest, createDb, makeEnv } from './apiHarness.js';

describe('mutation boundary: exact Origin and JSON only', () => {
  const env = makeEnv({}); // the database is never used: the route is a stub
  const JSON_TYPE = { 'Content-Type': 'application/json' };

  /** Sends one request through the middleware; `reached` says whether the route ran. A null body sends no Content-Type either. */
  const through = async (headers, { method = 'POST', body = '{}' } = {}) => {
    const next = vi.fn(async () => new Response('route ran'));
    const res = await onRequest({ request: new Request(`${ORIGIN}/api/passport`, { method, headers, body }), env, next });
    return { status: res.status, reached: next.mock.calls.length === 1 };
  };

  it.each(['POST', 'DELETE'])('%s from this origin as JSON reaches the route', async method => {
    expect(await through({ Origin: ORIGIN, ...JSON_TYPE }, { method })).toEqual({ status: 200, reached: true });
    expect(await through({ Origin: ORIGIN, 'Content-Type': 'application/json; charset=utf-8' }, { method })).toEqual({ status: 200, reached: true });
  });

  it.each(['POST', 'DELETE'])('%s without an Origin header, with Origin "null" or from any other origin is refused with 403', async method => {
    const origins = [undefined, 'null', 'https://evil.example', 'https://x.test.evil.example', 'http://x.test', 'https://x.test:8443', 'https://x.test/'];
    for (const origin of origins) {
      const headers = { ...JSON_TYPE, ...(origin === undefined ? {} : { Origin: origin }) };
      expect(await through(headers, { method }), `Origin ${origin}`).toEqual({ status: 403, reached: false });
    }
  });

  it('refuses every content type a cross-site form can send, and a missing one, with 415', async () => {
    const types = ['text/plain', 'text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/xml'];
    for (const type of types) {
      expect(await through({ Origin: ORIGIN, 'Content-Type': type }), type).toEqual({ status: 415, reached: false });
    }
    expect(await through({ Origin: ORIGIN }, { body: null })).toEqual({ status: 415, reached: false });
  });

  it('checks the Origin before the content type', async () => {
    expect((await through({ Origin: 'https://evil.example', 'Content-Type': 'text/plain' })).status).toBe(403);
  });
});

describe('GET cannot change state', () => {
  it('only /api/me answers GET, and no route answers every method', () => {
    const routes = { account, login, logout, me, passport, signup };
    const handlers = Object.fromEntries(Object.entries(routes).map(([name, mod]) => [name, Object.keys(mod).filter(k => k.startsWith('onRequest')).sort()]));
    expect(handlers).toEqual({
      account: ['onRequestDelete'],
      login: ['onRequestPost'],
      logout: ['onRequestPost'],
      me: ['onRequestGet'],
      passport: ['onRequestDelete', 'onRequestPost'],
      signup: ['onRequestPost'],
    });
  });

  it('GET /api/me reads the passport and writes nothing', async () => {
    const db = createDb();
    const user = await addUser(db, 'amina');
    await addStamps(db, user.id, ['1', '2']);
    const [writes, calls] = [db.writes(), { ...db.calls }];
    const res = await me.onRequestGet({ request: apiRequest('GET', '/api/me', undefined, { Cookie: user.cookie }), env: makeEnv(db) });
    expect(await res.json()).toEqual({ signedIn: true, username: 'amina', discovered: ['1', '2'] });
    expect(db.writes()).toBe(writes);
    expect(db.calls).toEqual(calls);
  });
});

describe('readJson', () => {
  const MAX = 2048; // the default cap
  const request = (body, headers = {}) => new Request(`${ORIGIN}/api/x`, { method: 'POST', headers, body });
  const padded = length => `{"pad":"${'x'.repeat(length - 10)}"}`; // JSON text of exactly `length` characters
  const streamOf = text =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  /** The HttpError a read is refused with. */
  const refusal = async pending => {
    const e = await pending.catch(err => err);
    expect(e).toBeInstanceOf(HttpError);
    return e;
  };

  it('refuses a Content-Length over the cap with 413 without reading the body', async () => {
    const big = request('{}', { 'Content-Length': String(MAX + 1) });
    const read = vi.spyOn(big, 'text');
    expect((await refusal(readJson(big))).status).toBe(413);
    expect(read).not.toHaveBeenCalled();
    expect(big.bodyUsed).toBe(false);
  });

  it('refuses a body over the cap with 413 even when no Content-Length is sent', async () => {
    const plain = request(padded(MAX + 1));
    expect(plain.headers.get('Content-Length')).toBeNull();
    expect((await refusal(readJson(plain))).status).toBe(413);

    const streamed = new Request(`${ORIGIN}/api/x`, { method: 'POST', body: streamOf(padded(MAX + 1)), duplex: 'half' });
    expect(streamed.headers.get('Content-Length')).toBeNull();
    expect((await refusal(readJson(streamed))).status).toBe(413);
  });

  it('takes a body of exactly the cap, with or without Content-Length', async () => {
    expect(Object.keys(await readJson(request(padded(MAX))))).toEqual(['pad']);
    expect(Object.keys(await readJson(request(padded(MAX), { 'Content-Length': String(MAX) })))).toEqual(['pad']);
  });

  it.each([['an array', '[]'], ['a string', '"x"'], ['null', 'null'], ['a number', '42'], ['a boolean', 'true'], ['broken JSON', '{bad json']])(
    'refuses %s with 400',
    async (_, text) => {
      const e = await refusal(readJson(request(text)));
      expect(e).toMatchObject({ status: 400, message: 'Invalid request body.' });
    },
  );

  it('hands over a normal object whole, and callers use only the fields they name', async () => {
    const body = await readJson(request(JSON.stringify({ username: ' Amina ', passwordKey: KEY, role: 'admin', userId: 1, verifier: 'x' })));
    expect(body.role).toBe('admin'); // readJson parses, it does not filter
    expect(readCredentials(body)).toEqual({ username: 'amina', passwordKey: KEY });
  });
});

describe('account data follows the session, not the request', () => {
  it('writes the passport of the signed-in user whatever the body names', async () => {
    const db = createDb();
    const env = makeEnv(db);
    const amina = await addUser(db, 'amina');
    const rahim = await addUser(db, 'rahim');
    await addStamps(db, rahim.id, ['7']);

    const named = { userId: rahim.id, user_id: rahim.id, username: 'rahim', passwordKey: rahim.key };
    const added = await passport.onRequestPost({ request: apiRequest('POST', '/api/passport', { ids: ['20'], ...named }, { Cookie: amina.cookie }), env });
    expect(await added.json()).toEqual({ discovered: ['20'] });
    expect(await getDiscovered(db, amina.id)).toEqual(['20']);
    expect(await getDiscovered(db, rahim.id)).toEqual(['7']);

    await passport.onRequestDelete({ request: apiRequest('DELETE', '/api/passport', named, { Cookie: amina.cookie }), env });
    expect(await getDiscovered(db, amina.id)).toEqual([]);
    expect(await getDiscovered(db, rahim.id)).toEqual(['7']);
  });

  it('cannot delete another account by naming it or by knowing its password key', async () => {
    const db = createDb();
    const amina = await addUser(db, 'amina');
    const rahim = await addUser(db, 'rahim', { key: 'R'.repeat(43) });
    const body = { username: 'rahim', userId: rahim.id, passwordKey: rahim.key };
    const res = await account.onRequestDelete({ request: apiRequest('DELETE', '/api/account', body, { Cookie: amina.cookie }), env: makeEnv(db) });
    expect(res.status).toBe(401); // checked against amina's password, the session's user
    expect(db.rows('users').map(u => u.username).sort()).toEqual(['amina', 'rahim']);
  });
});
