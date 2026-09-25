import type { DB } from './db'
import { audit, now } from './db'
import {
  changePassword, clearAttempts, clearCookie, createSession, destroySession, recordAttempt, sessionCookie,
  tooManyAttempts, userFromRequest, verifyLogin, type User,
} from './auth'
import { seedDemo, wipeWorkspace } from './seed'
import { CLIENTS, DEMO_MONTH, renderDoc } from '../src/domain/seed'
import { sheetToBytes, sha256Hex } from '../src/domain/files'
import { runPipeline, exclusionsOf } from '../src/domain/pipeline'
import { buildView, type FileMeta } from '../src/domain/view'
import { buildVatPack } from '../src/domain/export'
import { applyDecisions, summarize, type Decision } from '../src/domain/reconcile'
import { computeVat } from '../src/domain/pipeline'
import { parsePeriod, periodKey, periodLabel, currentFilingPeriod } from '../src/domain/dates'
import type { BillingTool, Client, CreditCategory, ExpectedDoc, MonthResult, RawFile } from '../src/domain/types'

const MAX_UPLOAD = 5 * 1024 * 1024
const TOOLS: BillingTool[] = ['BUSY', 'Tigg', 'Tally', 'Excel (manual)']
const DECIDABLE: CreditCategory[] = ['loan', 'owner-capital', 'own-transfer', 'refund', 'other-explained', 'undeclared-sale']

class HttpError extends Error {
  constructor(public status: number, message: string, public field?: string) { super(message) }
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })

async function body<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T } catch { throw new HttpError(400, 'Request body must be JSON.') }
}

// ---------------- clients ----------------
interface ClientRow { id: string; name: string; pan: string; sector: string; billing_tool: string; story: string; docs_json: string; demo: number }
const toClient = (r: ClientRow): Client => ({ id: r.id, name: r.name, pan: r.pan, sector: r.sector, billingTool: r.billing_tool as BillingTool, story: r.story, docs: JSON.parse(r.docs_json), demo: !!r.demo })

function getClient(db: DB, id: string): Client {
  const r = db.query('SELECT * FROM clients WHERE id = ?').get(id) as ClientRow | null
  if (!r) throw new HttpError(404, 'Client not found.')
  return toClient(r)
}

interface ClientInput { name?: string; pan?: string; sector?: string; billingTool?: string; banks?: { bank?: string; account?: string }[] }

function validateClient(db: DB, input: ClientInput, existingId?: string) {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 120) throw new HttpError(422, 'Enter the business name (2–120 characters).', 'name')
  const pan = String(input.pan ?? '').replace(/\s/g, '')
  if (!/^\d{9}$/.test(pan)) throw new HttpError(422, 'PAN must be exactly 9 digits.', 'pan')
  const dup = db.query('SELECT id, name FROM clients WHERE pan = ? AND id != ?').get(pan, existingId ?? '') as { id: string; name: string } | null
  if (dup) throw new HttpError(409, `PAN ${pan} already belongs to ${dup.name}.`, 'pan')
  const sector = String(input.sector ?? '').trim().slice(0, 80)
  const billingTool = TOOLS.find((t) => t === input.billingTool)
  if (!billingTool) throw new HttpError(422, 'Choose the billing software the client uses.', 'billingTool')
  const banks = (input.banks ?? []).map((b) => ({ bank: String(b.bank ?? '').trim().slice(0, 60), account: String(b.account ?? '').replace(/\s/g, '') }))
  if (banks.length < 1 || banks.length > 5) throw new HttpError(422, 'Add between 1 and 5 bank accounts.', 'banks')
  banks.forEach((b, i) => {
    if (b.bank.length < 2) throw new HttpError(422, `Bank ${i + 1}: enter the bank name.`, `banks.${i}.bank`)
    if (!/^[A-Za-z0-9-]{4,24}$/.test(b.account)) throw new HttpError(422, `Bank ${i + 1}: account number should be 4–24 letters, digits or dashes.`, `banks.${i}.account`)
  })
  if (new Set(banks.map((b) => b.account)).size !== banks.length) throw new HttpError(422, 'The same account number is listed twice.', 'banks')
  return { name, pan, sector, billingTool, banks }
}

