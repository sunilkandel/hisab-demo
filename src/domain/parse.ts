/**
 * Format detection + parsing. Each "profile" describes one real-world file layout:
 * which header words identify it, which calendar its dates use, and where each field lives.
 * Detection scans the first rows for a header row (files often start with bank names, titles, periods).
 */
import { parseDateCell } from './dates'
import { fnv1a } from './files'
import { parseMoney, splitInclusive, toAsciiDigits } from './money'
import type { DocKind, FormatId, Invoice, PaymentMode, Sheet, Txn } from './types'

type BankField = 'date' | 'narration' | 'ref' | 'debit' | 'credit' | 'balance'
type BillField = 'date' | 'billNo' | 'party' | 'pan' | 'taxable' | 'vat' | 'total' | 'mode'

interface Profile {
  id: FormatId | 'generic-bank' | 'generic-register'
  label: string
  kinds: DocKind[]
  calendar: 'BS' | 'AD' | 'auto'
  fields: Record<string, string[]> // field -> accepted header texts (lowercase)
  required: string[]
}

const PROFILES: Profile[] = [
  {
    id: 'sagarmatha-xlsx', label: 'Sagarmatha Demo Bank statement (XLSX, AD dates)', kinds: ['bank'], calendar: 'AD',
    fields: { date: ['txn date'], narration: ['description'], ref: ['cheque/ref no'], debit: ['debit'], credit: ['credit'], balance: ['balance'] },
    required: ['date', 'narration', 'debit', 'credit'],
  },
  {
    id: 'gandaki-csv', label: 'Gandaki Demo Bank statement (CSV, BS dates)', kinds: ['bank'], calendar: 'BS',
    fields: { date: ['date (bs)'], narration: ['particulars'], ref: ['reference'], debit: ['withdrawal'], credit: ['deposit'], balance: ['balance'] },
    required: ['date', 'narration', 'debit', 'credit'],
  },
  {
    id: 'busy-sales-xlsx', label: 'BUSY sales register (XLSX, BS dates)', kinds: ['sales'], calendar: 'BS',
    fields: { date: ['date'], billNo: ['vch/bill no'], party: ['particulars'], pan: ['pan no.'], taxable: ['taxable amt'], vat: ['vat amt'], total: ['bill amt'], mode: ['pay mode'] },
    required: ['date', 'billNo', 'taxable', 'vat'],
  },
  {
    id: 'busy-purchase-xlsx', label: 'BUSY purchase register (XLSX, BS dates)', kinds: ['purchase'], calendar: 'BS',
    fields: { date: ['date'], billNo: ['supplier inv no'], party: ['particulars'], pan: ['pan no.'], taxable: ['taxable amt'], vat: ['vat amt'], total: ['bill amt'] },
    required: ['date', 'billNo', 'taxable', 'vat'],
  },
  {
    id: 'tigg-sales-csv', label: 'Tigg invoice export (CSV, AD dates)', kinds: ['sales'], calendar: 'AD',
    fields: { date: ['invoice date'], billNo: ['invoice number'], party: ['customer'], pan: ['customer pan'], taxable: ['sub total'], vat: ['tax'], total: ['grand total'], mode: ['payment method'] },
    required: ['date', 'billNo', 'taxable', 'vat'],
  },
  {
    id: 'tigg-purchase-csv', label: 'Tigg bill export (CSV, AD dates)', kinds: ['purchase'], calendar: 'AD',
    fields: { date: ['bill date'], billNo: ['bill number'], party: ['supplier'], pan: ['supplier pan'], taxable: ['sub total'], vat: ['tax'], total: ['grand total'] },
    required: ['date', 'billNo', 'taxable', 'vat'],
  },
  {
    id: 'tally-sales-xlsx', label: 'Tally sales register (XLSX, Excel serial dates)', kinds: ['sales'], calendar: 'AD',
    fields: { date: ['date'], party: ['particulars'], billNo: ['voucher no.'], pan: ['pan'], taxable: ['value'], vat: ['vat @13%'], total: ['gross total'] },
    required: ['date', 'billNo', 'taxable', 'vat'],
  },
  {
    id: 'tally-purchase-xlsx', label: 'Tally purchase register (XLSX, Excel serial dates)', kinds: ['purchase'], calendar: 'AD',
    fields: { date: ['date'], party: ['particulars'], billNo: ['voucher no.'], pan: ['pan'], taxable: ['value'], vat: ['vat @13%'], total: ['gross total'] },
    required: ['date', 'billNo', 'taxable', 'vat'],
  },
  {
    id: 'manual-sales-xlsx', label: 'Manual sales book (Excel, Nepali headers, VAT-inclusive)', kinds: ['sales'], calendar: 'BS',
    fields: { date: ['मिति'], billNo: ['बिल नं'], party: ['ग्राहक'], pan: ['प्यान'], total: ['जम्मा रकम (भ्याट सहित)'], mode: ['भुक्तानी'] },
    required: ['date', 'billNo', 'total'],
  },
  {
    id: 'manual-purchase-xlsx', label: 'Manual purchase book (Excel, Nepali headers)', kinds: ['purchase'], calendar: 'BS',
    fields: { date: ['मिति'], billNo: ['बिल नं'], party: ['सप्लायर'], pan: ['प्यान'], taxable: ['करयोग्य रकम'], vat: ['भ्याट'] },
    required: ['date', 'billNo', 'taxable', 'vat'],
  },
  // Fallbacks so a real file with common headers still imports.
  {
    id: 'generic-bank', label: 'Generic bank statement (auto-mapped columns)', kinds: ['bank'], calendar: 'auto',
    fields: {
      date: ['date', 'txn date', 'transaction date', 'tran date', 'value date', 'miti', 'मिति'],
      narration: ['description', 'particulars', 'narration', 'remarks', 'details'],
      ref: ['reference', 'ref no', 'cheque no', 'chq no', 'ref', 'cheque/ref no'],
      debit: ['debit', 'withdrawal', 'withdraw', 'dr', 'debit amount'],
      credit: ['credit', 'deposit', 'cr', 'credit amount'],
      balance: ['balance', 'running balance'],
    },
    required: ['date', 'narration', 'debit', 'credit'],
  },
  {
    id: 'generic-register', label: 'Generic sales/purchase register (auto-mapped columns)', kinds: ['sales', 'purchase'], calendar: 'auto',
    fields: {
      date: ['date', 'invoice date', 'bill date', 'miti', 'मिति'],
      billNo: ['bill no', 'invoice no', 'invoice number', 'bill number', 'voucher no', 'बिल नं'],
      party: ['customer', 'supplier', 'party', 'particulars', 'name'],
      pan: ['pan', 'pan no', 'vat no', 'प्यान'],
      taxable: ['taxable', 'taxable amount', 'amount', 'sub total', 'net amount'],
      vat: ['vat', 'vat amount', 'tax', 'vat 13%'],
      total: ['total', 'grand total', 'bill amount', 'gross total'],
      mode: ['payment', 'payment mode', 'mode', 'pay mode'],
    },
    required: ['date', 'billNo'],
  },
]

