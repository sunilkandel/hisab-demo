import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Link, useLocation } from '../../lib/router'
import { useAuth } from '../../lib/auth'
import { Logo, cx } from '../../ui/common'

export function PublicLayout({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const { user } = useAuth()
  const { path } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [path])
  const links = [
    { href: '/#features', label: 'Features' },
    { href: '/#how', label: 'How it works' },
    { href: '/#pricing', label: 'Pricing' },
    { href: '/faq', label: 'FAQ' },
  ]
  const cta = user
    ? <Link href="/app" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-primary hover:bg-emerald-400">Open app <ArrowRight size={16} aria-hidden /></Link>
    : <Link href="/login" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-primary hover:bg-emerald-400">Try the demo <ArrowRight size={16} aria-hidden /></Link>

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
      <header className={cx('sticky top-0 z-40 border-b backdrop-blur', dark ? 'border-white/10 bg-primary/90' : 'border-line bg-white/90')} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-6 px-5">
          <Link href="/" aria-label="Hisab home"><Logo dark={dark} /></Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={cx('rounded-lg px-3 py-2 text-sm font-medium transition-colors', dark ? 'text-slate-300 hover:text-white' : 'text-ink-2 hover:text-ink', path === l.href && (dark ? 'text-white' : 'text-ink'))}>{l.label}</Link>
            ))}
            {!user && <Link href="/login" className={cx('rounded-lg px-3 py-2 text-sm font-medium', dark ? 'text-slate-300 hover:text-white' : 'text-ink-2 hover:text-ink')}>Sign in</Link>}
            <span className="ml-2">{cta}</span>
          </nav>
          <button className={cx('ml-auto rounded-lg p-2 md:hidden', dark ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-muted')} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className={cx('border-t px-5 py-3 md:hidden', dark ? 'border-white/10' : 'border-line')}>
            {links.map((l) => <Link key={l.href} href={l.href} className={cx('block rounded-lg px-3 py-3 text-base font-medium', dark ? 'text-slate-200' : 'text-ink')}>{l.label}</Link>)}
            {!user && <Link href="/login" className={cx('block rounded-lg px-3 py-3 text-base font-medium', dark ? 'text-slate-200' : 'text-ink')}>Sign in</Link>}
            <div className="px-3 pt-2">{cta}</div>
          </nav>
        )}
      </header>
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

function Footer() {
  const cols = [
    { title: 'Product', links: [['/#features', 'Features'], ['/#how', 'How it works'], ['/#pricing', 'Pricing'], ['/login', 'Live demo']] },
    { title: 'Help', links: [['/faq', 'FAQ'], ['/security', 'Security'], ['/app/samples', 'Sample files']] },
    { title: 'Legal', links: [['/privacy', 'Privacy policy'], ['/terms', 'Terms of use']] },
  ]
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-ink-3">Month-end VAT packs and deposit reconciliation for accountants in Nepal. Built so the accountant makes the judgement calls, not the typing.</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-semibold text-ink">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.links.map(([href, label]) => <li key={href}><Link href={href} className="text-sm text-ink-3 hover:text-accent">{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 py-5 text-xs text-ink-3">
          <p>© {new Date().getFullYear()} Hisab (demo). All names, banks, PANs and figures in this demo are fictional.</p>
          <p>Not tax or legal advice. Always check figures before filing.</p>
        </div>
      </div>
    </footer>
  )
}
