import type { DB } from './db'
import { audit, now } from './db'
import { storeFile, runAndStore } from './api'
import { CLIENTS, DEMO_MONTH, renderDoc } from '../src/domain/seed'
import { sheetToBytes } from '../src/domain/files'
import { periodKey } from '../src/domain/dates'

/** Load the six fictional demo clients with their files "received" for the demo month, then process them. */
export async function seedDemo(db: DB) {
  const period = periodKey(DEMO_MONTH)
  for (const c of CLIENTS) {
    const t = now()
    db.query('INSERT OR IGNORE INTO clients (id, name, pan, sector, billing_tool, story, docs_json, demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
      .run(c.id, c.name, c.pan, c.sector, c.billingTool, c.story, JSON.stringify(c.docs), t, t)
    // Bagmati Fresh has only sent its bank statement so far, so the dashboard shows it waiting.
    const docs = c.id === 'bagmati-fresh' ? c.docs.filter((d) => d.kind === 'bank') : c.docs
    for (const d of docs) {
      const r = renderDoc(c.id, d.id)
      await storeFile(db, c.id, period, { docId: d.id, name: r.name, bytes: sheetToBytes(r.sheet, r.ext), source: 'sample' }, 'Client (email)')
    }
    audit(db, { clientId: c.id, period, actor: 'Client (email)', action: 'Documents received', detail: docs.map((d) => d.label).join(', ') })
    if (c.id !== 'bagmati-fresh') await runAndStore(db, c, period, 'Hisab')
  }
}

export function wipeWorkspace(db: DB) {
  db.transaction(() => {
    for (const t of ['decisions', 'exports', 'results', 'files', 'clients', 'audit']) db.run(`DELETE FROM ${t}`)
  })()
}

export async function seedIfEmpty(db: DB) {
  const any = db.query('SELECT 1 FROM clients LIMIT 1').get()
  if (!any && !db.query("SELECT 1 FROM audit WHERE action = 'Workspace seeded'").get()) {
    await seedDemo(db)
    audit(db, { actor: 'Hisab', action: 'Workspace seeded', detail: 'Six fictional demo clients loaded' })
  }
}
