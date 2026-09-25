import type { ReactNode } from 'react'
import { useSeo } from '../../lib/seo'
import { Link } from '../../lib/router'
import { PublicLayout } from './PublicLayout'

const UPDATED = '26 September 2026'
const CONTACT = 'privacy@hisab.example' // placeholder: replace with a real mailbox before launch

function Doc({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <p className="text-sm font-medium text-ink-3">Last updated {UPDATED}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">{lead}</p>
        <p className="mt-6 rounded-xl border border-amber-200 bg-warn-bg px-4 py-3 text-sm text-warn">This page describes the <strong>Hisab demo</strong>. It is a draft to be reviewed by a lawyer before Hisab is offered to real customers or handles real client data.</p>
        <div className="prose-legal mt-10 space-y-8 text-[15px] leading-relaxed text-ink-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:mt-3 [&_ul]:space-y-1.5 [&_p]:mt-3">
          {children}
        </div>
      </article>
    </PublicLayout>
  )
}

export function Privacy() {
  useSeo({ title: 'Privacy policy', description: 'What the Hisab demo collects, why, how long it is kept, and your choices. No cookies for tracking, no third-party trackers.' })
  return (
    <Doc title="Privacy policy" lead="Hisab collects as little as possible, keeps it on the server that runs Hisab, and never sells or shares it.">
      <section><h2>1. What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> username, display name and firm name, and a one-way (argon2id) hash of your password. We never store your password itself.</li>
          <li><strong>Session cookie:</strong> one strictly necessary, HttpOnly cookie that keeps you signed in for up to 7 days. It is not used for tracking.</li>
          <li><strong>Files you upload:</strong> bank statements and sales/purchase registers, plus the results Hisab computes from them and the decisions you record.</li>
          <li><strong>Audit log:</strong> sign-ins, uploads, processing runs, decisions and exports, with the time and the person who did them.</li>
          <li><strong>Anonymous page-view counts:</strong> page path, day and referring website. No cookies, no IP address, nothing that identifies you.</li>
        </ul>
      </section>
      <section><h2>2. Why we use it</h2>
        <p>To sign you in, keep your work, produce VAT packs and reports, keep an audit trail you can show a reviewer, protect the service (for example, limiting repeated failed sign-ins), and see which public pages are useful.</p>
      </section>
      <section><h2>3. Demo data</h2>
        <p>The demo is for <strong>fictional data only</strong>. Please don’t upload real bank statements, real client names or real PANs. If you do, delete them (remove the client, or reset the workspace in Settings).</p>
      </section>
      <section><h2>4. Sharing</h2>
        <p>We don’t sell, rent or share your data. There are no advertising or third-party analytics scripts. Fonts are served from this server, not from a third-party font service, so no request leaves for Google or anyone else.</p>
      </section>
      <section><h2>5. How long we keep it</h2>
        <ul>
          <li>Sessions expire after 7 days or when you sign out.</li>
          <li>Uploads, results and decisions stay until you remove the client or reset the workspace.</li>
          <li>The audit log is append-only while the workspace exists; a workspace reset clears it.</li>
          <li>Page-view counts are kept in aggregate form.</li>
        </ul>
      </section>
      <section><h2>6. Your choices</h2>
        <ul>
          <li>Turn on Do Not Track or Global Privacy Control in your browser and no page views are counted at all.</li>
          <li>Delete a client and everything uploaded for it at any time from its Edit page.</li>
          <li>Ask us what we hold about you, or ask us to delete it: <span className="code">{CONTACT}</span>.</li>
        </ul>
      </section>
      <section><h2>7. Security</h2>
        <p>See the <Link href="/security" className="font-medium text-accent underline">Security page</Link> for how we protect accounts and data.</p>
      </section>
      <section><h2>8. Changes</h2>
        <p>If this policy changes, we’ll update the date at the top of this page.</p>
      </section>
    </Doc>
  )
}

