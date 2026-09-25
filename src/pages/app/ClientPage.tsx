import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Download, Eye, FileSpreadsheet, Landmark, Loader2, Pencil, Play, Receipt, Trash2, Upload } from 'lucide-react'
import { Link } from '../../lib/router'
import { usePeriod, withPeriod } from '../../lib/period'
import { ClientMonthProvider, useCMRaw, useClientMonthLoader } from '../../lib/clientMonth'
import { useSeo } from '../../lib/seo'
import { download } from '../../lib/api'
import { bytesToSheet } from '../../domain/files'
import { periodLabel } from '../../domain/dates'
import type { DocKind, StepLog } from '../../domain/types'
import { Button, Card, ErrorBox, PageLoading, StatusPill, cx } from '../../ui/common'
import { Radar } from './tabs/Radar'
import { Review } from './tabs/Review'
import { IssuesTab, BankTab, RegisterTab } from './tabs/Tables'
import { VatPack } from './tabs/VatPack'

const TABS = [
  { id: 'documents', label: 'Documents' },
  { id: 'radar', label: 'Mismatch radar' },
  { id: 'review', label: 'Review queue' },
  { id: 'issues', label: 'Issues' },
  { id: 'bank', label: 'Bank' },
  { id: 'sales', label: 'Sales' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'vat', label: 'VAT pack' },
] as const

export function ClientPage({ clientId, tab }: { clientId: string; tab: string }) {
  const [period] = usePeriod()
  const { v, setV, error, reload, base } = useClientMonthLoader(clientId, period)
  useSeo({ title: v ? `${v.client.name} · ${periodLabel(period)}` : 'Client', noindex: true })
  if (error) return <ErrorBox message={error.status === 404 ? 'This client doesn’t exist or was removed.' : error.message} onRetry={error.status === 404 ? undefined : reload} />
  if (!v) return <PageLoading label="Loading client month" />
  const current = TABS.some((t) => t.id === tab) ? tab : 'documents'
  const href = (t: string) => withPeriod(`/app/clients/${encodeURIComponent(clientId)}/${t}`, period)
  const counts: Record<string, number | undefined> = { review: v.result ? v.toReview : undefined, issues: v.result ? v.errors + v.warnings : undefined }

  return (
    <ClientMonthProvider v={v} setV={setV} reload={reload} base={base} period={period}>
      <div className="space-y-5">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-ink-3">
            <Link href={withPeriod('/app', period)} className="hover:text-accent">Clients</Link><ChevronRight size={14} aria-hidden />
            <span className="truncate text-ink-2" aria-current="page">{v.client.name}</span>
          </nav>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{v.client.name}</h1>
                <StatusPill status={v.status} />
                {v.client.demo && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-3">Demo client</span>}
              </div>
              <p className="mt-1 text-sm text-ink-3">PAN <span className="code text-ink-2">{v.client.pan}</span>{v.client.sector && <> · {v.client.sector}</>} · Billing: {v.client.billingTool} · VAT month <strong className="font-semibold text-ink-2">{periodLabel(period)}</strong></p>
            </div>
            <Link href={`/app/clients/${encodeURIComponent(clientId)}/edit`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-ink-2 hover:bg-slate-50"><Pencil size={15} aria-hidden />Edit client</Link>
          </div>
          {v.client.story && <p className="mt-2 max-w-3xl rounded-lg bg-muted px-3 py-2 text-sm text-ink-2"><strong className="font-semibold">Demo scenario:</strong> {v.client.story}</p>}
        </div>

        <Progress />

        <div role="tablist" aria-label="Client month sections" className="flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => {
            const disabled = t.id !== 'documents' && !v.result
            const n = counts[t.id]
            return (
              <Link key={t.id} role="tab" aria-selected={current === t.id} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}
                href={href(t.id)}
                className={cx('-mb-px inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
                  current === t.id ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink', disabled && 'pointer-events-none opacity-40')}
                title={disabled ? 'Process the documents first' : undefined}>
                {t.label}
                {n !== undefined && n > 0 && <span className={cx('num rounded-full px-1.5 text-[11px] font-semibold', t.id === 'review' ? 'bg-warn-bg text-warn' : 'bg-bad-bg text-bad')}>{n}</span>}
              </Link>
            )
          })}
        </div>

        {current === 'documents' || !v.result ? <Documents /> :
          current === 'radar' ? <Radar /> :
          current === 'review' ? <Review /> :
          current === 'issues' ? <IssuesTab /> :
          current === 'bank' ? <BankTab /> :
          current === 'sales' ? <RegisterTab kind="sales" /> :
          current === 'purchases' ? <RegisterTab kind="purchase" /> : <VatPack />}
      </div>
    </ClientMonthProvider>
  )
}

