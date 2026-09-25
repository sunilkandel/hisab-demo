import { useState } from 'react'
import { CheckCircle2, Circle, FileDown, Loader2, Printer } from 'lucide-react'
import { useCM } from '../../../lib/clientMonth'
import { Link } from '../../../lib/router'
import { withPeriod } from '../../../lib/period'
import { splitInclusive } from '../../../domain/money'
import { periodLabel } from '../../../domain/dates'
import { Button, Card, Money, cx } from '../../../ui/common'

export function VatPack() {
  const { v, period, exportPack, busy } = useCM()
  const [ack, setAck] = useState(false)
  if (!v.vat || !v.summary) return null
  const vat = v.vat
  const s = v.summary
  const id = encodeURIComponent(v.client.id)
  const missing = v.client.docs.filter((d) => !v.files.some((f) => f.docId === d.id))
  const extra = splitInclusive(s.undeclaredConfirmed)
  const checks = [
    { ok: missing.length === 0, label: missing.length ? `Missing: ${missing.map((d) => d.label).join(', ')}` : 'All documents received' },
    { ok: v.status !== 'stale', label: v.status === 'stale' ? 'Files changed since the last run. Process again.' : 'Results match the uploaded files' },
    { ok: v.toReview === 0, label: v.toReview ? `${v.toReview} deposit(s) still need a decision` : 'Every deposit explained or classified', href: v.toReview ? 'review' : undefined },
    { ok: v.errors === 0 || ack, label: v.errors ? `${v.errors} error(s) in the client’s files` : 'No errors in the files', needsAck: v.errors > 0 },
  ]
  const canExport = checks.every((c) => c.ok)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={`VAT computation · ${periodLabel(period)}`}>
        <table className="w-full text-sm">
          <caption className="sr-only">VAT computation</caption>
          <tbody>
            <R label={`Taxable sales (${vat.salesCount} bills)`} p={vat.salesTaxable} />
            <R label="Output VAT @ 13%" p={vat.outputVat} strong />
            <R label={`Taxable purchases (${vat.purchaseCount} bills)`} p={vat.purchaseTaxable} />
            <R label="Input VAT" p={vat.inputVat} />
            <R label="− Input VAT not claimable (supplier PAN missing)" p={-vat.inputVatDisallowed} tone={vat.inputVatDisallowed ? 'warn' : undefined} />
            <R label={vat.payable >= 0 ? 'VAT payable' : 'Credit carried forward'} p={Math.abs(vat.payable)} strong big />
          </tbody>
        </table>
        {s.undeclaredConfirmed > 0 && (
          <p className="border-t border-line bg-bad-bg px-5 py-3 text-[13px] text-bad">
            You marked <Money p={s.undeclaredConfirmed} /> as undeclared sales. Ask the client to issue bills for it before filing. That adds <Money p={extra.vat} /> output VAT (on taxable <Money p={extra.taxable} />), which is not in the figure above.
          </p>
        )}
        {vat.inputVatDisallowed > 0 && (
          <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">Get the missing supplier PANs and <Money p={vat.inputVatDisallowed} /> of input VAT becomes claimable, lowering the VAT payable.</p>
        )}
      </Card>

      <Card title="Ready to file?">
        <ul className="space-y-3 px-5 py-4">
          {checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              {c.ok ? <CheckCircle2 size={19} className="shrink-0 text-ok" aria-label="Done" /> : <Circle size={19} className="shrink-0 text-ink-3" aria-label="Not done" />}
              <div>
                <span className={cx(!c.ok && 'text-ink-2')}>{c.label}</span>
                {c.href && <> · <Link className="font-medium text-accent hover:underline" href={withPeriod(`/app/clients/${id}/${c.href}`, period)}>Go to review queue</Link></>}
                {c.needsAck && (
                  <label className="mt-1.5 flex items-center gap-2 text-[13px] text-ink-2">
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="size-4 accent-[#0369a1]" />
                    <span>I’ve read the <Link className="text-accent underline" href={withPeriod(`/app/clients/${id}/issues`, period)}>errors</Link>; excluded rows and fixes are correct.</span>
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <Button kind="primary" className="min-h-11" disabled={!canExport || busy === 'export'} onClick={exportPack}>
            {busy === 'export' ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <FileDown size={17} aria-hidden />}Download VAT pack (.xlsx)
          </Button>
          <a href={withPeriod(`/app/report/${id}`, period)} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink-2 hover:bg-slate-50">
            <Printer size={17} aria-hidden />Client report (PDF)<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        {!canExport && <p className="px-5 pb-4 text-[13px] text-ink-3">Complete the checklist to unlock the download, so nothing gets filed with open questions.</p>}
        {v.exportedAt && <p className="px-5 pb-4 text-[13px] text-ok">Exported {new Date(v.exportedAt).toLocaleString()}. Recorded in the audit log.</p>}
        <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">The pack is one Excel workbook with five sheets: Summary, Sales register, Purchase register, Deposits (every classification and who made it) and Issues. You file from it, and it's your evidence if anyone asks.</p>
      </Card>
    </div>
  )
}

function R({ label, p, strong, big, tone }: { label: string; p: number; strong?: boolean; big?: boolean; tone?: 'warn' }) {
  return (
    <tr className="border-t border-line first:border-0">
      <th scope="row" className={cx('px-5 py-2.5 text-left font-normal', strong && 'font-semibold')}>{label}</th>
      <td className={cx('px-5 py-2.5 text-right', big && 'text-lg', tone === 'warn' && 'text-warn')}><Money p={p} strong={strong} /></td>
    </tr>
  )
}
