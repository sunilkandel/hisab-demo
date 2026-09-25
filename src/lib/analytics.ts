/**
 * First-party, cookieless page-view counting. Sends only the path and the referring site.
 * Skipped when the browser asks not to be tracked (Do Not Track or Global Privacy Control).
 */
export function trackPageView(path: string) {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return
  const referrer = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : ''
  const body = JSON.stringify({ path, referrer })
  try {
    if (!navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined)
    }
  } catch { /* analytics must never break the page */ }
}