function docsFor(billingTool: BillingTool, banks: { bank: string; account: string }[]): ExpectedDoc[] {
  const tool = billingTool === 'Excel (manual)' ? 'Excel' : billingTool
  return [
    ...banks.map((b) => ({ id: `bank-${b.account.toLowerCase()}`, kind: 'bank' as const, label: `${b.bank} · A/C ${b.account.slice(-4)}`, account: b.account })),
    { id: 'sales', kind: 'sales', label: `${tool} sales register` },
    { id: 'purchase', kind: 'purchase', label: `${tool} purchase register` },
  ]
}

function slugId(db: DB, name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'client'
  let id = base
  for (let i = 2; db.query('SELECT 1 FROM clients WHERE id = ?').get(id); i++) id = `${base}-${i}`
  return id
}

// ---------------- client-month ----------------
function filesMeta(db: DB, clientId: string, period: string): FileMeta[] {
  return (db.query('SELECT doc_id, name, size, sha256, source, uploaded_at, uploaded_by FROM files WHERE client_id = ? AND period = ? ORDER BY doc_id').all(clientId, period) as
    { doc_id: string; name: string; size: number; sha256: string; source: 'sample' | 'upload'; uploaded_at: string; uploaded_by: string }[])
    .map((f) => ({ docId: f.doc_id, name: f.name, size: f.size, sha256: f.sha256, source: f.source, uploadedAt: f.uploaded_at, uploadedBy: f.uploaded_by }))
}
function resultOf(db: DB, clientId: string, period: string): MonthResult | undefined {
  const r = db.query('SELECT result_json FROM results WHERE client_id = ? AND period = ?').get(clientId, period) as { result_json: string } | null
  return r ? JSON.parse(r.result_json) : undefined
}
function decisionsOf(db: DB, clientId: string, period: string): Record<string, Decision> {
  const rows = db.query('SELECT txn_id, category, note, decided_by, decided_at FROM decisions WHERE client_id = ? AND period = ?').all(clientId, period) as
    { txn_id: string; category: CreditCategory; note: string; decided_by: string; decided_at: string }[]
  return Object.fromEntries(rows.map((d) => [d.txn_id, { category: d.category, note: d.note, by: d.decided_by, at: d.decided_at }]))
}
function exportedAt(db: DB, clientId: string, period: string): string | undefined {
  return (db.query('SELECT exported_at FROM exports WHERE client_id = ? AND period = ?').get(clientId, period) as { exported_at: string } | null)?.exported_at
}
function view(db: DB, client: Client, period: string, detailed: boolean) {
  return buildView({ client, period, files: filesMeta(db, client.id, period), result: resultOf(db, client.id, period), decisions: decisionsOf(db, client.id, period), exportedAt: exportedAt(db, client.id, period), detailed })
}
function periodOrThrow(key: string) {
  const p = parsePeriod(key)
  if (!p) throw new HttpError(400, 'Period must look like 2083-05 (BS year-month).')
  return p
}
function invalidate(db: DB, clientId: string, period: string) {
  db.query('DELETE FROM exports WHERE client_id = ? AND period = ?').run(clientId, period)
}

export async function storeFile(db: DB, clientId: string, period: string, f: RawFile, by: string) {
  db.query(`INSERT INTO files (client_id, period, doc_id, name, size, sha256, bytes, source, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id, period, doc_id) DO UPDATE SET name = excluded.name, size = excluded.size, sha256 = excluded.sha256, bytes = excluded.bytes, source = excluded.source, uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at`)
    .run(clientId, period, f.docId, f.name, f.bytes.length, await sha256Hex(f.bytes), f.bytes, f.source, by, now())
}

