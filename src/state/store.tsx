/**
 * App state for the demo. In the real product this lives in Postgres (per firm, row-level security);
 * here it lives in the browser's localStorage so the demo needs no server.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CLIENTS, DEMO_FIRM, clientById, renderDoc } from '../domain/seed'
import { sheetToBytes } from '../domain/files'
import { runPipeline, exclusionsOf, computeVat } from '../domain/pipeline'
import { applyDecisions, summarize, type Decision } from '../domain/reconcile'
import type { AuditEntry, Client, CreditResult, MonthResult, RawFile, ReconSummary, VatSummary } from '../domain/types'

const KEY = 'hisab-demo-v1'

interface StoredFile { name: string; b64: string; source: 'sample' | 'upload' }
interface Persisted {
  files: Record<string, Record<string, StoredFile>>
  results: Record<string, MonthResult>
  decisions: Record<string, Record<string, Decision>>
  exported: Record<string, string>
  audit: AuditEntry[]
}

const empty: Persisted = { files: {}, results: {}, decisions: {}, exported: {}, audit: [] }

const toB64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s) }
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

function load(): Persisted | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Persisted) : null } catch { return null }
}
function save(p: Persisted) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* storage full or blocked: demo keeps working in memory */ }
}

export function sampleFile(clientId: string, docId: string): RawFile {
  const r = renderDoc(clientId, docId)
  return { docId, name: r.name, bytes: sheetToBytes(r.sheet, r.ext), source: 'sample' }
}

export type ClientStatus = 'waiting' | 'not-run' | 'errors' | 'review' | 'ready' | 'exported'

export interface ClientView {
  client: Client
  files: Record<string, StoredFile>
  result?: MonthResult
  credits: CreditResult[]
  summary?: ReconSummary
  vat?: VatSummary
  status: ClientStatus
  errors: number
  warnings: number
  toReview: number
  exportedAt?: string
}

interface Ctx {
  views: ClientView[]
  view: (id: string) => ClientView
  audit: AuditEntry[]
  ready: boolean
  addFile: (clientId: string, f: RawFile) => void
  removeFile: (clientId: string, docId: string) => void
  run: (clientId: string) => Promise<MonthResult>
  decide: (clientId: string, txnId: string, d: Omit<Decision, 'by' | 'at'> | null, label: string) => void
  markExported: (clientId: string, what: string) => void
  log: (clientId: string, action: string, detail: string) => void
  reset: () => Promise<void>
  getFile: (clientId: string, docId: string) => RawFile | undefined
}

const StoreCtx = createContext<Ctx | null>(null)

