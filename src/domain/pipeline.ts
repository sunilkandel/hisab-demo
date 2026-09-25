/**
 * Runs one client-month through every step, the same way a real upload would:
 * store → detect → parse → validate → reconcile → VAT. Each step records what it did.
 */
import { bytesToSheet, sha256Hex } from './files'
import { detectFormat, parseBank, parseRegister } from './parse'
import { reconcile } from './reconcile'
import { monthRangeAd } from './seed'
import { validate } from './validate'
import { formatNpr } from './money'
import type { Client, CreditResult, Invoice, Issue, MonthResult, ProcessedFile, RawFile, StepLog, Txn, VatSummary } from './types'

export function computeVat(invoices: Invoice[], excluded: Set<string>, disallowed: Set<string>): VatSummary {
  const sales = invoices.filter((i) => i.kind === 'sales' && !excluded.has(i.id))
  const purchases = invoices.filter((i) => i.kind === 'purchase' && !excluded.has(i.id))
  const sum = (xs: Invoice[], k: 'taxable' | 'vat') => xs.reduce((s, x) => s + x[k], 0)
  const inputVat = sum(purchases, 'vat')
  const inputVatDisallowed = sum(purchases.filter((p) => disallowed.has(p.id)), 'vat')
  const outputVat = sum(sales, 'vat')
  return {
    salesTaxable: sum(sales, 'taxable'),
    outputVat,
    purchaseTaxable: sum(purchases, 'taxable'),
    inputVat,
    inputVatDisallowed,
    payable: outputVat - (inputVat - inputVatDisallowed),
    salesCount: sales.length,
    purchaseCount: purchases.length,
  }
}

