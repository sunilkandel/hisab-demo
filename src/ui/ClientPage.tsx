import { useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, Eye, FileSpreadsheet, Landmark, Loader2, Play, Receipt, Trash2, Upload, XCircle } from 'lucide-react'
import { sampleFile, useStore } from '../state/store'
import { bytesToSheet, downloadBytes } from '../domain/files'
import type { DocKind, StepLog } from '../domain/types'
import { Button, Card, StatusPill, cx } from './common'
import { Radar } from './tabs/Radar'
import { Review } from './tabs/Review'
import { IssuesTab, BankTab, RegisterTab } from './tabs/Tables'
import { VatPack } from './tabs/VatPack'

const TABS = [
  { id: 'documents', label: 'Documents & processing' },
  { id: 'radar', label: 'Mismatch radar' },
  { id: 'review', label: 'Review queue' },
  { id: 'issues', label: 'Issues' },
  { id: 'bank', label: 'Bank' },
  { id: 'sales', label: 'Sales' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'vat', label: 'VAT pack' },
] as const

export function ClientPage({ clientId, tab }: { clientId: string; tab: string }) {
  const { view } = useStore()
  const v = view(clientId)
  if (!v) return <p>Unknown client. <a className="text-accent" href="#/">Back to clients</a></p>
  const counts: Record<string, number | undefined> = {
    review: v.result ? v.toReview : undefined,
    issues: v.result ? v.errors + v.warnings : undefined,
  }
  const current = TABS.some((t) => t.id === tab) ? tab : 'documents'

  return (
    <div className="space-y-4">
      <div>
        <a href="#/" className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-accent"><ArrowLeft size={14} aria-hidden />All clients</a>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{v.client.name}</h1>
          <StatusPill status={v.status} />
        </div>
        <p className="text-sm text-ink-3">PAN <span className="num">{v.client.pan}</span> · {v.client.sector} · Billing: {v.client.billingTool}</p>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">{v.client.story}</p>
      </div>

      <div role="tablist" aria-label="Client month" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const disabled = t.id !== 'documents' && !v.result
          return (
            <a key={t.id} role="tab" aria-selected={current === t.id} aria-disabled={disabled}
              href={disabled ? undefined : `#/client/${clientId}/${t.id}`}
              className={cx('-mb-px inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
                current === t.id ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink',
                disabled && 'pointer-events-none opacity-40')}>
              {t.label}
              {counts[t.id] !== undefined && counts[t.id]! > 0 && (
                <span className={cx('num rounded-full px-1.5 text-[11px]', t.id === 'review' ? 'bg-warn-bg text-warn' : 'bg-bad-bg text-bad')}>{counts[t.id]}</span>
              )}
            </a>
          )
        })}
      </div>

      {current === 'documents' && <Documents clientId={clientId} />}
      {current === 'radar' && <Radar clientId={clientId} />}
      {current === 'review' && <Review clientId={clientId} />}
      {current === 'issues' && <IssuesTab clientId={clientId} />}
      {current === 'bank' && <BankTab clientId={clientId} />}
      {current === 'sales' && <RegisterTab clientId={clientId} kind="sales" />}
      {current === 'purchases' && <RegisterTab clientId={clientId} kind="purchase" />}
      {current === 'vat' && <VatPack clientId={clientId} />}
    </div>
  )
}

const KIND_ICON: Record<DocKind, typeof Landmark> = { bank: Landmark, sales: Receipt, purchase: FileSpreadsheet }

