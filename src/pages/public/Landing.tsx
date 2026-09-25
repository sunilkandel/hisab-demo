import { useEffect, useState } from 'react'
import {
  ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, ClipboardCheck, FileSpreadsheet, FileWarning, Fingerprint, History,
  Landmark, Layers, Radar as RadarIcon, ScanSearch, ShieldCheck, Sparkles, Timer, Upload,
} from 'lucide-react'
import { Link } from '../../lib/router'
import { useSeo } from '../../lib/seo'
import { formatNpr } from '../../domain/money'
import { PublicLayout } from './PublicLayout'
import { FAQS } from './faqData'
import { cx } from '../../ui/common'

function useCountUp(target: number, ms = 1400) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function Landing() {
  useSeo({ title: 'Hisab', path: '/' })
  useEffect(() => {
    // Structured data so search engines understand what Hisab is.
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.id = 'ld-app'
    s.text = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Hisab', applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: 'Month-end VAT packs and bank-vs-sales mismatch radar for accountants in Nepal.',
      offers: { '@type': 'Offer', price: '3000', priceCurrency: 'NPR' },
    })
    document.head.appendChild(s)
    return () => s.remove()
  }, [])

  return (
    <PublicLayout dark>
      <Hero />
      <WorksWith />
      <Problem />
      <How />
      <Features />
      <Pricing />
      <FaqTeaser />
      <FinalCta />
    </PublicLayout>
  )
}

function Hero() {
  return (
    <section className="hero-grid relative overflow-hidden bg-primary text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
        <div className="fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[13px] font-medium text-emerald-300">
            <Sparkles size={14} aria-hidden /> For accountants & CA firms in Nepal
          </p>
          <h1 className="mt-5 text-[2.5rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-[3.6rem]">
            Every rupee in the bank, <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">explained</span> before IRD asks.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
            Hisab reads your clients’ bank statements and sales registers, whatever software made them. It reconciles every deposit and hands back a VAT-ready pack. You review. You don’t retype.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-primary shadow-lg shadow-emerald-500/20 transition-transform hover:-translate-y-0.5 hover:bg-emerald-400">
              Try the live demo <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/#how" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6 text-base font-semibold text-white hover:bg-white/10">See how it works</Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">Demo sign-in: <span className="code text-slate-200">demo</span> / <span className="code text-slate-200">Hisab@2083</span> · fictional data only</p>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {[['6', 'formats read automatically'], ['7', 'checks before filing'], ['0', 'numbers guessed by AI']].map(([n, l]) => (
              <div key={l}><dt className="sr-only">{l}</dt><dd><span className="num block text-2xl font-bold text-white">{n}</span><span className="block text-xs leading-snug text-slate-400">{l}</span></dd></div>
            ))}
          </dl>
        </div>
        <ProductPreview />
      </div>
    </section>
  )
}

