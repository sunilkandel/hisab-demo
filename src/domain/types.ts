// Core data model. Amounts are always integer paisa (1 NPR = 100 paisa) to avoid float rounding.

export type Paisa = number

export type BillingTool = 'BUSY' | 'Tigg' | 'Tally' | 'Excel (manual)'

export type DocKind = 'bank' | 'sales' | 'purchase'

export interface ExpectedDoc {
  id: string
  kind: DocKind
  label: string // e.g. "Sagarmatha Demo Bank · A/C ...0041"
  account?: string // bank account number for bank docs
  format?: FormatId // known layout for demo samples; real uploads are auto-detected
}

export interface Client {
  id: string
  name: string
  pan: string
  sector: string
  billingTool: BillingTool
  docs: ExpectedDoc[]
  story: string // what the demo scenario shows (empty for real clients)
  demo?: boolean // one of the generated demo clients (sample files available)
}

export type FormatId =
  | 'sagarmatha-xlsx'
  | 'gandaki-csv'
  | 'busy-sales-xlsx'
  | 'busy-purchase-xlsx'
  | 'tigg-sales-csv'
  | 'tigg-purchase-csv'
  | 'tally-sales-xlsx'
  | 'tally-purchase-xlsx'
  | 'manual-sales-xlsx'
  | 'manual-purchase-xlsx'

/** A raw file as the accountant would receive it. */
export interface RawFile {
  docId: string
  name: string
  bytes: Uint8Array
  source: 'sample' | 'upload'
}

/** Rows as read from a spreadsheet: array of arrays of cell values. */
export type Sheet = (string | number | null)[][]

export interface Txn {
  id: string
  docId: string
  account: string
  dateAd: string // YYYY-MM-DD
  dateBs: string // YYYY-MM-DD (BS)
  narration: string
  ref: string
  debit: Paisa
  credit: Paisa
  dedupeHash: string
  sourceRow: number
}

export type PaymentMode = 'Cash' | 'QR' | 'Bank' | 'Credit' | 'Unknown'

export interface Invoice {
  id: string
  docId: string
  kind: 'sales' | 'purchase'
  billNo: string
  dateAd: string
  dateBs: string
  party: string
  pan: string
  taxable: Paisa
  vat: Paisa
  total: Paisa
  mode: PaymentMode
  vatDerived: boolean // true when the source only had a VAT-inclusive total
  sourceRow: number
}

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface Issue {
  id: string
  severity: IssueSeverity
  code: string
  message: string
  docId?: string
  sourceRow?: number
  refId?: string
}

export type CreditCategory =
  | 'matched-sales' // tied to specific bills
  | 'qr-settlement' // daily QR batch matched to QR-mode sales
  | 'own-transfer'
  | 'loan'
  | 'owner-capital'
  | 'refund'
  | 'undeclared-sale'
  | 'other-explained'
  | 'unexplained'

export interface CreditResult {
  txnId: string
  category: CreditCategory
  auto: boolean // decided by rules vs by the accountant
  suggestion?: CreditCategory // rule suggestion awaiting confirmation
  reason: string
  matchedInvoiceIds: string[]
  confidence: number // 0..1
}

export interface ReconSummary {
  totalCredits: Paisa
  declaredSalesTotal: Paisa // VAT-inclusive
  matchedToSales: Paisa
  explainedOther: Paisa
  pendingReview: Paisa
  unexplained: Paisa
  undeclaredConfirmed: Paisa
  cashSalesDeclared: Paisa
  cashDeposits: Paisa
  risk: 'low' | 'medium' | 'high'
}

export interface VatSummary {
  salesTaxable: Paisa
  outputVat: Paisa
  purchaseTaxable: Paisa
  inputVat: Paisa
  inputVatDisallowed: Paisa // purchases without valid supplier PAN
  payable: Paisa // positive = pay, negative = carry forward credit
  salesCount: number
  purchaseCount: number
}

export interface StepLog {
  step: 'store' | 'detect' | 'parse' | 'validate' | 'reconcile' | 'vat'
  title: string
  detail: string[]
  ms: number
  ok: boolean
}

export interface ProcessedFile {
  docId: string
  name: string
  sha256: string
  size: number
  format: FormatId | null
  formatLabel: string
  headerRow: number
  rows: number
}

export interface MonthResult {
  clientId: string
  period: string // BS month key, e.g. "2083-05"
  processedAt: string
  files: ProcessedFile[]
  txns: Txn[]
  invoices: Invoice[]
  issues: Issue[]
  credits: CreditResult[]
  steps: StepLog[]
}

export interface AuditEntry {
  at: string
  clientId: string
  actor: string
  action: string
  detail: string
}
