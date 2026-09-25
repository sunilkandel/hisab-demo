import * as XLSX from 'xlsx'
import { formatBs } from './dates'
import type { Client, CreditResult, Invoice, Issue, ReconSummary, Txn, VatSummary } from './types'

const rs = (p: number) => Math.round(p) / 100

/** The downloadable VAT pack: one workbook the accountant files from and keeps as evidence. */
export function buildVatPack(args: {
  client: Client
  monthLabel: string
  vat: VatSummary
  summary: ReconSummary
  sales: Invoice[]
  purchases: Invoice[]
  disallowed: Set<string>
  txns: Txn[]
  credits: CreditResult[]
  issues: Issue[]
  preparedBy: string
}): Uint8Array {
  const { client, vat, summary } = args
  const wb = XLSX.utils.book_new()
  const summarySheet = [
    ['Hisab VAT pack (DEMO: fictional data)'],
    ['Client', client.name],
    ['PAN', client.pan],
    ['Period', args.monthLabel],
    ['Prepared by', args.preparedBy],
    ['Generated at', new Date().toLocaleString()],
    [],
    ['VAT summary', 'NPR'],
    ['Taxable sales', rs(vat.salesTaxable)],
    ['Output VAT (13%)', rs(vat.outputVat)],
    ['Taxable purchases', rs(vat.purchaseTaxable)],
    ['Input VAT', rs(vat.inputVat)],
    ['Input VAT not claimable (no supplier PAN)', rs(vat.inputVatDisallowed)],
    [vat.payable >= 0 ? 'VAT payable' : 'Credit carried forward', rs(Math.abs(vat.payable))],
    [],
    ['Deposit reconciliation', 'NPR'],
    ['Total deposits', rs(summary.totalCredits)],
    ['Declared sales (incl. VAT)', rs(summary.declaredSalesTotal)],
    ['Matched to bills / QR batches / cash sales', rs(summary.matchedToSales)],
    ['Explained (loans, capital, transfers, refunds)', rs(summary.explainedOther)],
    ['Confirmed undeclared sales', rs(summary.undeclaredConfirmed)],
    ['Awaiting confirmation', rs(summary.pendingReview)],
    ['Unexplained', rs(summary.unexplained)],
    ['Mismatch risk', summary.risk.toUpperCase()],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summarySheet), 'Summary')

  const reg = (xs: Invoice[], who: string, withFlag = false) => [
    ['Date (BS)', 'Date (AD)', 'Bill no', who, 'PAN', 'Taxable', 'VAT', 'Total', ...(withFlag ? ['Input VAT claimable'] : [])],
    ...xs.map((i) => [formatBs(i.dateBs), i.dateAd, i.billNo, i.party, i.pan, rs(i.taxable), rs(i.vat), rs(i.total), ...(withFlag ? [args.disallowed.has(i.id) ? 'No (PAN missing)' : 'Yes'] : [])]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reg(args.sales, 'Buyer')), 'Sales register')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reg(args.purchases, 'Supplier', true)), 'Purchase register')

  const byId = new Map(args.txns.map((t) => [t.id, t]))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Date (BS)', 'Account', 'Narration', 'Reference', 'Amount', 'Classification', 'Decided by', 'Reason / note', 'Matched bills'],
    ...args.credits.map((c) => {
      const t = byId.get(c.txnId)!
      return [formatBs(t.dateBs), t.account, t.narration, t.ref, rs(t.credit), c.category, c.auto ? 'Rules' : 'Accountant', c.reason, c.matchedInvoiceIds.length]
    }),
  ]), 'Deposits')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Severity', 'Code', 'Message'],
    ...args.issues.map((i) => [i.severity, i.code, i.message]),
  ]), 'Issues')

  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
