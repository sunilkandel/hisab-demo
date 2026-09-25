import { ArrowDown } from 'lucide-react'
import { Card } from './common'

const STEPS = [
  { n: 1, title: 'Store raw file', what: 'Every upload is kept exactly as received, with a SHA-256 fingerprint.', why: 'Proves later what the client sent. Stops the same file being counted twice.' },
  { n: 2, title: 'Detect format', what: 'Scans the first 20 rows for a known header (bank statements start with titles and periods). Each layout is a "profile": BUSY, Tigg, Tally, manual Nepali Excel, each bank.', why: 'Accountants get a different format from every client. Hisab accepts them as they come.' },
  { n: 3, title: 'Parse & normalise', what: 'Dates in BS, AD, Devanagari digits or Excel serials → stored as both BS and AD. Amounts like 1,23,456.00 or (500) → integer paisa. Titles, totals and balance rows skipped.', why: 'One clean shape for every source. Integer paisa means no rounding drift.' },
  { n: 4, title: 'Validate', what: 'VAT = 13% of taxable? Duplicate bill numbers? Bills from another month? Supplier PAN present (needed to claim input VAT)? Duplicate bank rows?', why: "These are the errors that make a VAT return wrong. Caught before filing, not after IRD's letter." },
  { n: 5, title: 'Reconcile deposits (mismatch radar)', what: 'Explains every rupee that came in: own-account transfers → QR batches vs that day\'s QR bills → bank transfers vs named bills → cash deposits vs declared cash sales → keyword suggestions (loan, capital, refund) → the rest is unexplained.', why: 'Income that reached the bank but not the sales book is what a turnover cross-check would flag. Rules only, no AI on the numbers, so every match can be explained.' },
  { n: 6, title: 'Human review', what: 'The accountant classifies what rules could not: loan, capital, refund, undeclared sale… with a note. Every action goes into the audit log.', why: 'Judgement stays with the professional. Hisab removes the grunt work.' },
  { n: 7, title: 'VAT pack', what: 'Output VAT − claimable input VAT = payable. One Excel workbook with registers, deposits, decisions and issues, plus a one-page client report.', why: 'What you file from, and your evidence if anyone asks.' },
]

export function HowItWorks() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">How Hisab works</h1>
        <p className="mt-1 text-sm text-ink-2">
          <strong>The problem:</strong> every month an accountant builds VAT registers for dozens of clients from bank statements and sales exports in different formats, by hand.
          Nobody checks whether the money that reached the bank matches the sales that were declared. That gap is exactly what a tax authority comparing payment data with returns would see.
        </p>
        <p className="mt-2 text-sm text-ink-2">
          <strong>Hisab</strong> reads the files as they are, checks them, explains every deposit, and hands back a VAT-ready pack. What's left is the accountant's judgement, not typing.
        </p>
      </div>

      <Card title="Data flow">
        <div className="space-y-1 px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {['Bank statements (XLSX / CSV / PDF*)', 'Sales register export', 'Purchase register export'].map((x) => (
              <div key={x} className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-center text-xs font-medium text-ink-2">{x}</div>
            ))}
          </div>
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="flex justify-center py-1 text-ink-3"><ArrowDown size={16} aria-hidden /></div>
              <div className="grid gap-2 rounded-md border border-line bg-white px-4 py-3 sm:grid-cols-[180px_1fr]">
                <div className="text-sm font-semibold"><span className="num mr-1.5 text-accent">{s.n}</span>{s.title}</div>
                <div className="text-sm">
                  <p className="text-ink-2">{s.what}</p>
                  <p className="mt-1 text-xs text-ink-3"><strong className="font-medium text-ink-2">Why:</strong> {s.why}</p>
                </div>
              </div>
            </div>
          ))}
          <p className="pt-2 text-xs text-ink-3">*PDF statements are planned (hardest format). This demo handles XLSX and CSV.</p>
        </div>
      </Card>

      <Card title="Why an accountant would pay">
        <ul className="list-disc space-y-1.5 py-3 pl-9 pr-4 text-sm text-ink-2">
          <li><strong>Time:</strong> hours of retyping per client per month becomes a short review. Across 40 clients that's a staff member's month.</li>
          <li><strong>Risk:</strong> one mismatch notice costs a client far more than a year of Hisab, and the client blames the accountant.</li>
          <li><strong>Works across tools:</strong> clients use BUSY, Tigg, Tally or Excel. Billing software reconciles only its own data; Hisab works across all of them.</li>
          <li><strong>A new service:</strong> the client mismatch report is something the accountant can sell as a "tax health check".</li>
        </ul>
        <p className="border-t border-line px-4 py-2 text-xs text-ink-3">These are hypotheses. The demo exists to test them with real accountants before building the production version.</p>
      </Card>

      <Card title="Demo vs production">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50"><tr><th className="px-4 py-2 text-left text-xs text-ink-3">Part</th><th className="px-4 py-2 text-left text-xs text-ink-3">This demo</th><th className="px-4 py-2 text-left text-xs text-ink-3">Production</th></tr></thead>
            <tbody className="[&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-2 [&_td]:align-top">
              <tr><td>Data</td><td>Fictional, generated in the browser</td><td>Real client files, with consent and a data-processing agreement</td></tr>
              <tr><td>Storage</td><td>Your browser (localStorage)</td><td>Postgres (Supabase, Mumbai), row-level security per firm, encrypted backups</td></tr>
              <tr><td>Login</td><td>None</td><td>Email + MFA, staff roles per firm</td></tr>
              <tr><td>Formats</td><td>2 demo banks, BUSY, Tigg, Tally, manual Excel</td><td>Parser per real bank/wallet, golden-file tests for each, PDF support</td></tr>
              <tr><td>Engine</td><td>Same rules as production would use</td><td>Same, plus tuning from real months</td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
