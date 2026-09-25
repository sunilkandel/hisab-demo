import { useState } from 'react'
import { useStore } from '../state/store'
import { CLIENTS } from '../domain/seed'
import { Card, Pager, cx, td, th } from './common'

const PAGE = 50

export function AuditPage() {
  const { audit } = useStore()
  const [client, setClient] = useState('all')
  const [page, setPage] = useState(0)
  const rows = [...audit].reverse().filter((a) => client === 'all' || a.clientId === client)
  const name = (id: string) => CLIENTS.find((c) => c.id === id)?.name ?? id
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-ink-3">Append-only record of every file, run, decision and export: who did what, and when. In production this is a table nobody can edit or delete from.</p>
      </div>
      <Card title={`${rows.length} entries`} action={
        <label className="flex items-center gap-2 text-xs text-ink-2">Client
          <select value={client} onChange={(e) => { setClient(e.target.value); setPage(0) }} className="min-h-8 rounded-md border border-line bg-white px-2 text-xs">
            <option value="all">All clients</option>
            {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      }>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>When</th><th className={th}>Client</th><th className={th}>Who</th><th className={th}>Action</th><th className={th}>Detail</th></tr></thead>
            <tbody>
              {rows.slice(page * PAGE, page * PAGE + PAGE).map((a, i) => (
                <tr key={i} className="border-t border-line">
                  <td className={cx(td, 'num whitespace-nowrap text-xs text-ink-3')}>{new Date(a.at).toLocaleString()}</td>
                  <td className={cx(td, 'text-xs')}><a className="hover:text-accent" href={`#/client/${a.clientId}`}>{name(a.clientId)}</a></td>
                  <td className={cx(td, 'text-xs')}>{a.actor}</td>
                  <td className={cx(td, 'text-xs font-medium')}>{a.action}</td>
                  <td className={cx(td, 'break-all text-xs text-ink-2')}>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={Math.ceil(rows.length / PAGE)} onPage={setPage} />
      </Card>
    </div>
  )
}
