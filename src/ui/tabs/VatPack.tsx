import { useState } from 'react'
import { CheckCircle2, Circle, FileDown, Printer } from 'lucide-react'
import { useStore } from '../../state/store'
import { exclusionsOf } from '../../domain/pipeline'
import { buildVatPack } from '../../domain/export'
import { downloadBytes } from '../../domain/files'
import { splitInclusive } from '../../domain/money'
import { DEMO_FIRM } from '../../domain/seed'
import { Button, Card, Money, cx } from '../common'

export function VatPack({ clientId }: { clientId: string }) {
  const { view, markExported } = useStore()
  const v = view(clientId)
  const [ack, setAck] = useState(false)
  if (!v.result || !v.vat || !v.summary) return null
  const vat = v.vat
  const s = v.summary
  const missingDocs = v.client.docs.filter((d) => !v.files[d.id]).length
  const extra = splitInclusive(s.undeclaredConfirmed)
  const checks = [
    { ok: missingDocs === 0, label: missingDocs ? `${missingDocs} document(s) missing` : 'All documents received and processed' },
    { ok: v.toReview === 0, label: v.toReview ? `${v.toReview} deposit(s) still need a decision` : 'Every deposit explained or classified' },
    { ok: v.errors === 0 || ack, label: v.errors ? `${v.errors} error(s) in the client's files reviewed` : 'No errors in the files', needsAck: v.errors > 0 },
  ]
  const canExport = checks.every((c) => c.ok)

  function exportPack() {
    const ex = exclusionsOf(v.result!)
    const bytes = buildVatPack({
      client: v.client, monthLabel: 'Bhadra 2083', vat, summary: s,
      sales: v.result!.invoices.filter((i) => i.kind === 'sales' && !ex.excludedInvoices.has(i.id)),
      purchases: v.result!.invoices.filter((i) => i.kind === 'purchase' && !ex.excludedInvoices.has(i.id)),
      disallowed: ex.disallowedInput, txns: v.result!.txns, credits: v.credits, issues: v.result!.issues, preparedBy: DEMO_FIRM.user,
    })
    const name = `VAT_pack_${v.client.name.replace(/[^A-Za-z]+/g, '_')}_Bhadra2083.xlsx`
    downloadBytes(bytes, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    markExported(clientId, name)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card title="VAT computation · Bhadra 2083">
        <table className="w-full text-sm">
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
          <p className="border-t border-line bg-bad-bg px-4 py-2 text-xs text-bad">
            You classified <Money p={s.undeclaredConfirmed} /> as undeclared sales. Before filing, ask the client to issue bills for it. That adds <Money p={extra.vat} /> of output VAT (on taxable <Money p={extra.taxable} />), not included above.
          </p>
        )}
        {vat.inputVatDisallowed > 0 && (
          <p className="border-t border-line px-4 py-2 text-xs text-ink-3">Get the missing supplier PANs and <Money p={vat.inputVatDisallowed} /> of input VAT becomes claimable, which lowers the VAT payable.</p>
        )}
      </Card>

      <Card title="Ready to file?">
        <ul className="space-y-2 px-4 py-3">
          {checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {c.ok ? <CheckCircle2 size={18} className="shrink-0 text-ok" aria-label="Done" /> : <Circle size={18} className="shrink-0 text-ink-3" aria-label="Not done" />}
              <div>
                <span className={cx(!c.ok && 'text-ink-2')}>{c.label}</span>
                {c.needsAck && (
                  <label className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-[#0369a1]" />
                    I've read the <a className="text-accent underline" href={`#/client/${clientId}/issues`}>errors</a>; excluded rows and fixes are correct
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          <Button kind="primary" disabled={!canExport} onClick={exportPack}><FileDown size={16} aria-hidden />Download VAT pack (.xlsx)</Button>
          <a href={`#/report/${clientId}`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink-2 hover:bg-slate-50">
            <Printer size={16} aria-hidden />Client mismatch report (PDF)
          </a>
        </div>
        {!canExport && <p className="px-4 pb-3 text-xs text-ink-3">Finish the checklist to unlock the download. Nothing gets filed with open questions.</p>}
        {v.exportedAt && <p className="px-4 pb-3 text-xs text-ok">Exported {new Date(v.exportedAt).toLocaleString()}. Recorded in the audit log.</p>}
        <p className="border-t border-line px-4 py-2 text-xs text-ink-3">The pack is one Excel workbook: Summary, Sales register, Purchase register, Deposits (every classification and who made it) and Issues. It's what you file from, and your evidence if IRD asks.</p>
      </Card>
    </div>
  )
}

function R({ label, p, strong, big, tone }: { label: string; p: number; strong?: boolean; big?: boolean; tone?: 'warn' }) {
  return (
    <tr className="border-t border-line first:border-0">
      <td className={cx('px-4 py-2', strong && 'font-semibold')}>{label}</td>
      <td className={cx('px-4 py-2 text-right', big && 'text-lg', tone === 'warn' && 'text-warn')}><Money p={p} strong={strong} /></td>
    </tr>
  )
}
