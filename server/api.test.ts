import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createServer } from './index'
import { DEFAULT_USER } from './auth'

let base = ''
let stop: () => void
let cookie = ''

beforeAll(async () => {
  const { server } = await createServer({ port: 0, dbPath: ':memory:' })
  base = `http://localhost:${server.port}`
  stop = () => server.stop(true)
})
afterAll(() => stop())

const api = (path: string, init: RequestInit = {}) =>
  fetch(base + path, { ...init, headers: { ...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(init.headers as Record<string, string>) } })

describe('auth', () => {
  test('API requires a session', async () => {
    const r = await api('/api/clients?period=2083-05')
    expect(r.status).toBe(401)
  })
  test('wrong password is rejected with a clear message', async () => {
    const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'demo', password: 'nope' }) })
    expect(r.status).toBe(401)
    expect((await r.json()).error).toContain('don’t match')
  })
  test('default credentials sign in and set a secure cookie', async () => {
    const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: DEFAULT_USER.username, password: DEFAULT_USER.password }) })
    expect(r.status).toBe(200)
    const set = r.headers.get('set-cookie')!
    expect(set).toContain('HttpOnly')
    expect(set).toContain('SameSite=Strict')
    cookie = set.split(';')[0]
    const me = await (await api('/api/auth/me')).json()
    expect(me.user.isDefaultPassword).toBe(true)
  })
  test('weak new password is refused', async () => {
    const r = await api('/api/auth/password', { method: 'POST', body: JSON.stringify({ current: DEFAULT_USER.password, next: 'short' }) })
    expect(r.status).toBe(422)
  })
})

describe('security', () => {
  test('cookie is marked Secure when a proxy reports HTTPS', async () => {
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' }, body: JSON.stringify({ username: DEFAULT_USER.username, password: DEFAULT_USER.password }) })
    expect(r.headers.get('set-cookie')).toContain('Secure')
  })
  test('cross-site POST is blocked', async () => {
    const r = await api('/api/clients', { method: 'POST', body: '{}', headers: { origin: 'https://evil.example' } })
    expect(r.status).toBe(403)
  })
  test('security headers are present', async () => {
    const r = await api('/api/health')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
  })
  test('unknown API path is 404', async () => {
    expect((await api('/api/nope')).status).toBe(404)
  })
})

describe('demo workspace', () => {
  test('six demo clients seeded with expected statuses', async () => {
    const j = await (await api('/api/clients?period=2083-05')).json()
    const s = Object.fromEntries(j.clients.map((c: { client: { id: string }; status: string }) => [c.client.id, c.status]))
    expect(s['lalitpur-hardware']).toBe('ready')
    expect(s['ram-pharmacy']).toBe('review')
    expect(s['bagmati-fresh']).toBe('waiting')
  })
  test('invalid period is rejected', async () => {
    expect((await api('/api/clients?period=May')).status).toBe(400)
  })
})

