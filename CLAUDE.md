# Hisab

- Runtime and package manager: Bun (`bun install`, `bun run dev`, `bun test`, `bun run build`, `bun run start`). Node is not installed.
- Backend: `server/` (Bun.serve + bun:sqlite, own tiny router in `server/api.ts`). Frontend: React 19 + Vite + Tailwind v4 (tokens in `src/index.css` `@theme`). Vite proxies `/api`, `/robots.txt`, `/sitemap.xml` to :3001 in dev.
- The engine in `src/domain/` is shared by server and browser. Keep it free of DOM and server-only APIs.
- Money is always integer paisa; dates are stored as BS and AD; VAT periods are BS months (`2083-05`).
- Reconciliation is rule-based only. Never put an LLM on the numbers.
- All demo data is fictional. Never add real names, real bank statement formats or real PANs.
- Every page must keep the professional essentials:
  - SEO via `useSeo`; `noindex` for `/app`.
  - Accessible labels and alt text; one `h1` per page.
  - FAQ, Privacy and Terms kept in sync with behaviour.
  - A real 404 status for unknown routes (`PUBLIC_ROUTES` in `server/index.ts`).
  - New public pages go into both `PUBLIC_ROUTES` and the sitemap.
- Work on a feature branch; run `bun test` and `bun run build` before committing.
