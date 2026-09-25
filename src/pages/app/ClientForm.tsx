import { useEffect, useState, type FormEvent } from 'react'
import { ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { Link, navigate } from '../../lib/router'
import { useToast } from '../../lib/toast'
import { useSeo } from '../../lib/seo'
import type { BillingTool, Client } from '../../domain/types'
import { Button, Card, ConfirmDialog, ErrorBox, Field, PageLoading, cx } from '../../ui/common'

const TOOLS: { id: BillingTool; hint: string }[] = [
  { id: 'BUSY', hint: 'Desktop accounting (BUSY)' },
  { id: 'Tigg', hint: 'Cloud accounting (Tigg)' },
  { id: 'Tally', hint: 'Tally registers' },
  { id: 'Excel (manual)', hint: 'Hand-kept Excel sheets' },
]

interface Bank { bank: string; account: string }
interface Form { name: string; pan: string; sector: string; billingTool: BillingTool | ''; banks: Bank[] }
const empty: Form = { name: '', pan: '', sector: '', billingTool: '', banks: [{ bank: '', account: '' }] }

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {}
  if (f.name.trim().length < 2) e.name = 'Enter the business name.'
  if (!/^\d{9}$/.test(f.pan.replace(/\s/g, ''))) e.pan = 'PAN must be exactly 9 digits.'
  if (!f.billingTool) e.billingTool = 'Choose the billing software the client uses.'
  f.banks.forEach((b, i) => {
    if (b.bank.trim().length < 2) e[`banks.${i}.bank`] = 'Enter the bank name.'
    if (!/^[A-Za-z0-9-]{4,24}$/.test(b.account.replace(/\s/g, ''))) e[`banks.${i}.account`] = '4–24 letters, digits or dashes.'
  })
  const accts = f.banks.map((b) => b.account.replace(/\s/g, ''))
  if (new Set(accts).size !== accts.length) e.banks = 'The same account number is listed twice.'
  return e
}

