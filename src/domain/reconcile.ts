/**
 * The "mismatch radar". Explains every rupee that came into the client's bank accounts this month,
 * using rules only (no AI on the numbers), so every result can be traced and repeated.
 *
 * Order matters:
 *  1. own transfers between the client's accounts  → not income
 *  2. QR settlements  → matched to that day's QR bills (daily batch, settles next day)
 *  3. bank transfers  → matched to named-customer bills (reference, amount + name, amount only)
 *  4. cash deposits   → covered by declared cash sales not yet deposited
 *  5. keywords        → suggestions (loan, owner capital, refund) the accountant must confirm
 *  6. everything else → unexplained
 */
import { addDays, daysBetween } from './dates'
import { formatNpr } from './money'
import type { CreditCategory, CreditResult, Invoice, Paisa, ReconSummary, Txn } from './types'

const WALK_IN = /walk-?in|cash customer|नगद ग्राहक/i
const TOL = 100 // 1 rupee rounding tolerance

function tokens(s: string): string[] {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !['PVT', 'LTD', 'THE', 'AND', 'CO', 'FROM'].includes(w))
}

/** Small subset-sum: which of these bills add up to the amount? Bounded so it stays fast. */
function subsetSum(bills: Invoice[], target: Paisa): Invoice[] | null {
  const xs = bills.slice(0, 16)
  const n = xs.length
  for (let mask = 1; mask < 1 << n; mask++) {
    let s = 0
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s += xs[i].total
    if (Math.abs(s - target) <= TOL) return xs.filter((_, i) => mask & (1 << i))
  }
  return null
}

export function reconcile(txns: Txn[], sales: Invoice[]): CreditResult[] {
  const credits = txns.filter((t) => t.credit > 0)
  const debits = txns.filter((t) => t.debit > 0)
  const used = new Set<string>() // invoice ids already explained by money
  const results = new Map<string, CreditResult>()
  const set = (t: Txn, category: CreditCategory, reason: string, ids: string[] = [], confidence = 1, suggestion?: CreditCategory) => {
    ids.forEach((i) => used.add(i))
    results.set(t.id, { txnId: t.id, category, auto: true, reason, matchedInvoiceIds: ids, confidence, suggestion })
  }
  const accounts = new Set(txns.map((t) => t.account))

  // 1. own transfers: same amount leaves another account of this client within a day
  if (accounts.size > 1) {
    for (const c of credits) {
      const d = debits.find((x) => x.account !== c.account && x.debit === c.credit && Math.abs(daysBetween(x.dateAd, c.dateAd)) <= 1)
      if (d) set(c, 'own-transfer', `Same amount left the client's other account ${d.account} on ${d.dateBs} ("${d.narration}"). Money moved between own accounts, not income.`)
    }
  }

  const open = () => sales.filter((s) => !used.has(s.id))

  // 2. QR settlements
  const qrCredits = credits.filter((c) => !results.has(c.id) && /\bQR\b|FONEPAY|MERCHANT SETTLEMENT/i.test(c.narration))
  const qrNote = (m: Invoice[]) => `QR batch equals ${m.length} QR bill(s) dated ${[...new Set(m.map((x) => x.dateBs))].join(', ')} (${formatNpr(m.reduce((s, b) => s + b.total, 0))}).`
  // 2a. exact daily batches first, for every QR credit, so one odd deposit can't steal another day's bills
  for (const c of qrCredits) {
    for (let back = 1; back >= 0; back--) {
      // "yesterday's QR bills" first (normal next-day settlement), then same day
      const day = addDays(c.dateAd, -back)
      const qrDay = open().filter((s) => s.dateAd === day && s.mode === 'QR')
      const sum = qrDay.reduce((s, b) => s + b.total, 0)
      if (qrDay.length && Math.abs(sum - c.credit) <= TOL) { set(c, 'qr-settlement', qrNote(qrDay), qrDay.map((m) => m.id)); break }
    }
  }
  // 2b. registers without a payment-mode column (e.g. Tally): find the walk-in bills that add up.
  // Only used when there is no mode information, because with many small bills a random subset
  // can hit almost any amount (false matches).
  for (const c of qrCredits) {
    if (results.has(c.id)) continue
    const cand = open().filter((s) => s.mode === 'Unknown' && WALK_IN.test(s.party) && daysBetween(s.dateAd, c.dateAd) >= 0 && daysBetween(s.dateAd, c.dateAd) <= 2)
    const m = cand.length <= 12 ? subsetSum(cand, c.credit) : null
    if (m) set(c, 'qr-settlement', qrNote(m) + ' (matched by amount: register has no payment-mode column)', m.map((x) => x.id), 0.85)
  }

  // 3. bank transfers from named customers
  for (const c of credits) {
    if (results.has(c.id) || /CASH DEP/i.test(c.narration)) continue
    const window = open().filter((s) => !WALK_IN.test(s.party) && s.mode !== 'Cash' && s.mode !== 'QR' && daysBetween(s.dateAd, c.dateAd) >= 0 && daysBetween(s.dateAd, c.dateAd) <= 5)
    const byRef = window.find((s) => c.ref && (c.ref === s.billNo || c.narration.includes(s.billNo)) && Math.abs(s.total - c.credit) <= TOL)
    if (byRef) { set(c, 'matched-sales', `Reference ${c.ref} is bill ${byRef.billNo} (${byRef.party}), same amount.`, [byRef.id], 1); continue }
    const narr = tokens(c.narration)
    const byName = window.find((s) => Math.abs(s.total - c.credit) <= TOL && tokens(s.party).some((w) => narr.includes(w)))
    if (byName) { set(c, 'matched-sales', `Same amount as bill ${byName.billNo}, and the narration names ${byName.party}.`, [byName.id], 0.95); continue }
    const byAmount = window.filter((s) => Math.abs(s.total - c.credit) <= TOL)
    if (byAmount.length === 1) set(c, 'matched-sales', `Only bill with this exact amount in the last 5 days: ${byAmount[0].billNo} (${byAmount[0].party}). Name not in narration.`, [byAmount[0].id], 0.8)
  }

  // 4. cash deposits covered by declared cash sales
  const cashSales = sales.filter((s) => (s.mode === 'Cash' || (s.mode === 'Unknown' && WALK_IN.test(s.party))) && !used.has(s.id))
  let deposited = 0
  for (const c of [...credits].sort((a, b) => a.dateAd.localeCompare(b.dateAd))) {
    if (results.has(c.id) || !/CASH DEP/i.test(c.narration) || /PROPRIETOR|OWNER|CAPITAL|SELF/i.test(c.narration)) continue
    const declaredSoFar = cashSales.filter((s) => s.dateAd <= c.dateAd).reduce((s, b) => s + b.total, 0)
    if (deposited + c.credit <= declaredSoFar + TOL) {
      deposited += c.credit
      set(c, 'matched-sales', `Covered by declared cash sales not yet banked (${formatNpr(declaredSoFar - deposited + c.credit)} available on ${c.dateBs}).`, [], 0.9)
    }
  }

  // 5 + 6. keyword suggestions, then unexplained
  for (const c of credits) {
    if (results.has(c.id)) continue
    const n = c.narration.toUpperCase()
    if (/INTEREST (CREDIT|CR|PAID)/.test(n)) { set(c, 'other-explained', 'Bank interest credit.', [], 1); continue }
    let suggestion: CreditCategory | undefined
    let why = 'No bill, QR batch, own transfer or cash sales explain this deposit.'
    if (/LOAN|DISBURSE/.test(n)) { suggestion = 'loan'; why = 'Narration mentions a loan. Confirm with the loan statement.' }
    else if (/PROPRIETOR|OWNER|CAPITAL|DIRECTOR/.test(n)) { suggestion = 'owner-capital'; why = "Narration suggests the owner's own money. Confirm and keep evidence." }
    else if (/REFUND|RETURN|REVERSAL/.test(n)) { suggestion = 'refund'; why = 'Narration mentions a refund. Match it to the original payment.' }
    else if (/QR|MERCHANT SETTLEMENT/.test(n)) why = 'QR money arrived but no QR bills that day add up to it. Were bills issued?'
    else if (/PAYOUT|PLATFORM|ONLINE ORDER/.test(n)) why = 'Payout from an online platform. Those orders need sales bills.'
    set(c, 'unexplained', why, [], 0, suggestion)
  }
  return credits.map((c) => results.get(c.id)!)
}

