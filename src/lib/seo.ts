import { useEffect } from 'react'

export const SITE = {
  name: 'Hisab',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://hisab.example',
  description: 'Hisab turns month-end VAT work into a short review for Nepali accountants, and flags deposits that declared sales don’t explain before a tax cross-check does.',
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = value
}

/** Per-page title, description, canonical URL, Open Graph and robots. */
export function useSeo({ title, description = SITE.description, noindex = false, path }: { title: string; description?: string; noindex?: boolean; path?: string }) {
  useEffect(() => {
    const full = title === SITE.name ? `${SITE.name}: VAT pack & mismatch radar for Nepali accountants` : `${title} · ${SITE.name}`
    document.title = full
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    setMeta('property', 'og:title', full)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', SITE.name)
    setMeta('name', 'twitter:card', 'summary_large_image')
    const href = `${window.location.origin}${path ?? window.location.pathname}`
    setMeta('property', 'og:url', href)
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = href
  }, [title, description, noindex, path])
}
