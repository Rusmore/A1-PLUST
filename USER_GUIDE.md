# Petty Cash Portal — User Guide (How to Use, Per User)

This guide explains how each person signs in and what they can do. It is written
for the day-to-day users, not developers.

---

## 1. Signing in

1. Open the portal link in a web browser (Chrome or Edge recommended).
2. Enter your **email** and **password**, then click **Sign in**.
3. You only see the plants and screens your account is allowed to use.
4. To sign out, use the **Sign out** button at the bottom of the left sidebar.

**First-time password / forgot password:** click **Forgot password** on the
sign-in screen to get a reset email, or ask the administrator (Grace Gan) to
reset it from the Supabase dashboard. After signing in you can change your own
password anytime from the sidebar (**Change password**).

> The app now saves each transaction as its own record, so several people can
> work at the same time without overwriting each other's entries. Still, always
> let a page finish saving (a second or two) before closing the browser.

---

## 2. Who's who — accounts, roles and plant access

| Email | Name | Role | Plants they see |
|-------|------|------|-----------------|
| `a1plusadmin@a1plus.com` | Grace Gan | System Administrator | All plants |
| `accounting@a1plus.com` | Accounting Department | Accounting (full admin) | All plants |
| `finance@a1plus.com` | Finance Department | Finance | All plants |
| `puradr@a1plus.com` | Pura Barloso | Custodian | Disney (D1) + RG and Co. (RG) |
| `lita@a1plus.com` | Angelita Bayani | Custodian | Warner |
| `mauwi@a1plus.com` | Maureen Felix | Custodian | Manila (A1+) |
| `pcfrequestordisney@a1plus.com` | PCF Requestor – Disney | PCF Requestor | Disney (D1) |
| `pcfrequestormanila@a1plus.com` | PCF Requestor – Manila | PCF Requestor | Manila (A1+) |
| `pcfrequestorrgandco@a1plus.com` | PCF Requestor – RG and Co. | PCF Requestor | RG and Co. (RG) |

**Plant scoping:** Custodians and Requestors only see tabs for their own
plant(s). Accounting, Finance and the Administrator see every plant.

---

## 3. What each role can do (permission summary)

| Action | Requestor | Custodian | Finance | Accounting | Administrator |
|--------|:---------:|:---------:|:-------:|:----------:|:-------------:|
| Create Petty Cash Requests | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve / reject requests | ❌ | ✅ | ✅ | ✅ | ✅ |
| Release cash (Release Ledger) | ❌ (view only) | ✅ | ✅ | ✅ | ✅ |
| Prepare Liquidation | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Approve receipts / liquidation** | ❌ | ❌ | ❌ | ❌ | ✅ *(Grace Gan only)* |
| Reimbursement module | ✅ | ✅ | ✅ | ✅ | ✅ |
| Replenishment | ❌ | ✅ | ✅ | ✅ | ✅ |
| Reports & Aging | ❌ | ✅ | ✅ | ✅ | ✅ |
| Dashboard | ❌ | ✅ | ✅ | ✅ | ✅ |
| PCF Documents | ❌ | ✅ | ✅ | ✅ | ✅ |
| Funds & Master Data | ❌ | ❌ | ✅ | ✅ | ✅ |
| User Management / System Settings | ❌ | ❌ | ❌ | ✅ | ✅ |
| Delete records | ❌ | ❌ | ❌ | ❌ | ✅ *(Administrator only)* |

> **Only Grace Gan** (`a1plusadmin@a1plus.com`) can approve or reject official
> receipts and final liquidations. A liquidation cannot be submitted until she
> has approved every receipt attached to it.

---

## 4. The core workflow

Petty cash moves through four steps, in order:

```
Petty Cash Request  →  Release Ledger  →  Liquidation  →  Replenishment
   (ask for cash)      (cash released)     (report spend)   (top the fund back up)
```

Reimbursement is a **separate** process (AF P16) for paying an employee back for
expenses they already paid out of pocket. It has its own tab.

---

## 5. Step-by-step, by user

### 5a. PCF Requestor (Disney / Manila / RG and Co.)
You prepare paperwork only — you cannot approve, release cash, or delete.

1. **Petty Cash Requests** → **New Request**. Fill in employee, department,
   purpose, amount and approver, then submit. It goes out for approval.
2. **Release Ledger** — **view only**. You can see what has been released but
   cannot change it.
3. **Liquidation** — prepare the liquidation for a released advance: enter the
   expense lines and upload each official receipt / sales invoice.
   - The liquidation **cannot be submitted** until Grace Gan approves the
     receipts. You'll see a "waiting for approval" note until she does.
4. **Reimbursement** — prepare employee reimbursement claims if needed.
5. **Transaction History** — track the status of everything you submitted.

### 5b. Custodian (Pura, Lita, Maureen)
You handle the cash for your assigned plant(s).

1. **Dashboard** — see balances, pending items and alerts for your plant.
2. **Petty Cash Requests** — create and **approve/reject** requests.
3. **Release Ledger** — **release cash** against an approved request and keep
   the ledger accurate.
4. **Liquidation** — prepare liquidations and attach receipts (final approval
   still comes from Grace Gan).
5. **Replenishment** — once expenses are liquidated, **replenish** the fund back
   to its float amount.
6. **Reports / Liquidation Aging** — monitor outstanding advances (5-day rule).

### 5c. Finance
Same as Custodian across **all plants**, plus **Funds & Master Data** (plants,
custodians, chart of accounts). Finance does **not** manage users/settings and
cannot delete records.

### 5d. Accounting (full admin)
Everything Finance can do, **plus User Management** and **System Settings**
(including the backup / recovery tools). Accounting sees all plants.

### 5e. System Administrator (Grace Gan)
Full access to every screen, and the **only** person who can:
- **Approve or reject official receipts and final liquidations.**
- **Delete** records.
- Restore data from a recovery snapshot (**System Settings → Data Integrity →
  Recovery snapshots**).

---

## 6. Approving receipts & liquidations (Grace Gan)

1. Open **Liquidation**. Receipts awaiting review are flagged (also shown on the
   Dashboard as "Receipts Waiting for Grace Gan's Approval").
2. Review each attached receipt and **Approve** (or reject with a remark).
3. Once **all** receipts on a liquidation are approved, the preparer can submit
   the final liquidation.

---

## 7. Working at the same time (multi-user)

- Each transaction is saved on its own, so two people editing **different**
  records at the same time no longer erase each other's work.
- If two people edit the **exact same record** within the same moment, the last
  save wins for that one record only. To avoid this, coordinate so two people
  don't edit the same request/liquidation simultaneously.
- Give a page a second or two to finish saving before closing the tab.

---

## 8. Troubleshooting

| Problem | What to do |
|---------|-----------|
| Can't sign in | Check the email/password. Use **Forgot password**, or ask Grace Gan to reset it. |
| "Cloud database not configured" | The portal lost its connection settings — contact the administrator. |
| A screen/tab is missing | That screen isn't part of your role (see the table in section 3). |
| Data looks out of date | Refresh the page (Ctrl+F5) to pull the latest from the shared database. |
| Something was deleted by mistake | Grace Gan can restore it from **System Settings → Data Integrity → Recovery snapshots**. |

---

*For technical setup (Supabase tables, deployment), see [README.md](README.md).*