export interface Decision {
  category: CreditCategory
  note: string
  by: string
  at: string
}

export function applyDecisions(credits: CreditResult[], decisions: Record<string, Decision>): CreditResult[] {
  return credits.map((c) => {
    const d = decisions[c.txnId]
    return d ? { ...c, category: d.category, auto: false, reason: d.note ? `Accountant: ${d.note}` : c.reason } : c
  })
}

export function summarize(credits: CreditResult[], txnsById: Map<string, Txn>, sales: Invoice[]): ReconSummary {
  const amt = (c: CreditResult) => txnsById.get(c.txnId)!.credit
  const sum = (f: (c: CreditResult) => boolean) => credits.filter(f).reduce((s, c) => s + amt(c), 0)
  const totalCredits = sum(() => true)
  const declaredSalesTotal = sales.reduce((s, b) => s + b.total, 0)
  const matchedToSales = sum((c) => c.category === 'matched-sales' || c.category === 'qr-settlement')
  const explainedOther = sum((c) => ['own-transfer', 'loan', 'owner-capital', 'refund', 'other-explained'].includes(c.category))
  const pendingReview = sum((c) => c.category === 'unexplained' && !!c.suggestion)
  const unexplained = sum((c) => c.category === 'unexplained' && !c.suggestion)
  const undeclaredConfirmed = sum((c) => c.category === 'undeclared-sale')
  const cashSalesDeclared = sales.filter((s) => s.mode === 'Cash').reduce((s, b) => s + b.total, 0)
  const cashDeposits = credits.filter((c) => /CASH DEP/i.test(txnsById.get(c.txnId)!.narration)).reduce((s, c) => s + amt(c), 0)
  const atRisk = unexplained + pendingReview + undeclaredConfirmed
  const ratio = declaredSalesTotal ? atRisk / declaredSalesTotal : atRisk ? 1 : 0
  const risk = atRisk > 30000000 || ratio > 0.1 ? 'high' : atRisk > 5000000 || ratio > 0.02 ? 'medium' : 'low'
  return { totalCredits, declaredSalesTotal, matchedToSales, explainedOther, pendingReview, unexplained, undeclaredConfirmed, cashSalesDeclared, cashDeposits, risk }
}
