/**
 * Demo data generator. Everything here is FICTIONAL: firm, clients, banks, PANs and amounts.
 *
 * It works like the real world: first it invents the "truth" for a month (bills issued, money received),
 * then it writes that truth out in the messy, tool-specific formats an accountant actually receives
 * (bank XLSX with title rows, CSV with BS dates and 1,23,456.00 amounts, Nepali headers, Excel serial dates,
 * totals rows, duplicated rows). The pipeline then has to parse those files back, exactly as it would real ones.
 */
import { bsToAd, daysInBsMonth, addDays, adToBs, adDate } from './dates'
import { vatOn, formatNpr } from './money'
import type { Client, FormatId, PaymentMode, Sheet } from './types'

export const DEMO_FIRM = {
  name: 'Annapurna Accounting Services',
  tagline: 'Fictional demo firm',
  user: 'Sita Gurung (demo)',
}

export const DEMO_MONTH = { year: 2083, month: 5 } // Bhadra 2083 (≈ 17 Aug – 16 Sep 2026)

export function monthRangeAd(): { start: string; end: string; days: number } {
  const days = daysInBsMonth(DEMO_MONTH.year, DEMO_MONTH.month)
  return {
    start: bsToAd(DEMO_MONTH.year, DEMO_MONTH.month, 1),
    end: bsToAd(DEMO_MONTH.year, DEMO_MONTH.month, days),
    days,
  }
}

// ---------- deterministic randomness ----------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type Rng = () => number
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const pick = <T,>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)]
const pan = (r: Rng) => String(int(r, 300000000, 619999999))

