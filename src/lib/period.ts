import { currentFilingPeriod, parsePeriod, periodKey, type Period } from '../domain/dates'
import { navigate, useLocation } from './router'

const KEY = 'hisab.period'

/** The VAT month being worked on. Lives in the URL (?m=2083-05) so links and the back button keep it. */
export function usePeriod(): [Period, (p: Period) => void] {
  const { path, search } = useLocation()
  let stored: string | null = null
  try { stored = localStorage.getItem(KEY) } catch { /* storage blocked */ }
  const p = parsePeriod(search.get('m')) ?? parsePeriod(stored) ?? currentFilingPeriod()
  const set = (next: Period) => {
    try { localStorage.setItem(KEY, periodKey(next)) } catch { /* ignore */ }
    const s = new URLSearchParams(search)
    s.set('m', periodKey(next))
    navigate(`${path}?${s.toString()}`, { replace: true })
  }
  return [p, set]
}

/** Append the current month to an in-app link. */
export const withPeriod = (href: string, p: Period) => `${href}${href.includes('?') ? '&' : '?'}m=${periodKey(p)}`
