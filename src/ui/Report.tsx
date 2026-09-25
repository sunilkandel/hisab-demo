import { Printer } from 'lucide-react'
import { useStore } from '../state/store'
import { DEMO_FIRM } from '../domain/seed'
import { adToBs, formatBs, todayAd } from '../domain/dates'
import { formatNpr } from '../domain/money'
import { Button, CATEGORY, Money } from './common'
import type { CreditCategory } from '../domain/types'

/** One-page report the accountant hands to the client. Print → Save as PDF. */
export function Report({ clientId }: { clientId: string }) {
  const { view } = useStore()
  const v = view(clientId)
  if (!v?.result || !v.summary || !v.vat) return <p className="p-6">Run Hisab for this client first. <a className="text-accent" href={`#/client/${clientId}`}>Back</a></p>
  const s = v.summary
  const txns = new Map(v.result.txns.map((t) => [t.id, t]))
  const attention = v.credits.filter((c) => ['unexplained', 'undeclared-sale'].includes(c.category)).map((c) => ({ c, t: txns.get(c.txnId)! }))
  const explained = (['loan', 'owner-capital', 'own-transfer', 'refund', 'other-explained'] as CreditCategory[])
    .map((k) => ({ k, amt: v.credits.filter((c) => c.category === k).reduce((a, c) => a + txns.get(c.txnId)!.credit, 0) })).filter((x) => x.amt)
  const atRisk = s.unexplained + s.pendingReview + s.undeclaredConfirmed

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-3 flex max-w-[800px] justify-between px-4">
        <a href={`#/client/${clientId}/vat`} className="text-sm text-accent">← Back to Hisab</a>
        <Button kind="primary" onClick={() => window.print()}><Printer size={16} aria-hidden />Print / Save as PDF</Button>
      </div>
      <article className="print-page mx-auto max-w-[800px] rounded-lg border border-line bg-white px-10 py-8 shadow-sm">
        <header className="flex items-start justify-between border-b-2 border-primary pb-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-3">Bank vs declared sales check</p>
            <h1 className="text-xl font-bold">{v.client.name}</h1>
            <p className="text-sm text-ink-2">PAN <span className="num">{v.client.pan}</span> · Period: Bhadra 2083</p>
          </div>
          <div className="text-right text-xs text-ink-3">
            <p className="font-medium text-ink-2">{DEMO_FIRM.name}</p>
            <p>Prepared by {DEMO_FIRM.user}</p>
            <p>{formatBs(adToBs(todayAd()), 'long')}</p>
          </div>
        </header>

        <section className="mt-4">
          <p className="text-sm">
            {atRisk
              ? <>This month, <strong className="num">NPR {formatNpr(atRisk, { decimals: false })}</strong> came into your bank account(s) that your sales records don't explain. If the tax office compares bank and wallet data with your VAT return, it could ask about these amounts. Please tell us what each one is and keep the evidence.</>
              : <>All money that came into your bank account(s) this month is explained by your sales, loans, capital or transfers. Nothing needs your attention.</>}
          </p>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Box label="Money received" p={s.totalCredits} />
          <Box label="Sales declared (incl. VAT)" p={s.declaredSalesTotal} />
          <Box label="Not explained" p={atRisk} tone={atRisk ? 'bad' : 'ok'} />
        </section>

        {attention.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-1 text-sm font-semibold">Deposits we need you to explain</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-ink-3"><th className="py-1">Date</th><th className="py-1">Bank narration</th><th className="py-1 text-right">Amount (NPR)</th><th className="py-1 pl-3">What is it?</th></tr></thead>
              <tbody>
                {attention.map(({ c, t }) => (
                  <tr key={c.txnId} className="border-b border-line">
                    <td className="num py-1.5 text-xs">{formatBs(t.dateBs)}</td>
                    <td className="py-1.5 text-xs">{t.narration}</td>
                    <td className="py-1.5 text-right"><Money p={t.credit} /></td>
                    <td className="py-1.5 pl-3 text-xs text-ink-3">{c.category === 'undeclared-sale' ? 'Sale: bill needed' : '______________'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {explained.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-1 text-sm font-semibold">Deposits already explained (not sales)</h2>
            <ul className="text-sm">
              {explained.map((x) => <li key={x.k} className="flex justify-between border-b border-line py-1"><span>{CATEGORY[x.k].label}</span><Money p={x.amt} /></li>)}
            </ul>
          </section>
        )}

        <section className="mt-5 rounded-md bg-slate-50 px-4 py-3 text-sm">
          <h2 className="font-semibold">VAT for Bhadra 2083 (before adjustments above)</h2>
          <p>Output VAT <Money p={v.vat.outputVat} /> − claimable input VAT <Money p={v.vat.inputVat - v.vat.inputVatDisallowed} /> = <strong>{v.vat.payable >= 0 ? 'payable' : 'credit'} NPR <Money p={Math.abs(v.vat.payable)} /></strong></p>
          {v.vat.inputVatDisallowed > 0 && <p className="mt-1 text-xs text-ink-3">NPR <Money p={v.vat.inputVatDisallowed} /> of input VAT can be claimed once you send us the missing supplier PAN numbers.</p>}
        </section>

        <footer className="mt-6 border-t border-line pt-2 text-[10px] text-ink-3">Generated with Hisab. DEMO: all names, accounts and amounts on this page are fictional.</footer>
      </article>
    </div>
  )
}

function Box({ label, p, tone }: { label: string; p: number; tone?: 'bad' | 'ok' }) {
  return (
    <div className="rounded-md border border-line px-2 py-2">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={`num text-base font-semibold ${tone === 'bad' ? 'text-bad' : tone === 'ok' ? 'text-ok' : ''}`}>{formatNpr(p, { decimals: false })}</div>
    </div>
  )
}
