import type { Paisa } from './types'

const DEVANAGARI = '०१२३४५६७८९'

export function toAsciiDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(DEVANAGARI.indexOf(d)))
}

/**
 * Parse a money cell from a statement or register into paisa.
 * Handles "1,23,456.50", "(1,000.00)" negatives, "Rs. 500", Devanagari digits, "-", blanks and numbers.
 */
export function parseMoney(v: unknown): Paisa {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Math.round(v * 100)
  let s = toAsciiDigits(String(v)).trim()
  if (s === '' || s === '-' || s === '--') return 0
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  s = s.replace(/rs\.?|npr/gi, '').replace(/[,\s]/g, '')
  if (s.startsWith('-')) {
    neg = !neg
    s = s.slice(1)
  }
  if (!/^\d*(\.\d+)?$/.test(s) || s === '') return NaN
  const [whole, frac = ''] = s.split('.')
  const paisa = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2))
  return neg ? -paisa : paisa
}

/** Nepali/Indian digit grouping: 12,34,567.89 */
export function formatNpr(p: Paisa, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const { decimals = true, sign = false } = opts
  const neg = p < 0
  const abs = Math.abs(Math.round(p))
  const rupees = Math.floor(abs / 100)
  const paisa = abs % 100
  const s = String(rupees)
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3
  const body = decimals ? `${grouped}.${String(paisa).padStart(2, '0')}` : grouped
  return `${neg ? '-' : sign && p > 0 ? '+' : ''}${body}`
}

/** Short form for KPI tiles: 3.7 lakh, 1.2 crore. */
export function formatNprShort(p: Paisa): string {
  const r = Math.abs(p) / 100
  const sign = p < 0 ? '-' : ''
  if (r >= 1e7) return `${sign}${(r / 1e7).toFixed(2)} crore`
  if (r >= 1e5) return `${sign}${(r / 1e5).toFixed(2)} lakh`
  return `${sign}${formatNpr(Math.abs(p), { decimals: false })}`
}

export const VAT_RATE_BP = 1300 // 13% in basis points

/** VAT on a taxable amount, rounded to the nearest paisa. */
export function vatOn(taxable: Paisa): Paisa {
  return Math.round((taxable * VAT_RATE_BP) / 10000)
}

/** Split a VAT-inclusive total into taxable + VAT. */
export function splitInclusive(total: Paisa): { taxable: Paisa; vat: Paisa } {
  const taxable = Math.round((total * 10000) / (10000 + VAT_RATE_BP))
  return { taxable, vat: total - taxable }
}