// ---------- clients ----------
export const CLIENTS: Client[] = [
  {
    id: 'ram-pharmacy',
    name: 'Ram Pharmacy Pvt. Ltd.',
    pan: '601234587',
    sector: 'Pharmacy · Kathmandu',
    billingTool: 'BUSY',
    story: 'Declared sales look normal, but deposits are NPR 8.7 lakh higher. A loan and owner capital explain part of it; NPR 3.7 lakh has no explanation.',
    docs: [
      { id: 'rp-bank', kind: 'bank', label: 'Sagarmatha Demo Bank · A/C 0041', account: '01234500041', format: 'sagarmatha-xlsx' },
      { id: 'rp-sales', kind: 'sales', label: 'BUSY sales register', format: 'busy-sales-xlsx' },
      { id: 'rp-purch', kind: 'purchase', label: 'BUSY purchase register', format: 'busy-purchase-xlsx' },
    ],
  },
  {
    id: 'himali-kitchen',
    name: 'Himali Kitchen & Cafe',
    pan: '609876512',
    sector: 'Restaurant · Pokhara',
    billingTool: 'Excel (manual)',
    story: 'Mostly QR payments, bills kept in a Nepali-language Excel sheet with VAT-inclusive totals. One day has QR money but no bills, plus an online-order payout.',
    docs: [
      { id: 'hk-bank', kind: 'bank', label: 'Gandaki Demo Bank · A/C 3318', account: '3318009921', format: 'gandaki-csv' },
      { id: 'hk-sales', kind: 'sales', label: 'Sales book (Excel, Nepali)', format: 'manual-sales-xlsx' },
      { id: 'hk-purch', kind: 'purchase', label: 'Purchase book (Excel, Nepali)', format: 'manual-purchase-xlsx' },
    ],
  },
  {
    id: 'lalitpur-hardware',
    name: 'Lalitpur Hardware Traders',
    pan: '604455661',
    sector: 'Hardware retail · Lalitpur',
    billingTool: 'Tigg',
    story: 'A clean month. Every deposit ties back to a bill or a QR batch, so the VAT pack is ready in one click.',
    docs: [
      { id: 'lh-bank', kind: 'bank', label: 'Sagarmatha Demo Bank · A/C 5520', account: '01234505520', format: 'sagarmatha-xlsx' },
      { id: 'lh-sales', kind: 'sales', label: 'Tigg sales export', format: 'tigg-sales-csv' },
      { id: 'lh-purch', kind: 'purchase', label: 'Tigg purchase export', format: 'tigg-purchase-csv' },
    ],
  },
  {
    id: 'everest-wholesale',
    name: 'Everest Wholesale Suppliers',
    pan: '607788990',
    sector: 'FMCG wholesale · Bhaktapur',
    billingTool: 'Tally',
    story: 'Bookkeeping errors: two bills with wrong VAT, purchases missing supplier PAN (input VAT at risk), and a supplier refund that looks like income.',
    docs: [
      { id: 'ew-bank', kind: 'bank', label: 'Gandaki Demo Bank · A/C 7002', account: '7002114455', format: 'gandaki-csv' },
      { id: 'ew-sales', kind: 'sales', label: 'Tally sales register', format: 'tally-sales-xlsx' },
      { id: 'ew-purch', kind: 'purchase', label: 'Tally purchase register', format: 'tally-purchase-xlsx' },
    ],
  },
  {
    id: 'ktm-mobile',
    name: 'Kathmandu Mobile Hub',
    pan: '602233445',
    sector: 'Electronics retail · Kathmandu',
    billingTool: 'BUSY',
    story: 'Two bank accounts. NPR 5 lakh moved between them (not income), and the second bank export repeated 3 rows that must not be counted twice.',
    docs: [
      { id: 'km-bank1', kind: 'bank', label: 'Sagarmatha Demo Bank · A/C 7710', account: '01234507710', format: 'sagarmatha-xlsx' },
      { id: 'km-bank2', kind: 'bank', label: 'Gandaki Demo Bank · A/C 7720', account: '7720331100', format: 'gandaki-csv' },
      { id: 'km-sales', kind: 'sales', label: 'BUSY sales register', format: 'busy-sales-xlsx' },
      { id: 'km-purch', kind: 'purchase', label: 'BUSY purchase register', format: 'busy-purchase-xlsx' },
    ],
  },
  {
    id: 'bagmati-fresh',
    name: 'Bagmati Fresh Mart',
    pan: '605566778',
    sector: 'Grocery · Kirtipur',
    billingTool: 'Excel (manual)',
    story: "The client sent a sales file that also includes last month's bills. Hisab catches rows dated outside Bhadra before they reach the VAT return.",
    docs: [
      { id: 'bf-bank', kind: 'bank', label: 'Sagarmatha Demo Bank · A/C 9001', account: '01234509001', format: 'sagarmatha-xlsx' },
      { id: 'bf-sales', kind: 'sales', label: 'Sales book (Excel, Nepali)', format: 'manual-sales-xlsx' },
      { id: 'bf-purch', kind: 'purchase', label: 'Purchase book (Excel, Nepali)', format: 'manual-purchase-xlsx' },
    ],
  },
]

export const clientById = (id: string) => CLIENTS.find((c) => c.id === id)

// ---------- truth model ----------
interface TruthBill {
  billNo: string
  dateAd: string
  party: string
  pan: string
  taxable: number // rupees (integer)
  vat: number // rupees, 2dp stored as paisa-accurate number
  total: number
  mode: PaymentMode
}
interface TruthTxn {
  account: string
  dateAd: string
  narration: string
  ref: string
  debit: number // rupees
  credit: number
}
interface Truth {
  sales: TruthBill[]
  purchases: TruthBill[]
  txns: TruthTxn[]
  openingBalance: Record<string, number>
}

const B2B_BUYERS = [
  ['Sunrise Clinic Pvt. Ltd.', '609112233'], ['Hetauda Polyclinic', '603344556'], ['Green Valley Hotel', '606677889'],
  ['Shree Ganesh Traders', '602211009'], ['Mero Construction Co.', '608800112'], ['Tripureshwor Suppliers', '604433221'],
  ['Newa Handicrafts', '607766554'], ['Blue Sky Apartments', '605544332'],
] as const
const SUPPLIERS = [
  ['Deurali Distributors', '600112244'], ['Himalayan Pharma Traders', '600223355'], ['Pashupati Wholesale', '600334466'],
  ['Koshi Agro Suppliers', '600445577'], ['Siddhartha Imports', '600556688'], ['Janakpur Packaging', '600667799'],
] as const

