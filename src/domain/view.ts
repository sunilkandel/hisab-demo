/**
 * Derives what the UI shows for one client-month (status, summary, VAT) from stored facts.
 * Shared by the server (API responses) and tests, so there's one definition of "ready".
 */
import { computeVat, exclusionsOf } from './pipeline'
import { applyDecisions, summarize, type Decision } from './reconcile'
import type { Client, CreditResult, MonthResult, ReconSummary, VatSummary } from './types'

export type ClientStatus = 'waiting' | 'not-run' | 'stale' | 'errors' | 'review' | 'ready' | 'exported'

export interface FileMeta {
  docId: string
  name: string
  size: number
  sha256: string
  source: 'sample' | 'upload'
  uploadedAt: string
  uploadedBy: string
}

export interface ClientMonthView {
  client: Client
  period: string
  files: FileMeta[]
  status: ClientStatus
  errors: number
  warnings: number
  toReview: number
  summary?: ReconSummary
  vat?: VatSummary
  exportedAt?: string
  processedAt?: string
  /** Only in the detailed view. */
  result?: MonthResult
  credits?: CreditResult[]
  exclusions?: { invoices: string[]; txns: string[]; disallowed: string[] }
}

export function buildView(args: {
  client: Client
  period: string
  files: FileMeta[]
  result?: MonthResult
  decisions: Record<string, Decision>
  exportedAt?: string
  detailed: boolean
}): ClientMonthView {
  const { client, period, files, result, decisions, exportedAt, detailed } = args
  const allDocs = client.docs.every((d) => files.some((f) => f.docId === d.id))
  const base = { client, period, files, errors: 0, warnings: 0, toReview: 0 }
  if (!result) return { ...base, status: files.length === 0 || !allDocs ? 'waiting' : 'not-run' }

  const ex = exclusionsOf(result)
  const credits = applyDecisions(result.credits, decisions)
  const txnsById = new Map(result.txns.map((t) => [t.id, t]))
  const sales = result.invoices.filter((i) => i.kind === 'sales' && !ex.excludedInvoices.has(i.id))
  const summary = summarize(credits, txnsById, sales)
  const vat = computeVat(result.invoices, ex.excludedInvoices, ex.disallowedInput)
  const errors = result.issues.filter((i) => i.severity === 'error').length
  const warnings = result.issues.filter((i) => i.severity === 'warning').length
  const toReview = credits.filter((c) => c.category === 'unexplained').length
  // Files changed after the last run: results no longer describe what's uploaded.
  const stale = files.some((f) => !result.files.some((r) => r.docId === f.docId && r.sha256 === f.sha256)) || result.files.some((r) => !files.some((f) => f.docId === r.docId))
  const status: ClientStatus = stale ? 'stale' : !allDocs ? 'waiting' : exportedAt ? 'exported' : errors ? 'errors' : toReview ? 'review' : 'ready'

  const view: ClientMonthView = { ...base, status, errors, warnings, toReview, summary, vat, exportedAt, processedAt: result.processedAt }
  if (detailed) {
    view.result = result
    view.credits = credits
    view.exclusions = { invoices: [...ex.excludedInvoices], txns: [...ex.excludedTxns], disallowed: [...ex.disallowedInput] }
  }
  return view
}
