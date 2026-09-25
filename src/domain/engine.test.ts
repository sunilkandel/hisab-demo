import { describe, expect, test } from 'bun:test'
import { parseMoney, formatNpr, splitInclusive, vatOn } from './money'
import { parseDateCell, bsToAd, adToBs } from './dates'
import { CLIENTS, DEMO_MONTH, renderDoc } from './seed'
import { sheetToBytes } from './files'
import { runPipeline } from './pipeline'
import { summarize, applyDecisions } from './reconcile'
import { exclusionsOf } from './pipeline'
import type { MonthResult, RawFile } from './types'

describe('money', () => {
  test('parses messy amounts into paisa', () => {
    expect(parseMoney('1,23,456.50')).toBe(12345650)
    expect(parseMoney('(1,000.00)')).toBe(-100000)
    expect(parseMoney('Rs. 500')).toBe(50000)
    expect(parseMoney('१,२००')).toBe(120000)
    expect(parseMoney('')).toBe(0)
    expect(parseMoney(99.99)).toBe(9999)
    expect(Number.isNaN(parseMoney('abc'))).toBe(true)
  })
  test('formats with Nepali grouping', () => {
    expect(formatNpr(12345650)).toBe('1,23,456.50')
    expect(formatNpr(-37000000, { decimals: false })).toBe('-3,70,000')
  })
  test('VAT math', () => {
    expect(vatOn(100000)).toBe(13000)
    const { taxable, vat } = splitInclusive(113000)
    expect(taxable).toBe(100000)
    expect(vat).toBe(13000)
  })
})

describe('dates', () => {
  test('BS <-> AD round trip', () => {
    const ad = bsToAd(2083, 5, 1)
    expect(adToBs(ad)).toBe('2083-05-01')
  })
  test('parses BS, AD, Devanagari and Excel serial dates', () => {
    expect(parseDateCell('2083/05/01', 'BS')?.bs).toBe('2083-05-01')
    expect(parseDateCell('२०८३/०५/०१', 'BS')?.bs).toBe('2083-05-01')
    const ad = bsToAd(2083, 5, 1)
    const [y, m, d] = ad.split('-')
    expect(parseDateCell(`${d}/${m}/${y}`, 'AD')?.bs).toBe('2083-05-01')
    const serial = Math.round(Date.UTC(+y, +m - 1, +d) / 86400000 + 25569)
    expect(parseDateCell(serial, 'AD')?.bs).toBe('2083-05-01')
    expect(parseDateCell('2083/13/01', 'BS')).toBeNull()
    expect(parseDateCell('BALANCE B/F', 'AD')).toBeNull()
  })
})

const cache = new Map<string, MonthResult>()
async function run(clientId: string): Promise<MonthResult> {
  if (cache.has(clientId)) return cache.get(clientId)!
  const client = CLIENTS.find((c) => c.id === clientId)!
  const files: RawFile[] = client.docs.map((d) => {
    const r = renderDoc(client.id, d.id)
    return { docId: d.id, name: r.name, bytes: sheetToBytes(r.sheet, r.ext), source: 'sample' }
  })
  const res = await runPipeline(client, files, DEMO_MONTH)
  cache.set(clientId, res)
  return res
}
function summary(r: MonthResult) {
  const ex = exclusionsOf(r)
  const txns = new Map(r.txns.map((t) => [t.id, t]))
  const sales = r.invoices.filter((i) => i.kind === 'sales' && !ex.excludedInvoices.has(i.id))
  return summarize(r.credits, txns, sales)
}

describe('pipeline on demo clients (files go through real XLSX/CSV bytes)', () => {
  test('every demo file is detected with a specific format', async () => {
    for (const c of CLIENTS) {
      const r = await run(c.id)
      for (const f of r.files) expect(f.format).not.toBeNull()
      expect(r.issues.filter((i) => i.code === 'UNKNOWN_FORMAT')).toHaveLength(0)
    }
  })

  test('Lalitpur Hardware: clean month, nothing unexplained', async () => {
    const r = await run('lalitpur-hardware')
    const s = summary(r)
    expect(s.unexplained).toBe(0)
    expect(s.pendingReview).toBe(0)
    expect(s.risk).toBe('low')
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0)
  })

  test('Ram Pharmacy: loan + owner capital suggested, exactly NPR 3,70,000 unexplained', async () => {
    const r = await run('ram-pharmacy')
    const s = summary(r)
    expect(s.unexplained).toBe(37000000)
    expect(s.pendingReview).toBe(50000000)
    expect(s.risk).toBe('high')
    const sugg = r.credits.filter((c) => c.suggestion).map((c) => c.suggestion).sort()
    expect(sugg).toEqual(['loan', 'owner-capital'])
  })

  test('Himali Kitchen: duplicates excluded, QR day without bills + platform payout flagged', async () => {
    const r = await run('himali-kitchen')
    expect(r.issues.filter((i) => i.code === 'DUPLICATE_BILL')).toHaveLength(2)
    expect(r.issues.some((i) => i.code === 'VAT_DERIVED')).toBe(true)
    const s = summary(r)
    expect(s.unexplained).toBe(1845000 + 4230000)
  })

  test('Everest Wholesale: VAT errors, missing PANs, refund suggested', async () => {
    const r = await run('everest-wholesale')
    expect(r.issues.filter((i) => i.code === 'VAT_NOT_13')).toHaveLength(2)
    expect(r.issues.filter((i) => i.code === 'PURCHASE_NO_PAN').length).toBeGreaterThanOrEqual(3)
    expect(r.credits.some((c) => c.suggestion === 'refund')).toBe(true)
    expect(summary(r).unexplained).toBe(0)
  })

  test('Kathmandu Mobile Hub: duplicate bank rows dropped, own transfer recognised', async () => {
    const r = await run('ktm-mobile')
    expect(r.issues.filter((i) => i.code === 'BANK_DUPLICATE_ROW')).toHaveLength(3)
    expect(r.credits.filter((c) => c.category === 'own-transfer')).toHaveLength(1)
    expect(summary(r).unexplained).toBe(0)
  })

  test('Bagmati Fresh: bills from the previous month excluded', async () => {
    const r = await run('bagmati-fresh')
    expect(r.issues.filter((i) => i.code === 'BILL_OUTSIDE_MONTH')).toHaveLength(6)
  })

  test('accountant decisions change the summary', async () => {
    const r = await run('ram-pharmacy')
    const loan = r.credits.find((c) => c.suggestion === 'loan')!
    const decided = applyDecisions(r.credits, { [loan.txnId]: { category: 'loan', note: 'Checked loan sanction letter', by: 'test', at: '' } })
    const ex = exclusionsOf(r)
    const s = summarize(decided, new Map(r.txns.map((t) => [t.id, t])), r.invoices.filter((i) => i.kind === 'sales' && !ex.excludedInvoices.has(i.id)))
    expect(s.pendingReview).toBe(20000000)
  })
})