export async function runAndStore(db: DB, client: Client, period: string, actor: string) {
  const rows = db.query('SELECT doc_id, name, bytes, source FROM files WHERE client_id = ? AND period = ?').all(client.id, period) as { doc_id: string; name: string; bytes: Uint8Array; source: 'sample' | 'upload' }[]
  const raws: RawFile[] = rows.map((r) => ({ docId: r.doc_id, name: r.name, bytes: new Uint8Array(r.bytes), source: r.source }))
  if (!raws.length) throw new HttpError(422, 'Upload at least one document before running.')
  const result = await runPipeline(client, raws, periodOrThrow(period))
  db.transaction(() => {
    db.query('INSERT INTO results (client_id, period, result_json, processed_at) VALUES (?, ?, ?, ?) ON CONFLICT(client_id, period) DO UPDATE SET result_json = excluded.result_json, processed_at = excluded.processed_at')
      .run(client.id, period, JSON.stringify(result), result.processedAt)
    // keep decisions only for deposits that still exist
    const ids = new Set(result.credits.map((c) => c.txnId))
    for (const d of db.query('SELECT txn_id FROM decisions WHERE client_id = ? AND period = ?').all(client.id, period) as { txn_id: string }[]) {
      if (!ids.has(d.txn_id)) db.query('DELETE FROM decisions WHERE client_id = ? AND period = ? AND txn_id = ?').run(client.id, period, d.txn_id)
    }
    invalidate(db, client.id, period)
  })()
  audit(db, { clientId: client.id, period, actor, action: 'Processed', detail: `${raws.length} file(s) · ${result.issues.length} issue(s) · ${result.credits.length} deposit(s)` })
  return result
}

// ---------------- router ----------------
type Handler = (ctx: { req: Request; db: DB; user: User; params: Record<string, string>; url: URL }) => Promise<Response> | Response
const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler; public?: boolean }[] = []
function route(method: string, path: string, handler: Handler, opts: { public?: boolean } = {}) {
  const keys: string[] = []
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$')
  routes.push({ method, pattern, keys, handler, public: opts.public })
}

route('GET', '/api/health', () => json({ ok: true, time: now() }), { public: true })

route('POST', '/api/auth/login', async ({ req, db, url }) => {
  const { username = '', password = '' } = await body<{ username?: string; password?: string }>(req)
  const key = `login:${req.headers.get('x-hisab-ip') ?? 'local'}:${String(username).toLowerCase()}`
  if (tooManyAttempts(key)) throw new HttpError(429, 'Too many attempts. Wait a minute and try again.')
  if (!username || !password) throw new HttpError(422, 'Enter your username and password.')
  const user = await verifyLogin(db, String(username).trim(), String(password))
  if (!user) {
    recordAttempt(key)
    audit(db, { actor: String(username).slice(0, 60), action: 'Sign-in failed', detail: 'Wrong username or password' })
    throw new HttpError(401, 'That username and password don’t match. Check both and try again.')
  }
  clearAttempts(key)
  const token = await createSession(db, user.id, req.headers.get('user-agent'))
  audit(db, { actor: user.name, action: 'Signed in', detail: user.username })
  return json({ user }, 200, { 'set-cookie': sessionCookie(token, url.protocol === 'https:') })
}, { public: true })

route('POST', '/api/auth/logout', async ({ req, db, url }) => {
  await destroySession(db, req)
  return json({ ok: true }, 200, { 'set-cookie': clearCookie(url.protocol === 'https:') })
}, { public: true })

route('GET', '/api/auth/me', ({ user }) => json({ user: user ?? null }), { public: true })

route('POST', '/api/auth/password', async ({ req, db, user }) => {
  const { current = '', next = '' } = await body<{ current?: string; next?: string }>(req)
  const problem = await changePassword(db, user.id, current, next)
  if (problem) throw new HttpError(422, problem, problem.startsWith('Current') ? 'current' : 'next')
  audit(db, { actor: user.name, action: 'Password changed', detail: user.username })
  return json({ ok: true })
})