function makeBillNo(tool: Client['billingTool'], n: number): string {
  switch (tool) {
    case 'BUSY': return `SI-83-${String(n).padStart(5, '0')}`
    case 'Tigg': return `INV-${1000 + n}`
    case 'Tally': return `Sales/${String(n).padStart(4, '0')}`
    default: return String(400 + n).padStart(4, '0')
  }
}

function bill(no: string, dateAd: string, party: string, pan: string, taxable: number, mode: PaymentMode): TruthBill {
  const vat = vatOn(taxable * 100) / 100
  return { billNo: no, dateAd, party, pan, taxable, vat, total: +(taxable + vat).toFixed(2), mode }
}

interface SalesProfile {
  billsPerDay: [number, number]
  retail: [number, number] // taxable range per retail bill
  mix: { Cash: number; QR: number } // share of retail bills
  b2bPerMonth: number
  b2bRange: [number, number]
  closedWeekday?: number
}

function genSales(r: Rng, client: Client, p: SalesProfile, dates: string[]): TruthBill[] {
  const out: TruthBill[] = []
  let n = int(r, 200, 900)
  for (const d of dates) {
    const dow = adDate(d).getDay()
    if (p.closedWeekday !== undefined && dow === p.closedWeekday) continue
    const count = int(r, p.billsPerDay[0], p.billsPerDay[1])
    for (let i = 0; i < count; i++) {
      const taxable = int(r, p.retail[0], p.retail[1])
      const mode: PaymentMode = r() < p.mix.QR ? 'QR' : 'Cash'
      out.push(bill(makeBillNo(client.billingTool, n++), d, 'Cash/Walk-in customer', '', taxable, mode))
    }
  }
  for (let i = 0; i < p.b2bPerMonth; i++) {
    const [party, ppan] = pick(r, B2B_BUYERS as unknown as [string, string][])
    const d = dates[int(r, 0, dates.length - 5)]
    const taxable = Math.round(int(r, p.b2bRange[0], p.b2bRange[1]) / 100) * 100
    out.push(bill(makeBillNo(client.billingTool, n++), d, party, ppan, taxable, r() < 0.75 ? 'Bank' : 'Credit'))
  }
  return out.sort((a, b) => a.dateAd.localeCompare(b.dateAd) || a.billNo.localeCompare(b.billNo))
}

/** Purchases sized to the business: buy roughly `ratio` of what you sell (taxable value). */
function genPurchases(r: Rng, sales: TruthBill[], ratio: number, range: [number, number], dates: string[], missingPan = 0): TruthBill[] {
  const out: TruthBill[] = []
  const target = sales.reduce((s, b) => s + b.taxable, 0) * ratio
  let total = 0
  while (total < target) {
    const [sup, span] = pick(r, SUPPLIERS as unknown as [string, string][])
    const taxable = Math.round(int(r, range[0], range[1]) / 10) * 10
    const b = bill(`PB-${int(r, 1000, 9999)}`, dates[int(r, 0, dates.length - 1)], sup, span, taxable, r() < 0.7 ? 'Bank' : 'Credit')
    out.push(b)
    total += taxable
  }
  out.sort((a, b) => a.dateAd.localeCompare(b.dateAd))
  for (let i = 0; i < missingPan && i < out.length; i++) out[i * 3 % out.length].pan = ''
  return out
}

