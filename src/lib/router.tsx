/** Minimal history-API router: real URLs (good for SEO, sharing and the back button). */
import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'

interface Loc { path: string; search: URLSearchParams }
const RouterCtx = createContext<Loc>({ path: '/', search: new URLSearchParams() })

const read = (): Loc => ({ path: window.location.pathname.replace(/\/+$/, '') || '/', search: new URLSearchParams(window.location.search) })

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === window.location.pathname + window.location.search) return
  window.history[opts.replace ? 'replaceState' : 'pushState']({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  if (!to.includes('#')) window.scrollTo(0, 0)
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState(read)
  useEffect(() => {
    const on = () => setLoc(read())
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  return <RouterCtx.Provider value={loc}>{children}</RouterCtx.Provider>
}

export const useLocation = () => useContext(RouterCtx)

/** Match "/app/clients/:id/:tab?" style patterns. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const s = path.split('/').filter(Boolean)
  const out: Record<string, string> = {}
  for (let i = 0; i < Math.max(p.length, s.length); i++) {
    const seg = p[i]
    if (seg === undefined) return null
    const optional = seg.endsWith('?')
    const name = seg.replace(/^:|\?$/g, '')
    if (s[i] === undefined) { if (optional) continue; return null }
    if (seg.startsWith(':')) out[name] = decodeURIComponent(s[i])
    else if (seg !== s[i]) return null
  }
  return out
}

export function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return
        if (!href.startsWith('/') || href.startsWith('/api/')) return
        const [path, hash] = href.split('#')
        if (!path && hash) return // in-page anchor
        e.preventDefault()
        navigate(href)
        if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 30)
      }}
    >
      {children}
    </a>
  )
}