// privacy-friendly analytics
route('POST', '/api/events', async ({ req, db }) => {
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return new Response(null, { status: 204 })
  const { path = '', referrer = '' } = await body<{ path?: string; referrer?: string }>(req).catch(() => ({} as { path?: string; referrer?: string }))
  const p = String(path).split('?')[0].slice(0, 120)
  if (!/^\/[\w\-/.]*$/.test(p)) return new Response(null, { status: 204 })
  // collapse client ids so no client names end up in analytics
  const clean = p.replace(/^\/app\/clients\/[^/]+/, '/app/clients/:id').replace(/^\/app\/report\/[^/]+/, '/app/report/:id')
  let host = ''
  try { host = referrer ? new URL(String(referrer)).host.slice(0, 80) : '' } catch { /* ignore */ }
  db.query('INSERT INTO page_views (day, path, referrer_host) VALUES (?, ?, ?)').run(now().slice(0, 10), clean, host)
  return new Response(null, { status: 204 })
}, { public: true })

route('GET', '/api/analytics', ({ db }) => {
  const since = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10)
  const byDay = db.query('SELECT day, COUNT(*) AS views FROM page_views WHERE day >= ? GROUP BY day ORDER BY day').all(since)
  const topPaths = db.query('SELECT path, COUNT(*) AS views FROM page_views WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 10').all(since)
  const referrers = db.query("SELECT referrer_host AS host, COUNT(*) AS views FROM page_views WHERE day >= ? AND referrer_host != '' GROUP BY referrer_host ORDER BY views DESC LIMIT 5").all(since)
  return json({ since, byDay, topPaths, referrers })
})

route('GET', '/api/periods/current', () => {
  const p = currentFilingPeriod()
  return json({ current: periodKey(p), label: periodLabel(p), demo: periodKey(DEMO_MONTH) })
})

route('GET', '/api/clients', ({ db, url }) => {
  const period = periodKey(periodOrThrow(url.searchParams.get('period') ?? ''))
  const rows = db.query('SELECT * FROM clients ORDER BY demo DESC, name').all() as ClientRow[]
  return json({ period, clients: rows.map((r) => view(db, toClient(r), period, false)) })
})

