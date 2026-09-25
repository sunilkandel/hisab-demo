/**
 * Hisab server: JSON API under /api, and (in production) the built frontend from dist/.
 *   dev:  bun run dev      → this server on :3001 + Vite on :5173 (proxies /api here)
 *   prod: bun run build && bun run start → everything on :3000
 */
import { existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { openDb } from './db'
import { ensureDefaultUser } from './auth'
import { handleApi } from './api'
import { seedIfEmpty } from './seed'

export const PUBLIC_ROUTES = ['/', '/faq', '/privacy', '/terms', '/login', '/security']
const isAppRoute = (p: string) => p === '/app' || p.startsWith('/app/')

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
}

function withHeaders(res: Response, extra: Record<string, string> = {}): Response {
  const h = new Headers(res.headers)
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) if (!h.has(k)) h.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h })
}

export async function createServer(opts: { port: number; dist?: string; dbPath?: string }) {
  const db = openDb(opts.dbPath)
  await ensureDefaultUser(db)
  await seedIfEmpty(db)
  const dist = opts.dist && existsSync(join(opts.dist, 'index.html')) ? opts.dist : undefined

  const server = Bun.serve({
    port: opts.port,
    maxRequestBodySize: 6 * 1024 * 1024,
    async fetch(req, srv) {
      const url = new URL(req.url)
      if (url.pathname.startsWith('/api/')) {
        const headers = new Headers(req.headers)
        headers.set('x-hisab-ip', srv.requestIP(req)?.address ?? 'local') // set by us, never trusted from the client
        return withHeaders(await handleApi(new Request(req, { headers }), db))
      }
      if (!dist) return new Response('Frontend not built. Use `bun run dev` (Vite on :5173) or `bun run build`.', { status: 404 })

      // static assets
      const safe = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')
      if (safe !== '/' && !safe.endsWith('/')) {
        const file = Bun.file(join(dist, safe))
        if (await file.exists()) {
          const immutable = safe.startsWith('/assets/')
          return withHeaders(new Response(file), { 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' })
        }
      }
      // SPA routes: known pages get 200; anything else still renders the app's 404 page, with a real 404 status.
      const path = url.pathname.replace(/\/+$/, '') || '/'
      const known = PUBLIC_ROUTES.includes(path) || isAppRoute(path)
      return withHeaders(new Response(Bun.file(join(dist, 'index.html')), {
        status: known ? 200 : 404,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', ...(isAppRoute(path) ? { 'x-robots-tag': 'noindex' } : {}) },
      }))
    },
  })
  return { server, db }
}

if (import.meta.main) {
  const prod = process.env.NODE_ENV === 'production' || process.argv.includes('--prod')
  const port = Number(process.env.PORT) || (prod ? 3000 : 3001)
  const { server } = await createServer({ port, dist: prod ? 'dist' : undefined })
  console.log(`Hisab ${prod ? 'running' : 'API running'} on http://localhost:${server.port}${prod ? '' : '  (open the app at http://localhost:5173)'}`)
}