export function ClientForm({ clientId }: { clientId?: string }) {
  const editing = !!clientId
  const toast = useToast()
  const [form, setForm] = useState<Form | null>(editing ? null : empty)
  const [client, setClient] = useState<Client | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  useSeo({ title: editing ? 'Edit client' : 'Add client', noindex: true })

  useEffect(() => {
    if (!clientId) return
    api.get<{ client: Client }>(`/api/clients/${encodeURIComponent(clientId)}`).then(({ client }) => {
      setClient(client)
      setForm({
        name: client.name, pan: client.pan, sector: client.sector, billingTool: client.billingTool,
        banks: client.docs.filter((d) => d.kind === 'bank').map((d) => ({ bank: d.label.split(' · ')[0], account: d.account ?? '' })),
      })
    }).catch((e) => setLoadError((e as Error).message))
  }, [clientId])

  if (loadError) return <ErrorBox message={loadError} />
  if (!form) return <PageLoading label="Loading client" />

  const set = (patch: Partial<Form>) => {
    const next = { ...form, ...patch }
    setForm(next)
    if (touched) setErrors(validate(next))
  }
  const setBank = (i: number, patch: Partial<Bank>) => set({ banks: form.banks.map((b, j) => (j === i ? { ...b, ...patch } : b)) })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    const v = validate(form!)
    setErrors(v)
    if (Object.keys(v).length) {
      const first = Object.keys(v)[0]
      document.getElementById(`f-${first.replace(/\./g, '-')}`)?.focus()
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, pan: form!.pan.replace(/\s/g, ''), banks: form!.banks.map((b) => ({ bank: b.bank.trim(), account: b.account.replace(/\s/g, '') })) }
      const r = editing
        ? await api.put<{ client: Client }>(`/api/clients/${encodeURIComponent(clientId!)}`, payload)
        : await api.post<{ client: Client }>('/api/clients', payload)
      toast(editing ? `${r.client.name} updated.` : `${r.client.name} added. Upload this month’s documents next.`)
      navigate(`/app/clients/${encodeURIComponent(r.client.id)}/documents`)
    } catch (err) {
      const ae = err as ApiError
      if (ae.field) { setErrors({ [ae.field]: ae.message }); document.getElementById(`f-${ae.field.replace(/\./g, '-')}`)?.focus() }
      else toast(ae.message, 'error')
    } finally { setSaving(false) }
  }

  async function onDelete() {
    setDeleting(true)
    try {
      await api.del(`/api/clients/${encodeURIComponent(clientId!)}`)
      toast(`${client?.name} and all its files were removed.`)
      navigate('/app')
    } catch (err) { toast((err as Error).message, 'error') } finally { setDeleting(false) }
  }

  const errCount = Object.keys(errors).length

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-ink-3">
        <Link href="/app" className="hover:text-accent">Clients</Link><ChevronRight size={14} aria-hidden />
        {editing && client && <><Link href={`/app/clients/${encodeURIComponent(client.id)}`} className="hover:text-accent">{client.name}</Link><ChevronRight size={14} aria-hidden /></>}
        <span className="text-ink-2" aria-current="page">{editing ? 'Edit' : 'Add client'}</span>
      </nav>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{editing ? `Edit ${client?.name}` : 'Add a client'}</h1>
        <p className="mt-1 text-sm text-ink-3">{editing ? 'Changes apply to all months.' : 'You need this once per client. Each month you then upload their bank statements and sales & purchase registers.'}</p>
      </div>

      {touched && errCount > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-bad-bg px-4 py-3 text-sm text-bad">
          Please fix {errCount} field{errCount > 1 ? 's' : ''} marked below.
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Card title="Business details">
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Business name" required error={errors.name} id="f-name" hint="As registered with IRD.">
                {(p) => <input {...p} className="field" autoComplete="organization" maxLength={120} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Shree Ganesh Traders" />}
              </Field>
            </div>
            <Field label="PAN" required error={errors.pan} id="f-pan" hint="9 digits, on the client’s PAN/VAT certificate.">
              {(p) => <input {...p} className="field code tracking-wider" inputMode="numeric" maxLength={11} value={form.pan} onChange={(e) => set({ pan: e.target.value.replace(/[^\d\s]/g, '') })} placeholder="601234587" />}
            </Field>
            <Field label="Business type & location" id="f-sector" hint="Optional. Helps you tell clients apart.">
              {(p) => <input {...p} className="field" maxLength={80} value={form.sector} onChange={(e) => set({ sector: e.target.value })} placeholder="e.g. Pharmacy · Butwal" />}
            </Field>
          </div>
        </Card>

        <Card title="Billing software">
          <fieldset className="p-5" aria-describedby={errors.billingTool ? 'f-billingTool-err' : undefined}>
            <legend className="sr-only">Which billing software does the client use?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TOOLS.map((t, i) => (
                <label key={t.id} className={cx('flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors', form.billingTool === t.id ? 'border-accent bg-accent-soft/60 ring-1 ring-accent' : 'border-line bg-white hover:border-line-2')}>
                  <input type="radio" name="billingTool" id={i === 0 ? 'f-billingTool' : undefined} value={t.id} checked={form.billingTool === t.id} onChange={() => set({ billingTool: t.id })} className="size-4 accent-[#0369a1]" />
                  <span><span className="block text-sm font-semibold">{t.id}</span><span className="block text-[13px] text-ink-3">{t.hint}</span></span>
                </label>
              ))}
            </div>
            {errors.billingTool && <p id="f-billingTool-err" className="mt-2 text-[13px] font-medium text-bad">{errors.billingTool}</p>}
            <p className="mt-3 text-[13px] text-ink-3">This only labels the register slots. Hisab reads the exported files automatically, whatever their layout.</p>
          </fieldset>
        </Card>

        <Card title="Bank accounts" action={<span className="text-xs text-ink-3">{form.banks.length}/5</span>}>
          <div className="space-y-4 p-5">
            {client?.demo && <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-ink-2">Demo clients keep their sample document slots, so bank changes here don't change their uploads.</p>}
            {form.banks.map((b, i) => (
              <div key={i} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                <Field label={`Bank ${i + 1} name`} required error={errors[`banks.${i}.bank`]} id={`f-banks-${i}-bank`}>
                  {(p) => <input {...p} className="field" list="bank-names" maxLength={60} value={b.bank} onChange={(e) => setBank(i, { bank: e.target.value })} placeholder="e.g. Sagarmatha Demo Bank" />}
                </Field>
                <Field label="Account number" required error={errors[`banks.${i}.account`]} id={`f-banks-${i}-account`}>
                  {(p) => <input {...p} className="field code" maxLength={24} value={b.account} onChange={(e) => setBank(i, { account: e.target.value })} placeholder="01234500041" />}
                </Field>
                <div className="sm:pt-7">
                  <Button type="button" kind="ghost" className="text-ink-3" disabled={form.banks.length === 1} onClick={() => set({ banks: form.banks.filter((_, j) => j !== i) })} aria-label={`Remove bank ${i + 1}`} title={form.banks.length === 1 ? 'At least one bank account is needed' : 'Remove this account'}><X size={18} aria-hidden /></Button>
                </div>
              </div>
            ))}
            <datalist id="bank-names"><option value="Sagarmatha Demo Bank" /><option value="Gandaki Demo Bank" /></datalist>
            {errors.banks && <p className="text-[13px] font-medium text-bad">{errors.banks}</p>}
            <Button type="button" onClick={() => set({ banks: [...form.banks, { bank: '', account: '' }] })} disabled={form.banks.length >= 5}><Plus size={16} aria-hidden />Add another account</Button>
            <p className="text-[13px] text-ink-3">Each account gets its own statement upload. Money moving between these accounts is recognised as a transfer, not income.</p>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {editing ? <Button type="button" kind="danger" onClick={() => { setDeleteText(''); setConfirmDelete(true) }}><Trash2 size={16} aria-hidden />Remove client</Button> : <span />}
          <div className="flex gap-2">
            <Link href={editing && client ? `/app/clients/${encodeURIComponent(client.id)}` : '/app'} className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-ink-2 hover:bg-muted">Cancel</Link>
            <Button type="submit" kind="primary" className="min-h-11 px-6" disabled={saving}>{saving && <Loader2 size={17} className="animate-spin" aria-hidden />}{editing ? 'Save changes' : 'Add client'}</Button>
          </div>
        </div>
      </form>

      <ConfirmDialog open={confirmDelete} title={`Remove ${client?.name}?`} confirmLabel="Remove client permanently" busy={deleting}
        confirmDisabled={deleteText.trim() !== client?.name} onCancel={() => setConfirmDelete(false)} onConfirm={onDelete}>
        <p>This deletes the client and <strong>every month’s files, results and decisions</strong>. It can’t be undone. The audit log keeps a record that it happened.</p>
        <label className="mt-4 block text-sm font-medium text-ink">Type <span className="code rounded bg-muted px-1">{client?.name}</span> to confirm
          <input className="field mt-1.5" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
        </label>
      </ConfirmDialog>
    </div>
  )
}