route('POST', '/api/clients', async ({ req, db, user }) => {
  const v = validateClient(db, await body<ClientInput>(req))
  const id = slugId(db, v.name)
  const t = now()
  db.query('INSERT INTO clients (id, name, pan, sector, billing_tool, story, docs_json, demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
    .run(id, v.name, v.pan, v.sector, v.billingTool, '', JSON.stringify(docsFor(v.billingTool, v.banks)), t, t)
  audit(db, { clientId: id, actor: user.name, action: 'Client added', detail: `${v.name} · PAN ${v.pan} · ${v.banks.length} bank account(s)` })
  return json({ client: getClient(db, id) }, 201)
})

route('GET', '/api/clients/:id', ({ db, params }) => json({ client: getClient(db, params.id) }))

route('PUT', '/api/clients/:id', async ({ req, db, user, params }) => {
  const old = getClient(db, params.id)
  const v = validateClient(db, await body<ClientInput>(req), old.id)
  // Demo clients keep their sample-file document ids; others are rebuilt from the bank list.
  const docs = old.demo ? old.docs : docsFor(v.billingTool, v.banks)
  db.query('UPDATE clients SET name = ?, pan = ?, sector = ?, billing_tool = ?, docs_json = ?, updated_at = ? WHERE id = ?')
    .run(v.name, v.pan, v.sector, v.billingTool, JSON.stringify(docs), now(), old.id)
  audit(db, { clientId: old.id, actor: user.name, action: 'Client updated', detail: `${v.name} · PAN ${v.pan}` })
  return json({ client: getClient(db, old.id) })
})

route('DELETE', '/api/clients/:id', ({ db, user, params }) => {
  const c = getClient(db, params.id)
  db.query('DELETE FROM clients WHERE id = ?').run(c.id)
  audit(db, { clientId: c.id, actor: user.name, action: 'Client removed', detail: `${c.name} and all its files, results and decisions` })
  return json({ ok: true })
})

route('GET', '/api/clients/:id/months/:period', ({ db, params }) => {
  const client = getClient(db, params.id)
  return json(view(db, client, periodKey(periodOrThrow(params.period)), true))
})

route('PUT', '/api/clients/:id/months/:period/files/:docId', async ({ req, db, user, params }) => {
  const client = getClient(db, params.id)
  const period = periodKey(periodOrThrow(params.period))
  const doc = client.docs.find((d) => d.id === params.docId)
  if (!doc) throw new HttpError(404, 'This client has no such document slot.')
  let form: FormData
  try { form = await req.formData() } catch { throw new HttpError(400, 'Send the file as multipart/form-data with a "file" field.') }
  const file = form.get('file')
  if (!(file instanceof File)) throw new HttpError(422, 'Choose a file to upload.')
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new HttpError(415, `${file.name}: only .xlsx, .xls or .csv files are accepted.`)
  if (file.size === 0) throw new HttpError(422, `${file.name} is empty.`)
  if (file.size > MAX_UPLOAD) throw new HttpError(413, `${file.name} is larger than 5 MB.`)
  const name = file.name.replace(/[^\w.\- ()ऀ-ॿ]/g, '_').slice(0, 120)
  await storeFile(db, client.id, period, { docId: doc.id, name, bytes: new Uint8Array(await file.arrayBuffer()), source: 'upload' }, user.name)
  invalidate(db, client.id, period)
  audit(db, { clientId: client.id, period, actor: user.name, action: 'File uploaded', detail: `${doc.label}: ${name} (${(file.size / 1024).toFixed(1)} KB)` })
  return json(view(db, client, period, true))
})

route('POST', '/api/clients/:id/months/:period/files/:docId/sample', async ({ db, user, params }) => {
  const client = getClient(db, params.id)
  const period = periodKey(periodOrThrow(params.period))
  const doc = client.docs.find((d) => d.id === params.docId)
  if (!client.demo || !doc?.format) throw new HttpError(422, 'Samples exist only for demo clients. Download one from Sample files and upload it instead.')
  if (period !== periodKey(DEMO_MONTH)) throw new HttpError(422, `Demo samples are for ${periodLabel(DEMO_MONTH)}. Switch to that month to attach them.`)
  const r = renderDoc(client.id, doc.id)
  await storeFile(db, client.id, period, { docId: doc.id, name: r.name, bytes: sheetToBytes(r.sheet, r.ext), source: 'sample' }, user.name)
  invalidate(db, client.id, period)
  audit(db, { clientId: client.id, period, actor: user.name, action: 'Sample attached', detail: `${doc.label}: ${r.name}` })
  return json(view(db, client, period, true))
})

route('GET', '/api/clients/:id/months/:period/files/:docId', ({ db, params }) => {
  const f = db.query('SELECT name, bytes FROM files WHERE client_id = ? AND period = ? AND doc_id = ?').get(params.id, params.period, params.docId) as { name: string; bytes: Uint8Array } | null
  if (!f) throw new HttpError(404, 'File not found.')
  return new Response(new Uint8Array(f.bytes), { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'cache-control': 'no-store' } })
})

route('DELETE', '/api/clients/:id/months/:period/files/:docId', ({ db, user, params }) => {
  const client = getClient(db, params.id)
  const period = periodKey(periodOrThrow(params.period))
  const f = db.query('SELECT name FROM files WHERE client_id = ? AND period = ? AND doc_id = ?').get(client.id, period, params.docId) as { name: string } | null
  if (!f) throw new HttpError(404, 'File not found.')
  db.query('DELETE FROM files WHERE client_id = ? AND period = ? AND doc_id = ?').run(client.id, period, params.docId)
  invalidate(db, client.id, period)
  audit(db, { clientId: client.id, period, actor: user.name, action: 'File removed', detail: f.name })
  return json(view(db, client, period, true))
})

