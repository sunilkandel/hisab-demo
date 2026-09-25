import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from '../../lib/router'
import { useSeo } from '../../lib/seo'
import { useAuth } from '../../lib/auth'
import { PublicLayout } from './PublicLayout'

export function NotFound() {
  useSeo({ title: 'Page not found', noindex: true })
  const { user } = useAuth()
  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-muted text-accent"><Compass size={30} aria-hidden /></span>
        <p className="num mt-6 text-sm font-semibold text-accent">Error 404</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">This page isn’t in the ledger</h1>
        <p className="mt-4 text-lg text-ink-3">The link may be old or mistyped. Nothing is lost; here are the places people usually want.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={user ? '/app' : '/'} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 font-semibold text-white hover:bg-accent-hover"><ArrowLeft size={17} aria-hidden />{user ? 'Back to clients' : 'Back to home'}</Link>
          <Link href="/faq" className="inline-flex min-h-11 items-center rounded-xl border border-line px-5 font-semibold text-ink-2 hover:bg-muted">Read the FAQ</Link>
          {!user && <Link href="/login" className="inline-flex min-h-11 items-center rounded-xl border border-line px-5 font-semibold text-ink-2 hover:bg-muted">Sign in</Link>}
        </div>
      </div>
    </PublicLayout>
  )
}
