import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, FileCheck2, Info, XCircle } from 'lucide-react'
import { formatNpr } from '../domain/money'
import type { ClientStatus } from '../state/store'
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

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ kind = 'secondary', className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind }) {
  const styles: Record<BtnKind, string> = {
    primary: 'bg-accent text-white hover:bg-accent-hover border-transparent',
    secondary: 'bg-white text-ink-2 border-line hover:bg-slate-50 hover:border-slate-300',
    ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-slate-100',
    danger: 'bg-white text-bad border-red-200 hover:bg-bad-bg',
  }
  return (
    <button
      {...rest}
      className={cx('inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-150 disabled:opacity-50', styles[kind], className)}
    >
      {children}
    </button>
  )
}

const STATUS: Record<ClientStatus, { label: string; cls: string; icon: ReactNode }> = {
  waiting: { label: 'Waiting for documents', cls: 'bg-slate-100 text-ink-2', icon: <Clock size={13} aria-hidden /> },
  'not-run': { label: 'Ready to process', cls: 'bg-info-bg text-info', icon: <CircleDashed size={13} aria-hidden /> },
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
