import NepaliDate from 'nepali-date-converter'
import { toAsciiDigits } from './money'

export const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Asoj',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
]

const pad = (n: number) => String(n).padStart(2, '0')

/** Format a JS Date as YYYY-MM-DD using its local calendar fields. */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse YYYY-MM-DD (AD) as a local-noon Date, so timezone shifts can't move the day. */
export function adDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

/** BS (year, month 1-12, day) → AD ISO date. */
export function bsToAd(y: number, m: number, d: number): string {
  const js = new NepaliDate(y, m - 1, d).toJsDate()
  return isoLocal(new Date(js.getFullYear(), js.getMonth(), js.getDate(), 12))
}

/** AD ISO date → BS ISO date (YYYY-MM-DD). */
export function adToBs(iso: string): string {
  const nd = new NepaliDate(adDate(iso))
  return `${nd.getYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}`
}

export function daysInBsMonth(y: number, m: number): number {
  const start = adDate(bsToAd(y, m, 1))
  const next = m === 12 ? adDate(bsToAd(y + 1, 1, 1)) : adDate(bsToAd(y, m + 1, 1))
  return Math.round((next.getTime() - start.getTime()) / 86400000)
}

export function addDays(iso: string, n: number): string {
  const d = adDate(iso)
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((adDate(b).getTime() - adDate(a).getTime()) / 86400000)
}

export function formatBs(bsIso: string, style: 'short' | 'long' = 'short'): string {
  const [y, m, d] = bsIso.split('-').map(Number)
  return style === 'long' ? `${d} ${BS_MONTHS[m - 1]} ${y}` : `${y}/${pad(m)}/${pad(d)}`
}

export interface ParsedDate {
  ad: string
  bs: string
}

/**
 * Parse a date cell from any of the formats Nepali files use.
 * `calendar` says whether the column is BS or AD; numbers are treated as Excel serials (AD).
 * Accepts YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY, and Devanagari digits.
 */
export function parseDateCell(v: unknown, calendar: 'BS' | 'AD'): ParsedDate | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') {
    // Excel serial date (1900 system)
    const ms = Math.round((v - 25569) * 86400000)
    const d = new Date(ms)
    const ad = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    return { ad, bs: adToBs(ad) }
  }
  const s = toAsciiDigits(String(v)).trim()
  let y: number, m: number, d: number
  let mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (mt) {
    y = +mt[1]; m = +mt[2]; d = +mt[3]
  } else if ((mt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    d = +mt[1]; m = +mt[2]; y = +mt[3]
  } else {
    return null
  }
  if (m < 1 || m > 12 || d < 1 || d > 32) return null
  if (calendar === 'BS') {
    if (y < 2000 || y > 2100) return null
    if (d > daysInBsMonth(y, m)) return null
    return { bs: `${y}-${pad(m)}-${pad(d)}`, ad: bsToAd(y, m, d) }
  }
  if (y < 1990 || y > 2050) return null
  const ad = `${y}-${pad(m)}-${pad(d)}`
  const check = adDate(ad)
  if (check.getMonth() + 1 !== m) return null
  return { ad, bs: adToBs(ad) }
}

export function todayAd(): string {
  return isoLocal(new Date())
}
