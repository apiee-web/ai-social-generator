/**
 * api/_lib/db.js
 * ---------------------------------------------------------------------------
 * One small Postgres helper shared by the API routes.
 *
 * Set DATABASE_URL (Neon, Supabase, Railway, plain Postgres — anything that
 * speaks SQL) and accounts switch on. Leave it unset and the app keeps working
 * in guest mode.
 *
 * The schema is created on first use, so there is no migration step to run by
 * hand: the first signup or sign-in after a deploy does it. New columns are
 * added with `add column if not exists`, which is safe on an existing table.
 * ---------------------------------------------------------------------------
 */

import pg from "pg";

const { Pool } = pg;

let pool = null;
let schemaPromise = null;
let testQuery = null;

export class MissingDatabaseError extends Error {
  constructor() {
    super(
      "Accounts aren't connected yet. Add DATABASE_URL to your environment variables, then redeploy.",
    );
    this.name = "MissingDatabaseError";
    this.status = 503;
  }
}

export function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

export function hasDatabase() {
  return Boolean(testQuery) || Boolean(databaseUrl());
}

/**
 * Test seam: swap the driver for an in-memory Postgres so the routes can be
 * exercised without a live database. Nobody calls this in production.
 */
export function setQueryFunction(fn) {
  testQuery = fn;
  pool = null;
  schemaPromise = null;
}

function sslFor(url) {
  /* An explicit sslmode in the URL is the operator's decision — follow it. */
  if (/[?&]sslmode=/i.test(url)) return undefined;
  if (/@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/i.test(url)) return false;
  /* Managed providers present certificates Node doesn't ship with. */
  return { rejectUnauthorized: false };
}

function getPool() {
  if (pool) return pool;

  const url = databaseUrl();
  if (!url) throw new MissingDatabaseError();

  pool = new Pool({
    connectionString: url,
    max: Math.max(1, Number(process.env.PGPOOL_MAX) || 3),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: sslFor(url),
  });

  /* A idle client error must never take the whole function down. */
  pool.on("error", (err) => {
    console.error("[db] idle client error:", err?.message || err);
  });

  return pool;
}

export async function query(text, params = []) {
  if (testQuery) return testQuery(text, params);
  return getPool().query(text, params);
}

/* Split so every statement runs on its own — works with pooled connections and
   with the in-memory driver used by the tests. */
const SCHEMA = [
  `create table if not exists app_users (
     id text primary key,
     email text not null unique,
     password_hash text not null,
     credits integer not null default 0,
     plan text not null default 'free',
     created_at timestamptz not null default now(),
     last_login_at timestamptz
   )`,
  /* Subscription state, added in place so existing accounts keep working. */
  `alter table app_users add column if not exists subscription_status text`,
  `alter table app_users add column if not exists stripe_customer_id text`,
  `alter table app_users add column if not exists stripe_subscription_id text`,
  `alter table app_users add column if not exists current_period_end timestamptz`,
  `create table if not exists credit_purchases (
     id text primary key,
     user_id text not null references app_users(id) on delete cascade,
     stripe_session_id text not null unique,
     plan text not null,
     credits integer not null,
     amount_cents integer,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists credit_purchases_user_idx on credit_purchases (user_id)`,
  /* The Brand Vault: the context a user should never have to retype. */
  `create table if not exists brand_vaults (
     id text primary key,
     user_id text not null references app_users(id) on delete cascade,
     name text not null,
     audience text not null,
     offer text not null,
     tone text not null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists brand_vaults_user_idx on brand_vaults (user_id)`,
];

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const statement of SCHEMA) await query(statement);
    })().catch((err) => {
      /* Let the next request try again instead of caching a broken state. */
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
