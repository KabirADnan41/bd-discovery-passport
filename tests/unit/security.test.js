// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HttpError, readCookie, sessionCookie } from '../../server/http.js';
import { cleanIds, makeVerifier, readCredentials, safeEqual, withinRateLimit } from '../../server/auth.js';
import { checkNewCredentials, derivePasswordKey } from '../../src/lib/authClient.js';
import { validate } from '../../scripts/validate-map-data.mjs';

const json = p => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));

describe('server auth helpers', () => {
  it('safeEqual compares exactly and rejects length or type mismatches', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', undefined)).toBe(false);
  });

  it('verifier is deterministic per pepper and changes with it', async () => {
    const key = 'A'.repeat(43);
    expect(await makeVerifier('p'.repeat(32), key)).toBe(await makeVerifier('p'.repeat(32), key));
    expect(await makeVerifier('q'.repeat(32), key)).not.toBe(await makeVerifier('p'.repeat(32), key));
  });

  it('cleanIds accepts 1..64 only and dedupes', () => {
    expect(cleanIds(['1', 54, '54', '64'])).toEqual(['1', '54', '64']);
    for (const bad of [['0'], ['65'], ['01'], ['<b>'], [null], 'nope', Array(65).fill('1')]) {
      expect(() => cleanIds(bad)).toThrow(HttpError);
    }
  });

  it('readCredentials normalises usernames and validates the key shape', () => {
    expect(readCredentials({ username: '  Amina_1 ', passwordKey: 'x'.repeat(43) }).username).toBe('amina_1');
    expect(() => readCredentials({ username: 'a', passwordKey: 'x'.repeat(43) })).toThrow(HttpError);
    expect(() => readCredentials({ username: 'amina', passwordKey: 'short' })).toThrow(HttpError);
    expect(() => readCredentials({ username: 'bad name!', passwordKey: 'x'.repeat(43) })).toThrow(HttpError);
  });

  it('session cookie is __Host-, HttpOnly, Secure, SameSite=Strict and parsable', () => {
    const header = sessionCookie('t'.repeat(43), 60);
    expect(header).toMatch(/^__Host-bdp_session=t{43}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=60$/);
    const req = new Request('https://x.test/', { headers: { Cookie: `other=1; ${header.split(';')[0]}` } });
    expect(readCookie(req, '__Host-bdp_session')).toBe('t'.repeat(43));
  });

  it('rate limit query binds the key, now and window start', async () => {
    let bound;
    const db = { prepare: () => ({ bind: (...args) => ((bound = args), { first: async () => ({ count: 11 }) }) }) };
    expect(await withinRateLimit(db, 'login:user:x', 10, 900, 1000)).toBe(false);
    expect(bound).toEqual(['login:user:x', 1000, 100]);
  });
});

describe('browser password stretching', () => {
  it('derives a 32-byte base64url key, salted per (case-insensitive) username', async () => {
    const a = await derivePasswordKey('Amina', 'correct horse battery', 1000);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await derivePasswordKey('amina', 'correct horse battery', 1000)).toBe(a);
    expect(await derivePasswordKey('rahim', 'correct horse battery', 1000)).not.toBe(a);
  });

  it('sign-up rules point at the field that needs fixing', () => {
    expect(checkNewCredentials('ab', 'long-enough-pass')?.field).toBe('username');
    expect(checkNewCredentials('amina', 'short')?.field).toBe('password');
    expect(checkNewCredentials('amina', 'amina-is-me-123')?.field).toBe('password');
    expect(checkNewCredentials('amina', 'river-padma-2026')).toBeNull();
  });
});

describe('map data validator', () => {
  const inputs = () => ({
    generated: json('src/generated/districtPaths.generated.json'),
    enriched: json('src/data/districts.enriched.json'),
    sourceDistricts: json('data/source/bd-districts.json').districts,
    sourceDivisions: json('data/source/bd-divisions.json').divisions,
  });

  it('passes on the committed data', () => {
    expect(validate(inputs())).toEqual([]);
  });

  it('catches a missing district, unsourced claims and markup in content', () => {
    const bad = inputs();
    bad.generated.districts = bad.generated.districts.filter(d => d.id !== '30');
    bad.enriched['1'].landmarks[0].sources = [];
    bad.enriched['1'].landmarks[1].note = '<img src=x onerror=alert(1)>';
    const errors = validate(bad).join('\n');
    expect(errors).toMatch(/expected 64 districts/);
    expect(errors).toMatch(/Nilphamari\) missing/);
    expect(errors).toMatch(/needs at least one source/);
    expect(errors).toMatch(/markup-like text/);
  });
});