route('POST', '/api/clients/:id/months/:period/run', async ({ db, user, params }) => {
  const client = getClient(db, params.id)
  const period = periodKey(periodOrThrow(params.period))
  await runAndStore(db, client, period, user.name)
  return json(view(db, client, period, true))
})

route('PUT', '/api/clients/:id/months/:period/decisions/:txnId', async ({ req, db, user, params }) => {
  const client = getClient(db, params.id)
  const period = periodKey(periodOrThrow(params.period))
  const result = resultOf(db, client.id, period)
  const credit = result?.credits.find((c) => c.txnId === params.txnId)
  if (!result || !credit) throw new HttpError(404, 'Deposit not found. Re-run processing and try again.')
  const { category, note = '' } = await body<{ category?: CreditCategory; note?: string }>(req)
  if (!category || !DECIDABLE.includes(category)) throw new HttpError(422, 'Choose what this deposit is.', 'category')
  const cleanNote = String(note).trim().slice(0, 300)
  if (category === 'other-explained' && !cleanNote) throw new HttpError(422, 'Add a note explaining what it is.', 'note')
  db.query(`INSERT INTO decisions (client_id, period, txn_id, category, note, decided_by, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id, period, txn_id) DO UPDATE SET category = excluded.category, note = excluded.note, decided_by = excluded.decided_by, decided_at = excluded.decided_at`)
    .run(client.id, period, credit.txnId, category, cleanNote, user.name, now())
  invalidate(db, client.id, period)
  const t = result.txns.find((x) => x.id === credit.txnId)!
  audit(db, { clientId: client.id, period, actor: user.name, action: 'Deposit classified', detail: `${t.dateBs} ${t.narration} · ${(t.credit / 100).toFixed(2)} → ${category}${cleanNote ? ` · ${cleanNote}` : ''}` })
  return json(view(db, client, period, true))
})

route('DELETE', '/api/clients/:id/months/:period/decisions/:txnId', ({ db, user, params }) => {
  const client = getClient(db, params.id)
  const period = periodKey(periodOrThrow(params.period))
  const res = db.query('DELETE FROM decisions WHERE client_id = ? AND period = ? AND txn_id = ?').run(client.id, period, params.txnId)
  if (!res.changes) throw new HttpError(404, 'Nothing to undo.')
  invalidate(db, client.id, period)
  audit(db, { clientId: client.id, period, actor: user.name, action: 'Classification undone', detail: params.txnId })
  return json(view(db, client, period, true))
})

route('GET', '/api/clients/:id/months/:period/export', ({ db, user, params }) => {
  const client = getClient(db, params.id)
  const p = periodOrThrow(params.period)
  const period = periodKey(p)
  const v = view(db, client, period, true)
  if (!v.result) throw new HttpError(409, 'Process this month first.')
  if (v.toReview > 0) throw new HttpError(409, `${v.toReview} deposit(s) still need a decision.`)
  const missing = client.docs.filter((d) => !v.files.some((f) => f.docId === d.id))
  if (missing.length) throw new HttpError(409, `Missing: ${missing.map((d) => d.label).join(', ')}.`)
  if (v.status === 'stale') throw new HttpError(409, 'Files changed since the last run. Process again first.')
  const ex = exclusionsOf(v.result)
  const credits = applyDecisions(v.result.credits, decisionsOf(db, client.id, period))
  const sales = v.result.invoices.filter((i) => i.kind === 'sales' && !ex.excludedInvoices.has(i.id))
  const bytes = buildVatPack({
    client, monthLabel: periodLabel(p), vat: computeVat(v.result.invoices, ex.excludedInvoices, ex.disallowedInput),
    summary: summarize(credits, new Map(v.result.txns.map((t) => [t.id, t])), sales), sales,
    purchases: v.result.invoices.filter((i) => i.kind === 'purchase' && !ex.excludedInvoices.has(i.id)),
    disallowed: ex.disallowedInput, txns: v.result.txns, credits, issues: v.result.issues, preparedBy: user.name,
  })
  const name = `VAT_pack_${client.name.replace(/[^A-Za-z0-9]+/g, '_')}_${periodLabel(p).replace(' ', '')}.xlsx`
  db.query('INSERT INTO exports (client_id, period, exported_at, exported_by, file_name) VALUES (?, ?, ?, ?, ?) ON CONFLICT(client_id, period) DO UPDATE SET exported_at = excluded.exported_at, exported_by = excluded.exported_by, file_name = excluded.file_name')
    .run(client.id, period, now(), user.name, name)
  audit(db, { clientId: client.id, period, actor: user.name, action: 'VAT pack exported', detail: name })
  return new Response(bytes as unknown as BodyInit, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } })
})

