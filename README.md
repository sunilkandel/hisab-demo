# Hisab: VAT pack & mismatch radar (demo)

A working demo of **Hisab**, a tool for Nepali accountants and CA firms. It turns each client's month-end VAT work into a short review, and flags deposits that aren't explained by declared sales **before** a tax-office cross-check does.

> **All data is fictional.** The firm, clients, banks, PANs and amounts are generated. Files are processed entirely in your browser; nothing is uploaded anywhere.

## Run it

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev        # http://localhost:5173
bun test           # engine tests (parsers, validation, reconciliation, VAT)
bun run build      # typecheck + production build into dist/
```

## What the demo shows

Six fictional clients for **Bhadra 2083**. Each one demonstrates a real-world situation:

| Client | Billing tool | Scenario |
|---|---|---|
| Ram Pharmacy | BUSY | NPR 8.7 lakh more deposits than sales: loan + owner capital (suggested), NPR 3.7 lakh unexplained |
| Himali Kitchen | Manual Excel (Nepali headers, VAT-inclusive totals) | Duplicate bills, QR money on a day with no bills, online-platform payout |
| Lalitpur Hardware | Tigg | Clean month: everything reconciles |
| Everest Wholesale | Tally (Excel serial dates, no payment-mode column) | Wrong VAT on 2 bills, purchases missing supplier PAN, supplier refund |
| Kathmandu Mobile Hub | BUSY, two banks | Own-account transfer; bank export with 3 repeated rows |
| Bagmati Fresh Mart | Manual Excel | Documents still arriving; the sales book contains last month's bills |

The sample files are real `.xlsx` / `.csv` bytes in each tool's messy layout: title rows, BS/AD/Devanagari/Excel-serial dates, `1,23,456.00` amounts, totals rows. Use **View raw file** or **Download** to see exactly what the engine has to parse. You can also **upload your own** statement or register; common header names are auto-mapped.

## How it works

```
raw files ─► 1 store (SHA-256) ─► 2 detect format ─► 3 parse & normalise (BS+AD dates, integer paisa)
          ─► 4 validate (13% VAT, duplicates, month, supplier PAN)
          ─► 5 reconcile deposits: own transfers → QR batches → bank transfers → cash deposits → suggestions → unexplained
          ─► 6 accountant review (audit-logged) ─► 7 VAT pack (.xlsx) + client report (print to PDF)
```

Reconciliation is **rules only, with no AI on the numbers**, so every match carries a human-readable reason.

## Code map

| Path | What |
|---|---|
| `src/domain/seed.ts` | Fictional clients, the month's "truth", and writers for each raw file format |
| `src/domain/parse.ts` | Format profiles, header detection, bank + register parsers |
| `src/domain/validate.ts` | Checks that make a VAT return wrong |
| `src/domain/reconcile.ts` | The mismatch radar |
| `src/domain/pipeline.ts` | Runs the steps and records what each did; VAT computation |
| `src/domain/export.ts` | VAT pack workbook |
| `src/domain/engine.test.ts` | Tests, run on real generated file bytes |
| `src/state/store.tsx` | App state (localStorage in the demo; Postgres + RLS in production) |
| `src/ui/` | Screens: dashboard, client workspace tabs, how-it-works, audit log, client report |
| `design-system/hisab/MASTER.md` | Colours, type and spacing rules |

## Demo vs production

The demo keeps everything in the browser. Production adds login with MFA, per-firm Postgres with row-level security, encrypted backups, a parser (with golden-file tests) for each real bank and wallet, and PDF statement support. See `~/million-dollar-plan.md` for the plan.
