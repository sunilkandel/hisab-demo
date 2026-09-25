/**
 * SQLite storage. One file (data/hisab.db). In production this becomes Postgres with row-level
 * security per firm; the table shapes are the same.
 */
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type DB = Database

export function openDb(path = process.env.HISAB_DB ?? 'data/hisab.db'): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path, { create: true, strict: true })
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: DB) {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    firm TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_default_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    user_agent TEXT
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pan TEXT NOT NULL,
    sector TEXT NOT NULL,
    billing_tool TEXT NOT NULL,
    story TEXT NOT NULL DEFAULT '',
    docs_json TEXT NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS files (
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    bytes BLOB NOT NULL,
    source TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    PRIMARY KEY (client_id, period, doc_id)
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS results (
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    result_json TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    PRIMARY KEY (client_id, period)
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS decisions (
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    txn_id TEXT NOT NULL,
    category TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    decided_by TEXT NOT NULL,
    decided_at TEXT NOT NULL,
    PRIMARY KEY (client_id, period, txn_id)
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS exports (
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    exported_at TEXT NOT NULL,
    exported_by TEXT NOT NULL,
    file_name TEXT NOT NULL,
    PRIMARY KEY (client_id, period)
  )`)
  // Append-only by convention; the API never updates or deletes audit rows.
  db.run(`CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    client_id TEXT,
    period TEXT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL
  )`)
  // Privacy-friendly analytics: no cookies, no IP, no user id. Day + path + referrer host only.
  db.run(`CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    path TEXT NOT NULL,
    referrer_host TEXT NOT NULL DEFAULT ''
  )`)
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_client ON audit(client_id, id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_views_day ON page_views(day)')
}

export const now = () => new Date().toISOString()

export function audit(db: DB, e: { clientId?: string | null; period?: string | null; actor: string; action: string; detail: string }) {
  db.query('INSERT INTO audit (at, client_id, period, actor, action, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .run(now(), e.clientId ?? null, e.period ?? null, e.actor, e.action, e.detail)
}
