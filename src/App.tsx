import { useEffect, useState } from 'react'
import { BookOpenText, LayoutGrid, ScrollText, ShieldCheck } from 'lucide-react'
import { useStore } from './state/store'
import { DEMO_FIRM } from './domain/seed'
import { adToBs, formatBs, todayAd } from './domain/dates'
import { cx } from './ui/common'
import { Dashboard } from './ui/Dashboard'
import { ClientPage } from './ui/ClientPage'
import { HowItWorks } from './ui/HowItWorks'
import { AuditPage } from './ui/AuditPage'
import { Report } from './ui/Report'

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const on = () => { setHash(window.location.hash || '#/'); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const { ready } = useStore()
  const hash = useHash()
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)

  if (parts[0] === 'report' && parts[1]) return ready ? <Report clientId={parts[1]} /> : <Loading />

  const nav = [
    { href: '#/', label: 'Clients', icon: LayoutGrid, active: parts.length === 0 || parts[0] === 'client' },
    { href: '#/how', label: 'How it works', icon: BookOpenText, active: parts[0] === 'how' },
    { href: '#/audit', label: 'Audit log', icon: ScrollText, active: parts[0] === 'audit' },
  ]

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <div className="bg-primary px-4 py-1.5 text-center text-xs text-slate-200">
        Demo with <strong className="text-white">fictional data</strong>. Firm, clients, banks, PANs and amounts are all made up. Files are processed in your browser; nothing is uploaded anywhere.
      </div>
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <a href="#/" className="flex items-center gap-2" aria-label="Hisab home">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-white"><ShieldCheck size={18} aria-hidden /></span>
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-tight">Hisab</span>
              <span className="block text-[11px] text-ink-3">VAT pack & mismatch radar</span>
            </span>
          </a>
          <nav className="flex gap-1" aria-label="Main">
            {nav.map((n) => (
              <a key={n.href} href={n.href} aria-current={n.active ? 'page' : undefined}
                className={cx('inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors', n.active ? 'bg-slate-100 text-ink' : 'text-ink-3 hover:bg-slate-50 hover:text-ink')}>
                <n.icon size={16} aria-hidden />{n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto text-right text-xs leading-tight text-ink-3">
            <div className="font-medium text-ink-2">{DEMO_FIRM.name}</div>
            <div>{DEMO_FIRM.user} · Today {formatBs(adToBs(todayAd()), 'long')}</div>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-5">
        {!ready ? <Loading /> :
          parts[0] === 'client' && parts[1] ? <ClientPage clientId={parts[1]} tab={parts[2] ?? 'documents'} /> :
          parts[0] === 'how' ? <HowItWorks /> :
          parts[0] === 'audit' ? <AuditPage /> :
          <Dashboard />}
      </main>
    </div>
  )
}

function Loading() {
  return (
    <div className="grid place-items-center py-24 text-ink-3" role="status">
      <div className="size-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
      <p className="mt-3 text-sm">Preparing demo month: generating client files and running the pipeline…</p>
    </div>
  )
}
