import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, FileCheck2, Info, RefreshCw, XCircle } from 'lucide-react'
import { formatNpr } from '../domain/money'
import type { ClientStatus } from '../domain/view'
import type { CreditCategory, IssueSeverity } from '../domain/types'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

export function Money({ p, className, sign, strong }: { p: number; className?: string; sign?: boolean; strong?: boolean }) {
  return <span className={cx('num whitespace-nowrap', strong && 'font-semibold', className)}>{formatNpr(p, { sign })}</span>
}

export function Card({ children, className, title, action, id }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <section id={id} className={cx('min-w-0 rounded-lg border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid'
export function Button({ kind = 'secondary', className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind }) {
  const styles: Record<BtnKind, string> = {
    primary: 'bg-accent text-white hover:bg-accent-hover border-transparent',
    secondary: 'bg-white text-ink-2 border-line hover:bg-slate-50 hover:border-slate-300',
    ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-slate-100',
    danger: 'bg-white text-bad border-red-200 hover:bg-bad-bg',
    dangerSolid: 'bg-bad text-white border-transparent hover:bg-red-800',
  }
  return (
    <button
      {...rest}
      className={cx('inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-50', styles[kind], className)}
    >
      {children}
    </button>
  )
}

const STATUS: Record<ClientStatus, { label: string; cls: string; icon: ReactNode }> = {
  waiting: { label: 'Waiting for documents', cls: 'bg-slate-100 text-ink-2', icon: <Clock size={13} aria-hidden /> },
  'not-run': { label: 'Ready to process', cls: 'bg-info-bg text-info', icon: <CircleDashed size={13} aria-hidden /> },
  stale: { label: 'Files changed: re-run', cls: 'bg-info-bg text-info', icon: <RefreshCw size={13} aria-hidden /> },
  errors: { label: 'Issues to check', cls: 'bg-bad-bg text-bad', icon: <XCircle size={13} aria-hidden /> },
  review: { label: 'Needs review', cls: 'bg-warn-bg text-warn', icon: <AlertTriangle size={13} aria-hidden /> },
  ready: { label: 'VAT pack ready', cls: 'bg-ok-bg text-ok', icon: <CheckCircle2 size={13} aria-hidden /> },
  exported: { label: 'Exported', cls: 'bg-ok-bg text-ok', icon: <FileCheck2 size={13} aria-hidden /> },
}
export function StatusPill({ status }: { status: ClientStatus }) {
  const s = STATUS[status]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', s.cls)}>{s.icon}{s.label}</span>
}

export function SeverityIcon({ s }: { s: IssueSeverity }) {
  if (s === 'error') return <XCircle size={16} className="shrink-0 text-bad" aria-label="Error" />
  if (s === 'warning') return <AlertTriangle size={16} className="shrink-0 text-warn" aria-label="Warning" />
  return <Info size={16} className="shrink-0 text-info" aria-label="Note" />
}

export const CATEGORY: Record<CreditCategory, { label: string; cls: string; bar: string }> = {
  'matched-sales': { label: 'Matched to bills / cash sales', cls: 'bg-ok-bg text-ok', bar: '#16a34a' },
  'qr-settlement': { label: 'QR batch = QR bills', cls: 'bg-ok-bg text-ok', bar: '#22c55e' },
  'own-transfer': { label: 'Own account transfer', cls: 'bg-slate-100 text-ink-2', bar: '#94a3b8' },
  loan: { label: 'Loan', cls: 'bg-slate-100 text-ink-2', bar: '#64748b' },
  'owner-capital': { label: 'Owner capital', cls: 'bg-slate-100 text-ink-2', bar: '#475569' },
  refund: { label: 'Refund', cls: 'bg-slate-100 text-ink-2', bar: '#334155' },
  'other-explained': { label: 'Other (explained)', cls: 'bg-slate-100 text-ink-2', bar: '#cbd5e1' },
  'undeclared-sale': { label: 'Undeclared sale', cls: 'bg-bad-bg text-bad', bar: '#b91c1c' },
  unexplained: { label: 'Unexplained', cls: 'bg-warn-bg text-warn', bar: '#d97706' },
}
export function CategoryChip({ c, suggestion }: { c: CreditCategory; suggestion?: CreditCategory }) {
  const s = CATEGORY[c]
  return (
    <span className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', s.cls)}>
      {s.label}
      {c === 'unexplained' && suggestion && <span className="ml-1 font-normal">· maybe {CATEGORY[suggestion].label.toLowerCase()}</span>}
    </span>
  )
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'bad' | 'warn' | 'ok' }) {
  const tones = { default: 'text-ink', bad: 'text-bad', warn: 'text-warn', ok: 'text-ok' }
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className={cx('num mt-1 text-xl font-semibold', tones[tone])}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  )
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2 text-xs text-ink-3">
      <Button kind="ghost" className="min-h-8 px-2" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="num">{page + 1} / {pages}</span>
      <Button kind="ghost" className="min-h-8 px-2" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  )
}

