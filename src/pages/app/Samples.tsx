import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Info } from 'lucide-react'
import { api, download } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useSeo } from '../../lib/seo'
import { Link } from '../../lib/router'
import { Button, Card, ErrorBox, PageLoading } from '../../ui/common'

interface Sample { id: string; name: string; billingTool: string; story: string; docs: { id: string; kind: string; label: string; file: string }[] }

export function Samples() {
  const [data, setData] = useState<{ label: string; clients: Sample[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  useSeo({ title: 'Sample files', noindex: true })
  useEffect(() => { api.get<{ label: string; clients: Sample[] }>('/api/samples').then(setData).catch((e) => setError(e.message)) }, [])
  if (error) return <ErrorBox message={error} />
  if (!data) return <PageLoading label="Loading sample files" />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sample files</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-3">Realistic but fictional files, in the messy layouts real banks and billing tools produce, for <strong className="text-ink-2">{data.label}</strong>. Download them, edit them in Excel if you like (change amounts, delete rows, add a bogus deposit), then upload them to any client and see how Hisab reacts.</p>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-accent-soft/60 px-4 py-3 text-sm text-ink-2">
        <Info size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <p>Try it: <Link href="/app/clients/new" className="font-semibold text-accent underline">add a client</Link>, set the month to <strong>{data.label}</strong>, and upload one bank statement plus the matching sales and purchase registers below. Use your own files only if they are made up. Don’t upload real client data to this demo.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.clients.map((c) => (
          <Card key={c.id} title={<span>{c.name} <span className="font-normal text-ink-3">· {c.billingTool}</span></span>}>
            <p className="px-5 pt-3 text-[13px] text-ink-3">{c.story}</p>
            <ul className="divide-y divide-line px-2 py-2">
              {c.docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileSpreadsheet size={18} className="shrink-0 text-ink-3" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{d.label}</div>
                    <div className="code truncate text-xs text-ink-3">{d.file}</div>
                  </div>
                  <Button kind="ghost" className="min-h-9 text-[13px]" onClick={() => download(`/api/samples/${c.id}/${d.id}`).then((n) => toast(`${n} downloaded.`)).catch((e) => toast(e.message, 'error'))} aria-label={`Download ${d.file}`}>
                    <Download size={15} aria-hidden />Download
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