/** Turn bills into the bank movements they would really cause. */
function moneyFlows(r: Rng, sales: TruthBill[], purchases: TruthBill[], account: string, monthEnd: string): TruthTxn[] {
  const txns: TruthTxn[] = []
  // QR: one settlement per day, next day, for that day's QR bills
  const qrByDay = new Map<string, number>()
  for (const b of sales) if (b.mode === 'QR') qrByDay.set(b.dateAd, +((qrByDay.get(b.dateAd) ?? 0) + b.total).toFixed(2))
  for (const [d, amt] of qrByDay) {
    const settle = addDays(d, 1)
    if (settle > monthEnd) continue // settles next month: correctly absent from this statement
    txns.push({ account, dateAd: settle, narration: `QR MERCHANT SETTLEMENT ${adToBs(d).replaceAll('-', '/')}`, ref: `QRS${d.replaceAll('-', '')}`, debit: 0, credit: amt })
  }
  // Cash: deposited every few days, rounded down to the nearest 500 (some cash stays in the drawer)
  let pool = 0
  const cashDays = [...new Set(sales.filter((b) => b.mode === 'Cash').map((b) => b.dateAd))].sort()
  for (const d of cashDays) {
    pool += sales.filter((b) => b.mode === 'Cash' && b.dateAd === d).reduce((s, b) => s + b.total, 0)
    if (r() < 0.35 && pool > 5000) {
      const dep = Math.floor(pool / 500) * 500
      pool -= dep
      txns.push({ account, dateAd: d, narration: 'CASH DEPOSIT', ref: `CD${int(r, 10000, 99999)}`, debit: 0, credit: dep })
    }
  }
  // B2B bank sales: paid 0-3 days later by IPS/fund transfer
  for (const b of sales) {
    if (b.mode !== 'Bank') continue
    const d = addDays(b.dateAd, int(r, 0, 3))
    if (d > monthEnd) continue
    const withRef = r() < 0.5
    txns.push({ account, dateAd: d, narration: `IPS CR FROM ${b.party.toUpperCase()}`, ref: withRef ? b.billNo : `IPS${int(r, 100000, 999999)}`, debit: 0, credit: b.total })
  }
  // Supplier payments
  for (const b of purchases) {
    if (b.mode !== 'Bank') continue
    const d = addDays(b.dateAd, int(r, 0, 5))
    if (d > monthEnd) continue
    txns.push({ account, dateAd: d, narration: `CHQ PAID TO ${b.party.toUpperCase()}`, ref: `CHQ${int(r, 100000, 999999)}`, debit: b.total, credit: 0 })
  }
  return txns
}

function monthDates(): string[] {
  const { start, days } = monthRangeAd()
  return Array.from({ length: days }, (_, i) => addDays(start, i))
}

function opsDebits(r: Rng, account: string, dates: string[], scale: number): TruthTxn[] {
  return [
    { account, dateAd: dates[1], narration: 'RENT PAYMENT - BHADRA', ref: `SO${int(r, 1000, 9999)}`, debit: 45000 * scale, credit: 0 },
    { account, dateAd: dates[6], narration: 'ELECTRICITY BILL PAYMENT', ref: `EB${int(r, 1000, 9999)}`, debit: int(r, 6000, 14000), credit: 0 },
    { account, dateAd: dates[20], narration: 'IRD VAT PAYMENT - SHRAWAN', ref: `VAT${int(r, 1000, 9999)}`, debit: int(r, 20000, 90000) * scale, credit: 0 },
    { account, dateAd: dates[dates.length - 2], narration: 'SALARY TRANSFER - STAFF', ref: `SAL${int(r, 1000, 9999)}`, debit: 120000 * scale, credit: 0 },
  ]
}

const truthCache = new Map<string, Truth>()

