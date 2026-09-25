# Hisab demo

- Runtime and package manager: Bun (`bun install`, `bun run dev`, `bun test`, `bun run build`). Node is not installed.
- Frontend: React 19 + Vite + TypeScript + Tailwind v4 (`@tailwindcss/vite`, tokens in `src/index.css` `@theme`).
- Money is always integer paisa (`src/domain/money.ts`); dates are stored as both BS and AD (`src/domain/dates.ts`).
- Reconciliation is rule-based only. Never put an LLM on the numbers.
- All demo data is fictional (`src/domain/seed.ts`). Never add real names, banks' real statement formats, or real PANs.
- Design rules: `design-system/hisab/MASTER.md`.
- Run `bun test` and `bun run build` before committing.
