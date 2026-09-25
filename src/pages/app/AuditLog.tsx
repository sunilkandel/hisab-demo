import { useEffect, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { api } from '../../lib/api'
import { useSeo } from '../../lib/seo'
import { Link } from '../../lib/router'
import { Card, EmptyState, ErrorBox, PageLoading, Pager, cx, td, th } from '../../ui/common'

interface Entry { id: number; at: string; client_id: string | null; client_name: string | null; period: string | null; actor: string; action: string; detail: string }
const PAGE = 50

export function AuditLog() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState('all')
  const [page, setPage] = useState(0)
  useSeo({ title: 'Audit log', noindex: true })
  useEffect(() => { api.get<{ entries: Entry[] }>('/api/audit?limit=1000').then((r) => setEntries(r.entries)).catch((e) => setError(e.message)) }, [])
  if (error) return <ErrorBox message={error} />
  if (!entries) return <PageLoading label="Loading audit log" />
  const clients = [...new Map(entries.filter((e) => e.client_id).map((e) => [e.client_id!, e.client_name ?? e.client_id!])).entries()]
  const rows = entries.filter((e) => client === 'all' || e.client_id === client)
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-3">Every sign-in, upload, run, decision and export: who did what, and when. Entries are never edited or deleted, so you can show a reviewer exactly how each figure was reached.</p>
      </div>
      <Card title={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`} action={
        <label className="flex items-center gap-2 text-sm text-ink-2">Client
          <select value={client} onChange={(e) => { setClient(e.target.value); setPage(0) }} className="field min-h-9 w-auto py-1 text-sm">
            <option value="all">All clients</option>
            {clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      }>
        {rows.length === 0 ? <EmptyState icon={<ScrollText size={22} aria-hidden />} title="Nothing recorded yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <caption className="sr-only">Audit log entries, newest first</caption>
              <thead className="bg-slate-50"><tr><th scope="col" className={th}>When</th><th scope="col" className={th}>Client</th><th scope="col" className={th}>Month</th><th scope="col" className={th}>Who</th><th scope="col" className={th}>Action</th><th scope="col" className={th}>Detail</th></tr></thead>
              <tbody>
                {rows.slice(page * PAGE, page * PAGE + PAGE).map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className={cx(td, 'num whitespace-nowrap text-[13px] text-ink-3')}><time dateTime={a.at}>{new Date(a.at).toLocaleString()}</time></td>
                    <td className={cx(td, 'text-[13px]')}>{a.client_id ? (a.client_name ? <Link className="hover:text-accent" href={`/app/clients/${encodeURIComponent(a.client_id)}`}>{a.client_name}</Link> : <span className="text-ink-3">{a.client_id} (removed)</span>) : <span className="text-ink-3">—</span>}</td>
                    <td className={cx(td, 'num text-[13px]')}>{a.period ?? '—'}</td>
                    <td className={cx(td, 'text-[13px]')}>{a.actor}</td>
                    <td className={cx(td, 'text-[13px] font-semibold')}>{a.action}</td>
                    <td className={cx(td, 'break-all text-[13px] text-ink-2')}>{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={Math.ceil(rows.length / PAGE)} onPage={setPage} />
      </Card>
    </div>
  )
}
