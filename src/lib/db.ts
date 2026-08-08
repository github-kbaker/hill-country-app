/**
 * Database adapter — Vercel-compatible.
 *
 * Production path: @libsql/client (Turso). When TURSO_DATABASE_URL is set,
 * every query runs against the hosted libsql database (local `file:` URLs are
 * supported too, e.g. for migrations/tests). This is the ONLY runtime path in
 * production (NODE_ENV=production): if the URL is missing, query() throws and
 * the app fails closed — there is no silent fallback.
 *
 * Dev path: when TURSO_DATABASE_URL is NOT set and NODE_ENV !== 'production',
 * queries fall back to the `team-db` CLI (the shared team coordination
 * database). This keeps the local development loop working with the same SQL
 * dialect/schema. A warning is emitted so the fallback is never silent.
 *
 * The application-facing surface is preserved: query(sql) returns the same
 * row-array shape (objects keyed by column name) the team-db CLI produced, so
 * callers only need to await it. escape() is unchanged.
 */

import { execSync } from 'node:child_process';
import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;
let devFallbackWarned = false;

export type DbMode = 'turso' | 'team-db-dev' | 'unconfigured';

/** Which backing store query() will use right now. */
export function dbMode(): DbMode {
  if (getClient()) return 'turso';
  if (process.env.NODE_ENV !== 'production') return 'team-db-dev';
  return 'unconfigured';
}

function getClient(): Client | null {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
    return client;
  }
  return null;
}

/**
 * Run a single SQL statement and return rows (objects keyed by column name).
 * Async so the hosted @libsql client (HTTP) is used directly in production.
 */
export async function query(sql: string): Promise<any> {
  const c = getClient();
  if (c) {
    const rs = await c.execute(sql);
    return rs.rows;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[db] Production database not configured: set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN for a remote database). Failing closed — no fallback is used in production.',
    );
  }
  if (!devFallbackWarned) {
    console.warn('[db] TURSO_DATABASE_URL not set — using team-db CLI as the dev-only fallback. Never used in production.');
    devFallbackWarned = true;
  }
  const output = execSync(`team-db "${sql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(output);
}

/** Escape a value for inline SQL (same semantics as before). */
export function escape(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Test-only: drop the cached client so tests can point at a fresh database. */
export function __resetDbClientForTests(): void {
  client = null;
  devFallbackWarned = false;
}