export function Terms() {
  useSeo({ title: 'Terms of use', description: 'The terms for using the Hisab demo: fictional data only, no warranty, not tax advice.' })
  return (
    <Doc title="Terms of use" lead="By using the Hisab demo you agree to these terms. They’re short, and written to be read.">
      <section><h2>1. What the demo is</h2>
        <p>Hisab is a demonstration of software that prepares VAT figures and reconciles bank deposits for accountants in Nepal. Features, pricing and availability may change.</p>
      </section>
      <section><h2>2. Use fictional data only</h2>
        <p>Upload only made-up files. Don’t upload personal data, real client records or anything confidential. You are responsible for what you upload.</p>
      </section>
      <section><h2>3. Not tax, legal or accounting advice</h2>
        <p>Hisab applies rules to the files you give it. It can be wrong: files can be incomplete, formats can be misread, and tax rules change. You remain responsible for checking every figure and for anything you file with the Inland Revenue Department.</p>
      </section>
      <section><h2>4. Acceptable use</h2>
        <ul>
          <li>Don’t try to break into accounts, overload the service or get around its security.</li>
          <li>Don’t upload malicious files.</li>
          <li>Keep your sign-in details to yourself, and change the default demo password if others can reach your copy.</li>
        </ul>
      </section>
      <section><h2>5. No warranty</h2>
        <p>The demo is provided “as is”, without warranties of any kind. To the extent the law allows, we aren’t liable for losses arising from using it.</p>
      </section>
      <section><h2>6. Ending use</h2>
        <p>You can stop using the demo and delete your data at any time. We may suspend access that breaks these terms.</p>
      </section>
      <section><h2>7. Law</h2>
        <p>These terms are intended to be governed by the laws of Nepal. This will be confirmed by legal review before launch.</p>
      </section>
      <section><h2>8. Contact</h2>
        <p>Questions: <span className="code">{CONTACT}</span>.</p>
      </section>
    </Doc>
  )
}

export function Security() {
  useSeo({ title: 'Security', description: 'How Hisab protects accounts and data: argon2id password hashing, HttpOnly SameSite cookies, rate limiting, strict security headers and an append-only audit log.' })
  return (
    <Doc title="Security" lead="Financial data deserves boring, well-understood protections. Here’s what the demo does today, and what production adds.">
      <section><h2>Accounts</h2>
        <ul>
          <li>Passwords hashed with argon2id; never stored or logged in plain text.</li>
          <li>Sign-in attempts limited per address and username; wrong username and wrong password look the same.</li>
          <li>Sessions: random 256-bit tokens in HttpOnly, SameSite=Strict cookies (Secure over HTTPS); only a hash of the token is stored.</li>
        </ul>
      </section>
      <section><h2>Application</h2>
        <ul>
          <li>Strict Content-Security-Policy, no framing (clickjacking protection), no MIME sniffing, conservative referrer policy.</li>
          <li>State-changing requests must come from Hisab’s own origin.</li>
          <li>Uploads limited to .xlsx/.xls/.csv up to 5 MB. Files are parsed as data, never executed.</li>
          <li>Money is stored as integer paisa to avoid rounding errors. Matching is rule-based and explainable.</li>
          <li>Every upload, run, decision and export is written to an append-only audit log.</li>
        </ul>
      </section>
      <section><h2>What production adds</h2>
        <ul>
          <li>Multi-factor sign-in and per-staff roles.</li>
          <li>Each firm’s data isolated at the database level (row-level security), encrypted at rest, with off-site encrypted backups.</li>
          <li>Data-processing agreements with each firm, and automatic deletion of raw files after an agreed period.</li>
        </ul>
      </section>
      <section><h2>Reporting a problem</h2>
        <p>Found a vulnerability? Please tell us privately at <span className="code">{CONTACT}</span> and give us a chance to fix it before sharing.</p>
      </section>
    </Doc>
  )
}
