import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

type Tone = 'success' | 'error'
interface Toast { id: number; tone: Tone; text: string }
const Ctx = createContext<(text: string, tone?: Tone) => void>(() => undefined)

/** Short confirmations for every action (visibility of system status). Errors stay until dismissed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))
  const push = useCallback((text: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-3), { id, tone, text }])
    if (tone === 'success') setTimeout(() => dismiss(id), 4000)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 print:hidden" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'}
            className={`toast-in pointer-events-auto flex max-w-lg items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg ${t.tone === 'error' ? 'border-red-200 bg-white text-bad' : 'border-slate-200 bg-ink text-white'}`}>
            {t.tone === 'error' ? <AlertCircle size={18} className="mt-px shrink-0" aria-hidden /> : <CheckCircle2 size={18} className="mt-px shrink-0 text-emerald-400" aria-hidden />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="-m-1 rounded p-1 opacity-70 hover:opacity-100" aria-label="Dismiss notification"><X size={16} aria-hidden /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