export const th = 'px-3 py-2 text-left text-xs font-semibold text-ink-3 whitespace-nowrap'
export const td = 'px-3 py-2 align-top'
export const tdNum = 'px-3 py-2 text-right align-top'


/** Brand mark: a ledger page with a tick, drawn as SVG (scales crisply, has a text alternative). */
export function Logo({ size = 32, dark = false, withText = true }: { size?: number; dark?: boolean; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Hisab logo">
        <rect width="32" height="32" rx="8" fill={dark ? '#ffffff' : '#0b1b33'} />
        <path d="M9 10.5h14M9 15.5h9M9 20.5h6" stroke={dark ? '#0b1b33' : '#ffffff'} strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
        <path d="m17.5 21 3 3 5.5-7" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {withText && (
        <span className="leading-none">
          <span className={cx('block text-[17px] font-bold tracking-tight', dark ? 'text-white' : 'text-ink')}>Hisab</span>
          <span className={cx('mt-0.5 block text-[11px] font-medium', dark ? 'text-slate-300' : 'text-ink-3')}>VAT pack & mismatch radar</span>
        </span>
      )}
    </span>
  )
}

/** Labelled form field with hint and inline error (error sits next to the field, announced to screen readers). */
export function Field({ label, hint, error, children, required, id: given }: { label: string; hint?: ReactNode; error?: string; required?: boolean; id?: string; children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode }) {
  const auto = useId()
  const id = given ?? auto
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">{label}{required && <span className="text-bad" aria-hidden> *</span>}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined, required })}
      {hint && !error && <p id={hintId} className="mt-1.5 text-[13px] text-ink-3">{hint}</p>}
      {error && <p id={errId} className="mt-1.5 flex items-center gap-1 text-[13px] font-medium text-bad"><XCircle size={14} aria-hidden />{error}</p>}
    </div>
  )
}

/** Accessible confirm dialog for destructive or irreversible actions (error prevention). */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = 'danger', busy, onConfirm, onCancel, confirmDisabled }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; tone?: 'danger' | 'primary'; busy?: boolean; confirmDisabled?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); onCancel() }}
      className="m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-white p-0 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-[2px]">
      <div className="px-6 pt-5 pb-4">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-ink-2">{children}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-slate-50 px-6 py-3">
        <Button kind="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button kind={tone === 'danger' ? 'dangerSolid' : 'primary'} onClick={onConfirm} disabled={busy || confirmDisabled}>{busy ? 'Working…' : confirmLabel}</Button>
      </div>
    </dialog>
  )
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-ink-3">{icon}</div>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-ink-3">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-slate-200/70', className)} aria-hidden />
}

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="space-y-3 py-2">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-3 pt-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-72" />
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-bad-bg px-4 py-3 text-sm text-bad">
      <XCircle size={18} aria-hidden /> <span className="flex-1">{message}</span>
      {onRetry && <Button kind="danger" onClick={onRetry}>Try again</Button>}
    </div>
  )
}