function Documents({ clientId }: { clientId: string }) {
  const { view, addFile, removeFile, run, getFile } = useStore()
  const v = view(clientId)
  const [running, setRunning] = useState(false)
  const [shownSteps, setShownSteps] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const allAttached = v.client.docs.every((d) => v.files[d.id])

  async function onRun() {
    setRunning(true)
    setShownSteps(0)
    const res = await run(clientId)
    // reveal steps one by one so you can follow what the engine did
    for (let i = 1; i <= res.steps.length; i++) {
      await new Promise((r) => setTimeout(r, 280))
      setShownSteps(i)
    }
    setRunning(false)
    setShownSteps(null)
  }

  async function onUpload(docId: string, file: File | undefined) {
    setUploadError(null)
    if (!file) return
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { setUploadError(`${file.name}: only .xlsx, .xls or .csv files`); return }
    if (file.size > 5 * 1024 * 1024) { setUploadError(`${file.name}: larger than 5 MB`); return }
    const bytes = new Uint8Array(await file.arrayBuffer())
    addFile(clientId, { docId, name: file.name, bytes, source: 'upload' })
  }

  const steps: StepLog[] = v.result?.steps ?? []
  const visibleSteps = shownSteps === null ? steps : steps.slice(0, shownSteps)

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Card title="1. Documents for Bhadra 2083" action={<span className="text-xs text-ink-3">{Object.keys(v.files).length}/{v.client.docs.length} received</span>}>
        <ul className="divide-y divide-line">
          {v.client.docs.map((d) => {
            const f = v.files[d.id]
            const processed = v.result?.files.find((x) => x.docId === d.id)
            const Icon = KIND_ICON[d.kind]
            return (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Icon size={18} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{d.label}</div>
                    {f ? (
                      <div className="mt-0.5 text-xs text-ink-3">
                        <span className="num break-all text-ink-2">{f.name}</span> · {f.source === 'sample' ? 'demo sample' : 'uploaded by you'}
                        {processed && <div className={processed.format ? 'text-ok' : 'text-bad'}>{processed.format ? `Detected: ${processed.formatLabel}` : 'Format not recognised'}</div>}
                      </div>
                    ) : <div className="mt-0.5 text-xs text-warn">Not received yet</div>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                  {!f && <Button className="min-h-8 text-xs" onClick={() => addFile(clientId, sampleFile(clientId, d.id))}>Attach demo sample</Button>}
                  <Button className="min-h-8 text-xs" onClick={() => inputs.current[d.id]?.click()}><Upload size={14} aria-hidden />{f ? 'Replace' : 'Upload your file'}</Button>
                  <input ref={(el) => { inputs.current[d.id] = el }} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label={`Upload ${d.label}`}
                    onChange={(e) => { onUpload(d.id, e.target.files?.[0]); e.target.value = '' }} />
                  {f && <>
                    <Button kind="ghost" className="min-h-8 text-xs" aria-expanded={preview === d.id} onClick={() => setPreview(preview === d.id ? null : d.id)}><Eye size={14} aria-hidden />{preview === d.id ? 'Hide raw file' : 'View raw file'}</Button>
                    <Button kind="ghost" className="min-h-8 text-xs" onClick={() => { const r = getFile(clientId, d.id)!; downloadBytes(r.bytes, r.name) }}><Download size={14} aria-hidden />Download</Button>
                    <Button kind="ghost" className="min-h-8 text-xs text-bad" onClick={() => removeFile(clientId, d.id)}><Trash2 size={14} aria-hidden />Remove</Button>
                  </>}
                </div>
                {preview === d.id && f && <RawPreview clientId={clientId} docId={d.id} />}
              </li>
            )
          })}
        </ul>
        {uploadError && <p role="alert" className="border-t border-line px-4 py-2 text-xs text-bad">{uploadError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-slate-50 px-4 py-3">
          <p className="text-xs text-ink-3">{allAttached ? 'All documents in. Run Hisab to process them.' : 'You can run with missing documents; results will be flagged incomplete.'}</p>
          <Button kind="primary" onClick={onRun} disabled={running || Object.keys(v.files).length === 0}>
            {running ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />}
            {running ? 'Processing…' : v.result ? 'Re-run Hisab' : 'Run Hisab'}
          </Button>
        </div>
      </Card>

      <Card title="2. What Hisab did" action={v.result && <span className="text-xs text-ink-3">Last run {new Date(v.result.processedAt).toLocaleString()}</span>}>
        {steps.length === 0 && !running ? (
          <p className="px-4 py-6 text-sm text-ink-3">Not processed yet. Attach documents and press <strong>Run Hisab</strong>.</p>
        ) : (
          <ol className="divide-y divide-line" aria-live="polite">
            {visibleSteps.map((s, i) => (
              <li key={s.step} className="px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {s.ok ? <CheckCircle2 size={16} className="text-ok" aria-label="OK" /> : <XCircle size={16} className="text-warn" aria-label="Needs attention" />}
                  <span className="num text-xs text-ink-3">{i + 1}.</span> {s.title}
                  <span className="num ml-auto text-[11px] font-normal text-ink-3">{s.ms < 1 ? '<1' : s.ms.toFixed(0)} ms</span>
                </div>
                <ul className="mt-1 space-y-0.5 pl-6 text-xs text-ink-2">
                  {s.detail.map((d, j) => <li key={j} className="break-words">{d}</li>)}
                </ul>
              </li>
            ))}
            {running && shownSteps !== null && shownSteps < steps.length && (
              <li className="flex items-center gap-2 px-4 py-3 text-sm text-ink-3"><Loader2 size={16} className="animate-spin" aria-hidden />Working…</li>
            )}
          </ol>
        )}
        {v.result && !running && (
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
            <a href={`#/client/${clientId}/radar`} className="inline-flex min-h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover">Open mismatch radar</a>
            {v.toReview > 0 && <a href={`#/client/${clientId}/review`} className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-sm font-medium text-ink-2 hover:bg-slate-50">Review {v.toReview} deposits</a>}
          </div>
        )}
      </Card>
    </div>
  )
}

function RawPreview({ clientId, docId }: { clientId: string; docId: string }) {
  const { getFile } = useStore()
  const f = getFile(clientId, docId)
  if (!f) return null
  const rows = bytesToSheet(f.bytes, f.name).slice(0, 14)
  const width = Math.max(...rows.map((r) => r.length), 1)
  return (
    <div className="mt-2 ml-7 overflow-x-auto rounded border border-line">
      <p className="border-b border-line bg-slate-50 px-2 py-1 text-[11px] text-ink-3">First 14 rows exactly as received. Note the title rows, date styles and number formats Hisab must cope with.</p>
      <table className="num w-full text-[11px]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line first:border-0">
              <td className="bg-slate-50 px-1.5 py-0.5 text-right text-ink-3">{i + 1}</td>
              {Array.from({ length: width }, (_, j) => <td key={j} className="whitespace-nowrap px-1.5 py-0.5">{r[j] === null || r[j] === undefined ? '' : String(r[j])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