/** Where this month stands, as four steps (visibility of system status). */
function Progress() {
  const { v } = useCMRaw()
  const received = v.client.docs.filter((d) => v.files.some((f) => f.docId === d.id)).length
  const steps = [
    { label: 'Documents', done: received === v.client.docs.length, detail: `${received}/${v.client.docs.length} received` },
    { label: 'Processed', done: !!v.result && v.status !== 'stale', detail: v.status === 'stale' ? 'files changed, re-run' : v.processedAt ? new Date(v.processedAt).toLocaleDateString() : 'not yet' },
    { label: 'Reviewed', done: !!v.result && v.toReview === 0, detail: v.result ? (v.toReview ? `${v.toReview} to decide` : 'all deposits explained') : '—' },
    { label: 'Exported', done: !!v.exportedAt, detail: v.exportedAt ? new Date(v.exportedAt).toLocaleDateString() : 'not yet' },
  ]
  const active = steps.findIndex((s) => !s.done)
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Month-end progress">
      {steps.map((s, i) => (
        <li key={s.label} aria-current={i === active ? 'step' : undefined}
          className={cx('flex items-center gap-3 rounded-xl border px-3 py-2.5', s.done ? 'border-emerald-200 bg-emerald-50/60' : i === active ? 'border-accent/40 bg-white shadow-sm' : 'border-line bg-white')}>
          <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold', s.done ? 'bg-ok text-white' : i === active ? 'bg-accent text-white' : 'bg-muted text-ink-3')}>
            {s.done ? <Check size={15} aria-label="done" /> : i + 1}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold">{s.label}</span>
            <span className="block truncate text-xs text-ink-3">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

const KIND_ICON: Record<DocKind, typeof Landmark> = { bank: Landmark, sales: Receipt, purchase: FileSpreadsheet }

function Documents() {
  const cm = useCMRaw()
  const { v, busy, base, period } = cm
  const [shownSteps, setShownSteps] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const received = v.client.docs.filter((d) => v.files.some((f) => f.docId === d.id)).length

  async function onRun() {
    setShownSteps(0)
    const r = await cm.run()
    if (r?.result) for (let i = 1; i <= r.result.steps.length; i++) { await new Promise((res) => setTimeout(res, 220)); setShownSteps(i) }
    setShownSteps(null)
  }

  const steps: StepLog[] = v.result?.steps ?? []
  const visible = shownSteps === null ? steps : steps.slice(0, shownSteps)
  const running = busy === 'run' || shownSteps !== null

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr]">
      <Card title={`1 · Documents for ${periodLabel(period)}`} action={<span className="num text-xs text-ink-3">{received}/{v.client.docs.length} received</span>}>
        <ul className="divide-y divide-line">
          {v.client.docs.map((d) => {
            const f = v.files.find((x) => x.docId === d.id)
            const processed = v.result?.files.find((x) => x.docId === d.id)
            const Icon = KIND_ICON[d.kind]
            const uploading = busy === `upload:${d.id}`
            return (
              <li key={d.id}
                className={cx('px-5 py-4 transition-colors', dragOver === d.id && 'bg-accent-soft')}
                onDragOver={(e) => { e.preventDefault(); setDragOver(d.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); const file = e.dataTransfer.files?.[0]; if (file) cm.upload(d.id, file) }}>
                <div className="flex items-start gap-3">
                  <span className={cx('grid size-9 shrink-0 place-items-center rounded-lg', f ? 'bg-emerald-50 text-ok' : 'bg-muted text-ink-3')}><Icon size={18} aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{d.label}</div>
                    {f ? (
                      <div className="mt-0.5 text-[13px] text-ink-3">
                        <span className="code break-all text-ink-2">{f.name}</span> · <span className="num">{(f.size / 1024).toFixed(1)} KB</span> · {f.source === 'sample' ? 'demo sample' : `uploaded by ${f.uploadedBy}`}
                        {processed && (processed.sha256 === f.sha256
                          ? <div className={processed.format || processed.formatLabel.startsWith('Generic') ? 'text-ok' : 'text-bad'}>{processed.headerRow > 0 ? `Read as: ${processed.formatLabel}` : 'Format not recognised. Check the file.'}</div>
                          : <div className="text-info">New file. Run processing to read it.</div>)}
                      </div>
                    ) : <div className="mt-0.5 text-[13px] text-warn">Not received yet. Drop a file here or upload.</div>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 pl-12">
                  <Button className="min-h-9 text-[13px]" onClick={() => inputs.current[d.id]?.click()} disabled={uploading}>
                    {uploading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Upload size={15} aria-hidden />}{f ? 'Replace file' : 'Upload file'}
                  </Button>
                  <input ref={(el) => { inputs.current[d.id] = el }} type="file" accept=".xlsx,.xls,.csv" className="sr-only" tabIndex={-1} aria-label={`Upload ${d.label}`}
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) cm.upload(d.id, file); e.target.value = '' }} />
                  {!f && v.client.demo && d.format && <Button kind="ghost" className="min-h-9 text-[13px]" onClick={() => cm.attachSample(d.id)} disabled={uploading}>Attach demo sample</Button>}
                  {f && <>
                    <Button kind="ghost" className="min-h-9 text-[13px]" aria-expanded={preview === d.id} onClick={() => setPreview(preview === d.id ? null : d.id)}><Eye size={15} aria-hidden />{preview === d.id ? 'Hide raw file' : 'View raw file'}</Button>
                    <Button kind="ghost" className="min-h-9 text-[13px]" onClick={() => download(`${base}/files/${encodeURIComponent(d.id)}`)}><Download size={15} aria-hidden />Download</Button>
                    <Button kind="ghost" className="min-h-9 text-[13px] text-bad hover:bg-bad-bg" onClick={() => cm.removeFile(d.id)} disabled={busy === `remove:${d.id}`}><Trash2 size={15} aria-hidden />Remove</Button>
                  </>}
                </div>
                {preview === d.id && f && <RawPreview url={`${base}/files/${encodeURIComponent(d.id)}`} name={f.name} key={f.sha256} />}
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-slate-50/70 px-5 py-4">
          <p className="text-[13px] text-ink-3">{received === v.client.docs.length ? 'All documents are in. Process them to see the results.' : 'You can process with missing documents; results will be marked incomplete.'}<br />Accepted: .xlsx, .xls, .csv up to 5 MB. <Link href="/app/samples" className="font-medium text-accent hover:underline">Get sample files</Link></p>
          <Button kind="primary" onClick={onRun} disabled={running || v.files.length === 0} className="min-h-11 px-5">
            {running ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Play size={17} aria-hidden />}
            {running ? 'Processing…' : v.result ? 'Process again' : 'Process documents'}
          </Button>
        </div>
      </Card>

      <Card title="2 · What Hisab did" action={v.processedAt && <span className="text-xs text-ink-3">Last run {new Date(v.processedAt).toLocaleString()}</span>}>
        {steps.length === 0 && !running ? (
          <p className="px-5 py-8 text-sm text-ink-3">Nothing processed yet for {periodLabel(period)}. Upload the documents and press <strong className="text-ink-2">Process documents</strong>. Each step and what it found will show here.</p>
        ) : (
          <ol className="divide-y divide-line" aria-live="polite">
            {visible.map((s, i) => (
              <li key={s.step} className="fade-up px-5 py-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cx('grid size-5 place-items-center rounded-full text-[11px] text-white', s.ok ? 'bg-ok' : 'bg-warn')} aria-label={s.ok ? 'OK' : 'Needs attention'}>{s.ok ? <Check size={12} aria-hidden /> : '!'}</span>
                  {i + 1}. {s.title}
                  <span className="num ml-auto text-[11px] font-normal text-ink-3">{s.ms < 1 ? '<1' : s.ms.toFixed(0)} ms</span>
                </div>
                <ul className="mt-1 space-y-0.5 pl-7 text-[13px] text-ink-2">{s.detail.map((d, j) => <li key={j} className="break-words">{d}</li>)}</ul>
              </li>
            ))}
            {running && <li className="flex items-center gap-2 px-5 py-3.5 text-sm text-ink-3"><Loader2 size={16} className="animate-spin" aria-hidden />Working…</li>}
          </ol>
        )}
        {v.result && !running && (
          <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
            <Link href={withPeriod(`/app/clients/${encodeURIComponent(v.client.id)}/radar`, period)} className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">Open mismatch radar</Link>
            {v.toReview > 0 && <Link href={withPeriod(`/app/clients/${encodeURIComponent(v.client.id)}/review`, period)} className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink-2 hover:bg-slate-50">Review {v.toReview} deposit{v.toReview > 1 ? 's' : ''}</Link>}
          </div>
        )}
      </Card>
    </div>
  )
}

function RawPreview({ url, name }: { url: string; name: string }) {
  const [rows, setRows] = useState<(string | number | null)[][] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch(url, { credentials: 'same-origin' })
      .then(async (r) => { if (!r.ok) throw new Error('Could not load the file.'); const s = bytesToSheet(new Uint8Array(await r.arrayBuffer()), name).slice(0, 15); if (alive) setRows(s) })
      .catch((e) => alive && setErr((e as Error).message))
    return () => { alive = false }
  }, [url, name])
  if (err) return <p className="mt-2 pl-12 text-sm text-bad">{err}</p>
  if (!rows) return <p className="mt-2 pl-12 text-sm text-ink-3">Loading preview…</p>
  const width = Math.max(...rows.map((r) => r.length), 1)
  return (
    <div className="mt-3 ml-12 overflow-x-auto rounded-lg border border-line">
      <p className="border-b border-line bg-slate-50 px-3 py-1.5 text-xs text-ink-3">First 15 rows exactly as received: title rows, date styles and number formats included.</p>
      <table className="code w-full text-[11.5px]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line first:border-0">
              <td className="bg-slate-50 px-2 py-1 text-right text-ink-3">{i + 1}</td>
              {Array.from({ length: width }, (_, j) => <td key={j} className="whitespace-nowrap px-2 py-1">{r[j] === null || r[j] === undefined ? '' : String(r[j])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

