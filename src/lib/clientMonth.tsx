import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, download } from './api'
import { useToast } from './toast'
import { periodKey, periodLabel, type Period } from '../domain/dates'
import type { ClientMonthView } from '../domain/view'
import type { CreditCategory } from '../domain/types'

export interface Detailed extends ClientMonthView {
  result: NonNullable<ClientMonthView['result']>
  credits: NonNullable<ClientMonthView['credits']>
}

interface Ctx {
  v: ClientMonthView
  period: Period
  base: string // `/api/clients/:id/months/:period`
  busy: string | null
  ex: { invoices: Set<string>; txns: Set<string>; disallowed: Set<string> }
  reload: () => Promise<void>
  upload: (docId: string, file: File) => Promise<void>
  attachSample: (docId: string) => Promise<void>
  removeFile: (docId: string) => Promise<void>
  run: () => Promise<ClientMonthView | null>
  decide: (txnId: string, category: CreditCategory, note: string) => Promise<boolean>
  undo: (txnId: string) => Promise<void>
  exportPack: () => Promise<void>
}

const C = createContext<Ctx | null>(null)

export function useClientMonthLoader(clientId: string, period: Period) {
  const [v, setV] = useState<ClientMonthView | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const base = `/api/clients/${encodeURIComponent(clientId)}/months/${periodKey(period)}`
  const reload = useCallback(async () => {
    setError(null)
    try { setV(await api.get<ClientMonthView>(base)) } catch (e) { setError(e as ApiError) }
  }, [base])
  useEffect(() => { setV(null); reload() }, [reload])
  return { v, setV, error, reload, base }
}

export function ClientMonthProvider({ v, setV, reload, base, period, children }: {
  v: ClientMonthView; setV: (v: ClientMonthView) => void; reload: () => Promise<void>; base: string; period: Period; children: ReactNode
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const act = useCallback(async <T,>(key: string, fn: () => Promise<T>, ok?: (r: T) => string | null): Promise<T | null> => {
    setBusy(key)
    try {
      const r = await fn()
      const msg = ok?.(r)
      if (msg) toast(msg)
      return r
    } catch (e) {
      toast((e as Error).message, 'error')
      return null
    } finally { setBusy(null) }
  }, [toast])

  const ex = useMemo(() => ({
    invoices: new Set(v.exclusions?.invoices ?? []), txns: new Set(v.exclusions?.txns ?? []), disallowed: new Set(v.exclusions?.disallowed ?? []),
  }), [v.exclusions])

  const docLabel = (id: string) => v.client.docs.find((d) => d.id === id)?.label ?? id

  const value: Ctx = {
    v, period, base, busy, ex, reload,
    upload: async (docId, file) => {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { toast(`${file.name}: only .xlsx, .xls or .csv files are accepted.`, 'error'); return }
      if (file.size > 5 * 1024 * 1024) { toast(`${file.name} is larger than 5 MB.`, 'error'); return }
      const form = new FormData()
      form.set('file', file)
      const r = await act(`upload:${docId}`, () => api.put<ClientMonthView>(`${base}/files/${encodeURIComponent(docId)}`, form), () => `${file.name} uploaded to ${docLabel(docId)}.`)
      if (r) setV(r)
    },
    attachSample: async (docId) => {
      const r = await act(`upload:${docId}`, () => api.post<ClientMonthView>(`${base}/files/${encodeURIComponent(docId)}/sample`), () => `Demo sample attached to ${docLabel(docId)}.`)
      if (r) setV(r)
    },
    removeFile: async (docId) => {
      const r = await act(`remove:${docId}`, () => api.del<ClientMonthView>(`${base}/files/${encodeURIComponent(docId)}`), () => `File removed from ${docLabel(docId)}.`)
      if (r) setV(r)
    },
    run: async () => {
      const r = await act('run', () => api.post<ClientMonthView>(`${base}/run`), (x) => `Processed ${periodLabel(period)}: ${x.toReview} deposit(s) to review, ${x.errors} error(s).`)
      if (r) setV(r)
      return r
    },
    decide: async (txnId, category, note) => {
      const r = await act(`decide:${txnId}`, () => api.put<ClientMonthView>(`${base}/decisions/${encodeURIComponent(txnId)}`, { category, note }), () => 'Decision saved.')
      if (r) setV(r)
      return !!r
    },
    undo: async (txnId) => {
      const r = await act(`decide:${txnId}`, () => api.del<ClientMonthView>(`${base}/decisions/${encodeURIComponent(txnId)}`), () => 'Decision undone. The deposit is back in the queue.')
      if (r) setV(r)
    },
    exportPack: async () => {
      const name = await act('export', () => download(`${base}/export`), (n) => `${n} downloaded. Export recorded in the audit log.`)
      if (name) await reload()
    },
  }
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useCM(): Ctx & { v: Detailed } {
  const c = useContext(C)
  if (!c) throw new Error('useCM outside ClientMonthProvider')
  return c as Ctx & { v: Detailed }
}

/** For components that also render before processing (Documents tab). */
export function useCMRaw(): Ctx {
  const c = useContext(C)
  if (!c) throw new Error('useCMRaw outside ClientMonthProvider')
  return c
}
