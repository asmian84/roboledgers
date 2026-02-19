# RoboLedger — Mega Game Plan
**Last Updated:** February 19, 2026
**Branch:** `hungry-villani`
**Firm:** Swift Accounting and Business Solutions Ltd.
**Scale target:** 400 clients → multi-firm SaaS
**Source:** Merged from original Mega Game Plan + Antigravity SDLC review

---

## Table of Contents

1. [The Vision](#1-the-vision)
2. [The Three Tiers — Platform Architecture](#2-the-three-tiers)
3. [What Has Been Built — Phase 0](#3-what-has-been-built)
4. [Unified Roadmap — 5 Phases](#4-unified-roadmap)
5. [Release Strategy](#5-release-strategy)
6. [Technical Debt Register](#6-technical-debt-register)
7. [Multi-Client Architecture](#7-multi-client-architecture)
8. [Industry Profiles](#8-industry-profiles)
9. [Reporting Suite — Target State](#9-reporting-suite)
10. [CRA Integration Layer](#10-cra-integration)
11. [Bank Feed — Live Ingestion](#11-bank-feed)
12. [Investment & Crypto](#12-investment--crypto)
13. [AI Intelligence Layer](#13-ai-intelligence)
14. [Client Portal — Tier 2](#14-client-portal)
15. [Export Layer](#15-export-layer)

---

## 1. The Vision

> **RoboLedger is not accounting software. It is the operating system for accounting firms — with a client portal layer on top.**

**Who:** Accountant at Swift Accounting and Business Solutions Ltd. — ~400 clients, single entity is the prototype engine.

**Automation target:** Tesla Full Self-Driving standard. The system drives 95% of the time. The accountant touches the wheel only for edge cases — a transaction that cannot be categorized, an unusual statement format, a judgment call. Everything else is automated, audited, and traceable to source.

**Non-negotiable design principle:** Everything flows through COA. No exceptions. Every transaction, adjustment, tax entry, and journal entry goes through the Chart of Accounts. The COA is the single source of truth.

**End state:** CRA-approved, bank-approved, sealed standard. A ledger package that needs no explanation to any auditor.

---

## 2. The Three Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROBOLEDGER PLATFORM                                 │
│                                                                             │
│  TIER 1 ──────── ACCOUNTING FIRM DASHBOARD ──────────────────── [NOW]      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Drop PDFs/CSVs → Auto-detect bank → Categorize → COA → Reports     │   │
│  │  400 clients · each isolated · CaseWare export · CRA compliance      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TIER 2 ──────── CLIENT COLLABORATION PORTAL ─────────────── [MID-TERM]    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Client sees their books · flags transactions · uploads receipts     │   │
│  │  Accountant controls · client annotates but never overrides          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TIER 3 ──────── CLIENT SELF-SERVE ────────────────────────── [LONG-TERM]  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Live bank feed (Flinks/Open Banking) · CRA letter analysis          │   │
│  │  Real-time bookkeeping · bank-ready ledger packages                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. What Has Been Built — Phase 0

Everything below is **complete and in production** as of February 2026.

### Parser Infrastructure
| Component | Notes |
|-----------|-------|
| 26 bank PDF parsers | RBC (4), BMO (6), TD (3), Scotia (6), CIBC (3), HSBC, ATB, Amex |
| Amex audit parity — all parsers | parser_ref, statementId, lineNumber, pdfLocation, audit.rawText on every tx |
| BaseBankParser + buildAuditData | Foundation shared by all 26 parsers |

### Categorization Engine
| Component | Notes |
|-----------|-------|
| SignalFusion Engine (9-signal) | Weighted: vendor type, CC polarity, refund mirror, amount bracket, frequency |
| CategorizationEngine 3-layer | VENDOR_PATTERNS → ROUTING_TABLE → ACCOUNT_GUARDS |
| ATM withdrawal routing | → 9970 with ATM_OWNER_DRAW flag for accountant to split |
| CC polarity enforcement | 3-layer guard — CC charges never routed to revenue |
| Refund / contra-expense routing | Auto-routes CC refunds/cashback to mirror original purchase account |
| Training brain | SWIFT workpapers corrections feed back into signal weights |

### COA + GST
| Component | Notes |
|-----------|-------|
| COA engine | Full ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE hierarchy, GIFI code mapping |
| GST auto-calculation | Province-aware (AB 5%, BC 12%, ON 13%, QC 14.975%) |
| GST per transaction | gst_enabled toggle, tax_cents, gst_account routing |

### UI
| Component | Notes |
|-----------|-------|
| Transaction grid (TanStack) | Virtualized, 10k+ rows, inline edit, bulk actions, filter toolbar |
| Utility bar drill-down | 3-level: All › Category › Payee — all stat tiles drillable |
| Audit sidebar + PDF viewer | parser_ref trace, raw text, PDF highlight, account metadata, GST drill |
| Bulk action bar | Recategorize, toggle GST, flag for review |
| Settings drawer | Theme/density/font, province selector, GST config |

### Reports Suite
| Report | Notes |
|--------|-------|
| Trial Balance | CaseWare standard, prior year compare, equity synthesis, GST section |
| Income Statement | GAAP |
| Balance Sheet | GAAP |
| General Ledger | Per-account, net amount column, running balance |
| General Journal | Chronological, net signed amount (credits red) |
| COA Summary | Category breakdown with counts |
| GST Report | Full drill-down, collected/ITC/net, CRA-format |
| Financial Ratios | Current ratio, quick ratio, debt-to-equity |

### Export
| Export | Status |
|--------|--------|
| CaseWare ZIP | ✅ Working |
| XLSX / CSV | ✅ Working |

---

## 4. Unified Roadmap — 5 Phases

> **Merged from:** Original Mega Game Plan (Feb 2026) + Antigravity SDLC review.
> Key additions from Antigravity: **stabilization gate** (Phase 1), FX/USD support, undo/redo, backup/restore, import merge, duplicate detection, onboarding, QA gate, staged release strategy.

---

### 🚨 Phase 1 — Stabilization (Weeks 1–2)
**Gate: All blockers resolved before any new feature work begins.**

| # | Item | Priority |
|---|------|----------|
| 1 | **Grid disappears on account switch** — TanStack grid loses DOM node on account switcher change. Must re-init cleanly. Priority #1. | 🔴 Blocker |
| 2 | **ALL mode account metadata broken** — 2-line description + masked card number display incorrectly in aggregated view. | 🔴 Blocker |
| 3 | **Balance calculation verification** — Audit aggregate math: running balance, account totals, reconciliation check. Grid / utility bar / reports must all agree. | 🔴 Blocker |
| 4 | **Grid persistence on page refresh** — Loaded transactions must survive full page refresh via localStorage recovery. Currently inconsistent. | 🔴 Blocker |

---

### 🏗️ Phase 2 — Multi-Client Core (Weeks 3–8)
**Gate: Alpha release — internal use only.**

| # | Item | Priority |
|---|------|----------|
| 1 | **Client Registry — Multi-Client Shell** — Firm dashboard, client list, create/select/archive. Navigation: Firm → Client → FY → Account → Transactions. Foundation everything else sits on. | 🔴 Critical |
| 2 | **Scoped ledger per client (client_id everywhere)** — All queries, reports, statements filtered by active client. Zero data bleed between clients. Single most important architectural change. | 🔴 Critical |
| 3 | **IndexedDB persistence (replace localStorage)** — 50MB+/origin, survives browser wipe, binary PDF blob support. SQLite via WASM (wa-sqlite) — one .db file per client. | 🔴 Critical |
| 4 | **Fiscal year management UI** — Per client: open FY, set dates, switch years, year-end retained earnings rollover. FY-scoped reports. | 🔴 Critical |
| 5 | **Industry profile on client creation** — Sets COA defaults, signal boost table, GST applicability, T4A flag. Drives first-import accuracy. | 🔴 Critical |
| 6 | **Period locking** — Finalized FY locked. No edits to locked periods. Required for professional accounting standards. | 🔴 Critical |
| 7 | **Cash Flow Statement** — Indirect method: Net Income ± WC changes ± investing ± financing. Required for complete financial package. | 🟠 High |
| 8 | **Bank Reconciliation Module** — Book vs bank statement side-by-side, outstanding items list, reconciliation sign-off. Audit-defensible. | 🟠 High |
| 9 | **Adjusting Journal Entries (AJEs)** — Dr/Cr entry with COA picker. Flows to Trial Balance. Reversal option. Year-end accruals, depreciation, prepaid. | 🟠 High |
| 10 | **Comparative Reports (P&L + BS)** — Current vs prior year side-by-side. Variance in $ and %. | 🟠 High |
| 11 | **Undo / Redo** — Ctrl+Z / Ctrl+Y for category changes, GST toggle, flags. Session-scoped action stack. Required before real accountant use. | 🟠 High |
| 12 | **Backup / Restore + Import Merge** — Full ledger backup as .json or .db. Restore from file. Import merge: detect and skip duplicates when re-importing a statement already loaded. | 🟠 High |

---

### 🏢 Phase 3 — CRA Compliance & Professional Output (Weeks 9–14)
**Gate: Beta release — 10–20 friendly accountants.**

| # | Item | Priority |
|---|------|----------|
| 1 | **CaseWare full working paper export** — TB + JE + AJE + Financial Statements + Notes in CaseWare-compatible ZIP. Full year-end deliverable in one download. | 🟠 High |
| 2 | **HST-34 auto-fill** — GST Report data auto-populates CRA HST-34 lines (101 Sales, 105 Collected, 106 ITC, 109 Net). Export printable PDF or CRA NETFILE XML. Quarterly + annual. | 🟠 High |
| 3 | **T4A generation** — Flag vendors as T4A recipients. Year-end slips auto-generated (Box 020 fees, Box 048 contractor). CRA XML export. | 🟠 High |
| 4 | **AR/AP Aging Report** — 30/60/90/90+ day aging buckets by vendor/customer. Outstanding balance summary. Collector-ready printable. | 🟠 High |
| 5 | **More parsers** — National Bank (6th major bank), Tangerine, Simplii, EQ Bank, Desjardins. Covers ~98% of Canadian client bank accounts. | 🟡 Medium |
| 6 | **FX / USD transaction support** — FX Rate column, Foreign Amount column in grid. CAD equivalent at transaction date. USD bank accounts (BMO US, RBC US) treated correctly. | 🟡 Medium |
| 7 | **Extended grid columns** — Match Status (reconciled/unmatched), Split Indicator, Confidence Score visible, Attachments badge count. | 🟡 Medium |
| 8 | **Duplicate detection** — Flag transactions with same date + amount + description within configurable window. Surfaced in Needs Review tile. | 🟡 Medium |
| 9 | **In-app onboarding + tooltips** — First-run walkthrough, contextual tooltips on key UI elements, empty-state guides, accountant quick-start guide. | 🟡 Medium |

---

### 📊 Phase 4 — Operational Intelligence (Weeks 15–20)
**Gate: Public launch ready — 80% test coverage, UAT with real accountants.**

| # | Item | Priority |
|---|------|----------|
| 1 | **Budget vs Actual** — Import budget from Excel or enter per COA/period. Monthly variance report: actual vs budget in $ and %. | 🟡 Medium |
| 2 | **CFO Dashboard per client** — Burn rate, cash runway, quick ratio, current ratio, DSO, DPO, gross margin at a glance. One-page printable for client meetings. | 🟡 Medium |
| 3 | **Anomaly detection engine** — Duplicate alert (same amount + vendor, 7 days), new high-value payee alert, 3× rolling average spike, GST inconsistency flag. All surfaced in UB Needs Review. | 🟡 Medium |
| 4 | **Vendor intelligence DB (firm-level)** — Shared vendor→COA DB across 400 clients. Firm rules > client rules > system defaults. Significantly improves first-import accuracy for new clients. | 🟡 Medium |
| 5 | **More financial ratios** — EBITDA margin, gross margin %, working capital, interest coverage, DSO, DPO. CFO-grade output. | 🟡 Medium |
| 6 | **QBO / Xero export** — QuickBooks Online bank feed CSV/IIF or REST API. Xero Statement CSV or REST API. For clients needing catch-up from RoboLedger to their existing QBO/Xero file. | 🟡 Medium |
| 7 | **Testing & QA gate (80% coverage)** — Categorization engine, parser outputs, COA math, GST calculations. UAT with 3–5 real accountants who have never used the software. | 🟡 Medium |

---

### 🌐 Phase 5 — Platform Scale (2027+)
**Goal: Clients manage their own books live. Multi-firm SaaS product.**

| # | Item | Priority |
|---|------|----------|
| 1 | **Client portal (Tier 2)** — Read-only client view with annotation, receipt upload, flagging. Email magic link auth. Year-end digital sign-off. Accountant controls all. | 🟢 Future |
| 2 | **Investment bookkeeping (ACB)** — T1 Schedule 3 capital gains tracking. Questrade/Wealthsimple/TD Direct/RBC Direct CSV parsers. DRIP handling. Annual ACB report per security. | 🟢 Future |
| 3 | **Crypto bookkeeping** — Coinbase/Kraken/Bitbuy/Newton CSV + on-chain wallet history. ACB per coin. Staking income (T1 Line 13000). Annual gain/loss report. | 🟢 Future |
| 4 | **Live bank feed (Tier 3)** — Flinks/Inverite Canadian bank feed API. Webhook receiver slots into same parser pipeline, real-time. Bill C-37 compliant (Canada open banking 2026–2027). | 🟢 Future |
| 5 | **CRA letter analysis (AI)** — Upload CRA letter PDF → AI identifies type (HST audit, assessment, clearance), extracts figures, cross-references client ledger, drafts response letter. | 🟢 Future |
| 6 | **AI memo / narrative generator** — Year-end plain-English financial summary from P&L + BS + ratios. Accountant edits and signs off. CPD-quality client letter. | 🟢 Future |
| 7 | **Multi-firm SaaS** — Tenant isolation per accounting firm. Firm onboarding + subscription billing. RoboLedger as a product sold to other accounting firms beyond Swift Accounting. | 🟢 Future |

---

## 5. Release Strategy

| Milestone | Gate | Audience |
|-----------|------|----------|
| **Alpha** | After Phase 2 | Internal only — developer + one trusted accountant at Swift |
| **Beta** | After Phase 3 | 10–20 friendly accountants at Swift + external early adopters |
| **Public Launch** | After Phase 4 | All 400 Swift clients onboarded · public access |

**The Phase 4 QA gate is the hard requirement before public launch.** 80%+ test coverage on: categorization engine, parser outputs, COA math, GST calculations. User acceptance testing with real accountants who have never seen the software before — not just internal users.

---

## 6. Technical Debt Register

| ID | Problem | Impact | Status | Fix |
|----|---------|--------|--------|-----|
| TD-1 | **Dual-layer architecture** — TypeScript core (src/core/) never called at runtime. Vanilla JS (app.js, ledger.core.js) is the real engine. Two parallel implementations. | Every feature built twice or risks divergence | 🔴 Open | Commit to JS runtime. Delete dead TS after multi-client shell ships. |
| TD-2 | **localStorage ceiling** — ~5MB limit, wiped on browser clear, no binary blob support. | Cannot store real client data reliably | 🔴 Open | Migrate to IndexedDB / SQLite via WASM (wa-sqlite) in Phase 2. |
| TD-3 | **Monolithic app.js (4,200+ lines)** — UI, state, events, parsing, reporting all in one file. Merge conflicts are constant. | Untestable, hard to navigate | 🟡 Ongoing | Decompose progressively: WorkspaceManager, LedgerController, AccountManager, ReportEngine. |
| TD-4 | **ScoringEngine mocked** — src/brain/scoring.ts returns 0 for all 5 dimensions. Has never been real. | Brain TS layer completely disconnected | 🟡 Low | Bridge scoring.ts → window.RoboLedger.SignalFusionEngine. Or port SignalFusion to TS. |
| TD-5 | **Dead dependencies** — Tabulator CSS, AG-Grid CSS referenced but not installed. | Bundle waste, confusing imports | ✅ Fixed | Removed from imports. npm pruned. |
| TD-6 | **PDF highlight Y-coord** — DocumentViewer.jsx Y-axis inversion used wrong reference. Highlight box misaligned. | Yellow box appears wrong row | ✅ Fixed | Now uses page.getViewport({ scale: 1.0 }).height as unscaled reference. |

---

## 7. Multi-Client Architecture

The foundation for all Phase 2+ work. Every other feature depends on `client_id` existing.

### Data Model

```
Firm
├── id: uuid
├── name: "Swift Accounting and Business Solutions Ltd."
├── province: "AB"
└── gst_number: "123456789RT0001"

Client
├── id: uuid
├── firm_id → Firm.id
├── name: "Canmore Co-Host Inc."
├── industry: "SHORT_TERM_RENTAL"
├── province: "AB"
├── status: "ACTIVE" | "ARCHIVED" | "IN_REVIEW" | "FINALIZED"
├── fiscal_year_end: "DEC" | "MAR" | "JUN" | "SEP"
└── created_at, updated_at

FiscalYear
├── id: uuid
├── client_id → Client.id
├── year: 2024
├── start_date, end_date
├── locked: boolean
└── status: "OPEN" | "IN_REVIEW" | "FINALIZED"

Account
├── id: uuid
├── client_id → Client.id
├── fiscal_year_id → FiscalYear.id
├── bank: "RBC" | "BMO" | "TD" | ...
├── account_type: "CHEQUING" | "SAVINGS" | "VISA" | "MASTERCARD" | ...
├── account_number_masked: "****4567"
└── currency: "CAD" | "USD"

Statement
├── id: uuid
├── account_id → Account.id
├── statement_id: "RBCCHQ-2024NOV"
└── period_start, period_end, source_file_name

Transaction
├── id: uuid
├── statement_id, account_id, client_id (denorm), fiscal_year_id (denorm)
├── date, description, amount, polarity
├── category (COA code), confidence, needs_review
├── gst_enabled, tax_cents, gst_account
├── fx_rate, foreign_amount, foreign_currency  ← Phase 3 addition
├── parser_ref, pdfLocation{}, audit{}
└── human_overrides[]  ← every manual change, timestamped

AuditEntry
├── id: uuid
├── transaction_id, client_id
├── changed_by: "system" | "accountant@swift.com"
├── changed_at: timestamp
├── field, old_value, new_value
└── reason (optional note)
```

### Storage Strategy
- Each client = one `.db` file — portable, exportable, downloadable
- Runs in-browser via `wa-sqlite` — zero server infrastructure now
- Schema designed for Postgres migration in one week when Tier 2 requires it
- 400 clients × ~50MB avg = 20GB — manageable on any developer machine

---

## 8. Industry Profiles

| Code | Industry | Key Revenue | Key Expense | Special |
|------|----------|------------|-------------|---------|
| `SHORT_TERM_RENTAL` | Airbnb/VRBO | 4100 Rental Income | 5400 Platform Fees, 5410 Cleaning | GST if >$30k |
| `PROFESSIONAL_SERVICES` | Consultant/Lawyer | 4000 Professional Income | 5200 Meals/Travel | T4A from clients |
| `MEDICAL_PROFESSIONAL` | Doctor/Dentist | 4050 Corp Income | 5150 CMPA/Malpractice | No GST on medical |
| `RETAIL` | Grocery/Store | 4200 Sales Revenue | 5000 COGS, 5100 Inventory | COGS tracking |
| `CONSTRUCTION` | GC/Subcontractor | 4300 Contract Revenue | 5500 Subcontractors | T5018, holdbacks |
| `RESTAURANT` | Food service | 4250 Food Sales | 5050 Food COGS | Tip tracking |
| `REAL_ESTATE` | Property investor | 4100 Rental Income | 5700 Mortgage Interest | CCA classes |
| `E_COMMERCE` | Online seller | 4200 E-Commerce Sales | 5400 Platform Fees | Cross-border GST |

---

## 9. Reporting Suite — Target State

### Currently Working ✅
Trial Balance · Income Statement · Balance Sheet · General Ledger · General Journal · COA Summary · GST Report · Financial Ratios

### To Build
| Report | Phase | Notes |
|--------|-------|-------|
| Cash Flow Statement | 2 | Indirect method |
| Bank Reconciliation | 2 | Book vs bank |
| Comparative P&L + BS | 2 | Current vs prior year |
| AR/AP Aging | 3 | 30/60/90/90+ day buckets |
| Budget vs Actual | 4 | Import from Excel or manual entry |
| CFO Dashboard | 4 | Burn rate, DSO, DPO, ratios |

---

## 10. CRA Integration

```
GST Report → HST-34 Auto-Fill (Phase 3)
  Line 101  Sales
  Line 105  GST Collected
  Line 106  ITC Paid
  Line 109  Net Remit
  [Export PDF] [NETFILE XML]

Contractor Payments → T4A Generation (Phase 3)
  Box 020  Fees for services
  Box 048  Independent contractors
  [CRA XML] [Print Slips]

CRA Letter (uploaded PDF) → AI Analysis (Phase 5)
  Type: HST Audit Notice
  Period, Amount, Deadline extracted
  Cross-referenced with client ledger
  Draft response generated
  Accountant reviews and sends
```

---

## 11. Bank Feed

PDF parsers are the offline fallback. Live feed is the same pipeline, real-time.

```
Bank (RBC/TD/BMO etc.)
     │
     │  Flinks / Inverite webhook (Bill C-37 open banking, 2026–2027)
     ▼
FEED ADAPTER → maps to BaseBankParser schema
     │
     ▼  (identical to PDF pipeline)
SIGNAL FUSION ENGINE (real-time categorization)
     │
     ▼
CLIENT NOTIFICATION — push / mobile alert
  "New $420 SYSCO — COGS? ✓ / ✗"
```

---

## 12. Investment & Crypto

### Investment — ACB Tracking (T1 Schedule 3)
Parsers: Questrade CSV, Wealthsimple CSV, TD Direct Investing, RBC Direct Investing.
DRIP handling, ACB/share calculation, annual capital gain/loss report per security.

### Crypto — Canadian Tax Treatment
Every crypto disposition = taxable event (CRA 2022: crypto is property, not currency).
Parsers: Coinbase, Kraken, Bitbuy, Newton, Binance CSV + on-chain wallet history.
ACB per coin, staking income → T1 Line 13000 (Other Income).

---

## 13. AI Intelligence Layer

### Already Working
- SignalFusion 9-signal weighted categorization
- Smart 2-line description splitter (merchant name from raw bank text)
- Refund mirror signal (contra-expense routing)
- Training brain (corrections feed back into signal weights)

### To Build (Phase 4–5)
- **Anomaly detection** — duplicate tx, new-payee high-value, 3× rolling spike, GST inconsistency
- **Vendor intelligence DB** — firm-wide shared vendor→COA mapping, all 400 clients benefit
- **Industry detection** — on first import: "I see Amazon, Shopify, Canada Post — e-commerce?" Accountant confirms, profile applied.
- **CRA letter analysis** — PDF upload → extract type/figures → cross-ref ledger → draft response letter
- **AI memo generator** — P&L + BS + ratios → 2-3 paragraph English summary for client letter

---

## 14. Client Portal — Tier 2

```
ACCOUNTANT SIDE                    CLIENT SIDE
──────────────────                 ──────────────────────
Finalizes FY2024                   Receives magic link invite
     │                                    │
     ▼                                    ▼
Pushes to portal              CLIENT VIEW (read-only)
                                Revenue, Expenses, Net
                                ⚠ 3 items need input
                                [Review flagged items]
                                [Upload receipts: 3]
                                [Sign off on FY2024]
```

| Role | Permissions |
|------|------------|
| Accountant | Full read/write — all clients, all periods |
| Client (view) | Read-only — own data, P&L, BS, GST summary |
| Client (annotate) | Flag, upload receipts, add notes — cannot change categories |
| Client (approve) | Digital sign-off on finalized year-end package |

---

## 15. Export Layer

| Export | Status | Phase | Notes |
|--------|--------|-------|-------|
| CaseWare ZIP (TB only) | ✅ Working | 0 | TB in CaseWare Working Papers format |
| XLSX / CSV | ✅ Working | 0 | Any filtered grid selection |
| CaseWare full package | ❌ To build | 3 | TB + JE + AJE + FS + Notes |
| HST-34 (PDF + NETFILE XML) | ❌ To build | 3 | CRA GIFI format, NETFILE compatible |
| T4A (CRA XML) | ❌ To build | 3 | Year-end contractor slips |
| QuickBooks Online | ❌ To build | 4 | CSV/IIF or REST API |
| Xero | ❌ To build | 4 | Statement CSV or REST API |
| T5018 | ❌ Future | 5 | Construction subcontractor payments |

---

*Mega Game Plan — RoboLedger*
*Branch: `hungry-villani` · Build: 60+ commits · 26 parsers · 8 reports · 1 client (for now)*
*Swift Accounting and Business Solutions Ltd. — Updated February 19, 2026*
*Merged: Original Mega Game Plan + Antigravity SDLC Phase 0–4 review*
