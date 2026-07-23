# PCF Portal — Source Map & Troubleshooting Guide

The Petty Cash Fund (PCF) Portal is a **single-page React app with NO build step**.
It runs directly in the browser: `index.html` loads Babel + an importmap, then a
small loader stitches the files in this `src/` folder together, transpiles them
once, and runs the result as one ES module.

> The whole app is still **one program** — these files are just slices of it,
> sharing one scope. Editing `src/08-dashboard.jsx` is exactly like editing that
> section of the old single file.

---

## How it loads (the important part)

1. `index.html` lists every fragment in **`window.PCP_SRC_FILES`** (in order).
2. The inline loader `fetch()`es each file, joins them with the order preserved,
   and calls `Babel.transform(...)` on the combined code.
3. The transpiled code is run via a Blob + dynamic `import()`, so the importmap
   (react, react-dom, recharts, xlsx, lucide-react) still resolves.

**Order matters.** Later files depend on things defined in earlier files. Do not
reorder `PCP_SRC_FILES`. If you add a new file, insert it in the right place.

---

## File map

| File | Contents |
|------|----------|
| `01-imports.jsx` | The `import` lines (React, recharts, xlsx, lucide-react). **Keep all imports here only** — importing the same thing twice is a syntax error. |
| `02-helpers.jsx` | Formatting/date helpers, seed data, derived-metric functions (`computeMetrics`, `monitoringForFund`, `liqStatusFor`, …). |
| `03-report-engine.jsx` | The Report Center engine: `money()`, `REPORT_TYPES`, `buildReport()`, Excel/CSV/print builders, `printReportDocument()`. |
| `04-acumatica-export.jsx` | Acumatica "Purchase Orders Template" export columns/logic. |
| `05-master-data.jsx` | `BRANCHES`, `COMPANIES`, `PLANTS`, `SUBACCOUNTS`, `TAX_CATEGORIES`, `EXPENSE_CATEGORIES`, account map, user `ROLES` / access resolution. |
| `06-logos.jsx` | The two embedded base64 logos only (`LOGO_SPI`, `LOGO_A1`). Isolated so the other files stay readable. |
| `07-styles.jsx` | The global `CSS` string and the navigation constants. |
| `08-dashboard.jsx` | Dashboard screen + KPI cards. |
| `09-requests.jsx` | Petty Cash Requests screen. |
| `10-disbursements.jsx` | Release Ledger / Disbursements screen. |
| `11-liquidation.jsx` | Liquidation worksheet screen. |
| `12-masterdata-tab.jsx` | Funds & Master Data admin screen. |
| `13-reports-aging.jsx` | Edit-balances modal, liquidation-aging engine + Liquidation Aging screen. |
| `14-report-center.jsx` | `ManagementReportTab` — the print-ready Report Center screen. |
| `15-replenishment.jsx` | Replenishment screen. |
| `16-history.jsx` | Transaction History screen. |
| `17-audit.jsx` | Audit Trail screen. |
| `18-account-admin.jsx` | User management + system settings screens. |
| `19-app.jsx` | The main `App` component (state, storage, navigation, wiring). |
| `20-auth-gate.jsx` | Sign-in gate / local + Supabase auth. |
| `21-root-mount.jsx` | `Root` component + `createRoot(...).render(...)`. |

---

## Making a change

1. Edit the relevant `src/…jsx` file.
2. Bump **`window.PCP_SRC_VERSION`** in `index.html` (e.g. `20260723a` → `20260723b`).
   This busts the browser cache so users get the new code.
3. Deploy the **whole `src/` folder together with `index.html`**.

---

## Troubleshooting

**Blank page / "failed to load" box.**
- Confirm every file in `PCP_SRC_FILES` was uploaded and the paths match
  (case-sensitive on most servers). The error box names the missing file.
- Hard-refresh: **Ctrl+F5**.

**My change isn't showing.**
- You forgot to bump `PCP_SRC_VERSION`. Bump it and hard-refresh.

**"Transpile error: …" in the box / console.**
- A syntax error in one of the fragments. The message usually points near the
  problem. Remember the files are concatenated, so a stray unclosed brace in an
  early file can surface as an error "later".

**"Duplicate declaration React" / import errors.**
- All `import` statements must live in `01-imports.jsx` only.

**Reports don't print / "allow pop-ups".**
- The Report Center opens the print/PDF view in a new window. Allow pop-ups for
  the site.

**Report logo missing.**
- `SPI PAPER LOGO.png` must be deployed next to `index.html`.

**Data not shared between devices.**
- That's Supabase config in `index.html` (`PCP_SUPABASE_URL` / `..._ANON_KEY`),
  independent of this split.

---

## Reverting to a single file (if ever needed)

The original monolithic `PettyCashPortal.jsx` in the project root is left
untouched as a backup. To go back, replace the loader `<script>` in `index.html`
with the original tag:

```html
<script type="text/babel" data-type="module" data-presets="react" src="PettyCashPortal.jsx?v=1"></script>
```
