import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, FolderDown, HelpCircle, LayoutGrid, LogOut, Menu, ScrollText, Settings as Cog, TriangleAlert, X } from 'lucide-react'
import { Link, navigate, useLocation } from '../../lib/router'
import { useAuth } from '../../lib/auth'
import { usePeriod, withPeriod } from '../../lib/period'
import { useToast } from '../../lib/toast'
import { BS_MONTHS, adToBs, currentFilingPeriod, formatBs, nextPeriod, periodKey, periodLabel, prevPeriod, todayAd, type Period } from '../../domain/dates'
import { Logo, cx } from '../../ui/common'

export function AppLayout({ children }: { children: ReactNode }) {
  const { path } = useLocation()
  const { user, logout } = useAuth()
  const [period] = usePeriod()
  const toast = useToast()
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => setNavOpen(false), [path])

  const nav = [
    { href: withPeriod('/app', period), label: 'Clients', icon: LayoutGrid, active: path === '/app' || path.startsWith('/app/clients') },
    { href: '/app/samples', label: 'Sample files', icon: FolderDown, active: path === '/app/samples' },
    { href: '/app/audit', label: 'Audit log', icon: ScrollText, active: path === '/app/audit' },
    { href: '/app/settings', label: 'Settings', icon: Cog, active: path === '/app/settings' },
  ]

  async function signOut() {
    await logout()
    toast('Signed out.')
    navigate('/login')
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-5"><Link href={withPeriod('/app', period)} aria-label="Hisab: clients dashboard"><Logo dark /></Link></div>
      <nav aria-label="App" className="flex-1 space-y-1 px-3">
        {nav.map((n) => (
          <Link key={n.label} href={n.href} aria-current={n.active ? 'page' : undefined}
            className={cx('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors', n.active ? 'bg-white/12 text-white' : 'text-slate-300 hover:bg-white/6 hover:text-white')}>
            <n.icon size={18} aria-hidden />{n.label}
          </Link>
        ))}
        <Link href="/faq" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-300 hover:bg-white/6 hover:text-white"><HelpCircle size={18} aria-hidden />Help & FAQ</Link>
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/90 text-sm font-bold text-primary" aria-hidden>{user?.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
            <div className="truncate text-xs text-slate-400">{user?.firm}</div>
          </div>
        </div>
        <button onClick={signOut} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/15 text-sm font-medium text-slate-200 hover:bg-white/8"><LogOut size={16} aria-hidden />Sign out</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen bg-primary lg:block">{sidebar}</aside>
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-primary shadow-xl">
            <button onClick={() => setNavOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Close menu"><X size={20} aria-hidden /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex min-h-16 items-center gap-3 px-4 lg:px-8">
            <button onClick={() => setNavOpen(true)} className="rounded-lg p-2 text-ink-2 hover:bg-muted lg:hidden" aria-label="Open menu"><Menu size={22} aria-hidden /></button>
            <div className="lg:hidden"><Logo size={28} withText={false} /></div>
            <MonthPicker />
            <div className="ml-auto hidden text-right text-xs leading-tight text-ink-3 sm:block">
              <div>Today</div>
              <div className="font-medium text-ink-2">{formatBs(adToBs(todayAd()), 'long')}</div>
            </div>
          </div>
          <div className="border-t border-amber-100 bg-amber-50/70 px-4 py-1.5 text-center text-xs text-amber-900 lg:px-8">
            Demo workspace: use <strong>made-up data only</strong>. Everything you upload stays on this server’s database.
          </div>
        </header>
        {user?.isDefaultPassword && (
          <div className="mx-4 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-warn-bg px-4 py-2.5 text-sm text-warn lg:mx-8" role="status">
            <TriangleAlert size={16} aria-hidden /> You’re signed in with the default demo password. <Link href="/app/settings" className="font-semibold underline">Change it in Settings</Link>
          </div>
        )}
        <main id="main" className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}

function MonthPicker() {
  const [period, setPeriod] = usePeriod()
  const latest = nextPeriod(currentFilingPeriod())
  const options: Period[] = []
  for (let p = latest, i = 0; i < 24; i++, p = prevPeriod(p)) options.push(p)
  const atLatest = periodKey(period) === periodKey(latest)
  const selectRef = useRef<HTMLSelectElement>(null)
  return (
    <div className="flex items-center gap-1" role="group" aria-label="VAT month">
      <span className="mr-1 hidden text-xs font-medium text-ink-3 md:inline">VAT month</span>
      <button className="grid size-9 place-items-center rounded-lg border border-line bg-white text-ink-2 hover:bg-muted" onClick={() => setPeriod(prevPeriod(period))} aria-label={`Previous month (${periodLabel(prevPeriod(period))})`}><ChevronLeft size={18} aria-hidden /></button>
      <label htmlFor="month" className="sr-only">Choose VAT month</label>
      <select id="month" ref={selectRef} value={periodKey(period)} onChange={(e) => { const [y, m] = e.target.value.split('-').map(Number); setPeriod({ year: y, month: m }) }}
        className="min-h-9 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-line-2">
        {options.map((p) => <option key={periodKey(p)} value={periodKey(p)}>{BS_MONTHS[p.month - 1]} {p.year}</option>)}
        {!options.some((p) => periodKey(p) === periodKey(period)) && <option value={periodKey(period)}>{periodLabel(period)}</option>}
      </select>
      <button className="grid size-9 place-items-center rounded-lg border border-line bg-white text-ink-2 hover:bg-muted disabled:opacity-40" disabled={atLatest} onClick={() => setPeriod(nextPeriod(period))} aria-label={`Next month (${periodLabel(nextPeriod(period))})`}><ChevronRight size={18} aria-hidden /></button>
    </div>
  )
}
