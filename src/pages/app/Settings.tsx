import { useEffect, useState, type FormEvent } from 'react'
import { BarChart3, KeyRound, Loader2, RotateCcw, UserRound } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useSeo } from '../../lib/seo'
import { navigate } from '../../lib/router'
import { Button, Card, ConfirmDialog, Field } from '../../ui/common'

export function Settings() {
  useSeo({ title: 'Settings', noindex: true })
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-3">Your account, security and this workspace.</p>
      </div>
      <Profile />
      <Password />
      <Analytics />
      <Reset />
    </div>
  )
}

function Profile() {
  const { user } = useAuth()
  return (
    <Card title={<span className="inline-flex items-center gap-2"><UserRound size={16} aria-hidden />Profile</span>}>
      <dl className="grid gap-4 p-5 sm:grid-cols-3">
        <div><dt className="text-xs font-medium text-ink-3">Name</dt><dd className="mt-0.5 text-sm font-medium">{user?.name}</dd></div>
        <div><dt className="text-xs font-medium text-ink-3">Username</dt><dd className="code mt-0.5 text-sm">{user?.username}</dd></div>
        <div><dt className="text-xs font-medium text-ink-3">Firm</dt><dd className="mt-0.5 text-sm">{user?.firm}</dd></div>
      </dl>
    </Card>
  )
}

function Password() {
  const { user, refresh } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const [err, setErr] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const v: Record<string, string> = {}
    if (!f.current) v.current = 'Enter your current password.'
    if (f.next.length < 10) v.next = 'Use at least 10 characters.'
    else if (!/[A-Za-z]/.test(f.next) || !/\d/.test(f.next)) v.next = 'Mix letters and numbers.'
    if (f.confirm !== f.next) v.confirm = 'The two new passwords don’t match.'
    setErr(v)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      await api.post('/api/auth/password', { current: f.current, next: f.next })
      setF({ current: '', next: '', confirm: '' })
      toast('Password changed.')
      refresh()
    } catch (e2) {
      const ae = e2 as ApiError
      setErr(ae.field ? { [ae.field]: ae.message } : { next: ae.message })
    } finally { setSaving(false) }
  }
  return (
    <Card title={<span className="inline-flex items-center gap-2"><KeyRound size={16} aria-hidden />Password</span>}>
      <form onSubmit={submit} noValidate className="space-y-4 p-5">
        {user?.isDefaultPassword && <p className="rounded-lg border border-amber-200 bg-warn-bg px-3 py-2 text-[13px] text-warn">You’re still using the default demo password. Change it if anyone else can reach this server.</p>}
        <input type="text" name="username" autoComplete="username" value={user?.username ?? ''} readOnly hidden />
        <Field label="Current password" error={err.current}>{(p) => <input {...p} type="password" className="field" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" error={err.next} hint="At least 10 characters, letters and numbers.">{(p) => <input {...p} type="password" className="field" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />}</Field>
          <Field label="Repeat new password" error={err.confirm}>{(p) => <input {...p} type="password" className="field" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />}</Field>
        </div>
        <Button type="submit" kind="primary" disabled={saving}>{saving && <Loader2 size={16} className="animate-spin" aria-hidden />}Change password</Button>
      </form>
    </Card>
  )
}

interface Stats { since: string; byDay: { day: string; views: number }[]; topPaths: { path: string; views: number }[]; referrers: { host: string; views: number }[] }
function Analytics() {
  const [s, setS] = useState<Stats | null>(null)
  useEffect(() => { api.get<Stats>('/api/analytics').then(setS).catch(() => setS(null)) }, [])
  const total = s?.byDay.reduce((a, d) => a + d.views, 0) ?? 0
  const max = Math.max(1, ...(s?.byDay.map((d) => d.views) ?? [1]))
  return (
    <Card title={<span className="inline-flex items-center gap-2"><BarChart3 size={16} aria-hidden />Site analytics (last 30 days)</span>}>
      <div className="space-y-4 p-5">
        <p className="text-[13px] text-ink-3">Counted on this server only: page path, day and referring site. No cookies, no IP addresses, no third parties. Visitors with Do Not Track or Global Privacy Control switched on aren’t counted at all.</p>
        {!s ? <p className="text-sm text-ink-3">Loading…</p> : total === 0 ? <p className="text-sm text-ink-3">No page views yet.</p> : (
          <>
            <div>
              <div className="num text-2xl font-semibold">{total}</div>
              <div className="text-xs text-ink-3">page views since {s.since}</div>
              <div className="mt-3 flex h-20 items-end gap-1" role="img" aria-label={`Daily page views: ${s.byDay.map((d) => `${d.day} ${d.views}`).join(', ')}`}>
                {s.byDay.map((d) => <div key={d.day} title={`${d.day}: ${d.views}`} className="flex-1 rounded-t bg-accent/80" style={{ height: `${Math.max(6, (d.views / max) * 100)}%` }} />)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-1 text-xs font-semibold text-ink-3">Top pages</h3>
                <ul className="text-sm">{s.topPaths.map((p) => <li key={p.path} className="flex justify-between border-b border-line py-1"><span className="code truncate text-[13px]">{p.path}</span><span className="num">{p.views}</span></li>)}</ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold text-ink-3">Referring sites</h3>
                {s.referrers.length ? <ul className="text-sm">{s.referrers.map((r) => <li key={r.host} className="flex justify-between border-b border-line py-1"><span className="truncate text-[13px]">{r.host}</span><span className="num">{r.views}</span></li>)}</ul> : <p className="text-[13px] text-ink-3">None yet (direct visits).</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

function Reset() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try {
      await api.post('/api/workspace/reset', { confirm: text })
      toast('Workspace reset to the six demo clients.')
      setOpen(false)
      navigate('/app')
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  return (
    <Card title={<span className="inline-flex items-center gap-2"><RotateCcw size={16} aria-hidden />Reset demo workspace</span>}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="max-w-lg text-sm text-ink-2">Deletes every client you added, all uploads, decisions and the audit log, and reloads the six demo clients. Handy before showing Hisab to someone new. Your login is kept.</p>
        <Button kind="danger" onClick={() => { setText(''); setOpen(true) }}>Reset workspace…</Button>
      </div>
      <ConfirmDialog open={open} title="Reset the whole workspace?" confirmLabel="Reset workspace" busy={busy} confirmDisabled={text !== 'RESET'} onCancel={() => setOpen(false)} onConfirm={go}>
        <p>Everything except your login is replaced with the demo set. This can’t be undone.</p>
        <label className="mt-4 block text-sm font-medium text-ink">Type <span className="code rounded bg-muted px-1">RESET</span> to confirm
          <input className="field mt-1.5" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        </label>
      </ConfirmDialog>
    </Card>
  )
}
