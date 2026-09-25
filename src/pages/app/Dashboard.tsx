import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarClock, Plus, Search, Users } from 'lucide-react'
import { api, type ApiError } from '../../lib/api'
import { Link } from '../../lib/router'
import { usePeriod, withPeriod } from '../../lib/period'
import { useSeo } from '../../lib/seo'
import { adToBs, daysBetween, formatBs, periodKey, periodLabel, periodRange, todayAd, vatDueDate } from '../../domain/dates'
import { formatNprShort } from '../../domain/money'
import type { ClientMonthView, ClientStatus } from '../../domain/view'
import { Card, EmptyState, ErrorBox, Money, PageLoading, Stat, StatusPill, cx, td, tdNum, th } from '../../ui/common'

const FILTERS: { id: 'all' | 'attention' | 'done' | 'waiting'; label: string; match: (s: ClientStatus) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'attention', label: 'Needs attention', match: (s) => s === 'review' || s === 'errors' || s === 'stale' || s === 'not-run' },
  { id: 'waiting', label: 'Waiting for documents', match: (s) => s === 'waiting' },
  { id: 'done', label: 'Ready / exported', match: (s) => s === 'ready' || s === 'exported' },
]

export function Dashboard() {
  const [period] = usePeriod()
  const [clients, setClients] = useState<ClientMonthView[] | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  useSeo({ title: `Clients · ${periodLabel(period)}`, noindex: true })

  const load = () => {
    setError(null)
    api.get<{ clients: ClientMonthView[] }>(`/api/clients?period=${periodKey(period)}`).then((r) => setClients(r.clients)).catch(setError)
  }
  useEffect(() => { setClients(null); load() }, [periodKey(period)]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!
    const needle = q.trim().toLowerCase()
    return (clients ?? []).filter((c) => f.match(c.status) && (!needle || c.client.name.toLowerCase().includes(needle) || c.client.pan.includes(needle)))
  }, [clients, q, filter])

  if (error) return <ErrorBox message={error.message} onRetry={load} />
  if (!clients) return <PageLoading label="Loading clients" />

  const due = vatDueDate(period)
  const daysLeft = daysBetween(todayAd(), due.ad)
  const { start, end } = periodRange(period)
  const atRisk = clients.reduce((s, v) => s + (v.summary ? v.summary.unexplained + v.summary.pendingReview : 0), 0)
  const payable = clients.reduce((s, v) => s + (v.vat && v.vat.payable > 0 ? v.vat.payable : 0), 0)
  const done = clients.filter((v) => v.status === 'ready' || v.status === 'exported').length
  const toReview = clients.reduce((s, v) => s + v.toReview, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Month-end · {periodLabel(period)}</h1>
          <p className="mt-1 text-sm text-ink-3">VAT period {formatBs(adToBs(start), 'long')} – {formatBs(adToBs(end), 'long')} <span className="num">({start} to {end} AD)</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={cx('flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm', daysLeft < 0 ? 'border-red-200 bg-bad-bg text-bad' : daysLeft <= 7 ? 'border-amber-200 bg-warn-bg text-warn' : 'border-line bg-white text-ink-2')}>
            <CalendarClock size={16} aria-hidden />
            <span>Returns due <strong>{formatBs(due.bs, 'long')}</strong> · {daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : `${-daysLeft} days overdue`}</span>
          </div>
          <Link href="/app/clients/new" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover"><Plus size={17} aria-hidden />Add client</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clients" value={clients.length} hint={`${done} ready or exported`} />
        <Stat label="Deposits to review" value={toReview} hint={atRisk ? `${formatNprShort(atRisk)} not yet explained` : 'nothing unexplained'} tone={toReview ? 'warn' : 'ok'} />
        <Stat label="VAT payable (clients owing)" value={formatNprShort(payable)} hint="from processed clients" />
        <Stat label="Progress" value={`${clients.length ? Math.round((done / clients.length) * 100) : 0}%`} hint={`${done} of ${clients.length} clients done`} tone={done === clients.length && clients.length ? 'ok' : 'default'} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <label htmlFor="client-search" className="sr-only">Search clients by name or PAN</label>
            <input id="client-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or PAN" className="field min-h-10 pl-9" />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => {
              const n = clients.filter((c) => f.match(c.status)).length
              return (
                <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                  className={cx('min-h-9 rounded-lg px-3 text-sm font-medium transition-colors', filter === f.id ? 'bg-primary text-white' : 'text-ink-2 hover:bg-muted')}>
                  {f.label} <span className="num opacity-70">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
        {clients.length === 0 ? (
          <EmptyState icon={<Users size={22} aria-hidden />} title="No clients yet" action={<Link href="/app/clients/new" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"><Plus size={16} aria-hidden />Add your first client</Link>}>
            Add a client, upload their bank statement and sales/purchase registers, and Hisab does the rest.
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={<Search size={22} aria-hidden />} title="No clients match">Try another name or PAN, or clear the filter.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <caption className="sr-only">Clients and their status for {periodLabel(period)}</caption>
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className={th}>Client</th><th scope="col" className={th}>Billing tool</th><th scope="col" className={th}>Status</th>
                  <th scope="col" className={cx(th, 'text-right')}>Issues</th><th scope="col" className={cx(th, 'text-right')}>Unexplained deposits</th>
                  <th scope="col" className={cx(th, 'text-right')}>VAT payable</th><th scope="col" className={th}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((v) => {
                  const href = withPeriod(`/app/clients/${encodeURIComponent(v.client.id)}`, period)
                  const risk = v.summary ? v.summary.unexplained + v.summary.pendingReview : 0
                  return (
                    <tr key={v.client.id} className="border-t border-line transition-colors hover:bg-slate-50/80">
                      <td className={td}>
                        <Link href={href} className="font-semibold text-ink hover:text-accent">{v.client.name}</Link>
                        <div className="text-[13px] text-ink-3">{v.client.sector || 'No sector set'} · PAN <span className="code">{v.client.pan}</span></div>
                      </td>
                      <td className={cx(td, 'text-ink-2')}>{v.client.billingTool}</td>
                      <td className={td}><StatusPill status={v.status} /></td>
                      <td className={tdNum}>{v.summary ? <span className="num text-[13px]"><span className={v.errors ? 'font-semibold text-bad' : 'text-ink-3'}>{v.errors} err</span> · <span className={v.warnings ? 'font-semibold text-warn' : 'text-ink-3'}>{v.warnings} warn</span></span> : <span className="text-ink-3">—</span>}</td>
                      <td className={tdNum}>{v.summary ? (risk ? <Money p={risk} className="text-warn" strong /> : <span className="font-medium text-ok">None</span>) : <span className="text-ink-3">—</span>}</td>
                      <td className={tdNum}>{v.vat ? <Money p={v.vat.payable} /> : <span className="text-ink-3">—</span>}</td>
                      <td className={cx(td, 'text-right')}>
                        <Link href={href} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-accent-soft" aria-label={`Open ${v.client.name}`}>Open <ArrowRight size={15} aria-hidden /></Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