export async function runPipeline(client: Client, files: RawFile[]): Promise<MonthResult> {
  const { start, end } = monthRangeAd()
  const steps: StepLog[] = []
  const issues: Issue[] = []
  const processed: ProcessedFile[] = []
  const txns: Txn[] = []
  const invoices: Invoice[] = []
  const time = () => performance.now()

  // 1. store
  let t0 = time()
  const hashes = new Map<string, string>()
  for (const f of files) hashes.set(f.docId, await sha256Hex(f.bytes))
  const dupFiles = [...hashes.entries()].filter(([, h], i, arr) => arr.findIndex(([, x]) => x === h) !== i)
  steps.push({
    step: 'store', title: 'Store raw files', ok: dupFiles.length === 0, ms: time() - t0,
    detail: [
      ...files.map((f) => `${f.name}: ${(f.bytes.length / 1024).toFixed(1)} KB, SHA-256 ${hashes.get(f.docId)!.slice(0, 12)}…`),
      ...dupFiles.map(([id]) => `Same file uploaded twice (${id}). Second copy ignored.`),
    ],
  })
  const missing = client.docs.filter((d) => !files.some((f) => f.docId === d.id))
  for (const d of missing) issues.push({ id: `miss-${d.id}`, severity: 'error', code: 'MISSING_DOCUMENT', docId: d.id, message: `Missing document: ${d.label}. Results are incomplete until it's uploaded.` })

  // 2 + 3. detect + parse
  t0 = time()
  const detectLines: string[] = []
  const parseLines: string[] = []
  for (const f of files) {
    if (dupFiles.some(([id]) => id === f.docId)) continue
    const doc = client.docs.find((d) => d.id === f.docId)!
    const sheet = bytesToSheet(f.bytes, f.name)
    const det = detectFormat(sheet, doc.kind)
    if (!det) {
      detectLines.push(`${f.name}: format not recognised`)
      issues.push({ id: `fmt-${f.docId}`, severity: 'error', code: 'UNKNOWN_FORMAT', docId: f.docId, message: `${f.name}: no known ${doc.kind} layout found in the first 20 rows. Check it's the right file.` })
      processed.push({ docId: f.docId, name: f.name, sha256: hashes.get(f.docId)!, size: f.bytes.length, format: null, formatLabel: 'Not recognised', headerRow: -1, rows: sheet.length })
      continue
    }
    detectLines.push(`${f.name} → ${det.label} (header on row ${det.headerRow + 1}; columns: ${Object.keys(det.columns).join(', ')})`)
    processed.push({ docId: f.docId, name: f.name, sha256: hashes.get(f.docId)!, size: f.bytes.length, format: det.format, formatLabel: det.label, headerRow: det.headerRow + 1, rows: sheet.length })
    if (doc.kind === 'bank') {
      const rep = parseBank(sheet, det, f.docId, doc.account ?? f.docId)
      txns.push(...rep.items)
      parseLines.push(`${f.name}: ${rep.items.length} transactions (${rep.calendar} dates), ${rep.skipped.length} rows skipped${rep.skipped.length ? ': ' + summarizeSkips(rep.skipped) : ''}`)
    } else {
      const rep = parseRegister(sheet, det, f.docId, doc.kind)
      invoices.push(...rep.items)
      parseLines.push(`${f.name}: ${rep.items.length} bills (${rep.calendar} dates), ${rep.skipped.length} rows skipped${rep.skipped.length ? ': ' + summarizeSkips(rep.skipped) : ''}`)
    }
  }
  const tDetect = time() - t0
  steps.push({ step: 'detect', title: 'Detect file formats', ok: !issues.some((i) => i.code === 'UNKNOWN_FORMAT'), ms: tDetect / 2, detail: detectLines })
  steps.push({ step: 'parse', title: 'Parse & normalise', ok: true, ms: tDetect / 2, detail: [...parseLines, 'All amounts stored as integer paisa; every date stored in both BS and AD.'] })

  // 4. validate
  t0 = time()
  const v = validate(txns, invoices, { startAd: start, endAd: end })
  issues.push(...v.issues)
  const count = (s: string) => v.issues.filter((i) => i.severity === s).length
  steps.push({
    step: 'validate', title: 'Validate', ok: count('error') === 0, ms: time() - t0,
    detail: [
      `${count('error')} errors, ${count('warning')} warnings, ${count('info')} notes`,
      `${v.excludedTxns.size} bank rows set aside (duplicates / other months)`,
      `${v.excludedInvoices.size} bills excluded from VAT (duplicates / other months)`,
      `${v.disallowedInput.size} purchases without a valid supplier PAN`,
    ],
  })

  // 5. reconcile
  t0 = time()
  const cleanTxns = txns.filter((x) => !v.excludedTxns.has(x.id))
  const cleanSales = invoices.filter((i) => i.kind === 'sales' && !v.excludedInvoices.has(i.id))
  const credits: CreditResult[] = reconcile(cleanTxns, cleanSales)
  const byCat = (c: string) => credits.filter((x) => x.category === c).length
  const unexplainedAmt = credits.filter((c) => c.category === 'unexplained').reduce((s, c) => s + cleanTxns.find((t) => t.id === c.txnId)!.credit, 0)
  steps.push({
    step: 'reconcile', title: 'Reconcile deposits', ok: unexplainedAmt === 0, ms: time() - t0,
    detail: [
      `${credits.length} deposits checked`,
      `${byCat('qr-settlement')} QR batches matched to QR bills · ${byCat('matched-sales')} matched to bills or cash sales`,
      `${byCat('own-transfer')} transfers between own accounts`,
      `${byCat('unexplained')} need review (NPR ${formatNpr(unexplainedAmt)})`,
    ],
  })

  // 6. VAT
  t0 = time()
  const vat = computeVat(invoices, v.excludedInvoices, v.disallowedInput)
  steps.push({
    step: 'vat', title: 'Compute VAT', ok: true, ms: time() - t0,
    detail: [
      `Output VAT ${formatNpr(vat.outputVat)} on ${vat.salesCount} sales bills`,
      `Input VAT ${formatNpr(vat.inputVat)} on ${vat.purchaseCount} purchases (${formatNpr(vat.inputVatDisallowed)} not claimable)`,
      `${vat.payable >= 0 ? 'VAT payable' : 'Credit carried forward'}: NPR ${formatNpr(Math.abs(vat.payable))}`,
    ],
  })

  return {
    clientId: client.id,
    processedAt: new Date().toISOString(),
    files: processed,
    txns,
    invoices,
    issues,
    credits,
    steps,
  }
}

function summarizeSkips(skips: { reason: string }[]): string {
  const counts = new Map<string, number>()
  for (const s of skips) {
    const key = s.reason.replace(/\(.*\)/, '').trim()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([k, n]) => `${n}× ${k}`).join(', ')
}

/** Re-derive exclusions from a stored result (validation is deterministic). */
export function exclusionsOf(r: MonthResult) {
  const { start, end } = monthRangeAd()
  return validate(r.txns, r.invoices, { startAd: start, endAd: end })
}