function ProductPreview() {
  const amount = useCountUp(87000000)
  const rows = [
    { d: '2083/05/10', n: 'LOAN DISBURSEMENT A/C 0041-LN', a: 30000000, chip: 'Suggest: loan', tone: 'slate' },
    { d: '2083/05/13', n: 'CASH DEPOSIT BY PROPRIETOR', a: 20000000, chip: 'Suggest: owner capital', tone: 'slate' },
    { d: '2083/05/16', n: 'FT FROM R K TRADERS', a: 14500000, chip: 'Unexplained', tone: 'amber' },
  ]
  return (
    <div className="relative fade-up [animation-delay:150ms]">
      <p className="sr-only">Example screen: Hisab finds NPR 8,70,000 of deposits at a fictional pharmacy that its declared sales don’t explain, suggests a loan and owner capital for two of them, and flags the rest for review.</p>
      <div aria-hidden className="relative rounded-2xl border border-white/10 bg-white p-5 text-ink shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-ink-3">Ram Pharmacy Pvt. Ltd. · Bhadra 2083</div>
            <div className="mt-0.5 text-sm font-semibold">Mismatch radar</div>
          </div>
          <span className="pulse-ring rounded-full bg-warn-bg px-2.5 py-1 text-xs font-semibold text-warn">Risk: high</span>
        </div>
        <div className="mt-4 rounded-xl bg-bad-bg/60 px-4 py-3">
          <div className="text-xs font-medium text-bad">Deposits not explained by declared sales</div>
          <div className="num mt-0.5 text-3xl font-bold tracking-tight text-bad">NPR {formatNpr(amount, { decimals: false })}</div>
        </div>
        <div className="mt-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="grow-x h-full bg-emerald-500" style={{ width: '18%' }} />
            <div className="grow-x h-full bg-emerald-600 [animation-delay:150ms]" style={{ width: '27%' }} />
            <div className="grow-x h-full bg-amber-500 [animation-delay:300ms]" style={{ width: '55%' }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
            <span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />QR batches matched</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-600" />Bills & cash sales</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-amber-500" />Needs a decision</span>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {rows.map((r, i) => (
            <li key={r.n} className="fade-up flex items-center gap-3 px-3 py-2.5" style={{ animationDelay: `${500 + i * 150}ms` }}>
              <span className="code w-20 shrink-0 text-[11px] text-ink-3">{r.d}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{r.n}</span>
              <span className={cx('hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold sm:inline', r.tone === 'amber' ? 'bg-warn-bg text-warn' : 'bg-muted text-ink-2')}>{r.chip}</span>
              <span className="num w-20 shrink-0 text-right text-xs font-semibold">{formatNpr(r.a, { decimals: false })}</span>
            </li>
          ))}
        </ul>
      </div>
      <div aria-hidden className="fade-up absolute -left-6 -bottom-6 hidden rounded-xl border border-line bg-white px-4 py-3 text-ink shadow-xl sm:block [animation-delay:900ms]">
        <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 size={16} className="text-ok" />QR batches matched</div>
        <div className="text-xs text-ink-3">to that day’s QR bills</div>
      </div>
      <div aria-hidden className="fade-up absolute -right-3 -top-16 hidden rounded-xl border border-line bg-white px-4 py-3 text-ink shadow-xl sm:block [animation-delay:1100ms]">
        <div className="flex items-center gap-2 text-sm font-semibold"><Fingerprint size={16} className="text-accent" />Duplicate rows removed</div>
        <div className="text-xs text-ink-3">bank export glitches caught</div>
      </div>
    </div>
  )
}

function WorksWith() {
  return (
    <section aria-label="Supported files" className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-6 text-sm text-ink-3">
        <span className="font-medium text-ink-2">Reads files exported from</span>
        {['BUSY', 'Tigg', 'Tally', 'Excel sales books', 'Bank statements (XLSX / CSV)'].map((x) => (
          <span key={x} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 font-medium text-ink-2"><FileSpreadsheet size={14} aria-hidden />{x}</span>
        ))}
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, children, id }: { eyebrow: string; title: string; children?: React.ReactNode; id?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-lg leading-relaxed text-ink-3">{children}</p>}
    </div>
  )
}

function Problem() {
  const before = [
    ['Bank PDFs and Excel files arrive on WhatsApp, in a different layout for every client.', FileWarning],
    ['Staff retype registers and check 13% VAT by eye, a few days before the deadline.', Timer],
    ['Nobody checks whether money in the bank matches the sales that were declared.', ScanSearch],
  ] as const
  const after = [
    ['Upload the files as they are. Hisab detects the layout, dates and number formats.', Upload],
    ['Seven checks run in seconds: VAT math, duplicates, wrong month, missing supplier PAN…', ClipboardCheck],
    ['Every deposit is matched to bills, QR batches, cash sales, or flagged for your decision.', RadarIcon],
  ] as const
  return (
    <section className="bg-canvas py-20 sm:py-24" aria-labelledby="problem-h">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="The month-end problem" title="Hours of retyping, and still a blind spot" id="problem-h">
          The gap between what reached the bank and what was declared is exactly what a tax cross-check would find. Today, almost nobody looks at it before filing.
        </SectionHead>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">Today</h3>
            <ul className="mt-5 space-y-5">
              {before.map(([t, I]) => <li key={t} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-bad-bg text-bad"><I size={18} aria-hidden /></span><p className="pt-1.5 text-[15px] text-ink-2">{t}</p></li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white p-7 shadow-lg shadow-emerald-900/5 ring-1 ring-emerald-100">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ok">With Hisab</h3>
            <ul className="mt-5 space-y-5">
              {after.map(([t, I]) => <li key={t} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ok-bg text-ok"><I size={18} aria-hidden /></span><p className="pt-1.5 text-[15px] text-ink-2">{t}</p></li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function How() {
  const steps = [
    { t: 'Add the client once', d: 'Name, PAN, billing software and bank accounts. Two minutes.', i: Landmark },
    { t: 'Upload the month’s files', d: 'Bank statements plus sales & purchase registers, exactly as exported.', i: Upload },
    { t: 'Decide what rules can’t', d: 'Loan? Owner capital? Undeclared sale? One click each, with a note.', i: BadgeCheck },
    { t: 'Download the VAT pack', d: 'Registers, deposits, decisions and issues in one workbook, plus a client report.', i: FileSpreadsheet },
  ]
  return (
    <section id="how" className="scroll-mt-20 bg-white py-20 sm:py-24" aria-labelledby="how-h">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="How it works" title="From messy files to a filed return in four steps" id="how-h" />
        <ol className="mt-14 grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.t} className="relative rounded-2xl border border-line bg-white p-6 transition-shadow hover:shadow-lg">
              <span className="num absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">Step {i + 1}</span>
              <s.i size={26} className="text-accent" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-[15px] text-ink-3">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Features() {
  const f = [
    { t: 'Mismatch radar', d: 'Deposits vs declared sales, explained rupee by rupee: own transfers, QR batches, bank transfers, cash banked, loans.', i: RadarIcon },
    { t: 'Reads any layout', d: 'Title rows, BS or AD dates, Devanagari digits, Excel serial dates, 1,23,456.00 amounts, totals rows. All handled.', i: Layers },
    { t: 'Checks before filing', d: '13% VAT math, duplicate bills, bills from another month, purchases without supplier PAN, repeated bank rows.', i: ClipboardCheck },
    { t: 'Nepali calendar built in', d: 'Bhadra is Bhadra. Periods, due dates and every date shown in Bikram Sambat, with AD alongside.', i: CalendarDays },
    { t: 'Full audit trail', d: 'Every upload, run, decision and export is logged with who and when. Show a reviewer exactly how a figure was reached.', i: History },
    { t: 'Rules, not guesses', d: 'No AI touches the numbers. Every match comes with a plain-language reason you can check.', i: ShieldCheck },
  ]
  return (
    <section id="features" className="scroll-mt-20 bg-canvas py-20 sm:py-24" aria-labelledby="features-h">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="Features" title="Built for how Nepali month-end actually works" id="features-h" />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {f.map((x) => (
            <div key={x.t} className="group rounded-2xl border border-line bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <span className="grid size-11 place-items-center rounded-xl bg-primary text-emerald-300 transition-colors group-hover:bg-accent group-hover:text-white"><x.i size={21} aria-hidden /></span>
              <h3 className="mt-4 text-lg font-semibold">{x.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-3">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const plans = [
    { n: 'Starter', p: 3000, d: 'Solo accountants', feats: ['Up to 10 clients', 'Mismatch radar & VAT pack', 'Audit trail'], cta: 'Start with the demo' },
    { n: 'Practice', p: 8000, d: 'Small firms', feats: ['Up to 40 clients', 'Everything in Starter', '3 staff logins', 'Client reports'], cta: 'Start with the demo', featured: true },
    { n: 'Firm', p: 15000, d: 'Growing CA firms', feats: ['Up to 100 clients', 'Everything in Practice', '10 staff logins', 'Priority help with new bank formats'], cta: 'Start with the demo' },
  ]
  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20 sm:py-24" aria-labelledby="pricing-h">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead eyebrow="Pricing" title="Priced per firm, not per client" id="pricing-h">
          Planned pricing for launch. Early firms get a free pilot month while we tune Hisab to their clients’ files.
        </SectionHead>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {plans.map((pl) => (
            <div key={pl.n} className={cx('relative flex flex-col rounded-2xl border p-7', pl.featured ? 'border-accent bg-primary text-white shadow-2xl shadow-sky-900/20' : 'border-line bg-white')}>
              {pl.featured && <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-0.5 text-xs font-bold text-primary">Most popular</span>}
              <h3 className="text-lg font-semibold">{pl.n}</h3>
              <p className={cx('text-sm', pl.featured ? 'text-slate-300' : 'text-ink-3')}>{pl.d}</p>
              <p className="mt-5"><span className="num text-4xl font-bold tracking-tight">NPR {pl.p.toLocaleString('en-IN')}</span><span className={cx('text-sm', pl.featured ? 'text-slate-300' : 'text-ink-3')}> / month</span></p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {pl.feats.map((x) => <li key={x} className="flex gap-2 text-[15px]"><CheckCircle2 size={18} className={cx('mt-0.5 shrink-0', pl.featured ? 'text-emerald-300' : 'text-ok')} aria-hidden />{x}</li>)}
              </ul>
              <Link href="/login" className={cx('mt-8 inline-flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold', pl.featured ? 'bg-brand text-primary hover:bg-emerald-400' : 'border border-line text-ink hover:bg-muted')}>{pl.cta}</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqTeaser() {
  return (
    <section className="bg-canvas py-20 sm:py-24" aria-labelledby="faq-h">
      <div className="mx-auto max-w-3xl px-5">
        <SectionHead eyebrow="Questions" title="Frequently asked" id="faq-h" />
        <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-white">
          {FAQS.flatMap((g) => g.items).slice(0, 5).map((q) => (
            <details key={q.q} className="group px-6 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-8 items-center justify-between gap-4 text-base font-semibold">{q.q}<span className="text-xl leading-none text-ink-3 transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-3">{q.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center"><Link href="/faq" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">All questions <ArrowRight size={16} aria-hidden /></Link></p>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="hero-grid bg-primary py-20 text-white" aria-labelledby="cta-h">
      <div className="mx-auto max-w-3xl px-5 text-center">
        <h2 id="cta-h" className="text-3xl font-bold tracking-tight sm:text-4xl">See your next month-end take minutes, not days</h2>
        <p className="mt-4 text-lg text-slate-300">Open the demo, add a client, upload the sample files and watch every deposit get explained.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-primary hover:bg-emerald-400">Try the live demo <ArrowRight size={18} aria-hidden /></Link>
          <Link href="/faq" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6 text-base font-semibold hover:bg-white/10">Read the FAQ</Link>
        </div>
      </div>
    </section>
  )
}
