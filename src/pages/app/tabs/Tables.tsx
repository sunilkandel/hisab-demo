import { useState } from 'react'
import { useCM } from '../../../lib/clientMonth'
import { formatBs } from '../../../domain/dates'
import type { IssueSeverity } from '../../../domain/types'
import { Card, CategoryChip, Money, Pager, SeverityIcon, cx, td, tdNum, th } from '../../../ui/common'

const PAGE = 50

export function IssuesTab() {
  const { v } = useCM()
  const [filter, setFilter] = useState<IssueSeverity | 'all'>('all')
  const docName = (id?: string) => v.result!.files.find((f) => f.docId === id)?.name ?? v.client.docs.find((d) => d.id === id)?.label
  const issues = v.result.issues.filter((i) => filter === 'all' || i.severity === filter)
  const count = (s: IssueSeverity) => v.result!.issues.filter((i) => i.severity === s).length
  const opts: { id: IssueSeverity | 'all'; label: string }[] = [
    { id: 'all', label: `All (${v.result.issues.length})` }, { id: 'error', label: `Errors (${count('error')})` },
    { id: 'warning', label: `Warnings (${count('warning')})` }, { id: 'info', label: `Notes (${count('info')})` },
  ]
  return (
    <Card title="Issues found in the client's files" action={
      <div className="flex gap-1" role="group" aria-label="Filter by severity">
        {opts.map((o) => (
          <button key={o.id} aria-pressed={filter === o.id} onClick={() => setFilter(o.id)}
            className={cx('min-h-8 rounded-md px-2 text-xs font-medium', filter === o.id ? 'bg-slate-100 text-ink' : 'text-ink-3 hover:bg-slate-50')}>{o.label}</button>
        ))}
      </div>
    }>
      {issues.length === 0 ? <p className="px-4 py-6 text-sm text-ok">No issues of this kind.</p> : (
        <ul className="divide-y divide-line">
          {issues.map((i) => (
            <li key={i.id} className="flex gap-3 px-4 py-2.5">
              <SeverityIcon s={i.severity} />
              <div className="min-w-0">
                <p className="text-sm">{i.message}</p>
                <p className="text-xs text-ink-3"><span className="num">{i.code}</span>{i.docId && <> · {docName(i.docId)}</>}{i.sourceRow && <> · row <span className="num">{i.sourceRow}</span></>}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function BankTab() {
  const { v, ex } = useCM()
  const [page, setPage] = useState(0)
  const [onlyCredits, setOnlyCredits] = useState(false)
  const byTxn = new Map(v.credits.map((c) => [c.txnId, c]))
  const rows = v.result.txns.filter((t) => !onlyCredits || t.credit > 0)
  const pages = Math.ceil(rows.length / PAGE)
  return (
    <Card title={`Bank transactions (${v.result.txns.length} rows from ${v.result.files.filter((f) => v.client.docs.find((d) => d.id === f.docId)?.kind === 'bank').length} statement(s))`} action={
      <label className="flex items-center gap-1.5 text-xs text-ink-2"><input type="checkbox" checked={onlyCredits} onChange={(e) => { setOnlyCredits(e.target.checked); setPage(0) }} className="accent-[#0369a1]" />Deposits only</label>
    }>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Date (BS)</th><th className={th}>Account</th><th className={th}>Narration</th><th className={th}>Ref</th>
            <th className={cx(th, 'text-right')}>Withdrawal</th><th className={cx(th, 'text-right')}>Deposit</th><th className={th}>Explained as</th>
          </tr></thead>
          <tbody>
            {rows.slice(page * PAGE, page * PAGE + PAGE).map((t) => {
              const c = byTxn.get(t.id)
              const out = ex.txns.has(t.id)
              return (
                <tr key={t.id} className={cx('border-t border-line', out && 'bg-slate-50 text-ink-3 line-through decoration-slate-300')}>
                  <td className={cx(td, 'num whitespace-nowrap text-xs')}>{formatBs(t.dateBs)}</td>
                  <td className={cx(td, 'num text-xs')}>…{t.account.slice(-4)}</td>
                  <td className={cx(td, 'text-xs')}>{t.narration}</td>
                  <td className={cx(td, 'num text-xs text-ink-3')}>{t.ref}</td>
                  <td className={tdNum}>{t.debit ? <Money p={t.debit} /> : ''}</td>
                  <td className={tdNum}>{t.credit ? <Money p={t.credit} /> : ''}</td>
                  <td className={td}>{out ? <span className="text-xs no-underline">Duplicate row, counted once</span> : c ? <span title={c.reason}><CategoryChip c={c.category} suggestion={c.suggestion} /></span> : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </Card>
  )
}

export function RegisterTab({ kind }: { kind: 'sales' | 'purchase' }) {
  const { v, ex } = useCM()
  const [page, setPage] = useState(0)
  const rows = v.result.invoices.filter((i) => i.kind === kind)
  const flagged = new Map<string, string>()
  for (const i of v.result.issues) if (i.refId && (i.severity === 'error' || i.severity === 'warning')) flagged.set(i.refId, i.message)
  const matched = new Set(v.credits.flatMap((c) => c.matchedInvoiceIds))
  const pages = Math.ceil(rows.length / PAGE)
  const derived = rows.some((r) => r.vatDerived)
  return (
    <Card title={`${kind === 'sales' ? 'Sales' : 'Purchase'} register (${rows.length} bills)`} action={derived ? <span className="text-xs text-ink-3">Taxable & VAT derived from VAT-inclusive totals</span> : undefined}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50"><tr>
            <th className={th}>Date (BS)</th><th className={th}>Bill no</th><th className={th}>{kind === 'sales' ? 'Buyer' : 'Supplier'}</th><th className={th}>PAN</th>
            {kind === 'sales' && <th className={th}>Paid by</th>}
            <th className={cx(th, 'text-right')}>Taxable</th><th className={cx(th, 'text-right')}>VAT</th><th className={cx(th, 'text-right')}>Total</th><th className={th}>Check</th>
          </tr></thead>
          <tbody>
            {rows.slice(page * PAGE, page * PAGE + PAGE).map((i) => {
              const out = ex.invoices.has(i.id)
              const flag = flagged.get(i.id)
              return (
                <tr key={i.id} className={cx('border-t border-line', out && 'bg-slate-50 text-ink-3')}>
                  <td className={cx(td, 'num whitespace-nowrap text-xs')}>{formatBs(i.dateBs)}</td>
                  <td className={cx(td, 'num text-xs')}>{i.billNo}</td>
                  <td className={cx(td, 'text-xs')}>{i.party}</td>
                  <td className={cx(td, 'num text-xs')}>{i.pan || <span className="text-ink-3">—</span>}</td>
                  {kind === 'sales' && <td className={cx(td, 'text-xs')}>{i.mode === 'Unknown' ? <span className="text-ink-3">not recorded</span> : i.mode}</td>}
                  <td className={tdNum}><Money p={i.taxable} /></td>
                  <td className={tdNum}><Money p={i.vat} /></td>
                  <td className={tdNum}><Money p={i.total} /></td>
                  <td className={cx(td, 'text-xs')}>
                    {out ? <span className="text-bad">Excluded</span> : flag ? <span className="text-warn" title={flag}>Check</span> : kind === 'sales' && matched.has(i.id) ? <span className="text-ok">In bank</span> : <span className="text-ink-3">OK</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </Card>
  )
}
