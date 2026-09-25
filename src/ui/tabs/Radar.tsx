import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../state/store'
import { formatNpr, formatNprShort } from '../../domain/money'
import { formatBs } from '../../domain/dates'
import type { CreditCategory } from '../../domain/types'
import { CATEGORY, Card, CategoryChip, Money, Stat, cx, td, tdNum, th } from '../common'

const ORDER: CreditCategory[] = ['qr-settlement', 'matched-sales', 'own-transfer', 'loan', 'owner-capital', 'refund', 'other-explained', 'undeclared-sale', 'unexplained']

export function Radar({ clientId }: { clientId: string }) {
  const { view } = useStore()
  const v = view(clientId)
  if (!v.result || !v.summary) return null
  const s = v.summary
  const txns = new Map(v.result.txns.map((t) => [t.id, t]))
  const amountBy = (c: CreditCategory) => v.credits.filter((x) => x.category === c).reduce((a, x) => a + txns.get(x.txnId)!.credit, 0)
  const parts = ORDER.map((c) => ({ c, amt: amountBy(c) })).filter((p) => p.amt > 0)
  const atRisk = s.unexplained + s.pendingReview + s.undeclaredConfirmed
  const notSeen = s.declaredSalesTotal - s.matchedToSales
  const top = v.credits.filter((c) => c.category === 'unexplained' || c.category === 'undeclared-sale')
    .map((c) => ({ c, t: txns.get(c.txnId)! })).sort((a, b) => b.t.credit - a.t.credit)

  const riskStyle = { low: 'border-green-200 bg-ok-bg text-ok', medium: 'border-amber-200 bg-warn-bg text-warn', high: 'border-red-200 bg-bad-bg text-bad' }[s.risk]

  return (
    <div className="space-y-4">
      <div className={cx('flex items-start gap-3 rounded-lg border px-4 py-3', riskStyle)}>
        {atRisk ? <AlertTriangle size={22} className="mt-0.5 shrink-0" aria-hidden /> : <CheckCircle2 size={22} className="mt-0.5 shrink-0" aria-hidden />}
        <div>
          <p className="text-base font-semibold">
            {atRisk
              ? <>NPR <span className="num">{formatNpr(atRisk, { decimals: false })}</span> of deposits are not explained by declared sales</>
              : 'Every deposit is explained'}
          </p>
          <p className="text-sm opacity-90">
            Mismatch risk: <strong className="uppercase">{s.risk}</strong>. {atRisk
              ? 'If IRD compares bank or wallet inflows with declared turnover, these amounts are what it would question. Explain them with evidence, or declare them as sales, before filing.'
              : 'Deposits line up with declared sales, loans, capital and own transfers.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total deposits (this month)" value={formatNprShort(s.totalCredits)} hint={`${v.credits.length} credits`} />
        <Stat label="Declared sales incl. VAT" value={formatNprShort(s.declaredSalesTotal)} hint={`${v.vat?.salesCount ?? 0} bills`} />
        <Stat label="Explained by sales" value={formatNprShort(s.matchedToSales)} hint="bills, QR batches, cash sales banked" tone="ok" />
        <Stat label="Needs your decision" value={formatNprShort(s.unexplained + s.pendingReview)} hint={s.pendingReview ? `${formatNprShort(s.pendingReview)} has a suggestion` : 'no suggestions'} tone={s.unexplained + s.pendingReview ? 'warn' : 'ok'} />
      </div>

      <Card title="Where the money came from">
        <div className="px-4 py-4">
          <div className="flex h-7 w-full overflow-hidden rounded" role="img" aria-label={parts.map((p) => `${CATEGORY[p.c].label} ${formatNpr(p.amt)}`).join(', ')}>
            {parts.map((p) => (
              <div key={p.c} title={`${CATEGORY[p.c].label}: NPR ${formatNpr(p.amt)}`} style={{ width: `${(p.amt / s.totalCredits) * 100}%`, background: CATEGORY[p.c].bar }} className="h-full border-r border-white last:border-0" />
            ))}
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {parts.map((p) => (
                <tr key={p.c} className="border-t border-line first:border-0">
                  <td className="py-1.5 pr-2"><span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: CATEGORY[p.c].bar }} aria-hidden />{CATEGORY[p.c].label}</td>
                  <td className="num py-1.5 text-right text-xs text-ink-3">{((p.amt / s.totalCredits) * 100).toFixed(1)}%</td>
                  <td className="py-1.5 pl-4 text-right"><Money p={p.amt} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Deposits → declared sales, step by step">
          <table className="w-full text-sm">
            <tbody>
              <Row label="Total deposits" p={s.totalCredits} bold />
              <Row label="− matched to bills, QR batches, cash sales" p={-s.matchedToSales} />
              <Row label="− own transfers, loans, capital, refunds" p={-s.explainedOther} />
              <Row label="= Not explained by sales" p={atRisk} bold tone={atRisk ? 'warn' : 'ok'} />
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-2 text-xs text-ink-3">
            The other direction: NPR <span className="num">{formatNpr(Math.max(notSeen, 0), { decimals: false })}</span> of declared sales didn't reach the bank this month (cash kept in the drawer, credit sales not yet paid, QR from the last day settling next month). That's normal and not a risk.
          </p>
        </Card>

        <Card title="Largest unexplained deposits" action={<a className="text-xs font-medium text-accent hover:underline" href={`#/client/${clientId}/review`}>Open review queue</a>}>
          {top.length === 0 ? <p className="px-4 py-6 text-sm text-ok">Nothing left to explain.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-slate-50"><tr><th className={th}>Date</th><th className={th}>Narration</th><th className={cx(th, 'text-right')}>Amount</th></tr></thead>
                <tbody>
                  {top.slice(0, 6).map(({ c, t }) => (
                    <tr key={c.txnId} className="border-t border-line">
                      <td className={cx(td, 'num whitespace-nowrap text-xs')}>{formatBs(t.dateBs)}</td>
                      <td className={td}><div className="text-xs font-medium">{t.narration}</div><div className="mt-0.5"><CategoryChip c={c.category} suggestion={c.suggestion} /></div></td>
                      <td className={tdNum}><Money p={t.credit} strong /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Row({ label, p, bold, tone }: { label: string; p: number; bold?: boolean; tone?: 'warn' | 'ok' }) {
  return (
    <tr className="border-t border-line first:border-0">
      <td className={cx('px-4 py-2', bold && 'font-semibold')}>{label}</td>
      <td className={cx('px-4 py-2 text-right', tone === 'warn' && 'text-warn', tone === 'ok' && 'text-ok')}><Money p={p} strong={bold} /></td>
    </tr>
  )
}
