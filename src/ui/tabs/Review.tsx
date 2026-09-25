import { useState } from 'react'
import { Check, Undo2 } from 'lucide-react'
import { useStore } from '../../state/store'
import { formatBs } from '../../domain/dates'
import { formatNpr } from '../../domain/money'
import type { CreditCategory, CreditResult, Txn } from '../../domain/types'
import { Button, CATEGORY, Card, CategoryChip, Money, cx } from '../common'

const CHOICES: { c: CreditCategory; help: string }[] = [
  { c: 'loan', help: 'Loan disbursed to the business. Keep the loan statement.' },
  { c: 'owner-capital', help: "Owner's own money put into the business. Keep proof of source." },
  { c: 'own-transfer', help: "Moved from another of the client's accounts." },
  { c: 'refund', help: 'Refund of an earlier payment by the client.' },
  { c: 'other-explained', help: 'Explained by something else. Write what in the note.' },
  { c: 'undeclared-sale', help: 'It was a sale with no bill. Must be added to sales and VAT.' },
]

export function Review({ clientId }: { clientId: string }) {
  const { view } = useStore()
  const v = view(clientId)
  const [showAll, setShowAll] = useState(false)
  if (!v.result) return null
  const txns = new Map(v.result.txns.map((t) => [t.id, t]))
  const pending = v.credits.filter((c) => c.category === 'unexplained')
  const decided = v.credits.filter((c) => !c.auto)
  const auto = v.credits.filter((c) => c.auto && c.category !== 'unexplained')

  return (
    <div className="space-y-4">
      <Card title={`Waiting for your decision (${pending.length})`}>
        {pending.length === 0 ? <p className="px-4 py-6 text-sm text-ok">Queue is empty. Every deposit is explained or classified.</p> : (
          <ul className="divide-y divide-line">
            {pending.map((c) => <ReviewItem key={c.txnId} clientId={clientId} c={c} t={txns.get(c.txnId)!} />)}
          </ul>
        )}
      </Card>

      {decided.length > 0 && (
        <Card title={`Decided by you (${decided.length})`}>
          <ul className="divide-y divide-line">
            {decided.map((c) => <ReviewItem key={c.txnId} clientId={clientId} c={c} t={txns.get(c.txnId)!} />)}
          </ul>
        </Card>
      )}

      <Card title={`Explained automatically by rules (${auto.length})`} action={<Button kind="ghost" className="min-h-8 text-xs" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Hide' : 'Show'} all</Button>}>
        <p className="px-4 py-2 text-xs text-ink-3">Each one shows the rule that explained it, so you can check the reasoning instead of trusting a black box.</p>
        {showAll && (
          <ul className="divide-y divide-line border-t border-line">
            {auto.map((c) => {
              const t = txns.get(c.txnId)!
              return (
                <li key={c.txnId} className="grid gap-1 px-4 py-2 text-sm sm:grid-cols-[90px_1fr_auto]">
                  <span className="num text-xs text-ink-3">{formatBs(t.dateBs)}</span>
                  <div><div className="text-xs font-medium">{t.narration}</div><div className="text-xs text-ink-3">{c.reason}</div></div>
                  <div className="text-right"><Money p={t.credit} /><div className="mt-0.5"><CategoryChip c={c.category} /></div></div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

function ReviewItem({ clientId, c, t }: { clientId: string; c: CreditResult; t: Txn }) {
  const { decide } = useStore()
  const [choice, setChoice] = useState<CreditCategory | ''>(c.category !== 'unexplained' ? c.category : c.suggestion ?? '')
  const [note, setNote] = useState('')
  const isDecided = !c.auto
  const needsNote = choice === 'other-explained'
  const label = `${formatBs(t.dateBs)} ${t.narration} NPR ${formatNpr(t.credit)}`

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{t.narration}</div>
          <div className="text-xs text-ink-3"><span className="num">{formatBs(t.dateBs, 'long')}</span> · A/C <span className="num">{t.account}</span> · Ref <span className="num">{t.ref || '—'}</span></div>
          <p className="mt-1 text-xs text-ink-2">{c.reason}</p>
        </div>
        <div className="text-right">
          <Money p={t.credit} strong className="text-base" />
          <div className="mt-0.5"><CategoryChip c={c.category} suggestion={c.suggestion} /></div>
        </div>
      </div>
      {isDecided ? (
        <div className="mt-2 flex items-center gap-2">
          <Button kind="ghost" className="min-h-8 text-xs" onClick={() => decide(clientId, t.id, null, label)}><Undo2 size={14} aria-hidden />Undo</Button>
        </div>
      ) : (
        <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); if (choice && (!needsNote || note.trim())) decide(clientId, t.id, { category: choice, note: note.trim() }, `${label} → ${CATEGORY[choice].label}`) }}>
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-ink-2">What is this deposit?{c.suggestion && <span className="font-normal text-ink-3"> Hisab suggests: {CATEGORY[c.suggestion].label}</span>}</legend>
            <div className="flex flex-wrap gap-1.5">
              {CHOICES.map((o) => (
                <label key={o.c} title={o.help} className={cx('inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors',
                  choice === o.c ? 'border-accent bg-info-bg text-accent' : 'border-line bg-white text-ink-2 hover:border-slate-300')}>
                  <input type="radio" name={`c-${t.id}`} value={o.c} checked={choice === o.c} onChange={() => setChoice(o.c)} className="accent-[#0369a1]" />
                  {CATEGORY[o.c].label}
                </label>
              ))}
            </div>
            {choice && <p className="mt-1 text-xs text-ink-3">{CHOICES.find((o) => o.c === choice)?.help}</p>}
          </fieldset>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[240px] flex-1 text-xs font-medium text-ink-2">
              Note / evidence {needsNote ? <span className="text-bad">(required)</span> : <span className="font-normal text-ink-3">(optional)</span>}
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Loan sanction letter no. 2209 seen" className="mt-1 block min-h-9 w-full rounded-md border border-line px-2.5 text-sm font-normal focus:border-accent" />
            </label>
            <Button kind="primary" type="submit" disabled={!choice || (needsNote && !note.trim())}><Check size={16} aria-hidden />Confirm</Button>
          </div>
        </form>
      )}
    </li>
  )
}