export function truthFor(clientId: string): Truth {
  const hit = truthCache.get(clientId)
  if (hit) return hit
  const client = clientById(clientId)!
  const r = mulberry32([...clientId].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0)
  const dates = monthDates()
  const monthEnd = dates[dates.length - 1]
  let t: Truth

  switch (clientId) {
    case 'ram-pharmacy': {
      const acc = client.docs[0].account!
      const sales = genSales(r, client, { billsPerDay: [8, 14], retail: [250, 2600], mix: { Cash: 0.45, QR: 0.55 }, b2bPerMonth: 6, b2bRange: [18000, 65000] }, dates)
      const purchases = genPurchases(r, sales, 0.72, [15000, 90000], dates)
      const txns = [...moneyFlows(r, sales, purchases, acc, monthEnd), ...opsDebits(r, acc, dates, 1)]
      txns.push(
        { account: acc, dateAd: dates[9], narration: 'LOAN DISBURSEMENT A/C 0041-LN-2209', ref: 'LN220915', debit: 0, credit: 300000 },
        { account: acc, dateAd: dates[12], narration: 'CASH DEPOSIT BY PROPRIETOR RAM K. ADHIKARI', ref: 'CD77120', debit: 0, credit: 200000 },
        { account: acc, dateAd: dates[15], narration: 'FT FROM R K TRADERS', ref: 'FT8812034', debit: 0, credit: 145000 },
        { account: acc, dateAd: dates[21], narration: 'IPS CR 8823411', ref: 'IPS8823411', debit: 0, credit: 125000 },
        { account: acc, dateAd: dates[26], narration: 'MOBILE BANKING TRF FROM 98XXXXX412', ref: 'MB4412098', debit: 0, credit: 100000 },
      )
      t = { sales, purchases, txns, openingBalance: { [acc]: 482300.5 } }
      break
    }
    case 'himali-kitchen': {
      const acc = client.docs[0].account!
      const sales = genSales(r, client, { billsPerDay: [14, 24], retail: [300, 2400], mix: { Cash: 0.2, QR: 0.8 }, b2bPerMonth: 1, b2bRange: [25000, 40000] }, dates)
      // Day 18: the till was not used (no bills), but QR money still came in the next morning.
      const gapDay = dates[17]
      const kept = sales.filter((b) => b.dateAd !== gapDay)
      // Two bills entered twice by hand
      const dup1 = { ...kept[40] }
      const dup2 = { ...kept[133] }
      kept.splice(41, 0, dup1)
      kept.splice(135, 0, dup2)
      const purchases = genPurchases(r, kept, 0.45, [3000, 28000], dates)
      const txns = [...moneyFlows(r, kept.filter((b, i, arr) => arr.findIndex((x) => x.billNo === b.billNo) === i), purchases, acc, monthEnd), ...opsDebits(r, acc, dates, 0.6)]
      txns.push(
        { account: acc, dateAd: addDays(gapDay, 1), narration: `QR MERCHANT SETTLEMENT ${adToBs(gapDay).replaceAll('-', '/')}`, ref: `QRS${gapDay.replaceAll('-', '')}`, debit: 0, credit: 18450 },
        { account: acc, dateAd: dates[23], narration: 'ONLINE ORDER PLATFORM PAYOUT WK34', ref: 'OOP34-2231', debit: 0, credit: 42300 },
      )
      t = { sales: kept, purchases, txns, openingBalance: { [acc]: 126540 } }
      break
    }
    case 'lalitpur-hardware': {
      const acc = client.docs[0].account!
      const sales = genSales(r, client, { billsPerDay: [5, 10], retail: [400, 6000], mix: { Cash: 0.35, QR: 0.65 }, b2bPerMonth: 7, b2bRange: [20000, 120000], closedWeekday: 6 }, dates)
      for (const b of sales) if (b.mode === 'Credit') b.mode = 'Bank' // everyone paid this month
      const purchases = genPurchases(r, sales, 0.75, [10000, 150000], dates)
      const txns = [...moneyFlows(r, sales, purchases, acc, monthEnd), ...opsDebits(r, acc, dates, 1)]
      t = { sales, purchases, txns, openingBalance: { [acc]: 910200 } }
      break
    }
    case 'everest-wholesale': {
      const acc = client.docs[0].account!
      const sales = genSales(r, client, { billsPerDay: [0, 1], retail: [5000, 15000], mix: { Cash: 0.3, QR: 0.7 }, b2bPerMonth: 24, b2bRange: [30000, 210000] }, dates)
      // Two bills keyed with the wrong VAT
      const wrong = sales.filter((b) => b.pan).slice(2, 4)
      wrong[0].vat = +(wrong[0].taxable * 0.12).toFixed(2); wrong[0].total = +(wrong[0].taxable + wrong[0].vat).toFixed(2)
      wrong[1].vat = +(wrong[1].vat + 150).toFixed(2); wrong[1].total = +(wrong[1].taxable + wrong[1].vat).toFixed(2)
      const purchases = genPurchases(r, sales, 0.85, [40000, 260000], dates, 4)
      const txns = [...moneyFlows(r, sales, purchases, acc, monthEnd), ...opsDebits(r, acc, dates, 2)]
      txns.push({ account: acc, dateAd: dates[19], narration: 'FT FROM PASHUPATI WHOLESALE - ADVANCE REFUND', ref: 'FT9910021', debit: 0, credit: 240000 })
      t = { sales, purchases, txns, openingBalance: { [acc]: 2350000 } }
      break
    }
    case 'ktm-mobile': {
      const acc1 = client.docs[0].account!
      const acc2 = client.docs[1].account!
      const sales = genSales(r, client, { billsPerDay: [3, 7], retail: [1500, 45000], mix: { Cash: 0.3, QR: 0.7 }, b2bPerMonth: 5, b2bRange: [40000, 180000] }, dates)
      const purchases = genPurchases(r, sales, 0.8, [80000, 400000], dates)
      // QR settles into account 2; bank sales, cash and suppliers use account 1
      const flows1 = moneyFlows(r, sales.filter((b) => b.mode !== 'QR'), purchases, acc1, monthEnd)
      const flows2 = moneyFlows(r, sales.filter((b) => b.mode === 'QR'), [], acc2, monthEnd)
      const txns = [...flows1, ...flows2, ...opsDebits(r, acc1, dates, 1.5)]
      txns.push(
        { account: acc2, dateAd: dates[14], narration: `TRF TO OWN A/C ...${acc1.slice(-4)}`, ref: 'OWN5500', debit: 500000, credit: 0 },
        { account: acc1, dateAd: dates[14], narration: `TRF FROM A/C ...${acc2.slice(-4)} KATHMANDU MOBILE HUB`, ref: 'OWN5500', debit: 0, credit: 500000 },
      )
      t = { sales, purchases, txns, openingBalance: { [acc1]: 1540000, [acc2]: 88000 } }
      break
    }
    default: {
      // bagmati-fresh: the sales book also contains the last 3 days of Shrawan
      const acc = client.docs[0].account!
      const sales = genSales(r, client, { billsPerDay: [10, 18], retail: [150, 1800], mix: { Cash: 0.5, QR: 0.5 }, b2bPerMonth: 0, b2bRange: [0, 0] }, dates)
      const prev = [addDays(dates[0], -3), addDays(dates[0], -2), addDays(dates[0], -1)]
      const early = prev.flatMap((d, i) => [bill(makeBillNo(client.billingTool, 90 + i * 2), d, 'Cash/Walk-in customer', '', int(r, 300, 1500), 'Cash'), bill(makeBillNo(client.billingTool, 91 + i * 2), d, 'Cash/Walk-in customer', '', int(r, 300, 1500), 'QR')])
      const purchases = genPurchases(r, sales, 0.7, [4000, 30000], dates)
      const txns = [...moneyFlows(r, sales, purchases, acc, monthEnd), ...opsDebits(r, acc, dates, 0.5)]
      t = { sales: [...early, ...sales], purchases, txns, openingBalance: { [acc]: 64000 } }
    }
  }
  t.txns.sort((a, b) => a.dateAd.localeCompare(b.dateAd) || (b.credit - a.credit))
  truthCache.set(clientId, t)
  return t
}

