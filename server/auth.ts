/**
 * Password login with server-side sessions.
 * - Passwords: argon2id via Bun.password.
 * - Session token: 32 random bytes in an HttpOnly, SameSite=Strict cookie; only its SHA-256 is stored.
 * - Login attempts are rate-limited per client address.
 */
import type { DB } from './db'
import { now } from './db'

export const DEFAULT_USER = { username: 'demo', password: 'Hisab@2083', name: 'Sita Gurung', firm: 'Annapurna Accounting Services' }

const COOKIE = 'hisab_session'
const SESSION_DAYS = 7

export interface User {
  id: number
  username: string
  name: string
  firm: string
  isDefaultPassword: boolean
}

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
async function sha256(s: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
}

export async function ensureDefaultUser(db: DB) {
  const exists = db.query('SELECT id FROM users LIMIT 1').get()
  if (exists) return
  const hash = await Bun.password.hash(DEFAULT_USER.password, { algorithm: 'argon2id' })
  db.query('INSERT INTO users (username, name, firm, password_hash, is_default_password, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .run(DEFAULT_USER.username, DEFAULT_USER.name, DEFAULT_USER.firm, hash, now())
}

// --- rate limiting (in memory; fine for one server process) ---
const attempts = new Map<string, number[]>()
export function tooManyAttempts(key: string, limit = 5, windowMs = 60_000): boolean {
  const t = Date.now()
  const list = (attempts.get(key) ?? []).filter((x) => t - x < windowMs)
  attempts.set(key, list)
  return list.length >= limit
}
export function recordAttempt(key: string) {
  attempts.set(key, [...(attempts.get(key) ?? []), Date.now()])
}
export function clearAttempts(key: string) {
  attempts.delete(key)
}

let dummyHash: string | undefined

export async function verifyLogin(db: DB, username: string, password: string): Promise<User | null> {
  const row = db.query('SELECT id, username, name, firm, password_hash, is_default_password FROM users WHERE username = ?').get(username) as
    | { id: number; username: string; name: string; firm: string; password_hash: string; is_default_password: number }
    | null
  // Always run a real hash check so response time doesn't reveal whether the username exists.
  dummyHash ??= await Bun.password.hash('not-a-real-password', { algorithm: 'argon2id' })
  const ok = await Bun.password.verify(password, row?.password_hash ?? dummyHash).catch(() => false)
  if (!row || !ok) return null
  return { id: row.id, username: row.username, name: row.name, firm: row.firm, isDefaultPassword: !!row.is_default_password }
}

export async function createSession(db: DB, userId: number, userAgent: string | null): Promise<string> {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)))
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  db.query('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)')
    .run(await sha256(token), userId, now(), expires, userAgent?.slice(0, 200) ?? null)
  db.query('DELETE FROM sessions WHERE expires_at < ?').run(now())
  return token
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`
}
export function clearCookie(secure: boolean): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`
}

function readToken(req: Request): string | null {
  const c = req.headers.get('cookie') ?? ''
  const m = c.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`))
  return m ? m[1] : null
}

export async function userFromRequest(db: DB, req: Request): Promise<User | null> {
  const token = readToken(req)
  if (!token) return null
  const row = db.query(`SELECT u.id, u.username, u.name, u.firm, u.is_default_password FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(await sha256(token), now()) as
    | { id: number; username: string; name: string; firm: string; is_default_password: number }
    | null
  return row ? { id: row.id, username: row.username, name: row.name, firm: row.firm, isDefaultPassword: !!row.is_default_password } : null
}

export async function destroySession(db: DB, req: Request) {
  const token = readToken(req)
  if (token) db.query('DELETE FROM sessions WHERE token_hash = ?').run(await sha256(token))
}

export async function changePassword(db: DB, userId: number, current: string, next: string): Promise<string | null> {
  const row = db.query('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | null
  if (!row || !(await Bun.password.verify(current, row.password_hash))) return 'Current password is incorrect.'
  const problem = passwordProblem(next)
  if (problem) return problem
  const hash = await Bun.password.hash(next, { algorithm: 'argon2id' })
  db.query('UPDATE users SET password_hash = ?, is_default_password = 0 WHERE id = ?').run(hash, userId)
  return null
}

export function passwordProblem(p: string): string | null {
  if (p.length < 10) return 'Use at least 10 characters.'
  if (p.length > 200) return 'Use at most 200 characters.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Mix letters and numbers.'
  if (p === DEFAULT_USER.password) return 'Choose a password different from the default.'
  return null
}
