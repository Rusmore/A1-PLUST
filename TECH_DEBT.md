# Tech Debt / Known Limitations

Pragmatic notes on things that work today but should be addressed before the
app scales (more users, heavier concurrent editing, or larger file volume).
Ordered by priority.

## 1. Move uploaded files out of the state blob into Supabase Storage
**Now:** Receipts, PCF documents, and reimbursement attachments are read with
`readAsDataURL` and stored as base64 strings *inside* the single app-state JSON
blob (see `src/18b-pcf-documents.jsx`, `src/11-liquidation.jsx`,
`src/22-reimbursement.jsx`).
**Problem:** Base64 inflates files ~33%, every save re-uploads the entire blob,
and it all counts against the Supabase free-tier 500 MB limit.
**Fix:** Upload files to Supabase Storage buckets and keep only a URL/reference
in the state.

## 2. Split the single state blob into per-record tables
**Now:** All data (funds, requests, disbursements, liquidations, replenishments,
reimbursements, audit log, documents) is saved as ONE JSON blob in one row of
`pcp_state`, with debounced last-write-wins saves (`src/02-helpers.jsx`,
`src/19-app.jsx`, `index.html`).
**Problem:** Two users editing at the same time can silently overwrite each
other's changes.
**Fix:** Normalize into real tables (one row per record) so concurrent writes
don't collide.

### Related: PCF Requestor role is enforced at the CLIENT layer only
The `Requestor` role (see `ROLES` in `src/05-master-data.jsx`, flags in
`src/19-app.jsx`) enforces its permissions in the app UI/logic:
- Petty Cash Requests — full access (no approve/reject/release)
- Release Ledger — view-only (`canEdit` gate in `src/10-disbursements.jsx`)
- Liquidation — full access except approve/reject (`isLiquidationApprover`)
- Per-entity data isolation via existing plant scoping (`allowedPlants`)

Because RLS on `pcp_state` only checks *authenticated* (not role/plant), a
signed-in Requestor could still bypass these limits by calling the Supabase API
directly. **True database/API-level role + entity isolation depends on this
per-record-table refactor** (or an Edge Function that validates every write).
Until then, the Requestor restrictions are UX/workflow controls, not a hard
security boundary.


## 3. Automated Supabase backups + audit-log integrity
**Now:** Backups rely on the in-app snapshot mechanism
(`src/02-helpers.jsx`), and the audit log lives in the same mutable blob a
SuperAdmin could overwrite.
**Fix:** Schedule regular Supabase database exports, and consider storing the
audit trail in an append-only table.

---

_Current verdict: acceptable for a ~10-user internal tool. These are upgrades
for scale/robustness, not blockers._
