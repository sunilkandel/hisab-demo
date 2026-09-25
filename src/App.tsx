import { useEffect } from 'react'
import { match, navigate, useLocation } from './lib/router'
import { useAuth } from './lib/auth'
import { trackPageView } from './lib/analytics'
import { PageLoading } from './ui/common'
import { Landing } from './pages/public/Landing'
import { Faq } from './pages/public/Faq'
import { Privacy, Security, Terms } from './pages/public/Legal'
import { Login } from './pages/public/Login'
import { NotFound } from './pages/public/NotFound'
import { AppLayout } from './pages/app/AppLayout'
import { Dashboard } from './pages/app/Dashboard'
import { ClientPage } from './pages/app/ClientPage'
import { ClientForm } from './pages/app/ClientForm'
import { Samples } from './pages/app/Samples'
import { AuditLog } from './pages/app/AuditLog'
import { Settings } from './pages/app/Settings'
import { Report } from './pages/app/Report'

export default function App() {
  const { path, search } = useLocation()
  const { user, loading } = useAuth()

  useEffect(() => { trackPageView(path) }, [path])

  // Public pages
  if (path === '/') return <Landing />
  if (path === '/faq') return <Faq />
  if (path === '/privacy') return <Privacy />
  if (path === '/terms') return <Terms />
  if (path === '/security') return <Security />
  if (path === '/login') return <Login />
  if (path !== '/app' && !path.startsWith('/app/')) return <NotFound />

  // App pages: sign-in required
  if (loading) return <div className="mx-auto max-w-5xl p-8"><PageLoading label="Checking your session" /></div>
  if (!user) return <RedirectToLogin next={path + (search.toString() ? `?${search}` : '')} />

  let m: Record<string, string> | null
  if ((m = match('/app/report/:id', path))) return <Report clientId={m.id} />
  return <AppLayout>{appPage(path)}</AppLayout>
}

function appPage(path: string) {
  let m: Record<string, string> | null
  if (path === '/app') return <Dashboard />
  if (path === '/app/clients/new') return <ClientForm />
  if ((m = match('/app/clients/:id/edit', path))) return <ClientForm clientId={m.id} key={m.id} />
  if ((m = match('/app/clients/:id/:tab?', path))) return <ClientPage clientId={m.id} tab={m.tab ?? 'documents'} key={m.id} />
  if (path === '/app/samples') return <Samples />
  if (path === '/app/audit') return <AuditLog />
  if (path === '/app/settings') return <Settings />
  return <InAppNotFound />
}

function RedirectToLogin({ next }: { next: string }) {
  useEffect(() => { navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true }) }, [next])
  return null
}

function InAppNotFound() {
  return (
    <div className="py-16 text-center">
      <p className="num text-sm font-semibold text-accent">Error 404</p>
      <h1 className="mt-2 text-2xl font-semibold">This page doesn’t exist</h1>
      <p className="mt-2 text-ink-3">Use the menu to get back to your clients.</p>
      <button onClick={() => navigate('/app')} className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 font-semibold text-white hover:bg-accent-hover">Back to clients</button>
    </div>
  )
}
