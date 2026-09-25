import * as XLSX from 'xlsx'
import type { Sheet } from './types'

/** Write a sheet to real file bytes, the same bytes a bank or billing tool would give you. */
export function sheetToBytes(sheet: Sheet, ext: 'xlsx' | 'csv'): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(sheet)
  if (ext === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws)
    return new TextEncoder().encode(csv)
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Uint8Array(out)
}

/** Read any XLSX/XLS/CSV bytes back into rows. CSV cells stay as text, like a real import. */
export function bytesToSheet(bytes: Uint8Array, name: string): Sheet {
  const isCsv = /\.csv$/i.test(name)
  const wb = isCsv
    ? XLSX.read(new TextDecoder().decode(bytes), { type: 'string', raw: true })
    : XLSX.read(bytes, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, raw: true, defval: null, blankrows: true })
  return rows.map((r) => r.map((c) => (c === undefined ? null : (c as string | number | null))))
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Short, stable hash for dedupe keys (FNV-1a, not for security). */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function downloadBytes(bytes: Uint8Array, name: string, mime = 'application/octet-stream') {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