route('GET', '/api/audit', ({ db, url }) => {
  const clientId = url.searchParams.get('clientId')
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 200, 1), 1000)
  const rows = clientId
    ? db.query('SELECT a.*, c.name AS client_name FROM audit a LEFT JOIN clients c ON c.id = a.client_id WHERE a.client_id = ? ORDER BY a.id DESC LIMIT ?').all(clientId, limit)
    : db.query('SELECT a.*, c.name AS client_name FROM audit a LEFT JOIN clients c ON c.id = a.client_id ORDER BY a.id DESC LIMIT ?').all(limit)
  return json({ entries: rows })
})

route('GET', '/api/samples', () => json({
  period: periodKey(DEMO_MONTH), label: periodLabel(DEMO_MONTH),
  clients: CLIENTS.map((c) => ({ id: c.id, name: c.name, billingTool: c.billingTool, story: c.story, docs: c.docs.map((d) => ({ id: d.id, kind: d.kind, label: d.label, file: renderDoc(c.id, d.id).name })) })),
}))

route('GET', '/api/samples/:clientId/:docId', ({ params }) => {
  const c = CLIENTS.find((x) => x.id === params.clientId)
  const d = c?.docs.find((x) => x.id === params.docId)
  if (!c || !d) throw new HttpError(404, 'Sample not found.')
  const r = renderDoc(c.id, d.id)
  return new Response(sheetToBytes(r.sheet, r.ext) as unknown as BodyInit, { headers: { 'content-type': r.ext === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${r.name}"` } })
})

route('POST', '/api/workspace/reset', async ({ req, db, user }) => {
  const { confirm } = await body<{ confirm?: string }>(req)
  if (confirm !== 'RESET') throw new HttpError(422, 'Type RESET to confirm.', 'confirm')
  wipeWorkspace(db)
  await seedDemo(db)
  audit(db, { actor: user.name, action: 'Workspace reset', detail: 'All clients, files and decisions replaced with the demo set' })
  return json({ ok: true })
})

export async function handleApi(req: Request, db: DB): Promise<Response> {
  const url = new URL(req.url)
  // CSRF defence in depth (cookies are already SameSite=Strict): state-changing requests must come from this origin.
  if (!['GET', 'HEAD'].includes(req.method)) {
    const origin = req.headers.get('origin')
    if (origin && new URL(origin).host !== url.host) return json({ error: 'Cross-site request blocked.' }, 403)
  }
  const match = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname))
  if (!match) {
    const other = routes.some((r) => r.pattern.test(url.pathname))
    return json({ error: other ? 'Method not allowed.' : 'Not found.' }, other ? 405 : 404)
  }
  const m = url.pathname.match(match.pattern)!
  const params = Object.fromEntries(match.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
  try {
    const user = await userFromRequest(db, req)
    if (!user && !match.public) return json({ error: 'Please sign in.' }, 401)
    return await match.handler({ req, db, user: user!, params, url })
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, field: e.field }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong on our side. Your data is unchanged; please try again.' }, 500)
  }
}

