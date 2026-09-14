# Petty Cash Portal — Presentation Prompt (for Gemini)

This file helps you create a simple, easy-to-understand slide presentation about
the Petty Cash Portal — even if you're not technical.

## How to use this (3 easy steps)

1. Open **Gemini** (gemini.google.com) and start a new chat.
2. Copy **everything** inside the gray box below (from "You are a presentation
   designer" all the way to the end) and paste it into Gemini.
3. Press Enter. Gemini will create the slides for you. If anything sounds too
   complicated, just reply: *"Please make it simpler."*

> **Tip:** To get a file you can open, add this to your message:
> *"Also give me a Google Slides outline I can import."*

---

## Copy everything below into Gemini

```text
You are a presentation designer. Turn the content below into a clear, simple
slide deck for a NON-TECHNICAL management audience. Requirements:
- Keep language plain — no jargon; explain any necessary term in everyday words.
- One idea per slide; short bullet points (max ~6 per slide).
- Add a one-line takeaway at the bottom of each slide.
- Keep the speaker notes provided.
- Suggest a simple, professional visual or icon idea for each slide.
- Use a calm, professional theme — cream background, teal accent.
- Output slide-by-slide with a clear title, bullets, takeaway, speaker note, and
  visual suggestion.
- Also generate this as a Google Slides outline I can import.

CONTENT:

Slide 1 — Title
Petty Cash Fund (PCF) Portal
A Simple, Secure Online System for Managing Petty Cash
Overview for Management · A1+ Group · 2026
Speaker note: "Today I'll walk you through our new petty cash system — what it
does, how we keep it secure, what it costs, and what's next. No technical
background needed."

Slide 2 — What It Is & Why It Matters
- Online replacement for petty cash spreadsheets
- One shared, always-up-to-date system across all companies, plants, and branches
- Full process in one place: request → release → liquidate → replenish → report
- Everyone sees only the locations they're responsible for
- Every action is recorded for a complete audit trail
Speaker note: "Instead of separate spreadsheets that get out of sync, everyone
now works in one shared system. It follows the same petty cash process we already
use — just faster and fully tracked."

Slide 3 — Full Feature List
- Dashboard — fund balances and activity at a glance
- Petty Cash Requests — submit, approve, and track
- Release Ledger — record and view cash released
- Liquidation — match expenses to receipts and settle
- Replenishment — top the fund back to its set amount
- Reimbursement — employee expense reimbursements (separate workflow)
- Liquidation Aging — track how long expenses stay unliquidated
- Report Center — print-ready reports and Excel/CSV exports
- Acumatica Export — send data into our accounting system
- PCF Documents — central library for supporting documents
- Master Data — manage branches, companies, plants, tax & expense categories
- Audit Trail — complete record of every action
Speaker note: "Here's the full picture. Beyond the core petty cash flow, it also
handles employee reimbursements, feeds our accounting system, stores supporting
documents, and keeps a complete audit trail."

Slide 4 — Reimbursement & Accounting Integration
Employee Reimbursement
- A separate, guided workflow for reimbursing employee expenses
- Built-in policy checks to keep claims within the rules
- Full cycle: submit → approve → liquidate → pay, with its own aging view
Accounting Integration (Acumatica)
- One-click export to our Acumatica accounting system
- Uses the standard Purchase Orders template — no re-typing
- Reduces manual data entry and errors
Speaker note: "Two things worth highlighting: a dedicated reimbursement process
for employee expenses with policy checks built in, and a direct export into
Acumatica so finance doesn't re-enter data by hand."

Slide 5 — How People Use It
- Works in any web browser — nothing to install
- Staff open a web link and sign in
- Works on office computers and mobile devices
- Everyone always sees the latest shared information
- Easy to update and maintain
Speaker note: "There's nothing to install. Staff just open a link and log in, on
a PC or a phone, and everyone sees the same live information."

Slide 6 — Where the Information Is Kept
- Stored securely in a professional online database
- Automatically saved and shared across all users and devices
- A backup copy is kept for recovery
- We monitor storage space as receipt uploads grow
Speaker note: "All the data lives in a secure, professional online database that
saves automatically. We keep backups, and we simply keep an eye on storage as
more receipts are uploaded."

Slide 7 — Is It Secure?
- Users must sign in — no public access
- Only people we approve can get an account (no self sign-up)
- Each person sees only their own location's records
- Sensitive actions (approve, release, delete) limited by role
- All traffic is encrypted (secure "https")
- One future upgrade planned for the strongest protection
Speaker note: "Access is locked down — approved users only, each limited to their
own location, everything encrypted. There's one future upgrade planned to make it
even stronger, covered in the recommendations."

Slide 8 — Who Can Do What (User Roles)
- Administrator / Accounting: full access
- Finance: sees all locations and modules
- Custodian: manages their own location's petty cash
- PCF Requestor (new): prepares requests for one location only
  - Can create requests/liquidations and upload receipts
  - Cannot approve, reject, or release funds
  - Can only view the release ledger
  - Sees only its assigned location (Disney / Manila / RG and Co.)
Speaker note: "Everyone has a role that fits their job. The new PCF Requestor can
prepare paperwork but can't approve or release money — a clear separation of
duties, which matters for financial control."

Slide 9 — Where It Lives (Hosting)
- Cheap and easy to host — it's just a set of web files
- Code stored privately; a web host serves the live site
- Recommended host: Cloudflare Pages (free, fast, reliable)
- Secure web address, optional custom domain
- Running cost today: effectively free
- Only possible future cost: database upgrade (~$25/month) for more space/backups
Speaker note: "Hosting is essentially free today. If we ever grow enough to need
more storage or guaranteed backups, the only cost is about twenty-five dollars a
month — nothing else."

Slide 10 — Can It Handle Our Team?
- Yes — comfortably handles our current team (~10 users) and well beyond
- The website and database can serve far more than we need
- Best practice: each person edits their own location's records
- Small caveat: two people editing the exact same record at the same second
  could overwrite each other — rare
- A planned upgrade removes even this small risk
Speaker note: "For our team size, it's more than capable. The only edge case is
two people editing the very same record at the very same moment — uncommon, and a
planned upgrade eliminates it entirely."

Slide 11 — Recommendations (Future Improvements)
1. Store receipts/attachments separately — keeps it fast, controls storage space
2. Upgrade how records are saved — removes the rare same-second risk and
   strengthens per-location security
3. Set up automatic backups — extra data protection
Overall: solid and ready to use today; these are future improvements
Speaker note: "The system is ready to use now. These three improvements are about
future-proofing — better speed, stronger security, and automatic backups — and we
can schedule them as we grow."

Slide 12 — Next Steps
1. Finish setting up the new PCF Requestor accounts
2. Keep the code repository private
3. Publish the latest updates
4. Confirm everything works with a quick test login
5. Plan future improvements as usage grows
Speaker note: "Our immediate steps are simple: finish the new accounts, publish
the latest version, do a quick test, and plan the improvements. Happy to take any
questions."
```

---

## If you want changes

After Gemini creates the slides, you can simply reply with things like:
- *"Make slide 3 shorter."*
- *"Use bigger, friendlier headings."*
- *"Add a summary slide at the end."*
- *"Translate the whole deck into Filipino."*
