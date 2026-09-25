import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from '../../lib/router'
import { useSeo } from '../../lib/seo'
import { PublicLayout } from './PublicLayout'
import { FAQS } from './faqData'

export function Faq() {
  useSeo({ title: 'FAQ', description: 'Answers about Hisab: what it does, which files it reads, the demo, data and security, and pricing.' })
  useEffect(() => {
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.text = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQS.flatMap((g) => g.items).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    })
    document.head.appendChild(s)
    return () => s.remove()
  }, [])
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <h1 className="text-4xl font-bold tracking-tight">Frequently asked questions</h1>
        <p className="mt-3 text-lg text-ink-3">Can’t find what you need? Try the <Link href="/login" className="font-semibold text-accent underline">live demo</Link>. It’s the fastest way to see how Hisab works.</p>
        <nav aria-label="FAQ sections" className="mt-8 flex flex-wrap gap-2">
          {FAQS.map((g) => <a key={g.title} href={`#${g.title.toLowerCase().replace(/\W+/g, '-')}`} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:border-accent hover:text-accent">{g.title}</a>)}
        </nav>
        {FAQS.map((g) => (
          <section key={g.title} id={g.title.toLowerCase().replace(/\W+/g, '-')} className="mt-12 scroll-mt-24" aria-labelledby={`h-${g.title}`}>
            <h2 id={`h-${g.title}`} className="text-xl font-semibold">{g.title}</h2>
            <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
              {g.items.map((q) => (
                <details key={q.q} className="group px-6 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-8 items-center justify-between gap-4 text-base font-semibold">{q.q}<span className="text-xl leading-none text-ink-3 transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-3">{q.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <div className="mt-14 rounded-2xl bg-primary px-6 py-8 text-center text-white">
          <h2 className="text-2xl font-bold">Ready to see it work?</h2>
          <Link href="/login" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-primary hover:bg-emerald-400">Try the live demo <ArrowRight size={18} aria-hidden /></Link>
        </div>
      </div>
    </PublicLayout>
  )
}
