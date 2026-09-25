import { formatNpr, vatOn } from './money'
import { formatBs } from './dates'
import type { Invoice, Issue, Txn } from './types'

export interface ValidationResult {
  issues: Issue[]
  /** Invoice ids excluded from VAT totals (outside the month, exact duplicates). */
  excludedInvoices: Set<string>
  /** Txn ids dropped (duplicate rows, outside the month). */
  excludedTxns: Set<string>
  /** Purchase ids whose input VAT can't be claimed (missing/invalid supplier PAN). */
  disallowedInput: Set<string>
}

const isPan = (p: string) => /^\d{9}$/.test(p)

export function validate(txns: Txn[], invoices: Invoice[], month: { startAd: string; endAd: string }): ValidationResult {
  const issues: Issue[] = []
  const excludedInvoices = new Set<string>()
  const excludedTxns = new Set<string>()
  const disallowedInput = new Set<string>()
  let n = 0
  const add = (i: Omit<Issue, 'id'>) => issues.push({ id: `iss-${++n}`, ...i })
  const inMonth = (d: string) => d >= month.startAd && d <= month.endAd

  // --- bank ---
  const seen = new Map<string, Txn>()
  for (const t of txns) {
    const prior = seen.get(t.dedupeHash)
    if (prior) {
      excludedTxns.add(t.id)
      add({ severity: 'info', code: 'BANK_DUPLICATE_ROW', docId: t.docId, sourceRow: t.sourceRow, refId: t.id,
        message: `Row ${t.sourceRow} repeats row ${prior.sourceRow} exactly (${t.narration}, ${formatNpr(t.credit || t.debit)}). Counted once.` })
      continue
    }
    seen.set(t.dedupeHash, t)
    if (!inMonth(t.dateAd)) {
      excludedTxns.add(t.id)
      add({ severity: 'info', code: 'BANK_OUTSIDE_MONTH', docId: t.docId, sourceRow: t.sourceRow, refId: t.id,
        message: `Row ${t.sourceRow} is dated ${formatBs(t.dateBs)}, outside this month. Ignored for reconciliation.` })
    }
  }

  // --- registers ---
  const byBill = new Map<string, Invoice>()
  for (const inv of invoices) {
    const label = inv.kind === 'sales' ? 'Sales' : 'Purchase'
    if (!inMonth(inv.dateAd)) {
      excludedInvoices.add(inv.id)
      add({ severity: 'error', code: 'BILL_OUTSIDE_MONTH', docId: inv.docId, sourceRow: inv.sourceRow, refId: inv.id,
        message: `${label} bill ${inv.billNo} is dated ${formatBs(inv.dateBs)}, which belongs to a different month. Excluded from this VAT return.` })
      continue
    }
    const key = `${inv.kind}|${inv.billNo}`
    const prior = byBill.get(key)
    if (prior && inv.kind === 'sales') {
      const exact = prior.total === inv.total && prior.dateAd === inv.dateAd
      if (exact) excludedInvoices.add(inv.id)
      add({ severity: 'error', code: 'DUPLICATE_BILL', docId: inv.docId, sourceRow: inv.sourceRow, refId: inv.id,
        message: exact
          ? `Bill ${inv.billNo} appears twice (rows ${prior.sourceRow} and ${inv.sourceRow}) with the same amount. The second copy is excluded; fix the sales book.`
          : `Bill number ${inv.billNo} is used for two different bills (rows ${prior.sourceRow} and ${inv.sourceRow}). Both kept; check with the client.` })
      if (exact) continue
    }
    byBill.set(key, inv)

    if (!inv.vatDerived) {
      const expected = vatOn(inv.taxable)
      if (Math.abs(expected - inv.vat) > 100) {
        add({ severity: 'error', code: 'VAT_NOT_13', docId: inv.docId, sourceRow: inv.sourceRow, refId: inv.id,
          message: `${label} bill ${inv.billNo}: VAT is ${formatNpr(inv.vat)} but 13% of ${formatNpr(inv.taxable)} is ${formatNpr(expected)} (difference ${formatNpr(inv.vat - expected, { sign: true })}).` })
      }
    }
    if (Math.abs(inv.taxable + inv.vat - inv.total) > 100) {
      add({ severity: 'warning', code: 'TOTAL_MISMATCH', docId: inv.docId, sourceRow: inv.sourceRow, refId: inv.id,
        message: `${label} bill ${inv.billNo}: taxable + VAT = ${formatNpr(inv.taxable + inv.vat)} but the bill total says ${formatNpr(inv.total)}.` })
    }
    if (inv.kind === 'purchase' && !isPan(inv.pan)) {
      disallowedInput.add(inv.id)
      add({ severity: 'warning', code: 'PURCHASE_NO_PAN', docId: inv.docId, sourceRow: inv.sourceRow, refId: inv.id,
        message: `Purchase ${inv.billNo} from ${inv.party || 'unknown supplier'} has no valid supplier PAN. Its input VAT (${formatNpr(inv.vat)}) can't be claimed until the PAN is added.` })
    }
    if (inv.kind === 'sales' && inv.pan && !isPan(inv.pan)) {
      add({ severity: 'warning', code: 'SALES_BAD_PAN', docId: inv.docId, sourceRow: inv.sourceRow, refId: inv.id,
        message: `Sales bill ${inv.billNo}: buyer PAN "${inv.pan}" is not 9 digits.` })
    }
  }
  const derived = invoices.filter((i) => i.vatDerived).length
  if (derived) {
    add({ severity: 'info', code: 'VAT_DERIVED', message: `${derived} sales bills only had a VAT-inclusive total. Taxable value and VAT were derived (total ÷ 1.13).` })
  }
  return { issues, excludedInvoices, excludedTxns, disallowedInput }
}