async function seed(): Promise<Persisted> {
  const p: Persisted = structuredClone(empty)
  const at = new Date().toISOString()
  for (const c of CLIENTS) {
    // Bagmati Fresh has only sent the bank statement so far: the dashboard shows it waiting.
    const docs = c.id === 'bagmati-fresh' ? c.docs.filter((d) => d.kind === 'bank') : c.docs
    p.files[c.id] = {}
    const raws = docs.map((d) => sampleFile(c.id, d.id))
    for (const f of raws) p.files[c.id][f.docId] = { name: f.name, b64: toB64(f.bytes), source: 'sample' }
    p.audit.push({ at, clientId: c.id, actor: 'Client (email)', action: 'Documents received', detail: raws.map((f) => f.name).join(', ') })
    if (c.id !== 'bagmati-fresh') {
      p.results[c.id] = await runPipeline(c, raws)
      p.audit.push({ at, clientId: c.id, actor: 'Hisab', action: 'Pipeline run', detail: 'Processed on receipt' })
    }
  }
  return p
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Persisted>(empty)
  const [ready, setReady] = useState(false)
  const pRef = useRef(p)
  pRef.current = p

  useEffect(() => {
    const existing = load()
    if (existing) { setP(existing); setReady(true); return }
    seed().then((s) => { setP(s); save(s); setReady(true) })
  }, [])

  const update = useCallback((fn: (d: Persisted) => Persisted) => {
    setP((prev) => { const next = fn(prev); save(next); return next })
  }, [])

  const log = useCallback((clientId: string, action: string, detail: string) => {
    update((d) => ({ ...d, audit: [...d.audit, { at: new Date().toISOString(), clientId, actor: DEMO_FIRM.user, action, detail }] }))
  }, [update])

  const getFile = useCallback((clientId: string, docId: string): RawFile | undefined => {
    const f = pRef.current.files[clientId]?.[docId]
    return f ? { docId, name: f.name, bytes: fromB64(f.b64), source: f.source } : undefined
  }, [])

  const addFile = useCallback((clientId: string, f: RawFile) => {
    update((d) => ({
      ...d,
      files: { ...d.files, [clientId]: { ...(d.files[clientId] ?? {}), [f.docId]: { name: f.name, b64: toB64(f.bytes), source: f.source } } },
      audit: [...d.audit, { at: new Date().toISOString(), clientId, actor: DEMO_FIRM.user, action: f.source === 'upload' ? 'File uploaded' : 'Sample file attached', detail: `${f.name} (${(f.bytes.length / 1024).toFixed(1)} KB)` }],
    }))
  }, [update])

  const removeFile = useCallback((clientId: string, docId: string) => {
    update((d) => {
      const files = { ...(d.files[clientId] ?? {}) }
      const name = files[docId]?.name
      delete files[docId]
      return { ...d, files: { ...d.files, [clientId]: files }, audit: [...d.audit, { at: new Date().toISOString(), clientId, actor: DEMO_FIRM.user, action: 'File removed', detail: name ?? docId }] }
    })
  }, [update])

  const run = useCallback(async (clientId: string) => {
    const client = clientById(clientId)!
    const stored = pRef.current.files[clientId] ?? {}
    const raws = Object.entries(stored).map(([docId, f]) => ({ docId, name: f.name, bytes: fromB64(f.b64), source: f.source }))
    const result = await runPipeline(client, raws)
    update((d) => {
      // keep decisions only for deposits that still exist after re-processing
      const keep = Object.fromEntries(Object.entries(d.decisions[clientId] ?? {}).filter(([id]) => result.credits.some((c) => c.txnId === id)))
      const exported = { ...d.exported }
      delete exported[clientId]
      return {
        ...d,
        results: { ...d.results, [clientId]: result },
        decisions: { ...d.decisions, [clientId]: keep },
        exported,
        audit: [...d.audit, { at: new Date().toISOString(), clientId, actor: DEMO_FIRM.user, action: 'Pipeline run', detail: `${raws.length} files · ${result.issues.length} issues · ${result.credits.length} deposits` }],
      }
    })
    return result
  }, [update])

  const decide = useCallback((clientId: string, txnId: string, dec: Omit<Decision, 'by' | 'at'> | null, label: string) => {
    update((d) => {
      const cur = { ...(d.decisions[clientId] ?? {}) }
      if (dec) cur[txnId] = { ...dec, by: DEMO_FIRM.user, at: new Date().toISOString() }
      else delete cur[txnId]
      const exported = { ...d.exported }
      delete exported[clientId]
      return {
        ...d, decisions: { ...d.decisions, [clientId]: cur }, exported,
        audit: [...d.audit, { at: new Date().toISOString(), clientId, actor: DEMO_FIRM.user, action: dec ? 'Deposit classified' : 'Classification undone', detail: label + (dec?.note ? ` · note: ${dec.note}` : '') }],
      }
    })
  }, [update])

  const markExported = useCallback((clientId: string, what: string) => {
    update((d) => ({ ...d, exported: { ...d.exported, [clientId]: new Date().toISOString() }, audit: [...d.audit, { at: new Date().toISOString(), clientId, actor: DEMO_FIRM.user, action: 'VAT pack exported', detail: what }] }))
  }, [update])

  const reset = useCallback(async () => {
    setReady(false)
    const s = await seed()
    setP(s); save(s); setReady(true)
  }, [])

  const views = useMemo<ClientView[]>(() => CLIENTS.map((client) => {
    const files = p.files[client.id] ?? {}
    const result = p.results[client.id]
    const allDocs = client.docs.every((d) => files[d.id])
    if (!result) return { client, files, credits: [], status: allDocs ? 'not-run' : 'waiting', errors: 0, warnings: 0, toReview: 0 }
    const ex = exclusionsOf(result)
    const credits = applyDecisions(result.credits, p.decisions[client.id] ?? {})
    const txnsById = new Map(result.txns.map((t) => [t.id, t]))
    const sales = result.invoices.filter((i) => i.kind === 'sales' && !ex.excludedInvoices.has(i.id))
    const summary = summarize(credits, txnsById, sales)
    const vat = computeVat(result.invoices, ex.excludedInvoices, ex.disallowedInput)
    const errors = result.issues.filter((i) => i.severity === 'error').length
    const warnings = result.issues.filter((i) => i.severity === 'warning').length
    const toReview = credits.filter((c) => c.category === 'unexplained').length
    const exportedAt = p.exported[client.id]
    const status: ClientStatus = !allDocs ? 'waiting' : exportedAt ? 'exported' : errors ? 'errors' : toReview ? 'review' : 'ready'
    return { client, files, result, credits, summary, vat, status, errors, warnings, toReview, exportedAt }
  }), [p])

  const view = useCallback((id: string) => views.find((v) => v.client.id === id)!, [views])

  const value: Ctx = { views, view, audit: p.audit, ready, addFile, removeFile, run, decide, markExported, log, reset, getFile }
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore outside provider')
  return c
}