const norm = (c: unknown) => toAsciiDigits(String(c ?? '')).trim().toLowerCase().replace(/\s+/g, ' ')

export interface Detection {
  format: FormatId | null
  label: string
  headerRow: number
  columns: Record<string, number>
  calendar: 'BS' | 'AD' | 'auto'
}

export function detectFormat(sheet: Sheet, kind: DocKind): Detection | null {
  let best: (Detection & { score: number; specific: boolean }) | null = null
  for (const p of PROFILES) {
    if (!p.kinds.includes(kind)) continue
    for (let r = 0; r < Math.min(sheet.length, 20); r++) {
      const cells = (sheet[r] ?? []).map(norm)
      const columns: Record<string, number> = {}
      for (const [field, aliases] of Object.entries(p.fields)) {
        const idx = cells.findIndex((c) => aliases.includes(c))
        if (idx >= 0) columns[field] = idx
      }
      if (!p.required.every((f) => f in columns)) continue
      const score = Object.keys(columns).length
      const specific = !p.id.startsWith('generic')
      const better = !best || (specific && !best.specific) || (specific === best.specific && score > best.score)
      if (better) {
        best = { format: specific ? (p.id as FormatId) : null, label: p.label, headerRow: r, columns, calendar: p.calendar, score, specific }
      }
    }
  }
  if (!best) return null
  const { score: _s, specific: _sp, ...det } = best
  return det
}

function resolveCalendar(sheet: Sheet, det: Detection): 'BS' | 'AD' {
  if (det.calendar !== 'auto') return det.calendar
  for (let r = det.headerRow + 1; r < sheet.length; r++) {
    const v = sheet[r]?.[det.columns.date]
    const m = toAsciiDigits(String(v ?? '')).match(/(\d{4})/)
    if (m) return +m[1] > 2060 ? 'BS' : 'AD'
  }
  return 'AD'
}

