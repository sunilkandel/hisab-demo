# Hisab: VAT pack & mismatch radar

A full-stack web app for Nepali accountants and CA firms. You upload a client's bank statements and sales and purchase registers exactly as exported. Hisab then:

- reads them, whatever software made them,
- checks them for errors,
- explains every deposit against declared sales (the **mismatch radar**),
- produces a VAT-ready pack.

The accountant makes the judgement calls; Hisab does the typing.

> **Demo:** the only thing that's made up is the data. Upload made-up files and everything (parsing, checks, reconciliation, VAT, exports) runs for real. Never upload real client data to the demo.

## Run it

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev        # API on :3001 + app on http://localhost:5173
```

Sign in with **`demo` / `Hisab@2083`**, then change the password in Settings.

| Command | What it does |
|---|---|
| `bun run dev` | Development: API server (auto-restart) + Vite with hot reload |
| `bun test` | 35 tests: engine (parsing, validation, reconciliation, VAT) and API (auth, security, full client flow, SEO files) |
| `bun run build` | Typecheck + production build into `dist/` |
| `bun run start` | Production: one server on http://localhost:3000 serving the app and API |

### Docker

```bash
docker build -t hisab .
docker run -p 3000:3000 -v hisab-data:/app/data hisab   # open http://localhost:3000
```

The image is two-stage (build, then a slim runtime), runs as a non-root user, has a health check on `/api/health`, and keeps SQLite in `/app/data`. Mount a volume there, or data resets when the container restarts. Behind a hosting proxy (Render, Nginx…) the proxy's `X-Forwarded-Proto: https` header marks the session cookie `Secure`.

Data lives in `data/hisab.db` (SQLite, git-ignored). Delete it to start fresh; the six demo clients are re-seeded on the next start.

## Try the whole flow

1. **Sign in**, then open **Sample files** and download a set (for example Ram Pharmacy's three files).
2. **Add client**: name, 9-digit PAN, billing software, bank account.
3. Make sure the **VAT month** picker says **Bhadra 2083** (the samples are for that month), then **upload** the files (drag and drop works).
4. **Process documents** to see each step and what it found.
5. **Mismatch radar**, then the **Review queue**: classify unexplained deposits.
6. **VAT pack**: the checklist unlocks the Excel download; **Client report** prints to PDF.
7. **Audit log** shows everything you did.

Edit the sample files in Excel (add a deposit, delete a bill, break a VAT amount) and upload again to see how Hisab reacts.

## What's inside

**Public site**
- Landing page with clear calls to action, plus FAQ, Privacy policy, Terms, Security and Sign-in pages, and a custom 404 page that returns a real 404 status.
- SEO: per-page titles and descriptions, canonical URLs, Open Graph and Twitter image, JSON-LD structured data (`SoftwareApplication`, `FAQPage`), plus `robots.txt` and `sitemap.xml` generated for the actual domain.
- Favicon (SVG), app icons, web manifest.

**App**
- Clients dashboard with search, status filters, deadline countdown and progress.
- Add, edit and remove clients, with inline validation and type-to-confirm delete.
- VAT-month picker (BS calendar) that lives in the URL, so links and the back button keep it.
- Per client and month: document uploads, processing log, mismatch radar, review queue, issues, bank, sales and purchases tables, VAT pack and a printable client report.
- Sample files library, audit log, and Settings (password change, analytics, workspace reset).

**Backend** (Bun + SQLite)
- JSON API: clients, per-month files, processing, decisions, exports, audit, analytics.
- Security:
  - argon2id password hashes.
  - HttpOnly `SameSite=Strict` session cookies (only a hash of the token is stored).
  - Login rate limiting.
  - Same-origin check on writes.
  - Strict CSP and other security headers.
  - Upload type and size limits.
- Privacy-friendly analytics: first-party, no cookies, no IP addresses, honours Do Not Track and Global Privacy Control.

**Design and usability**
- Inter for text, with tabular figures so amounts line up; JetBrains Mono for PANs and references. Fonts are self-hosted.
- Every action shows its status (progress steps, toasts, loading skeletons).
- Error prevention: validation, confirm dialogs, and an export checklist.
- Choose-don't-type controls (radio cards, month picker, fill-in demo login), and undo for review decisions.
- Keyboard and screen-reader support: skip links, labels, `aria-live` regions, visible focus, reduced-motion support. Layout tested at 390 px (phone) and 1440 px.

## Code map

| Path | What |
|---|---|
| `server/index.ts` | HTTP server: API, static files, SPA routes with real 404s, security headers, robots/sitemap |
| `server/api.ts` | API routes and validation |
| `server/auth.ts` | Passwords, sessions, rate limiting |
| `server/db.ts` · `server/seed.ts` | SQLite schema; demo seeding |
| `src/domain/` | The engine, shared by server and browser: dates (BS/AD, VAT periods), money (paisa), parse, validate, reconcile, pipeline, export, view |
| `src/lib/` | Router, API client, auth, month (period) state, SEO, analytics, toasts, client-month data hook |
| `src/pages/public/` | Landing, FAQ, Privacy/Terms/Security, Login, 404 |
| `src/pages/app/` | Layout, dashboard, client form, client workspace and tabs, samples, audit, settings, report |
| `src/ui/common.tsx` | Shared components (buttons, fields, dialogs, pills, tables) |
| `design-system/hisab/MASTER.md` | Colours, type and spacing rules |

## Before real customers

Get a lawyer to review the Privacy policy and Terms, and replace the placeholder contact address `privacy@hisab.example`. Then add:

- multi-factor sign-in and staff roles,
- per-firm data isolation (Postgres with row-level security) and encrypted backups,
- a data-processing agreement,
- parsers with golden-file tests for each real bank and wallet format.

See `~/million-dollar-plan.md`.
