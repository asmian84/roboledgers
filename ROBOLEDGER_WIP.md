# RoboLedger — Work In Progress Document
**Last Updated:** February 18, 2026
**Branch:** `hungry-villani`
**Maintainer:** Swift Accounting and Business Solutions Ltd.

---

## Table of Contents

1. [The Vision — What This Actually Is](#1-the-vision)
2. [The Three Tiers](#2-the-three-tiers)
3. [Architecture Diagram — Target State](#3-architecture-diagram)
4. [What Has Been Built — Full History](#4-what-has-been-built)
5. [Current System Inventory — Honest Audit](#5-current-system-inventory)
6. [Technical Debt — What Needs Fixing Now](#6-technical-debt)
7. [What's Missing — Gaps by Priority](#7-whats-missing)
8. [Multi-Client Architecture — The Foundation Decision](#8-multi-client-architecture)
9. [Industry Profiles — Auto-COA Parameterization](#9-industry-profiles)
10. [Reporting Suite — Target State](#10-reporting-suite)
11. [Bank Feed — Live Tier 3 Ingestion](#11-bank-feed)
12. [CRA Integration — The Compliance Layer](#12-cra-integration)
13. [Investment & Crypto Bookkeeping](#13-investment--crypto-bookkeeping)
14. [Collaboration — Client Portal (Tier 2)](#14-collaboration--client-portal)
15. [Export Layer — CaseWare, QBO, Xero](#15-export-layer)
16. [AI Intelligence — The Automation Engine](#16-ai-intelligence)
17. [Prioritized Roadmap — 25 Actionable Points](#17-prioritized-roadmap)
18. [Next Immediate Steps](#18-next-immediate-steps)

---

## 1. The Vision

> **RoboLedger is not accounting software. It is the operating system for accounting firms — with a client portal layer on top.**

You are an accountant at **Swift Accounting and Business Solutions Ltd.** with approximately **400 clients**. The single-entity prototype you're building now is the engine that will power a full multi-client practice management platform.

The automation target is the **Tesla Full Self-Driving standard**: the system drives 95% of the time. The accountant only touches the wheel for edge cases — a transaction that genuinely cannot be categorized, a statement with an unusual format, a ruling that requires professional judgment. Everything else is automated, audited, and traceable to source.

The absolute non-negotiable design principle: **everything flows through COA. No exceptions.** Every transaction, every adjustment, every tax entry, every import goes through the Chart of Accounts. The COA is the single source of truth.

---

## 2. The Three Tiers

### Tier 1 — Accounting Firm Dashboard (Primary — Now)
Your daily driver. 400 clients, each in isolation.

- Drop PDFs/CSVs into a bucket → system auto-detects bank, account type, industry
- AI categorizes everything → COA → reports, instantly
- Navigate: **Client List → Client → Fiscal Year → Account → Transactions → Reports**
- Recategorize with full audit trail (every change linked to source PDF line)
- Export to CaseWare or other downstream tools
- One-time catch-up bookkeeping but permanently accessible historically

**This is what the current build is becoming.** Right now it handles one client. The shell needs to expand to 400.

### Tier 2 — Client Collaboration Portal (Mid-Term)
Accountant invites the client to their own RoboLedger view.

- Client sees their own books — read access by default
- Client can flag transactions, upload receipts, leave annotations
- Accountant maintains full control — client annotates, never overrides
- Fills the gap between "work is being done" and "work is done, now analyze it"
- Accountant pushes finalized reports to client portal with one click
- Client signs off on trial balance / year-end package digitally

### Tier 3 — Client Self-Serve (Long-Term)
Client manages their own bookkeeping live.

- Live bank feed (Plaid / Flinks / Inverite for Canada, Open Banking post Bill C-37)
- Real-time transaction ingestion through the same parser pipeline — but live, not PDF batch
- CRA letter analysis → auto-drafted CRA responses for client review
- Bank-ready ledger packages (matched receipts + statements + tax summaries)
- Eventually: CRA-approved, bank-approved, sealed standard output

---

## 3. Architecture Diagram — Target State

```
RoboLedger Platform
│
├── Firm Layer (accounting practice)
│   ├── Firm settings (province, GST number, practice name)
│   ├── Client Registry (400+ clients, each isolated)
│   └── Firm Dashboard (client list, status, flags, recent activity)
│
├── Client Layer [400x]
│   ├── client_id (UUID, never reused)
│   ├── Industry Profile (drives COA defaults + signal weights)
│   ├── Fiscal Year Manager (multiple years per client)
│   │   ├── FY2022, FY2023, FY2024, FY2025 (each fully independent)
│   │   └── Comparative mode (side-by-side year views)
│   ├── Account Layer [1–11 per client]
│   │   ├── Chequing, Savings, Visa, Mastercard, Amex, LOC, Mortgage...
│   │   └── Statement [multiple per account per year]
│   └── Transaction Layer [n per statement]
│       ├── Raw PDF line → parsed fields
│       ├── COA category (auto + human override)
│       ├── GST/HST classification
│       └── Audit Trail (every change, who, when, why)
│
├── Intelligence Layer
│   ├── SignalFusionEngine (categorization, 9 signals)
│   ├── Industry-parameterized COA mapping
│   ├── Anomaly detection (flags unusual patterns)
│   └── AI Memo generator (narrative for year-end)
│
├── Parser Layer (26 bank PDFs + live feed)
│   ├── 7 RBC variants, 6 BMO, 3 TD, 6 Scotia, 3 CIBC, HSBC, ATB, Amex
│   ├── BaseBankParser (audit parity — parser_ref, statementId, lineNumber)
│   └── [Future] Flinks/Plaid webhook → same pipeline
│
├── Report Layer
│   ├── Trial Balance (CaseWare standard)
│   ├── Income Statement / P&L
│   ├── Balance Sheet
│   ├── General Ledger
│   ├── General Journal
│   ├── COA Summary
│   ├── GST/HST Report (HST-34 ready)
│   ├── [Future] Cash Flow Statement
│   ├── [Future] Bank Reconciliation
│   ├── [Future] AR/AP Aging
│   └── [Future] Budget vs Actual
│
├── Export Layer
│   ├── CaseWare Working Papers (ZIP export)
│   ├── [Future] QuickBooks Online (QBO API)
│   ├── [Future] Xero CSV
│   └── [Future] CRA HST-34 / T4A / T5018
│
└── Client Portal (Tier 2 / Tier 3)
    ├── Client-scoped read view
    ├── Receipt upload / annotation
    └── [Future] Live bank feed ingestion
```

---

## 4. What Has Been Built — Full History

The following is the complete chronological build log, 60+ commits from genesis to today.

### Foundation Phase (v1.0)
- **Initial parser infrastructure**: `BaseBankParser.js` with `buildAuditData()` scaffolding
- **COA engine**: Full Chart of Accounts (`coa.ts`) with root types ASSET / LIABILITY / EQUITY / REVENUE / EXPENSE
- **Signal Fusion Engine v1**: `SignalFusionEngine.js` — multi-signal categorization (description, vendor, amount, merchant patterns)
- **GST system v1**: GST calculation from polarity-based logic, gst_enabled flag, tax_cents per transaction
- **Trial Balance v1**: Direct calculation from ledger, basic debit/credit/balance output

### Parser Coverage (v1.x)
- **24 → 26 parsers**: RBC (4 variants), BMO (6), TD (3), Scotia (6), CIBC (3), HSBC, ATB, Amex
- **Amex audit parity** (`8f63911`): First parser with `parser_ref`, `audit.statementId`, `audit.lineNumber`, `audit.allPdfLines`, `pdfLocation`
- **All 24 parsers: Amex audit parity** (`8f63911`): Applied the full audit structure to every parser — every transaction now has a traceable source reference

### Intelligence Layer (v1.5)
- **Signal Fusion Architecture v2.0** (`d649ea6`): Rebuilt categorization engine with weighted signal fusion — 9 signals including description patterns, merchant name, amount range, account type, GST pattern, temporal patterns
- **Smart 2-line description splitter** (`ea8f01a`): Merchant name extracted from raw bank description, transaction type inferred — human-readable display while preserving raw audit text
- **Refund mirror signal** (`e619542`): Contra-expense routing — credit card refunds/cashback/rebates automatically routed to contra-expense accounts, not revenue
- **CC polarity enforcement** (`6a39f30`): 3-layer fix — credit card charges are never revenue. Enforced at ingestion, categorization, and report levels
- **Retroactive CC refund cleanup** (`d8e6c03`): Recategorization engine that fixes historical misclassifications in-session
- **Context-aware training brain** (`9482052`): SWIFT workpapers training data — real accounting firm corrections feed back into signal weights

### UI & UX Layer
- **Audit Sidebar** (`src/components/AuditSidebar.jsx`): Full audit drawer — parser_ref display, PDF snippet, raw text, "View in PDF" button (DocumentViewer), categorization history, action buttons
- **DocumentViewer** (`src/components/DocumentViewer.jsx`): PDF.js-powered viewer with yellow highlight overlay positioned to the source transaction line
- **FilterToolbar** (`src/components/FilterToolbar.jsx`): Universal filter breadcrumb — category, date, account, text search
- **COADropdown** + **CategoryDropdown**: Searchable category pickers with COA hierarchy
- **Utility Bar full drill-down** (`2c48717`): Every stat row drillable — Transactions, Uncategorized, Needs Review, Money In/Out, Revenue, Expenses. 3-level breadcrumb: `All › Expenses › PETRO-CANADA`
- **Bulk action bar** (`c45f140`, `8b3c92d`): 3 working inline bulk actions — categorize, flag, export selection
- **Grid layout**: `@tanstack/react-table` + `@tanstack/react-virtual` — virtualized, handles 10,000+ rows without performance degradation
- **GST checkbox per row** (`6a29470`): Toggle GST eligibility per transaction inline in grid
- **Account card + switcher** (`13a9b82`): UB top shows active account, switching accounts reloads all drill state

### Reports Suite (`0c46e1b`, expanded)
- **8 report sub-components**: Trial Balance, Income Statement, Balance Sheet, General Ledger, General Journal, COA Summary, Financial Ratios, GST Report
- **Trial Balance hardening** (`d2db216`): QuickBooks PDF parser — dot separator, column detection, hierarchy, name matching
- **TB equity rows + retained earnings synthesis** (`996aff3`): Auto-synthesizes Retained Earnings from P&L carry-forward
- **GST/HST section in Trial Balance** (`06dcb19`): Dedicated GST section with correct accounting treatment (GST Collected vs ITC)
- **GST Report redesign** (`2ec7f86`): Ledger detail view — each GST category shows full transaction list, amounts, drill-down
- **Prior Year Import** (`83d757e`, `ca3ed6a`): CaseWare Working Papers ZIP import — prior year TB figures side-by-side with current
- **Reports hub redesign** (`309240d`): Consistent slim header, card grid, scrollable body, no wall bleed
- **Empty states all reports** (`15c2a3f`): Every report shows "Upload statements to get started" when no data loaded

### Settings & Configuration
- **Province selector** (`c45f140`): AB default, drives GST/HST/PST/QST rates
- **Theme + density + font size** (`b1f0f81`): Working settings drawer — 4 themes, 3 density modes, 3 font sizes
- **Settings drawer constrained** (`2c48717`): Constrained to grid boundary, not full viewport
- **Ghost accounts eliminated** (`49fdb6f`): No empty/phantom accounts appear in UI after re-import

### Infrastructure
- **Caseware ZIP export** (`0985567`): Export current year TB as CaseWare-compatible ZIP
- **Transaction Exporter** (`src/services/TransactionExporter.js`): XLSX and CSV export of any filtered grid selection
- **Home page rebuild** (`cef7cc6`): Real substance, swift.com branding, dashboard metrics
- **Error boundaries** (`src/components/ErrorBoundary.jsx`): React error boundaries around all report components

---

## 5. Current System Inventory — Honest Audit

| Layer | Component | Status | Notes |
|-------|-----------|--------|-------|
| **Parsing** | 26 bank PDF parsers | ✅ Working | All have Amex audit parity |
| **Parsing** | Audit fields (parser_ref, statementId, lineNumber) | ✅ Working | All parsers |
| **Categorization** | SignalFusionEngine (9 signals) | ✅ Working | Real production quality |
| **Categorization** | CC polarity enforcement | ✅ Working | 3-layer guard |
| **Categorization** | Refund/contra-expense routing | ✅ Working | |
| **COA** | Chart of Accounts engine | ✅ Working | Full hierarchy, root types |
| **GST** | Auto-calculation per transaction | ✅ Working | Province-aware |
| **GST** | GST drill-down in UB | ✅ Working | |
| **UI** | Transaction grid (virtualized) | ✅ Working | 10k+ rows |
| **UI** | Audit Sidebar + PDF highlight | ✅ ~85% | Y-coord fix pending |
| **UI** | Utility Bar all drills | ✅ Working | 3-level breadcrumb |
| **UI** | Bulk actions | ✅ Working | 3 actions |
| **Reports** | Trial Balance | ✅ Working | CaseWare standard |
| **Reports** | Income Statement | ✅ Working | |
| **Reports** | Balance Sheet | ✅ Working | |
| **Reports** | General Ledger | ✅ Working | |
| **Reports** | General Journal | ✅ Working | |
| **Reports** | COA Summary | ✅ Working | |
| **Reports** | GST Report | ✅ Working | Full drill-down |
| **Reports** | Financial Ratios | ✅ Working | |
| **Reports** | Cash Flow Statement | ❌ Missing | Direct + indirect method |
| **Reports** | Bank Reconciliation | ❌ Missing | Critical for accuracy |
| **Reports** | AR/AP Aging | ❌ Missing | |
| **Reports** | Budget vs Actual | ❌ Missing | |
| **Export** | CaseWare ZIP | ✅ Working | |
| **Export** | XLSX / CSV | ✅ Working | |
| **Export** | QBO API | ❌ Missing | |
| **Export** | HST-34 filing | ❌ Missing | |
| **Multi-client** | Client isolation | ❌ Not built | Single ledger only |
| **Multi-client** | Client registry / list | ❌ Not built | |
| **Multi-client** | Fiscal year management | ❌ Not built | |
| **Multi-client** | Industry profiles | ❌ Not built | |
| **Persistence** | localStorage (current) | ⚠️ ~5MB ceiling | Session-only, fragile |
| **Persistence** | IndexedDB / SQLite | ❌ Not built | Required for multi-client |
| **Architecture** | TypeScript core (src/core/) | ⚠️ Dead | Not called at runtime |
| **Architecture** | Vanilla JS runtime (app.js, ledger.core.js) | ✅ Live | 4,200-line monolith |
| **Intelligence** | ScoringEngine (TypeScript brain) | ⚠️ Mocked | Returns 0 all dims |
| **Intelligence** | SignalFusionEngine (JS) | ✅ Live | Real scorer |
| **Bank Feed** | Live ingestion (Plaid/Flinks) | ❌ Not built | |
| **CRA** | Letter analysis | ❌ Not built | |
| **CRA** | HST-34 auto-fill | ❌ Not built | |
| **CRA** | T4A / T5018 | ❌ Not built | |
| **Investments** | ACB tracking | ❌ Not built | |
| **Crypto** | On-chain + exchange CSV | ❌ Not built | |
| **Client Portal** | Tier 2 collaboration | ❌ Not built | |
| **Bank Feed** | Tier 3 live ingestion | ❌ Not built | |

---

## 6. Technical Debt — What Needs Fixing Now

### TD-1: Dual-Layer Architecture (Critical)
**Problem:** Two complete parallel implementations exist:
- TypeScript layer: `src/core/` (ledger.ts, coa.ts, ingestion.ts, entity_service.ts) — architecturally correct, never called
- Vanilla JS layer: `ledger.core.js`, `app.js` — 4,200+ lines, what actually runs

**Impact:** Every feature is built twice (or only in one layer, which is wrong). The TS layer has the right abstractions but is dead code.

**Fix:** Decide to either (a) fully commit to TS layer and migrate the JS runtime up, or (b) acknowledge the JS layer is the runtime and delete the TS layer. Option (b) is faster. Option (a) is correct for multi-client.

### TD-2: localStorage Persistence Ceiling (Critical for multi-client)
**Problem:** All client data lives in `localStorage` (~5MB limit). PDF files referenced in pdfLocation are stored as session memory only — lost on browser wipe.

**Fix:** Migrate to **IndexedDB** (50MB+ per origin, persistent, indexed). For multi-client, use **SQLite via WASM** (sql.js or wa-sqlite) — one .db file per client, downloadable, importable.

### TD-3: Monolithic app.js (High)
**Problem:** `app.js` is 4,200+ lines handling UI, state, events, parsing, reporting, everything. Untestable, hard to navigate.

**Fix:** Decompose progressively — extract WorkspaceManager, LedgerController, AccountManager as separate modules. Already started with the React layer.

### TD-4: ScoringEngine is Mocked (Medium)
**Problem:** `src/brain/scoring.ts` returns `0` for all 5 dimensions (identity, memory, context, similarity, anomaly). The real scorer is `SignalFusionEngine.js` but it doesn't use the TS brain interfaces.

**Fix:** Bridge them. Either port SignalFusionEngine to TS, or have scoring.ts call the JS engine via `window.RoboLedger.SignalFusionEngine`.

### TD-5: Dead Dependencies (Low)
- Tabulator CSS referenced but Tabulator not installed
- AG-Grid CSS fragments in some files
- `docling_bridge.py` in parsers_raw — Python bridge to a PDF ML library, not integrated

**Fix:** `npm prune` + clean imports.

### TD-6: PDF Highlight Y-Coordinate Bug (Known)
**Problem:** DocumentViewer.jsx uses `(pdfPageHeight - top - height) * viewport.scale` for Y positioning. Works correctly for bottom-origin PDF coordinates, but needs validation that all parsers store `top` consistently.

**Fix:** Already planned in prior plan document (Part D). Use `page.getViewport({ scale: 1.0 }).height` as the unscaled reference.

---

## 7. What's Missing — Gaps by Priority

### Critical Missing (Blocks real firm use)
1. **Multi-client isolation** — single ledger is not viable at 400 clients
2. **IndexedDB persistence** — localStorage is insufficient for real client data
3. **Cash Flow Statement** — required for any complete financial package
4. **Bank Reconciliation** — required for accuracy verification, CRA audit defence
5. **Period Locking** — prevent modification of finalized periods

### High Priority (Needed for professional output)
6. **Adjusting Journal Entries (AJEs)** — year-end accruals, prepaid amortization, depreciation, etc.
7. **Fiscal Year Management** — proper period open/close, year-end rollover
8. **Industry Profile switching** — one COA profile does not fit all 400 clients
9. **Comparative Reports** — current year vs prior year side-by-side in P&L, BS
10. **CaseWare full export** — full working paper package, not just TB

### Medium Priority (Firm competitive advantage)
11. **HST-34 auto-fill** — CRA HST return auto-populated from GST Report
12. **T4A generation** — contractor payments report
13. **AR/AP Aging** — 30/60/90 day aging buckets
14. **Budget vs Actual** — variance reports
15. **More parsers** — National Bank, Tangerine, EQ Bank, Simplii, Desjardins, Meridian, PC Financial
16. **CFO Dashboard** — burn rate, runway, key ratios at a glance

### Future Big Bets
17. **Investment bookkeeping** — ACB tracking (T1 Schedule 3), capital gains, dividend income
18. **Crypto bookkeeping** — on-chain (wallet CSV), exchange CSV, staking income, DeFi
19. **Live bank feed** — Flinks/Plaid webhook → same parser pipeline, real-time
20. **CRA letter analysis** — AI reads CRA letters, identifies filing type, drafts response
21. **AI Memo / Narrative generator** — year-end letter in plain English from financials
22. **Anomaly detection** — flags unusual patterns (duplicate vendors, amount spikes, new payees)
23. **Client self-serve portal** — Tier 3, client uploads own bank statements
24. **Multi-accountant collaboration** — role-based access within a firm
25. **Accounting firm white-label** — sell as SaaS to other accounting firms

---

## 8. Multi-Client Architecture — The Foundation Decision

### Why This Must Come First
Every feature built after this point depends on `client_id` existing. Reports are scoped to a client. Fiscal years are per-client. Industry profiles are per-client. Without this, everything is bolted onto a single-client system that will need to be torn apart.

### Data Model

```
Firm
  └── id: uuid
  └── name: "Swift Accounting and Business Solutions Ltd."
  └── province: "AB"
  └── gst_number: "123456789RT0001"

Client
  └── id: uuid
  └── firm_id → Firm.id
  └── name: "Canmore Co-Host Inc."
  └── industry: "SHORT_TERM_RENTAL"
  └── province: "AB"
  └── status: "ACTIVE" | "ARCHIVED" | "IN_REVIEW" | "FINALIZED"
  └── fiscal_year_end: "DEC" | "MAR" | "JUN" | "SEP" (CCPC can have non-Dec)
  └── created_at, updated_at

FiscalYear
  └── id: uuid
  └── client_id → Client.id
  └── year: 2024
  └── start_date: 2024-01-01
  └── end_date: 2024-12-31
  └── locked: boolean (prevents changes after finalization)
  └── status: "OPEN" | "IN_REVIEW" | "FINALIZED"

Account
  └── id: uuid
  └── client_id → Client.id
  └── fiscal_year_id → FiscalYear.id
  └── bank: "RBC"
  └── account_type: "CHEQUING"
  └── account_number_masked: "****4567"
  └── currency: "CAD" | "USD"

Statement
  └── id: uuid
  └── account_id → Account.id
  └── statement_id: "RBCCHQ-2024NOV"
  └── period_start, period_end
  └── source_file_name
  └── parsed_at

Transaction
  └── id: uuid
  └── statement_id → Statement.id
  └── account_id → Account.id
  └── client_id → Client.id (denormalized for query speed)
  └── fiscal_year_id → FiscalYear.id (denormalized)
  └── date, description, amount, polarity
  └── category (COA code)
  └── gst_enabled, tax_cents, gst_account
  └── parser_ref, pdfLocation, audit (JSON)
  └── confidence, needs_review
  └── human_overrides (JSON array — every manual change)

AuditEntry
  └── id: uuid
  └── transaction_id → Transaction.id
  └── client_id → Client.id
  └── changed_by: "system" | "accountant@swift.com" | "client@example.com"
  └── changed_at: timestamp
  └── field: "category" | "gst_enabled" | "description"
  └── old_value, new_value
  └── reason (optional note)
```

### Storage Choice: SQLite via WASM (Recommended)

**Why SQLite over PostgreSQL for now:**
- Each client = one `.db` file on disk — portable, exportable, importable
- Runs in-browser via `wa-sqlite` or `sql.js` — zero server infrastructure
- CaseWare-exportable as a file artifact alongside the ZIP
- Schema designed to migrate to Postgres with minimal changes when Tier 2 (multi-user) is needed
- 400 clients × average 50MB per client = 20GB — easily managed on any machine

**Why not PostgreSQL yet:**
- Requires server infrastructure (or Supabase), adds cost and complexity
- Not needed until multiple accountants access the same client simultaneously (Tier 2)
- Migration from SQLite to Postgres is a known, documented process

**Migration path:** SQLite → Postgres happens when:
- A second accountant needs to access a client at the same time, OR
- Client live bank feed (Tier 3) requires server-side webhook receiver

### Client Registry UI

**Firm Dashboard** (new top-level page replacing current single-entity home):
```
┌────────────────────────────────────────────────────────────┐
│  Swift Accounting — Client Registry           + New Client  │
│                                                             │
│  [Search clients...]   [Filter: Status ▼] [Industry ▼]     │
│                                                             │
│  ● Canmore Co-Host Inc.        Short-term rental  IN_REVIEW │
│    FY2024 · 3 accounts · 847 transactions · GST filed       │
│                                                             │
│  ● Dr. Smith Consulting Ltd.   Medical/Professional OPEN    │
│    FY2024 · 2 accounts · 124 transactions · 0 flags         │
│                                                             │
│  ○ Johnson Grocery Ltd.        Retail           FINALIZED   │
│    FY2023 · 5 accounts · 3,247 transactions · Exported      │
│  ...                                                        │
└────────────────────────────────────────────────────────────┘
```

---

## 9. Industry Profiles — Auto-COA Parameterization

Different industries have fundamentally different COA structures and signal weights. A grocery store and a consultant cannot share the same default category mappings.

### Industries to Support (Phase 1)

| Code | Industry | COA Profile Differences | Key Signals |
|------|----------|------------------------|-------------|
| `SHORT_TERM_RENTAL` | Airbnb/VRBO co-host | Rental income, cleaning, linens, platform fees, utilities | Airbnb/VRBO in description |
| `PROFESSIONAL_SERVICES` | Consultant/Lawyer/Engineer | T4A income, meals/travel/home office, professional dues | Invoice #, consulting |
| `MEDICAL_PROFESSIONAL` | Doctor/Dentist (contractor) | Professional corp income, malpractice, CME, equipment | College, CMPA, Medavie |
| `RETAIL` | Grocery/Convenience | COGS, inventory, supplier payables, POS systems | Sysco, GFS, food suppliers |
| `CONSTRUCTION` | GC/Sub-contractor | Progress billing, holdbacks (CCA 10%), equipment | Subtrade, progress, holdback |
| `RESTAURANT` | Food service | COGS (35-40%), liquor, staff meals, health inspections | Food suppliers, OpenTable |
| `REAL_ESTATE` | Property investor | Rental income, mortgage interest, property tax, depreciation | Mortgage, property tax |
| `E_COMMERCE` | Online seller | Platform fees (Amazon/Shopify), fulfillment, returns | Amazon, Shopify, Canada Post |
| `GOVERNMENT_CONTRACTOR` | Federal/Provincial work | Holdbacks, progress claims, PWGSC vendors | PWGSC, federal departments |

### Profile Format
```js
const INDUSTRY_PROFILES = {
  SHORT_TERM_RENTAL: {
    defaultCOA: {
      revenue: { code: '4100', name: 'Rental Income — Short Term' },
      platformFees: { code: '5400', name: 'Platform Fees (Airbnb/VRBO)' },
      cleaning: { code: '5410', name: 'Cleaning & Laundry' },
      utilities: { code: '5210', name: 'Utilities — Rental Property' },
    },
    signalBoosts: {
      'AIRBNB': { category: '4100', weight: 0.95 },
      'VRBO': { category: '4100', weight: 0.95 },
      'CLEANING': { category: '5410', weight: 0.85 },
    },
    gstRegistered: true,  // STR operators must register if >$30k
    t4aRequired: false,
    hstApplicable: true,
  }
  // ... etc
};
```

---

## 10. Reporting Suite — Target State

### Already Working ✅
| Report | Standard | Notes |
|--------|----------|-------|
| Trial Balance | CaseWare standard | Prior year comparison, equity synthesis |
| Income Statement | GAAP | Revenue - Expenses = Net Income |
| Balance Sheet | GAAP | Assets = Liabilities + Equity |
| General Ledger | Standard | Per-account transaction detail |
| General Journal | Standard | All entries chronological |
| COA Summary | Internal | Category breakdown |
| GST Report | CRA HST-34 | Full drill-down, collected/ITC/net |
| Financial Ratios | Internal | Current ratio, quick ratio, etc. |

### Needs to Be Built ❌

**Cash Flow Statement** (Direct + Indirect method)
- Operating activities: Net income ± working capital changes
- Investing activities: Asset purchases/sales
- Financing activities: Loan proceeds/repayments, dividends
- Required for any complete financial package

**Bank Reconciliation**
- Side-by-side: book balance vs bank statement balance
- Outstanding cheques, deposits in transit, bank errors
- Required for audit defence — proves every dollar is accounted for

**Adjusting Journal Entries (AJE) module**
- Prepaid expense amortization (insurance, rent)
- Accrued liabilities (wages payable at year-end)
- Depreciation (straight-line, declining balance — CCA classes)
- Deferred revenue
- Each AJE goes through COA with full audit trail

**Comparative Reports**
- Current year vs prior year side-by-side in P&L and Balance Sheet
- Variance: $ amount and % change
- Prior year data imported from CaseWare TB (already started)

**AR/AP Aging Report**
- Outstanding invoices by age bucket: Current, 30, 60, 90+ days
- Requires AR/AP transaction tagging

**Budget vs Actual**
- Import budget from spreadsheet (or enter manually)
- Variance report: actual vs budget per category per period

---

## 11. Bank Feed — Live Tier 3 Ingestion

### Architecture
The PDF parsers you've built are the offline fallback. The live feed is the same pipeline, run in real-time.

**Canadian Open Banking Options:**
- **Flinks** (Montreal) — Canada's leading open banking aggregator, covers all 26+ banks
- **Inverite** — Alternative, also Canadian
- **Plaid** — US-first but expanding in Canada (pending Open Banking regulatory clarity)
- **Bill C-37** (enacted 2024) — Canada's open banking framework, fully live ~2026

**Integration Flow:**
```
Bank Feed (Flinks webhook)
  → /api/feed/transaction (new server endpoint)
  → Same BaseBankParser pipeline (feed mode, not PDF mode)
  → Same SignalFusionEngine categorization
  → Same COA mapping
  → Transaction stored in client's SQLite DB
  → Real-time UB update via WebSocket or polling
```

**PDF vs Feed modes in BaseBankParser:**
```js
class BaseBankParser {
  parseFromPDF(pdfText, metadata) { ... }   // existing
  parseFromFeed(feedTransaction) { ... }     // new — maps Flinks fields to same schema
}
```

The key insight: **the categorization brain doesn't care whether the transaction came from a PDF or a live feed.** Same signals, same COA mapping, same output schema.

---

## 12. CRA Integration — The Compliance Layer

### HST-34 Auto-Fill
- From the GST Report (already built), auto-populate HST-34 quarterly/annual return
- Line 101 (Sales) = Total revenue (COA 4xxx)
- Line 105 (GST/HST collected) = GST Collected (COA 2160)
- Line 106 (ITC claimed) = GST Paid (COA 2150)
- Line 109 (Net tax remittable) = 2160 - 2150
- Export as CRA-compatible XML or printable PDF

### T4A Generation
- Any payment to an unincorporated contractor >$500/year
- Already trackable: flag vendor as "T4A recipient" in COA/vendor settings
- Generate T4A slips (Box 020) at year-end

### T5018 (Construction Subcontractors)
- Required for construction industry clients
- Same mechanism as T4A — contractor payments, annual reporting

### CRA Letter Analysis (AI)
- User uploads a scanned CRA letter (PDF)
- System identifies: audit request, reassessment, instalment reminder, HST query
- Extracts: client name, SIN/BN, tax year in question, amounts, deadline
- Drafts response template using client's financials
- Flags: "This looks like an HST audit for 2022-2023. Your GST Report shows $X collected, $Y ITC. Draft response attached."

---

## 13. Investment & Crypto Bookkeeping

### Investment Bookkeeping (ACB Tracking)

**Adjusted Cost Base (ACB)** is Canada's method for calculating capital gains on securities. Every purchase, DRIP, return of capital, and sale affects the ACB.

Required calculations:
- **ACB per share** = Total cost ÷ Total shares held
- **Capital gain** = Proceeds - (ACB × shares sold) - commissions
- **T1 Schedule 3** = Annual capital gains summary
- **RRSP/TFSA awareness** — gains inside registered accounts are not reported

Parser targets:
- TD Waterhouse/Direct Investing (statement CSV + trade confirmations)
- RBC Direct Investing
- Questrade (CSV export — already well-structured)
- Interactive Brokers (Activity Report CSV)
- Wealthsimple (transaction history CSV)

### Crypto Bookkeeping

Canada treats crypto as **property** (CRA 2022 guidance) — every disposition is a taxable event.

**What needs tracking:**
- **Acquisition:** Date, cost in CAD, exchange rate at acquisition
- **Disposition:** Date, proceeds in CAD, ACB at time of sale → capital gain/loss
- **Mining income:** Fair market value at time of receipt → income (T1 line 13000)
- **Staking income:** Same as mining — income, not capital gain at receipt
- **DeFi:** Swaps are dispositions (coin A sold for CAD, then CAD used to buy coin B)
- **NFT sales:** Capital gain or business income depending on frequency

**Parser sources:**
- Coinbase, Kraken, Binance, Bitbuy, Newton — CSV export
- On-chain (Etherscan/Solscan) — wallet transaction history
- Koinly/CoinLedger compatible import (they already parse, export as gain/loss CSV)

**COA additions for crypto:**
- `1300 — Digital Assets (Bitcoin)`
- `1310 — Digital Assets (Ethereum)`
- `4900 — Staking/Mining Income`
- `8100 — Capital Gain on Crypto Disposition`

---

## 14. Collaboration — Client Portal (Tier 2)

### What It Looks Like for the Client

```
┌─────────────────────────────────────────────────────────────┐
│  [Swift Logo]  Your Books — Canmore Co-Host Inc.   [Help]   │
│                                                             │
│  Your 2024 financials are in review.                        │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Revenue         │  │ Expenses        │                  │
│  │ $124,350        │  │ $87,240         │                  │
│  │ ↑ 12% vs 2023   │  │ ↑ 8% vs 2023    │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ⚠ 3 transactions flagged — your input needed              │
│  [Review flagged items]                                     │
│                                                             │
│  Receipts uploaded: 47 of 52 requested                      │
│  [Upload missing receipts]                                  │
└─────────────────────────────────────────────────────────────┘
```

### Access Control
- **Accountant:** Full read/write — all clients, all periods
- **Client:** Read-only for their own data — sees P&L, BS, GST summary
- **Client (annotate):** Can flag items, upload receipts, add notes — cannot change categories
- **Client (approve):** Signs off on finalized year-end package (digital signature)

### Technology
- Authentication: Email magic link (Tier 2 requires server) or client-scoped JWT
- For now: share a read-only export (JSON + PDF) instead of live portal
- Full portal requires a server (Supabase or self-hosted)

---

## 15. Export Layer — CaseWare, QBO, Xero

### CaseWare (Already Partial)
- **Current:** ZIP export of Trial Balance in CaseWare Working Papers format
- **Needed:** Full working paper package — TB + JE detail + AJE + financial statements + notes

### QuickBooks Online (QBO)
- QBO import format: IIF (legacy) or QBO Web Connector (QBWC)
- More practical: export to QBO-compatible CSV, then import via QBO's bank feed import
- Full API integration (QBO REST API) requires OAuth — significant work but high value

### Xero
- Xero accepts bank statement CSV in specific format (Date, Description, Amount, Running Balance)
- Straightforward — our Transaction Exporter already produces this structure
- With Xero's API (OAuth), can push transactions directly to the client's Xero account

### CRA Electronic Filing
- **HST-34:** CRA's NETFILE for HST accepts XML (GIFI format)
- **T4A slips:** CRA's XML submission format (T4A-XML)
- This is a regulated filing — requires CRA transmitter number for automated submission

---

## 16. AI Intelligence — The Automation Engine

### What's Already Working
- **SignalFusionEngine:** 9-signal weighted categorization — works well for common transactions
- **Smart 2-line splitter:** Merchant name + transaction type from raw bank description
- **Refund mirror signal:** Contra-expense routing for credit card refunds
- **Training brain:** SWIFT workpapers corrections feed back into signal weights

### What Should Be Built

**Anomaly Detection**
- Duplicate transaction alert (same amount, same vendor, within 7 days)
- New payee alert (vendor never seen before, high amount)
- Amount spike alert (transaction 3× higher than 90-day average for this category)
- GST inconsistency (vendor normally GST-exempt but filed GST this time)

**AI Memo / Narrative Generator**
- Input: Final P&L, Balance Sheet, key ratios
- Output: 2-3 paragraph plain-English summary
- "Revenue increased 12% year-over-year driven by growth in short-term rental income. Operating expenses increased 8%, primarily due to higher platform fees and cleaning costs. Net income was $37,110, representing a 25% margin."
- CPA review before sending to client — AI drafts, human approves

**Vendor Intelligence**
- `VendorMatcher.js` + `VendorNormalizer.js` are already built
- Extend: build a shared vendor database across all clients at the firm level
- "PETRO-CANADA #1234" → always maps to code 5800 (Fuel & Oil) unless overridden
- Firm-level vendor rules override individual client rules

**Industry Detection**
- On first import, analyze vendor list to infer industry
- "I see Amazon, Shopify, Canada Post — this looks like an e-commerce client"
- Prompt accountant to confirm before applying industry profile

---

## 17. Prioritized Roadmap — 25 Actionable Points

### 🔴 Immediate (Next 2 Weeks) — Foundational

**1. Multi-client shell — Client Registry**
Build the firm dashboard: client list, create/select/archive client, each client gets an isolated ledger context. Navigation: Firm Dashboard → Client → FY → Account → Transactions.

**2. Scoped ledger per client**
All transactions, accounts, statements tagged to `client_id`. All queries filtered by active client. No data bleeds between clients. This is the single most important architectural change.

**3. IndexedDB persistence (replace localStorage)**
Migrate all ledger state to IndexedDB. 50MB+ per origin, persistent across sessions, supports binary data for PDF blobs. Required before onboarding any real client data.

**4. Fiscal year management UI**
Per client: open a new FY, set start/end dates, view/switch between years. FY-scoped reports. Year-end rollover (retained earnings carry forward).

**5. Industry profile selection**
On client creation: pick industry from list. Industry drives: default COA mappings, signal boost table, GST applicability, T4A requirement flag.

**6. Period locking**
Finalize a fiscal year → lock it. No changes to locked periods. Required for professional accounting standards.

### 🟠 Short-Term (1–2 Months) — Professional Output

**7. Cash Flow Statement**
Indirect method: Net Income ± operating working capital changes ± investing ± financing. All flows from existing COA categorization. Required for complete financial package.

**8. Bank Reconciliation module**
Side-by-side reconciliation: book balance vs bank statement closing balance. Outstanding items list. Reconciliation sign-off with timestamp. Audit-defensible proof.

**9. Adjusting Journal Entries (AJE)**
AJE entry screen: Dr/Cr with COA picker, date, memo, supporting document attach. All AJEs appear in Trial Balance. Reversal option for the following period.

**10. Comparative reports**
Side-by-side current vs prior year in P&L and Balance Sheet. Variance in $ and %. Prior year data from imported CaseWare TB (already partially built).

**11. CaseWare full working paper export**
TB + JE + AJE + Financial Statements + Notes to Financial Statements in CaseWare-compatible format. Package download as ZIP.

**12. More bank parsers**
Priority order: National Bank (6th major bank), Tangerine (ING-based, popular with clients), Simplii (CIBC subsidiary), EQ Bank (growing SMB presence), Desjardins (Quebec clients).

### 🟡 Medium-Term (3–6 Months) — Firm Competitive Advantage

**13. HST-34 auto-fill**
From GST Report → auto-populate CRA HST-34 fields. Export as printable PDF or CRA NETFILE XML. Quarterly + annual filing support.

**14. T4A generation**
Flag vendors as T4A recipients. Year-end T4A slips generated automatically. CRA XML export format.

**15. AR/AP Aging Report**
30/60/90+ day aging buckets. Outstanding balance by vendor/customer. Integration with COA receivable/payable accounts.

**16. Budget vs Actual**
Import budget from Excel or enter manually per COA account per period. Variance report: actual vs budget, $ and %, by month. Required for management reporting.

**17. CFO Dashboard per client**
Burn rate, runway (months of cash at current burn), quick ratio, current ratio, DSO, DPO. At-a-glance health indicators. Printable one-pager for client meetings.

**18. Anomaly detection**
Duplicate transaction alerts, new-payee high-value alerts, amount spike alerts, GST inconsistency flags. All surfaced in the Utility Bar "Needs Review" drill.

**19. Vendor intelligence (firm-level)**
Shared vendor → COA mapping database across all clients at the firm level. Firm-wide rules override client-level rules. Significantly improves first-import accuracy.

### 🟢 Long-Term (6–18 Months) — Platform Scale

**20. Client portal (Tier 2)**
Read-only client view with annotation, receipt upload, flagging. Email magic link authentication. Accountant pushes finalized reports to client portal.

**21. Investment bookkeeping (ACB)**
T1 Schedule 3 capital gains tracking. Questrade/Wealthsimple CSV parsers. DRIP handling. RRSP/TFSA awareness. Annual ACB report per security.

**22. Crypto bookkeeping**
Coinbase/Kraken/Bitbuy/Newton CSV parsers. On-chain wallet history (Etherscan API). ACB per coin. Staking income classification. Annual crypto gain/loss report.

**23. Live bank feed (Tier 3)**
Flinks/Inverite Canadian bank feed API. Webhook receiver → same parser pipeline. Real-time categorization. WebSocket push to UI. First client: your own firm's operating account.

**24. CRA letter analysis**
PDF upload of CRA letter → AI identifies type, extracts key figures, cross-references client's ledger, drafts response. Accountant reviews and sends. High-value differentiator.

**25. AI memo / narrative generator**
Year-end plain-English financial summary. Inputs: final P&L + BS + ratios. Output: 2-3 paragraph narrative for client letter. Accountant edits and signs. CPD-quality output.

---

## 18. Next Immediate Steps

The first thing to build is the **multi-client shell** because it is the foundation everything else sits on. Here is the exact order:

1. **Design the client data schema** (client, fiscal_year, account, statement, transaction — all with client_id)
2. **Build IndexedDB persistence layer** — replace localStorage with a proper database abstraction
3. **Build Client Registry UI** — firm dashboard with client list, create client, select client
4. **Scope the existing ledger to `active_client_id`** — all queries, all reports, filtered by active client
5. **Add Fiscal Year selector** per client — drives date filtering for all reports
6. **Add industry profile on client creation** — sets default COA weights
7. **Migrate existing single-client data** to first client slot automatically (don't lose current work)

Once these 7 steps are complete, the existing engine (parsers, categorization, reports, audit trail) slots directly into the multi-client shell with minimal changes — because the intelligence layer is already client-agnostic. It just needs `client_id` passed through.

---

## Closing Note

RoboLedger today is a **highly capable single-client accounting engine** with professional-grade PDF parsing, AI categorization, audit trail, and reports. The quality of what exists is genuinely impressive for this stage of development.

The gap is not in the intelligence — the gap is in the **shell**: the infrastructure that takes this engine and deploys it across 400 clients, each isolated, each with their own fiscal years, each with an industry-appropriate COA profile.

That shell is the next thing to build. When it exists, RoboLedger becomes what you described: the operating system for an accounting firm.

Everything else on this list — HST-34, CRA letters, crypto, bank feeds, client portal — is powerful, but all of it lives inside the client shell. Build the shell first.

---

*Document generated: February 18, 2026*
*Build: `hungry-villani` branch · 60 commits · 26 parsers · 8 reports · 1 client (for now)*
