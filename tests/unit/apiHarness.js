// Shared by the API unit tests. A D1-shaped database over in-memory SQLite built from the real migrations,
// so routes run their real SQL (expiry comparisons, counter upserts, deletes) and tests assert on outcomes,
// not on SQL text. Only what the Functions use is implemented: prepare().bind() with first/all/run, and batch().
// Uses the built-in node:sqlite, which needs Node 22.13 or newer (no flag, no extra dependency).
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SESSION_COOKIE } from '../../server/http.js';
import { createSession, makeVerifier } from '../../server/auth.js';

export const ORIGIN = 'https://x.test';
export const PEPPER = 'p'.repeat(32);
export const KEY = 'A'.repeat(43); // a well-formed password key (what the browser derives from the password)

export const makeEnv = db => ({ DB: db, AUTH_PEPPER: PEPPER });

/** A JSON request the way the browser sends one; `headers` can add Cookie or CF-Connecting-IP. */
export const apiRequest = (method, path, body, headers = {}) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    headers: { Origin: ORIGIN, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const MIGRATIONS = new URL('../../migrations/', import.meta.url);

export function createDb() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(MIGRATIONS).sort()) sqlite.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));

  const calls = { batch: 0, run: 0 };
  const query = (sql, args) => sqlite.prepare(sql).all(...args).map(row => ({ ...row }));
  const prepare = sql => ({
    bind: (...args) => {
      const exec = () => query(sql, args);
      return {
        exec,
        first: async () => exec()[0] ?? null,
        all: async () => ({ results: exec() }),
        run: async () => {
          calls.run++;
          exec();
          return { success: true };
        },
      };
    },
  });
  // D1 runs a batch as one transaction.
  const batch = async statements => {
    calls.batch++;
    sqlite.exec('BEGIN');
    try {
      const out = statements.map(statement => ({ success: true, results: statement.exec() }));
      sqlite.exec('COMMIT');
      return out;
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  };

  return {
    prepare,
    batch,
    /** How often the Functions called batch() and run(). */
    calls,
    /** Rows changed by INSERT, UPDATE and DELETE since the database was created. A call that wrote nothing leaves it unchanged. */
    writes: () => query('SELECT total_changes() AS n', [])[0].n,
    rows: table => query(`SELECT * FROM ${table}`, []),
  };
}

/** A user with a live session, made with the real verifier and session code. `key` is their password key. */
export async function addUser(db, username, { key = KEY, now } = {}) {
  const row = await db
    .prepare('INSERT INTO users (username, verifier, created_at) VALUES (?1, ?2, ?3) RETURNING id')
    .bind(username, await makeVerifier(PEPPER, key), Math.floor(Date.now() / 1000))
    .first();
  const token = await createSession(db, row.id, now);
  return { id: row.id, username, key, token, cookie: `${SESSION_COOKIE}=${token}` };
}
