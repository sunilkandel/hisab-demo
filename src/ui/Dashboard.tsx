import { ArrowRight, CalendarClock, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../state/store'
import { DEMO_MONTH, monthRangeAd } from '../domain/seed'
import { BS_MONTHS, adToBs, bsToAd, daysBetween, formatBs, todayAd } from '../domain/dates'
import { formatNprShort } from '../domain/money'
import { Button, Card, Money, Stat, StatusPill, cx, td, tdNum, th } from './common'

export function Dashboard() {
  const { views, reset } = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const monthLabel = `${BS_MONTHS[DEMO_MONTH.month - 1]} ${DEMO_MONTH.year}`
  // VAT return for a month is due by the 25th of the following BS month.
  const dueBs = `${DEMO_MONTH.year}-${String(DEMO_MONTH.month + 1).padStart(2, '0')}-25`
  const daysLeft = daysBetween(todayAd(), bsToAd(DEMO_MONTH.year, DEMO_MONTH.month + 1, 25))
  const { start, end } = monthRangeAd()

  const atRisk = views.reduce((s, v) => s + (v.summary ? v.summary.unexplained + v.summary.pendingReview : 0), 0)
  const payable = views.reduce((s, v) => s + (v.vat && v.vat.payable > 0 ? v.vat.payable : 0), 0)
  const done = views.filter((v) => v.status === 'ready' || v.status === 'exported').length
  const needs = views.filter((v) => v.status === 'review' || v.status === 'errors').length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Month-end: {monthLabel}</h1>
          <p className="text-sm text-ink-3">VAT period {formatBs(adToBs(start), 'long')} – {formatBs(adToBs(end), 'long')} <span className="num">({start} to {end} AD)</span></p>
        </div>
        <div className={cx('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', daysLeft <= 7 ? 'border-red-200 bg-bad-bg text-bad' : 'border-amber-200 bg-warn-bg text-warn')}>
          <CalendarClock size={16} aria-hidden />
          <span>Returns due <strong>{formatBs(dueBs, 'long')}</strong> · {daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days overdue`}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clients" value={views.length} hint={`${done} ready · ${needs} need attention`} />
        <Stat label="Deposits not yet explained" value={formatNprShort(atRisk)} hint="across all clients" tone={atRisk ? 'warn' : 'ok'} />
        <Stat label="VAT payable (clients owing)" value={formatNprShort(payable)} hint="before your review" />
        <Stat label="Hours saved (estimate)" value={`~${views.filter((v) => v.result).length * 3} h`} hint="assumes 3 h manual work per client; to be measured" />
      </div>

      <Card title={`Clients · ${monthLabel}`} action={
        confirmReset ? (
          <span className="flex items-center gap-2 text-xs text-ink-3">Erase your changes and regenerate the demo?
            <Button kind="danger" className="min-h-8" onClick={() => { setConfirmReset(false); reset() }}>Yes, reset</Button>
            <Button kind="ghost" className="min-h-8" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </span>
        ) : <Button kind="ghost" className="min-h-8 text-xs" onClick={() => setConfirmReset(true)}><RotateCcw size={14} aria-hidden />Reset demo</Button>
      }>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Client</th><th className={th}>Billing tool</th><th className={th}>Status</th>
                <th className={cx(th, 'text-right')}>Issues</th><th className={cx(th, 'text-right')}>Unexplained deposits</th>
                <th className={cx(th, 'text-right')}>VAT payable</th><th className={th}><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.client.id} className="border-t border-line transition-colors hover:bg-slate-50">
                  <td className={td}>
                    <a href={`#/client/${v.client.id}`} className="font-medium text-ink hover:text-accent">{v.client.name}</a>
                    <div className="text-xs text-ink-3">{v.client.sector} · PAN <span className="num">{v.client.pan}</span></div>
                  </td>
                  <td className={cx(td, 'text-ink-2')}>{v.client.billingTool}</td>
                  <td className={td}><StatusPill status={v.status} /></td>
                  <td className={tdNum}>
                    {v.result ? <span className="num text-xs"><span className={v.errors ? 'text-bad' : 'text-ink-3'}>{v.errors} err</span> · <span className={v.warnings ? 'text-warn' : 'text-ink-3'}>{v.warnings} warn</span></span> : <span className="text-ink-3">—</span>}
                  </td>
                  <td className={tdNum}>
                    {v.summary ? (v.summary.unexplained + v.summary.pendingReview ? <Money p={v.summary.unexplained + v.summary.pendingReview} className="text-warn" strong /> : <span className="text-ok">None</span>) : <span className="text-ink-3">—</span>}
                  </td>
                  <td className={tdNum}>{v.vat ? <Money p={v.vat.payable} /> : <span className="text-ink-3">—</span>}</td>
                  <td className={cx(td, 'text-right')}>
                    <a href={`#/client/${v.client.id}`} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-accent hover:bg-info-bg" aria-label={`Open ${v.client.name}`}>
                      Open <ArrowRight size={14} aria-hidden />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="What each demo client shows">
        <ul className="grid gap-px bg-line sm:grid-cols-2">
          {views.map((v) => (
            <li key={v.client.id} className="bg-white px-4 py-3">
              <a href={`#/client/${v.client.id}`} className="text-sm font-medium hover:text-accent">{v.client.name}</a>
              <p className="mt-0.5 text-xs text-ink-3">{v.client.story}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