// ---------- writers: truth → the raw formats accountants receive ----------
const dmyAd = (ad: string) => { const [y, m, d] = ad.split('-'); return `${d}/${m}/${y}` }
const bsSlash = (ad: string) => adToBs(ad).replaceAll('-', '/')
const bsDmy = (ad: string) => { const [y, m, d] = adToBs(ad).split('-'); return `${d}-${m}-${y}` }
const DEV = '०१२३४५६७८९'
const toDev = (s: string) => s.replace(/\d/g, (d) => DEV[+d])
const excelSerial = (ad: string) => Math.round(Date.UTC(+ad.slice(0, 4), +ad.slice(5, 7) - 1, +ad.slice(8, 10)) / 86400000 + 25569)
const money = (n: number) => formatNpr(Math.round(n * 100))
const modeNp: Record<PaymentMode, string> = { Cash: 'नगद', QR: 'QR', Bank: 'बैंक', Credit: 'उधारो', Unknown: '' }

export function renderDoc(clientId: string, docId: string): { sheet: Sheet; ext: 'xlsx' | 'csv'; name: string } {
  const client = clientById(clientId)!
  const doc = client.docs.find((d) => d.id === docId)!
  const t = truthFor(clientId)
  const { start, end } = monthRangeAd()
  const bsLabel = `Bhadra 2083`
  const fmt: FormatId = doc.format
  const slug = client.name.replace(/[^A-Za-z]+/g, '_').replace(/_+$/, '')

  if (doc.kind === 'bank') {
    const acc = doc.account!
    let txns = t.txns.filter((x) => x.account === acc)
    let bal = t.openingBalance[acc] ?? 0
    const withBal = txns.map((x) => { bal = +(bal + x.credit - x.debit).toFixed(2); return { ...x, bal } })
    if (fmt === 'sagarmatha-xlsx') {
      const sheet: Sheet = [
        ['Sagarmatha Demo Bank Ltd. (fictional)'],
        ['Statement of Account'],
        ['Account Name:', client.name.toUpperCase()],
        ['Account No:', acc],
        ['Period:', `${dmyAd(start)} to ${dmyAd(end)}`],
        [],
        ['Txn Date', 'Value Date', 'Description', 'Cheque/Ref No', 'Debit', 'Credit', 'Balance'],
        [dmyAd(start), dmyAd(start), 'BALANCE B/F', '', null, null, t.openingBalance[acc]],
        ...withBal.map((x) => [dmyAd(x.dateAd), dmyAd(x.dateAd), x.narration, x.ref, x.debit || null, x.credit || null, x.bal]),
        [],
        ['*** End of statement. This is a computer generated statement. ***'],
      ]
      return { sheet, ext: 'xlsx', name: `${acc}_statement_${start}_${end}.xlsx` }
    }
    // gandaki-csv: BS dates, grouped string amounts
    let rows = withBal.map((x) => [bsSlash(x.dateAd), x.narration, x.ref, x.debit ? money(x.debit) : '', x.credit ? money(x.credit) : '', money(x.bal)])
    if (clientId === 'ktm-mobile') {
      // bank export glitch: 3 rows repeated at a page break
      rows = [...rows.slice(0, 12), ...rows.slice(9, 12), ...rows.slice(12)]
    }
    const sheet: Sheet = [['Date (BS)', 'Particulars', 'Reference', 'Withdrawal', 'Deposit', 'Balance'], ...rows]
    return { sheet, ext: 'csv', name: `GDB_${acc}_${bsLabel.replace(' ', '')}.csv` }
  }

  const bills = doc.kind === 'sales' ? t.sales : t.purchases
  const isSales = doc.kind === 'sales'
  switch (fmt) {
    case 'busy-sales-xlsx':
    case 'busy-purchase-xlsx': {
      const sum = (k: 'taxable' | 'vat' | 'total') => +bills.reduce((s, b) => s + b[k], 0).toFixed(2)
      const sheet: Sheet = [
        [client.name],
        [isSales ? 'Sales Register' : 'Purchase Register'],
        [`From ${bsDmy(start)} To ${bsDmy(end)}`],
        [],
        ['Date', isSales ? 'Vch/Bill No' : 'Supplier Inv No', 'Particulars', 'PAN No.', 'Taxable Amt', 'VAT Amt', 'Bill Amt', ...(isSales ? ['Pay Mode'] : [])],
        ...bills.map((b) => [bsDmy(b.dateAd), b.billNo, b.party, b.pan, b.taxable, b.vat, b.total, ...(isSales ? [b.mode] : [])]),
        ['', '', 'Total', '', sum('taxable'), sum('vat'), sum('total')],
      ]
      return { sheet, ext: 'xlsx', name: `${slug}_${isSales ? 'Sales' : 'Purchase'}_Register_Bhadra83.xlsx` }
    }
    case 'tigg-sales-csv':
    case 'tigg-purchase-csv': {
      const sheet: Sheet = [
        isSales
          ? ['Invoice Date', 'Invoice Number', 'Customer', 'Customer PAN', 'Sub Total', 'Tax', 'Grand Total', 'Payment Method']
          : ['Bill Date', 'Bill Number', 'Supplier', 'Supplier PAN', 'Sub Total', 'Tax', 'Grand Total'],
        ...bills.map((b) => [b.dateAd, b.billNo, b.party, b.pan, b.taxable.toFixed(2), b.vat.toFixed(2), b.total.toFixed(2), ...(isSales ? [b.mode === 'QR' ? 'Fonepay/QR' : b.mode === 'Bank' ? 'Bank Transfer' : b.mode] : [])]),
      ]
      return { sheet, ext: 'csv', name: `tigg_${isSales ? 'invoices' : 'bills'}_${start}_${end}.csv` }
    }
    case 'tally-sales-xlsx':
    case 'tally-purchase-xlsx': {
      const sheet: Sheet = [
        [client.name],
        [isSales ? 'Sales Register' : 'Purchase Register'],
        [`${dmyAd(start)} to ${dmyAd(end)}`],
        ['Date', 'Particulars', 'Voucher Type', 'Voucher No.', 'PAN', 'Value', 'VAT @13%', 'Gross Total'],
        ...bills.map((b) => [excelSerial(b.dateAd), b.party, isSales ? 'Sales' : 'Purchase', b.billNo, b.pan, b.taxable, b.vat, b.total]),
        ['', 'Grand Total', '', '', '', +bills.reduce((s, b) => s + b.taxable, 0).toFixed(2), +bills.reduce((s, b) => s + b.vat, 0).toFixed(2), +bills.reduce((s, b) => s + b.total, 0).toFixed(2)],
      ]
      return { sheet, ext: 'xlsx', name: `Tally_${isSales ? 'Sales' : 'Purchase'}_Register.xlsx` }
    }
    case 'manual-sales-xlsx': {
      const sheet: Sheet = [
        [`${client.name} - बिक्री खाता (${bsLabel})`],
        ['मिति', 'बिल नं', 'ग्राहक', 'प्यान', 'जम्मा रकम (भ्याट सहित)', 'भुक्तानी'],
        ...bills.map((b, i) => [i % 5 === 0 ? toDev(bsSlash(b.dateAd)) : bsSlash(b.dateAd), b.billNo, b.party === 'Cash/Walk-in customer' ? 'नगद ग्राहक' : b.party, b.pan, b.total, modeNp[b.mode]]),
      ]
      return { sheet, ext: 'xlsx', name: `${slug}_bikri_Bhadra.xlsx` }
    }
    default: {
      const sheet: Sheet = [
        [`${client.name} - खरिद खाता (${bsLabel})`],
        ['मिति', 'बिल नं', 'सप्लायर', 'प्यान', 'करयोग्य रकम', 'भ्याट'],
        ...bills.map((b) => [bsSlash(b.dateAd), b.billNo, b.party, b.pan, b.taxable, b.vat]),
      ]
      return { sheet, ext: 'xlsx', name: `${slug}_kharid_Bhadra.xlsx` }
    }
  }
}
