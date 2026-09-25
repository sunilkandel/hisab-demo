export interface Faq { q: string; a: string }
export interface FaqGroup { title: string; items: Faq[] }

export const FAQS: FaqGroup[] = [
  {
    title: 'Product',
    items: [
      { q: 'What does Hisab actually do?', a: 'You upload a client’s bank statements and sales and purchase registers for one VAT month. Hisab reads them, checks them for errors, explains every deposit (bills, QR batches, cash banked, own transfers, loans), and produces a VAT pack: output VAT, claimable input VAT, registers, and a record of every decision.' },
      { q: 'Does it replace my billing or accounting software?', a: 'No. Your clients keep BUSY, Tigg, Tally or Excel. Hisab works on the files those tools export, across all your clients, whatever each one uses. It isn’t billing software and doesn’t issue invoices.' },
      { q: 'What is the “mismatch radar”?', a: 'It compares money that came into the client’s bank accounts with the sales they declared. Deposits that no bill, QR batch or cash sale explains are shown with the reason, so you can explain them (loan, owner capital, refund) or treat them as undeclared sales before filing, not after a notice.' },
      { q: 'Does it use AI to decide numbers?', a: 'No. Matching is done by clear rules: exact amounts, dates, references and names, with a plain-language reason for every match. Anything the rules can’t explain goes to you. You make the judgement calls.' },
      { q: 'Which files can it read?', a: 'Excel (.xlsx, .xls) and CSV exports: bank statements, and sales and purchase registers from BUSY, Tigg, Tally and hand-kept Excel sheets, including Nepali headers, BS dates and Devanagari digits. Files with common column names are mapped automatically. PDF statements are planned.' },
    ],
  },
  {
    title: 'The demo',
    items: [
      { q: 'How do I sign in to the demo?', a: 'Use username “demo” and password “Hisab@2083”. Please change the password in Settings if anyone else can reach your copy.' },
      { q: 'Is the demo data real?', a: 'No. The firm, clients, banks, PANs and amounts are fictional, generated to look like real exports. Upload only made-up files to the demo. Never real client data.' },
      { q: 'How do I try it with my own files?', a: 'Go to Sample files, download a set, change them in Excel if you like (add a deposit, delete a bill), then add a client and upload them for the matching month. Everything is processed for real; only the data is imaginary.' },
      { q: 'Can I start again from scratch?', a: 'Yes. Settings → Reset demo workspace restores the six demo clients and removes everything you added.' },
    ],
  },
  {
    title: 'Data & security',
    items: [
      { q: 'Where is data stored?', a: 'In this demo, in a database on the server that runs Hisab. Nothing is sent to third parties. A production version would store each firm’s data separately, encrypted, with backups, and only with a data-processing agreement in place.' },
      { q: 'Do you track visitors?', a: 'Only anonymous page-view counts on this server: which page, which day, and the referring site. No cookies, no IP addresses, no advertising or third-party trackers. If your browser sends Do Not Track or Global Privacy Control, nothing is counted.' },
      { q: 'How are passwords protected?', a: 'Passwords are stored only as argon2id hashes. Sessions use secure, HttpOnly cookies, and sign-in attempts are rate-limited. See the Security page for details.' },
    ],
  },
  {
    title: 'Pricing',
    items: [
      { q: 'How much will it cost?', a: 'Planned launch pricing is per firm: NPR 3,000, 8,000 or 15,000 a month depending on the number of clients and staff. Early firms get a free pilot month.' },
      { q: 'Is this tax advice?', a: 'No. Hisab is a tool that prepares and checks figures. The accountant remains responsible for the return. Always review before filing.' },
    ],
  },
]