describe('new client: create → upload → process → review → export', () => {
  let id = ''
  test('validation errors name the field', async () => {
    const r = await api('/api/clients', { method: 'POST', body: JSON.stringify({ name: 'Test Traders', pan: '12345', billingTool: 'BUSY', banks: [{ bank: 'Test Bank', account: '1234567' }] }) })
    expect(r.status).toBe(422)
    expect((await r.json()).field).toBe('pan')
  })
  test('duplicate PAN is refused', async () => {
    const r = await api('/api/clients', { method: 'POST', body: JSON.stringify({ name: 'Copy', pan: '601234587', billingTool: 'BUSY', banks: [{ bank: 'X Bank', account: '9999' }] }) })
    expect(r.status).toBe(409)
  })
  test('client is created with document slots', async () => {
    const r = await api('/api/clients', { method: 'POST', body: JSON.stringify({ name: 'Shree Test Pharmacy', pan: '612345678', sector: 'Pharmacy · Butwal', billingTool: 'BUSY', banks: [{ bank: 'Sagarmatha Demo Bank', account: '01234500041' }] }) })
    expect(r.status).toBe(201)
    const { client } = await r.json()
    id = client.id
    expect(client.docs.map((d: { kind: string }) => d.kind)).toEqual(['bank', 'sales', 'purchase'])
  })
  test('uploads a sample file set and processes it for real', async () => {
    const { client } = await (await api(`/api/clients/${id}`)).json()
    const pairs: [string, string][] = [[client.docs[0].id, 'rp-bank'], ['sales', 'rp-sales'], ['purchase', 'rp-purch']]
    for (const [docId, sample] of pairs) {
      const f = await api(`/api/samples/ram-pharmacy/${sample}`)
      const name = /filename="([^"]+)"/.exec(f.headers.get('content-disposition')!)![1]
      const form = new FormData()
      form.set('file', new File([await f.arrayBuffer()], name))
      const up = await api(`/api/clients/${id}/months/2083-05/files/${docId}`, { method: 'PUT', body: form })
      expect(up.status).toBe(200)
    }
    const run = await api(`/api/clients/${id}/months/2083-05/run`, { method: 'POST' })
    expect(run.status).toBe(200)
    const v = await run.json()
    expect(v.status).toBe('review')
    expect(v.summary.unexplained).toBe(37000000)
    expect(v.result.files.every((f: { format: string | null }) => f.format)).toBe(true)
  })
  test('rejects non-spreadsheet uploads', async () => {
    const form = new FormData()
    form.set('file', new File(['hello'], 'notes.txt'))
    expect((await api(`/api/clients/${id}/months/2083-05/files/sales`, { method: 'PUT', body: form })).status).toBe(415)
  })
  test('export is blocked while deposits need review', async () => {
    expect((await api(`/api/clients/${id}/months/2083-05/export`)).status).toBe(409)
  })
  test('classifying every deposit unlocks export', async () => {
    let v = await (await api(`/api/clients/${id}/months/2083-05`)).json()
    for (const c of v.credits.filter((x: { category: string }) => x.category === 'unexplained')) {
      const category = c.suggestion ?? 'undeclared-sale'
      const r = await api(`/api/clients/${id}/months/2083-05/decisions/${encodeURIComponent(c.txnId)}`, { method: 'PUT', body: JSON.stringify({ category, note: 'Checked with client' }) })
      expect(r.status).toBe(200)
      v = await r.json()
    }
    expect(v.toReview).toBe(0)
    expect(v.summary.undeclaredConfirmed).toBe(37000000)
    const ex = await api(`/api/clients/${id}/months/2083-05/export`)
    expect(ex.status).toBe(200)
    expect(ex.headers.get('content-type')).toContain('spreadsheetml')
    const after = await (await api(`/api/clients/${id}/months/2083-05`)).json()
    expect(after.status).toBe('exported')
  })
  test('audit log records the whole story', async () => {
    const { entries } = await (await api(`/api/audit?clientId=${id}`)).json()
    const actions = entries.map((e: { action: string }) => e.action)
    for (const a of ['Client added', 'File uploaded', 'Processed', 'Deposit classified', 'VAT pack exported']) expect(actions).toContain(a)
  })
  test('client can be deleted', async () => {
    expect((await api(`/api/clients/${id}`, { method: 'DELETE' })).status).toBe(200)
    expect((await api(`/api/clients/${id}`)).status).toBe(404)
  })
})

describe('analytics', () => {
  test('records a page view without cookies, and honours Do Not Track', async () => {
    const before = await (await api('/api/analytics')).json()
    const count = (x: { topPaths: { path: string; views: number }[] }) => x.topPaths.find((p) => p.path === '/faq')?.views ?? 0
    await fetch(base + '/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/faq' }) })
    await fetch(base + '/api/events', { method: 'POST', headers: { 'content-type': 'application/json', dnt: '1' }, body: JSON.stringify({ path: '/faq' }) })
    const after = await (await api('/api/analytics')).json()
    expect(count(after) - count(before)).toBe(1)
  })
})

describe('SEO files and public session check', () => {
  test('robots.txt blocks the app and points to the sitemap', async () => {
    const t = await (await fetch(base + '/robots.txt')).text()
    expect(t).toContain('Disallow: /app')
    expect(t).toContain(`Sitemap: ${base}/sitemap.xml`)
  })
  test('sitemap lists public pages only', async () => {
    const x = await (await fetch(base + '/sitemap.xml')).text()
    expect(x).toContain(`<loc>${base}/faq</loc>`)
    expect(x).not.toContain('/app')
  })
  test('session check answers without an error when signed out', async () => {
    const r = await fetch(base + '/api/auth/me')
    expect(r.status).toBe(200)
    expect((await r.json()).user).toBeNull()
  })
})
