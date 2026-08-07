# Petty Cash Fund (PCF) Portal

A web-based **Petty Cash Management System** for tracking petty cash funds across
multiple companies, plants, and branches. It handles the full petty cash
lifecycle — requests, disbursements, liquidation, replenishment, aging, and
management reporting — with role-based access and an optional shared cloud
database.

## Purpose

The portal replaces spreadsheet-based petty cash tracking with a single,
auditable app that lets custodians, accounting, and finance:

- **Request** petty cash and track approvals.
- **Disburse** funds and maintain a release ledger.
- **Liquidate** expenses against issued funds.
- **Replenish** funds back to their float amount.
- **Monitor aging** of unliquidated balances.
- **Generate print-ready management reports** and export to Excel/CSV.
- **Export** to an Acumatica "Purchase Orders Template".
- **Audit** every action via a full audit trail.

Each user only sees the plants they are authorized for (role-based access
control), so custodians see their own funds while Accounting/Finance see
everything.

## Key Features

- **Dashboard** with KPI cards and fund monitoring.
- **Master data** management for branches, companies, plants, sub-accounts,
  tax and expense categories.
- **Report Center** with print/PDF output and Excel/CSV builders.
- **Liquidation aging** engine with editable balances.
- **Transaction history** and **audit trail**.
- **User administration** and system settings.

## How It Works

This is a **single-page React app with no build step**. It runs directly in the
browser:

1. `index.html` loads Babel Standalone and an importmap (react, react-dom,
   recharts, xlsx, lucide-react).
2. A small inline loader fetches the ordered fragments listed in
   `window.PCP_SRC_FILES`, concatenates them, transpiles once with Babel, and
   runs the result as one ES module.

The app in [`src/`](src/) is split into ordered fragments that all share one
scope — see [src/README.md](src/README.md) for the full file map and
troubleshooting guide.

## Tech Stack

- **React 18** (in-browser, via esm.sh) — no bundler, no `npm install`.
- **Recharts** for charts.
- **SheetJS (xlsx)** for Excel/CSV export.
- **lucide-react** for icons.
- **Supabase** (optional) for shared, authenticated cloud storage.

## Data Storage & Login

By default the app stores data in the **browser only** (`localStorage`) with no
login.

To share **one secured database** across all devices/users (works on GitHub
Pages — no server required), configure Supabase in `index.html`:

1. Create a free project at [supabase.com](https://supabase.com).
2. Create the `pcp_state` table with authenticated-only Row Level Security
   policies.
3. In **Authentication → Providers**, turn off public sign-up, then add your
   users manually.
4. Copy the Project URL and the `anon public` key into
   `window.PCP_SUPABASE_URL` and `window.PCP_SUPABASE_ANON_KEY`.

When configured, the app shows a login screen and only signed-in users can read
or write. The anon key is safe to commit because it is protected by Row Level
Security.

## Running Locally

No build required. Serve the folder with any static web server, for example:

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .
```

Then open `http://localhost:8000` in your browser.

> Opening `index.html` directly via `file://` may fail because the loader uses
> `fetch()`; use a local static server instead.

## Deployment

Deploy the whole [`src/`](src/) folder together with `index.html` (and
`SPI PAPER LOGO.png` next to `index.html`). It is compatible with static hosts
such as GitHub Pages.

When you change a `src/*.jsx` file, bump `window.PCP_SRC_VERSION` in `index.html`
to bust the browser cache.

## Project Structure

```
index.html            # Loader, importmap, Supabase + access config
src/                  # App source, split into ordered fragments (see src/README.md)
PettyCashPortal.jsx   # Original monolithic version (kept as a backup)
```

See [src/README.md](src/README.md) for the detailed source map, change workflow,
and troubleshooting.
