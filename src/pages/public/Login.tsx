import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { Link, navigate, useLocation } from '../../lib/router'
import { useSeo } from '../../lib/seo'
import { ApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { Button, Field, Logo } from '../../ui/common'

const DEMO = { username: 'demo', password: 'Hisab@2083' }

export function Login() {
  useSeo({ title: 'Sign in', description: 'Sign in to the Hisab demo. Demo username: demo, password: Hisab@2083.' })
  const { login, user } = useAuth()
  const { search } = useLocation()
  const toast = useToast()
  const next = search.get('next')
  const safeNext = next && next.startsWith('/app') ? next : '/app'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<{ message: string; field?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const userRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) navigate(safeNext, { replace: true }) }, [user, safeNext])
  useEffect(() => { userRef.current?.focus() }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError({ message: !username.trim() ? 'Enter your username.' : 'Enter your password.', field: !username.trim() ? 'username' : 'password' })
      return
    }
    setBusy(true)
    setError(null)
    try {
      const u = await login(username.trim(), password)
      toast(`Welcome back, ${u.name.split(' ')[0]}.`)
      navigate(safeNext, { replace: true })
    } catch (err) {
      setError({ message: (err as ApiError).message })
      setPassword('')
    } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      <aside className="hero-grid relative hidden flex-col justify-between bg-primary p-12 text-white lg:flex">
        <Link href="/" aria-label="Hisab home"><Logo dark /></Link>
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">Month-end, without the retyping.</h2>
          <ul className="mt-8 space-y-4 text-slate-300">
            {['Upload clients’ files exactly as exported', 'Every deposit explained, or flagged for you', 'A VAT pack and client report in one click'].map((t) => (
              <li key={t} className="flex gap-3"><CheckCircle2 size={20} className="shrink-0 text-emerald-300" aria-hidden />{t}</li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-400"><ShieldCheck size={16} aria-hidden />Passwords hashed with argon2id · HttpOnly sessions · <Link href="/security" className="underline hover:text-white">Security</Link></p>
      </aside>

      <main id="main" className="flex flex-col justify-center bg-white px-5 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="lg:hidden" aria-label="Hisab home"><Logo /></Link>
          <h1 className="mt-8 text-3xl font-bold tracking-tight lg:mt-0">Sign in</h1>
          <p className="mt-2 text-ink-3">to your Hisab workspace</p>

          {search.get('expired') && !error && <p role="status" className="mt-6 rounded-xl border border-sky-200 bg-accent-soft px-4 py-3 text-sm text-ink-2">Your session ended. Sign in again to continue where you left off.</p>}

          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-start gap-3">
              <KeyRound size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-ink">Demo access</p>
                <p className="mt-0.5 text-ink-2">Username <span className="code font-semibold">{DEMO.username}</span> · Password <span className="code font-semibold">{DEMO.password}</span></p>
              </div>
              <Button type="button" className="min-h-9 shrink-0 text-[13px]" onClick={() => { setUsername(DEMO.username); setPassword(DEMO.password); setError(null) }}>Fill in</Button>
            </div>
          </div>

          <form onSubmit={submit} noValidate className="mt-6 space-y-5">
            {error && !error.field && <p role="alert" className="rounded-xl border border-red-200 bg-bad-bg px-4 py-3 text-sm font-medium text-bad">{error.message}</p>}
            <Field label="Username" error={error?.field === 'username' ? error.message : undefined} id="username">
              {(p) => <input {...p} ref={userRef} className="field min-h-12" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />}
            </Field>
            <Field label="Password" error={error?.field === 'password' ? error.message : undefined} id="password">
              {(p) => (
                <div className="relative">
                  <input {...p} className="field min-h-12 pr-12" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-muted" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                    {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                  </button>
                </div>
              )}
            </Field>
            <Button type="submit" kind="primary" className="min-h-12 w-full text-base" disabled={busy}>{busy && <Loader2 size={18} className="animate-spin" aria-hidden />}{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>
          <p className="mt-8 text-center text-xs text-ink-3">By signing in you agree to the <Link href="/terms" className="underline hover:text-accent">Terms</Link> and <Link href="/privacy" className="underline hover:text-accent">Privacy policy</Link>. Use fictional data only.</p>
        </div>
      </main>
    </div>
  )
}