export function parseMode(v: unknown): PaymentMode {
  const s = norm(v)
  if (!s) return 'Unknown'
  if (s.includes('qr') || s.includes('fonepay') || s.includes('wallet')) return 'QR'
  if (s.includes('cash') || s.includes('नगद')) return 'Cash'
  if (s.includes('bank') || s.includes('बैंक') || s.includes('cheque') || s.includes('transfer')) return 'Bank'
  if (s.includes('credit') || s.includes('उधारो')) return 'Credit'
  return 'Unknown'
}

export interface ParseReport<T> {
  items: T[]
  skipped: { row: number; reason: string }[]
  calendar: 'BS' | 'AD'
}

export function parseBank(sheet: Sheet, det: Detection, docId: string, account: string): ParseReport<Txn> {
  const cal = resolveCalendar(sheet, det)
  const c = det.columns as Record<BankField, number>
  const items: Txn[] = []
  const skipped: { row: number; reason: string }[] = []
  for (let r = det.headerRow + 1; r < sheet.length; r++) {
    const row = sheet[r] ?? []
    if (row.every((x) => x === null || x === '')) continue
    const date = parseDateCell(row[c.date], cal)
    const narration = String(row[c.narration] ?? '').trim()
    if (!date) { skipped.push({ row: r + 1, reason: `no valid date ("${String(row[c.date] ?? '').slice(0, 40)}")` }); continue }
    const debit = parseMoney(row[c.debit])
    const credit = parseMoney(row[c.credit])
    if (Number.isNaN(debit) || Number.isNaN(credit)) { skipped.push({ row: r + 1, reason: 'unreadable amount' }); continue }
    if (!debit && !credit) { skipped.push({ row: r + 1, reason: `no movement (${narration || 'blank'})` }); continue }
    const ref = c.ref !== undefined ? String(row[c.ref] ?? '').trim() : ''
    items.push({
      id: `${docId}:${r + 1}`, docId, account, dateAd: date.ad, dateBs: date.bs, narration, ref,
      debit: Math.abs(debit), credit: Math.abs(credit),
      dedupeHash: fnv1a([account, date.ad, debit, credit, ref, narration.toUpperCase()].join('|')),
      sourceRow: r + 1,
    })
  }
  return { items, skipped, calendar: cal }
}

export function parseRegister(sheet: Sheet, det: Detection, docId: string, kind: 'sales' | 'purchase'): ParseReport<Invoice> {
  const cal = resolveCalendar(sheet, det)
  const c = det.columns as Partial<Record<BillField, number>>
  const items: Invoice[] = []
  const skipped: { row: number; reason: string }[] = []
  const cell = (row: Sheet[number], f: BillField) => (c[f] === undefined ? null : row[c[f]!])
  for (let r = det.headerRow + 1; r < sheet.length; r++) {
    const row = sheet[r] ?? []
    if (row.every((x) => x === null || x === '')) continue
    const date = parseDateCell(cell(row, 'date'), cal)
    const billNo = String(cell(row, 'billNo') ?? '').trim()
    if (!date) {
      const label = row.map((x) => String(x ?? '')).join(' ').trim()
      skipped.push({ row: r + 1, reason: /total/i.test(label) ? 'totals row' : `no valid date ("${String(cell(row, 'date') ?? '').slice(0, 30)}")` })
      continue
    }
    if (!billNo) { skipped.push({ row: r + 1, reason: 'missing bill number' }); continue }
    let taxable = parseMoney(cell(row, 'taxable'))
    let vat = parseMoney(cell(row, 'vat'))
    let total = parseMoney(cell(row, 'total'))
    let vatDerived = false
    if (c.taxable === undefined && c.total !== undefined) {
      ;({ taxable, vat } = splitInclusive(total))
      vatDerived = true
    }
    if (c.total === undefined || !total) total = taxable + vat
    if ([taxable, vat, total].some(Number.isNaN)) { skipped.push({ row: r + 1, reason: 'unreadable amount' }); continue }
    items.push({
      id: `${docId}:${r + 1}`, docId, kind, billNo,
      dateAd: date.ad, dateBs: date.bs,
      party: String(cell(row, 'party') ?? '').trim(),
      pan: toAsciiDigits(String(cell(row, 'pan') ?? '')).replace(/\D/g, ''),
      taxable, vat, total,
      mode: kind === 'sales' ? parseMode(cell(row, 'mode')) : 'Unknown',
      vatDerived, sourceRow: r + 1,
    })
  }
  return { items, skipped, calendar: cal }
}
