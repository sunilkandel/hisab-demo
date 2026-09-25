import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, ExternalLink, LifeBuoy, ListChecks, Search, Tags } from 'lucide-react'
import { Link } from '../../lib/router'
import { usePeriod, withPeriod } from '../../lib/period'
import { useSeo } from '../../lib/seo'
import { periodLabel } from '../../domain/dates'
import type { ClientStatus } from '../../domain/view'
import { FAQS } from '../public/faqData'
import { Card, CategoryChip, EmptyState, StatusPill } from '../../ui/common'

const STATUSES: { s: ClientStatus; meaning: string }[] = [
  { s: 'waiting', meaning: 'Some documents for this month haven’t been uploaded yet.' },
  { s: 'not-run', meaning: 'All documents are in. Press Process documents.' },
  { s: 'stale', meaning: 'A file changed after the last run. Process again so results match the files.' },
  { s: 'errors', meaning: 'The client’s files contain errors (wrong VAT, duplicates, other months). Read them in the Issues tab.' },
  { s: 'review', meaning: 'Some deposits need your decision in the Review queue.' },
  { s: 'ready', meaning: 'Everything checks out. Download the VAT pack.' },
  { s: 'exported', meaning: 'The VAT pack was downloaded. Any later change resets this.' },
]

const GLOSSARY: [string, string][] = [
  ['Mismatch radar', 'Compares money that came into the bank with declared sales, and shows what isn’t explained.'],
  ['QR batch', 'QR payments usually settle into the bank once a day. Hisab matches each batch to that day’s QR bills.'],
  ['Unexplained deposit', 'Money in the bank that no bill, QR batch, cash sale or own transfer accounts for. You decide what it is.'],
  ['Undeclared sale', 'A deposit you confirm was a sale without a bill. It needs a bill and adds output VAT.'],
  ['Input VAT not claimable', 'VAT on purchases whose supplier PAN is missing. Add the PAN to claim it.'],
  ['VAT pack', 'The Excel workbook you file from: summary, registers, deposits with decisions, and issues.'],
]

export function Help() {
  useSeo({ title: 'Help', noindex: true })
  const [period] = usePeriod()
  const [q, setQ] = useState('')
  const faqs = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return FAQS.map((g) => ({ ...g, items: g.items.filter((f) => !needle || f.q.toLowerCase().includes(needle) || f.a.toLowerCase().includes(needle)) })).filter((g) => g.items.length)
  }, [q])

  const steps = [
    { t: 'Add the client', d: 'Name, PAN, billing software and bank accounts. Once per client.', href: '/app/clients/new', cta: 'Add client' },
    { t: 'Pick the VAT month', d: `Use the month picker at the top. You’re on ${periodLabel(period)}.`, href: withPeriod('/app', period), cta: 'Go to clients' },
    { t: 'Upload the documents', d: 'Open the client → Documents. Drop in bank statements and sales & purchase registers as exported.', href: '/app/samples', cta: 'Get sample files' },
    { t: 'Process and review', d: 'Press Process documents, check the Mismatch radar, then decide each deposit in the Review queue.' },
    { t: 'Export', d: 'VAT pack tab: when the checklist is green, download the pack and print the client report.' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
        <p className="mt-1 text-sm text-ink-3">How to get a client’s month done, what the labels mean, and answers to common questions.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card title={<span className="inline-flex items-center gap-2"><ListChecks size={16} aria-hidden />Quick start</span>}>
          <ol className="divide-y divide-line">
            {steps.map((s, i) => (
              <li key={s.t} className="flex gap-4 px-5 py-4">
                <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.t}</p>
                  <p className="mt-0.5 text-sm text-ink-3">{s.d}</p>
                </div>
                {s.href && <Link href={s.href} className="inline-flex h-9 shrink-0 items-center gap-1 self-center rounded-lg px-2.5 text-sm font-semibold text-accent hover:bg-accent-soft">{s.cta}<ArrowRight size={15} aria-hidden /></Link>}
              </li>
            ))}
          </ol>
        </Card>

        <Card title={<span className="inline-flex items-center gap-2"><Tags size={16} aria-hidden />What the statuses mean</span>}>
          <ul className="divide-y divide-line">
            {STATUSES.map(({ s, meaning }) => (
              <li key={s} className="px-5 py-3">
                <StatusPill status={s} />
                <p className="mt-1 text-[13px] text-ink-2">{meaning}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={<span className="inline-flex items-center gap-2"><BookOpen size={16} aria-hidden />Glossary</span>}>
        <dl className="grid gap-px bg-line sm:grid-cols-2">
          {GLOSSARY.map(([term, def]) => (
            <div key={term} className="bg-white px-5 py-3.5">
              <dt className="text-sm font-semibold">{term}</dt>
              <dd className="mt-0.5 text-[13px] text-ink-3">{def}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-[13px] text-ink-3">
          Deposit labels you’ll see: <CategoryChip c="qr-settlement" /> <CategoryChip c="matched-sales" /> <CategoryChip c="own-transfer" /> <CategoryChip c="unexplained" suggestion="loan" /> <CategoryChip c="undeclared-sale" />
        </div>
      </Card>

      <Card title="Frequently asked questions" action={
        <div className="relative w-64 max-w-full">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <label htmlFor="faq-search" className="sr-only">Search questions</label>
          <input id="faq-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions" className="field min-h-9 py-1 pl-9 text-sm" />
        </div>
      }>
        {faqs.length === 0 ? (
          <EmptyState icon={<Search size={22} aria-hidden />} title="No matching questions">Try a different word, or check the glossary above.</EmptyState>
        ) : faqs.map((g) => (
          <section key={g.title} aria-labelledby={`faq-${g.title}`} className="border-t border-line first:border-0">
            <h2 id={`faq-${g.title}`} className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{g.title}</h2>
            <div className="divide-y divide-line">
              {g.items.map((f) => (
                <details key={f.q} open={!!q.trim()} className="group px-5 py-3.5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between gap-4 text-sm font-semibold">{f.q}<span className="text-lg leading-none text-ink-3 transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </Card>

      <Card title={<span className="inline-flex items-center gap-2"><LifeBuoy size={16} aria-hidden />Still stuck?</span>}>
        <div className="grid gap-4 p-5 text-sm text-ink-2 sm:grid-cols-2">
          <p>Write to <span className="code">support@hisab.example</span> with the client and month. Please don’t attach real client files.</p>
          <ul className="space-y-1.5">
            {[['/privacy', 'Privacy policy'], ['/terms', 'Terms of use'], ['/security', 'Security']].map(([href, label]) => (
              <li key={href}><a href={href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">{label}<ExternalLink size={13} aria-hidden /><span className="sr-only"> (opens in a new tab)</span></a></li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  )
}
