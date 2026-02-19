# RoboLedger — Mega Game Plan
**Last Updated:** February 18, 2026
**Branch:** `hungry-villani`
**Firm:** Swift Accounting and Business Solutions Ltd.
**Scale target:** 400 clients → multi-firm SaaS

---

## Table of Contents

1. [The Vision](#1-the-vision)
2. [The Three Tiers — Platform Architecture](#2-the-three-tiers)
3. [Visual Flowchart — Full System Map](#3-visual-flowchart)
4. [Visual Flowchart — User Journey per Tier](#4-visual-flowchart--user-journeys)
5. [Visual Flowchart — Data Flow](#5-visual-flowchart--data-flow)
6. [Visual Flowchart — Transaction Lifecycle](#6-visual-flowchart--transaction-lifecycle)
7. [Visual Flowchart — Roadmap Timeline](#7-visual-flowchart--roadmap-timeline)
8. [What Has Been Built — Full History](#8-what-has-been-built)
9. [Current System Inventory — Honest Audit](#9-current-system-inventory)
10. [Technical Debt Register](#10-technical-debt-register)
11. [Multi-Client Architecture — The Foundation](#11-multi-client-architecture)
12. [Industry Profiles — COA Parameterization](#12-industry-profiles)
13. [Reporting Suite — Target State](#13-reporting-suite)
14. [CRA Integration — Compliance Layer](#14-cra-integration)
15. [Bank Feed — Live Ingestion (Tier 3)](#15-bank-feed)
16. [Investment & Crypto Bookkeeping](#16-investment--crypto-bookkeeping)
17. [AI Intelligence — The Automation Engine](#17-ai-intelligence)
18. [Client Portal — Collaboration Layer (Tier 2)](#18-client-portal)
19. [Export Layer](#19-export-layer)
20. [Prioritized Roadmap — 25 Points](#20-prioritized-roadmap--25-points)
21. [Next Immediate Steps](#21-next-immediate-steps)

---

## 1. The Vision

> **RoboLedger is not accounting software. It is the operating system for accounting firms — with a client portal layer on top.**

**Who:** Accountant at Swift Accounting and Business Solutions Ltd. — ~400 clients, single entity is just the prototype engine.

**Automation target:** Tesla Full Self-Driving standard. The system drives 95% of the time. The accountant touches the wheel only for edge cases: a transaction that cannot be categorized, an unusual statement format, a judgment call. Everything else is automated, audited, and traceable to source.

**Non-negotiable design principle:** Everything flows through COA. No exceptions. Every transaction, adjustment, tax entry, import, and adjustment journal entry goes through the Chart of Accounts. The COA is the single source of truth.

**End state:** CRA-approved, bank-approved, sealed standard. A ledger package that needs no explanation to any auditor.

---

## 2. The Three Tiers — Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROBOLEDGER PLATFORM                                 │
│                                                                             │
│  TIER 1 ──────── ACCOUNTING FIRM DASHBOARD ──────────────────── [NOW]      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Drop PDFs/CSVs → Auto-detect bank → AI categorize → COA → Reports  │   │
│  │  400 clients · each isolated · CaseWare export · one-time catch-up   │   │
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

## 3. Visual Flowchart — Full System Map

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                      ROBOLEDGER — FULL SYSTEM MAP                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │                        FIRM LAYER                                    │    ║
║  │  Swift Accounting · Province: AB · GST: 123456789RT0001             │    ║
║  └──────────────────────────┬──────────────────────────────────────────┘    ║
║                             │ 1 firm → N clients                            ║
║                             ▼                                               ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │                      CLIENT REGISTRY                                 │    ║
║  │                                                                      │    ║
║  │  ● Canmore Co-Host Inc.     [SHORT_TERM_RENTAL] [IN_REVIEW]         │    ║
║  │  ● Dr. Smith Consulting     [PROFESSIONAL]      [OPEN]              │    ║
║  │  ● Johnson Grocery Ltd.     [RETAIL]            [FINALIZED]         │    ║
║  │  ● ... (400 total)                                                   │    ║
║  └──────────────────────────┬──────────────────────────────────────────┘    ║
║                             │ select client                                 ║
║                             ▼                                               ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │                     CLIENT WORKSPACE                                 │    ║
║  │                                                                      │    ║
║  │  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────┐    │    ║
║  │  │  FISCAL YEARS  │  │   ACCOUNTS      │  │ INDUSTRY PROFILE  │    │    ║
║  │  │                │  │                 │  │                   │    │    ║
║  │  │  FY2022 ●      │  │  RBC Chequing   │  │ SHORT_TERM_RENTAL │    │    ║
║  │  │  FY2023 ●      │  │  RBC Visa       │  │ → COA defaults    │    │    ║
║  │  │  FY2024 ● OPEN │  │  Amex Gold      │  │ → Signal weights  │    │    ║
║  │  │  FY2025 ○ LOCK │  │  TD Savings     │  │ → GST rules       │    │    ║
║  │  └────────────────┘  └─────────────────┘  └───────────────────┘    │    ║
║  └──────────────────────────┬──────────────────────────────────────────┘    ║
║                             │                                               ║
║                             ▼                                               ║
║  ╔══════════════════════════════════════════════════════╗                   ║
║  ║              INGESTION PIPELINE                      ║                   ║
║  ║                                                      ║                   ║
║  ║   PDF/CSV Drop                    Live Feed          ║                   ║
║  ║       │                             │                ║                   ║
║  ║       ▼                             ▼                ║                   ║
║  ║  ┌─────────────────────────────────────────────┐    ║                   ║
║  ║  │         26 BANK PARSERS                     │    ║                   ║
║  ║  │  RBC·BMO·TD·Scotia·CIBC·HSBC·ATB·Amex      │    ║                   ║
║  ║  │  BaseBankParser → parser_ref + audit trail  │    ║                   ║
║  ║  └──────────────────────┬──────────────────────┘    ║                   ║
║  ║                         │                           ║                   ║
║  ║                         ▼                           ║                   ║
║  ║  ┌─────────────────────────────────────────────┐    ║                   ║
║  ║  │      SIGNAL FUSION ENGINE (9 signals)       │    ║                   ║
║  ║  │                                             │    ║                   ║
║  ║  │  Description ──► pattern match              │    ║                   ║
║  ║  │  Vendor name ──► VendorMatcher              │    ║                   ║
║  ║  │  Amount range ─► range signal               │    ║                   ║
║  ║  │  Account type ─► CC polarity guard          │    ║                   ║
║  ║  │  GST pattern ──► gst_enabled flag           │    ║                   ║
║  ║  │  Temporal ─────► date/seasonal signal       │    ║                   ║
║  ║  │  Industry ─────► profile boosts             │    ║                   ║
║  ║  │  Historical ───► firm-wide vendor DB        │    ║                   ║
║  ║  │  Human feedback► correction memory          │    ║                   ║
║  ║  │                                             │    ║                   ║
║  ║  │  → category (COA code) + confidence score  │    ║                   ║
║  ║  └──────────────────────┬──────────────────────┘    ║                   ║
║  ║                         │                           ║                   ║
║  ║                         ▼                           ║                   ║
║  ║  ┌─────────────────────────────────────────────┐    ║                   ║
║  ║  │           COA ENGINE                        │    ║                   ║
║  ║  │  Every transaction → COA code               │    ║                   ║
║  ║  │  ASSET / LIABILITY / EQUITY                 │    ║                   ║
║  ║  │  REVENUE / EXPENSE                          │    ║                   ║
║  ║  │  GST Collected (2160) / ITC (2150)          │    ║                   ║
║  ║  └──────────────────────┬──────────────────────┘    ║                   ║
║  ╚════════════════════════╪═════════════════════════╝                   ║
║                           │                                               ║
║           ┌───────────────┼───────────────────────┐                       ║
║           ▼               ▼                       ▼                       ║
║  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐           ║
║  │  TRANSACTION │  │  AUDIT TRAIL │  │    GST LEDGER         │           ║
║  │  GRID        │  │              │  │                        │           ║
║  │  Virtualized │  │ parser_ref   │  │  Collected / ITC       │           ║
║  │  10k+ rows   │  │ pdfLocation  │  │  Net payable           │           ║
║  │  Drill-down  │  │ rawText      │  │  HST-34 ready          │           ║
║  │  Bulk edit   │  │ lineNumber   │  │                        │           ║
║  └──────┬───────┘  └──────────────┘  └───────────────────────┘           ║
║         │                                                                 ║
║         ▼                                                                 ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │                      REPORT SUITE                                   │  ║
║  │                                                                     │  ║
║  │  Trial Balance ── Income Statement ── Balance Sheet                 │  ║
║  │  General Ledger ─ General Journal ─── COA Summary                  │  ║
║  │  GST Report ───── Financial Ratios                                  │  ║
║  │  [Future] Cash Flow · Bank Recon · AJE · Budget vs Actual          │  ║
║  └──────────────────────────┬──────────────────────────────────────────┘  ║
║                             │                                             ║
║                             ▼                                             ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │                       EXPORT LAYER                                  │  ║
║  │                                                                     │  ║
║  │  CaseWare ZIP ─── XLSX/CSV ─── [Future] QBO ─── [Future] Xero     │  ║
║  │  [Future] HST-34 XML ─── [Future] T4A XML ─── [Future] T5018      │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Visual Flowchart — User Journeys per Tier

### Tier 1 — Accountant Journey (Today)

```
  Accountant opens RoboLedger
          │
          ▼
  ┌───────────────────┐
  │  CLIENT REGISTRY  │◄── 400 client cards (status, industry, last activity)
  └────────┬──────────┘
           │  click client
           ▼
  ┌───────────────────┐
  │  CLIENT WORKSPACE │◄── Name, industry, province, fiscal year selector
  └────────┬──────────┘
           │  drop files or drag-drop bank PDFs
           ▼
  ┌───────────────────────────────────────────────────────┐
  │  INGESTION MODAL                                       │
  │  "Detected: RBC Chequing · 2024-Nov · 147 items"       │
  │  Auto-detect: bank ✓  account type ✓  period ✓        │
  └────────┬──────────────────────────────────────────────┘
           │  confirm import
           ▼
  ┌────────────────────┐
  │  TRANSACTION GRID  │◄── All 147 rows, AI-categorized
  │                    │    Confidence shown per row
  │  Utility Bar ──►   │    Drillable stats: Revenue/Expenses/GST
  │  Audit Sidebar ──► │    Click row → source PDF line highlighted
  └────────┬───────────┘
           │  review flagged items (Needs Review)
           ▼
  ┌──────────────────────────┐
  │  BULK REVIEW              │
  │  3 items flagged          │
  │  Recategorize · Approve  │
  └────────┬─────────────────┘
           │  run reports
           ▼
  ┌──────────────────────────────────────────────────────┐
  │  REPORTS HUB                                          │
  │  Trial Balance · P&L · Balance Sheet · GST Report    │
  └────────┬─────────────────────────────────────────────┘
           │  export
           ▼
  ┌──────────────────────────┐
  │  EXPORT                   │
  │  CaseWare ZIP · XLSX      │
  │  [Future] HST-34 XML      │
  └──────────────────────────┘
```

### Tier 2 — Client Collaboration Journey (Mid-term)

```
  Accountant sends invite link to client
          │
          ▼
  ┌──────────────────────────┐
  │  CLIENT PORTAL LOGIN     │◄── Magic link (no password)
  └────────┬─────────────────┘
           │
           ▼
  ┌──────────────────────────────────────────────────────┐
  │  CLIENT VIEW (read-only)                              │
  │  Revenue: $124,350  Expenses: $87,240  Net: $37,110  │
  │  "3 transactions flagged — your input needed"         │
  └────────┬─────────────────────────────────────────────┘
           │  click flagged items
           ▼
  ┌──────────────────────────┐
  │  ANNOTATION PANEL        │
  │  Client adds note:        │
  │  "This was personal, not │
  │   business"              │
  │  Uploads receipt photo    │
  └────────┬─────────────────┘
           │  accountant notified
           ▼
  ┌──────────────────────────┐
  │  ACCOUNTANT REVIEWS      │
  │  Recategorizes per note  │
  │  Locks period            │
  │  Pushes to client portal │
  └──────────────────────────┘
```

### Tier 3 — Client Self-Serve Journey (Long-term)

```
  Client connects bank account (Flinks/Open Banking)
          │
          ▼
  ┌──────────────────────────┐
  │  LIVE FEED AUTHORIZATION │◄── OAuth bank connection
  └────────┬─────────────────┘
           │  webhook fires on every new transaction
           ▼
  ┌──────────────────────────┐
  │  AUTO-CATEGORIZATION     │◄── Same pipeline as PDF, real-time
  └────────┬─────────────────┘
           │  low-confidence items
           ▼
  ┌──────────────────────────┐
  │  MOBILE NOTIFICATION     │
  │  "$420 at Sysco Foods —  │
  │   categorized as COGS.   │
  │   Correct? [Yes] [Edit]" │
  └──────────────────────────┘
```

---

## 5. Visual Flowchart — Data Flow

```
  ╔══════════════ INPUT SOURCES ═══════════════════════════════════╗
  ║                                                                ║
  ║   Bank PDF Statement          CSV Export        Live Feed      ║
  ║   (26 parsers)               (QB/Caseware)    (Flinks/Plaid)  ║
  ║        │                          │                 │          ║
  ╚════════╪══════════════════════════╪═════════════════╪══════════╝
           │                          │                 │
           └──────────────┬───────────┘                 │
                          │                             │
                          ▼                             ▼
              ┌───────────────────────┐    ┌────────────────────────┐
              │   PARSER LAYER        │    │   FEED ADAPTER         │
              │   BaseBankParser      │    │   maps Flinks fields   │
              │   + buildAuditData()  │    │   → same schema        │
              └──────────┬────────────┘    └────────────┬───────────┘
                         │                              │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
              ┌─────────────────────────────────────────────────┐
              │              TRANSACTION SCHEMA                 │
              │                                                 │
              │  id, date, description, amount, polarity        │
              │  account_id, client_id, fiscal_year_id          │
              │  category (COA code), confidence                │
              │  gst_enabled, tax_cents, gst_account            │
              │  parser_ref, pdfLocation, audit{}               │
              │  needs_review, human_overrides[]                │
              └──────────────────────┬──────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                 ▼
        ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐
        │  COA MAPPING    │  │  GST ENGINE  │  │  AUDIT TRAIL     │
        │                 │  │              │  │                  │
        │  code → root    │  │  tax_cents   │  │  every change    │
        │  ASSET/LIAB/    │  │  gst_account │  │  who/when/why    │
        │  EQUITY/REV/EXP │  │  2150 / 2160 │  │  old→new value   │
        └────────┬────────┘  └──────┬───────┘  └──────────────────┘
                 │                  │
                 └────────┬─────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────────────────┐
        │                  REPORT GENERATOR                   │
        │                                                     │
        │  Trial Balance ←── aggregates by COA code          │
        │  Income Statement ←── filters REV / EXP            │
        │  Balance Sheet ←── filters ASSET / LIAB / EQ       │
        │  GST Report ←── filters gst_enabled transactions   │
        │  General Ledger ←── groups by account              │
        └─────────────────────────────────────────────────────┘
```

---

## 6. Visual Flowchart — Transaction Lifecycle

```
  ┌────────────────────────────────────────────────────────────────┐
  │                  TRANSACTION LIFECYCLE                          │
  └────────────────────────────────────────────────────────────────┘

  RAW PDF LINE
  "Nov 15  PETRO-CANADA #1234  -62.40"
          │
          ▼
  ┌──────────────────────────────────────┐
  │  PARSER                              │
  │  date: 2024-11-15                   │
  │  description: "PETRO-CANADA #1234"  │
  │  amount: 62.40                       │
  │  polarity: DEBIT                     │
  │  parser_ref: RBCCHQ-2024NOV-047     │
  │  pdfLocation: { page:3, y:412... }  │
  └───────────────────┬──────────────────┘
                      │
                      ▼
  ┌──────────────────────────────────────┐
  │  SIGNAL FUSION ENGINE                │
  │                                      │
  │  Signal 1 — "PETRO" pattern → 5800  │  (confidence: 0.82)
  │  Signal 2 — DEBIT + fuel range      │  (confidence: 0.71)
  │  Signal 3 — historical match        │  (confidence: 0.90)
  │  Signal 4 — industry profile boost  │  (confidence: +0.05)
  │                                      │
  │  → category: 5800 (Fuel & Oil)      │
  │  → confidence: 0.89                  │
  │  → needs_review: false               │
  └───────────────────┬──────────────────┘
                      │
                      ▼
  ┌──────────────────────────────────────┐
  │  GST ENGINE                          │
  │                                      │
  │  Fuel is GST-eligible                │
  │  tax_cents = 62.40 × 5% = 312 cents │
  │  gst_account: 2150 (GST ITC Paid)   │
  │  gst_enabled: true                   │
  └───────────────────┬──────────────────┘
                      │
                      ▼
  ┌──────────────────────────────────────┐
  │  TRANSACTION GRID (displayed)        │
  │  Nov 15 | Petro-Canada               │
  │          | Fuel & Oil              │
  │  $62.40  | DEBIT | 5800 | ✓ GST   │
  └───────────────────┬──────────────────┘
                      │
            ┌─────────┴───────────┐
            │ human review        │
            ▼                     ▼
  ┌──────────────────┐  ┌─────────────────────────────┐
  │  ACCEPTED        │  │  HUMAN OVERRIDE             │
  │  (auto-accepted  │  │  accountant changes to 5810  │
  │  at confidence   │  │  (Vehicle - Repairs)         │
  │  > 0.75)         │  │                             │
  └──────────────────┘  │  AuditEntry logged:         │
                        │  field: "category"           │
                        │  old: "5800"                 │
                        │  new: "5810"                 │
                        │  changed_by: accountant      │
                        │  reason: "oil change, not    │
                        │           fuel fill-up"      │
                        └─────────────────────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │  LEARNING LOOP               │
                      │  Correction stored in         │
                      │  firm-wide vendor DB:         │
                      │  "PETRO-CANADA + oil change"  │
                      │  → 5810 (Vehicle Repairs)    │
                      │                              │
                      │  Next client with same tx:   │
                      │  auto-routed to 5810          │
                      └──────────────────────────────┘
```

---

## 7. Visual Flowchart — Roadmap Timeline

```
  ════════════════════════════════════════════════════════════════════════════
                          ROBOLEDGER ROADMAP
  ════════════════════════════════════════════════════════════════════════════

  ◄── TODAY ──────────────────────────────────────────────────────── FUTURE ──►

  FEB 2026          MAR-APR 2026          MAY-AUG 2026          2027+
  │                 │                     │                      │
  ●─────────────────●─────────────────────●──────────────────────●
  │                 │                     │                      │
  │ PHASE 0         │ PHASE 1             │ PHASE 2              │ PHASE 3
  │ FOUNDATION      │ PROFESSIONAL        │ FIRM ADVANTAGE       │ PLATFORM
  │                 │                     │                      │
  │ ✅ 26 parsers   │ ① Multi-client      │ ⑦ HST-34 auto       │ ⑳ Client portal
  │ ✅ SignalFusion  │   shell             │ ⑧ T4A generation    │ ㉑ Investment ACB
  │ ✅ Audit trail  │ ② IndexedDB         │ ⑨ AR/AP Aging       │ ㉒ Crypto books
  │ ✅ 8 reports    │ ③ Fiscal year Mgr   │ ⑩ Budget vs Actual  │ ㉓ Live bank feed
  │ ✅ GST ledger   │ ④ Industry profiles │ ⑪ CFO Dashboard     │ ㉔ CRA letters
  │ ✅ CaseWare ZIP │ ⑤ Period locking   │ ⑫ Anomaly detect.   │ ㉕ AI memo gen
  │                 │ ⑥ Cash Flow Stmt   │ ⑬ Vendor intel DB   │
  │                 │ ⑭ Bank Recon       │ ⑮ More parsers      │
  │                 │ ⑯ AJE module       │ ⑰ Comp. reports     │
  │                 │ ⑱ CaseWare full    │ ⑲ QBO/Xero export   │
  │                 │                     │                      │
  ●─────────────────●─────────────────────●──────────────────────●
  │                 │                     │                      │
  Single client     400 clients isolated  CRA compliance ready   Multi-firm SaaS

  KEY MILESTONES:
  ━━━━━━━━━━━━━━
  ► Phase 1 Complete = Can onboard any of 400 clients in under 5 minutes
  ► Phase 2 Complete = Can file HST-34 from RoboLedger directly
  ► Phase 3 Complete = Clients manage their own books live

  ════════════════════════════════════════════════════════════════════════════
```

---

## 8. What Has Been Built — Full History

The following documents every commit phase, what was built, and why.

### Foundation (v1.0 — Parser Infrastructure)
| What | Commit | Notes |
|------|--------|-------|
| BaseBankParser + buildAuditData | early | Foundation for all 26 parsers |
| COA engine (coa.ts) | early | ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE hierarchy |
| SignalFusionEngine v1 | early | Multi-signal categorization |
| GST system v1 | early | Polarity-based GST, gst_enabled, tax_cents |
| Trial Balance v1 | early | Direct calculation from ledger |

### Intelligence Layer (v1.5 → v2.0)
| What | Commit | Notes |
|------|--------|-------|
| Signal Fusion v2 | `d649ea6` | 9-signal weighted architecture |
| Smart 2-line splitter | `ea8f01a` | Merchant name + transaction type from raw text |
| Refund mirror signal | `e619542` | Contra-expense for CC refunds/cashback/rebates |
| CC polarity enforcement | `6a39f30` | 3-layer guard — CC charges never revenue |
| Retroactive CC cleanup | `d8e6c03` | Fix historical misclassifications in-session |
| Training brain | `9482052` | SWIFT workpapers → signal weight updates |

### Parser Coverage
| What | Commit | Notes |
|------|--------|-------|
| 24 parsers: Amex audit parity | `8f63911` | parser_ref, statementId, lineNumber on all |
| RBC (4 variants) | — | Chequing, Savings, Mastercard, Visa |
| BMO (6 variants) | — | Chequing, Savings, Mastercard, Visa, CreditCard, US |
| TD (3) | — | Chequing, Savings, Visa |
| Scotia (6) | — | Chequing, Savings, Mastercard, Visa, Amex, CreditCard |
| CIBC (3) | — | Chequing, Savings, Visa |
| HSBC, ATB, Amex | — | Complete |

### UI & UX
| What | Commit | Notes |
|------|--------|-------|
| Audit Sidebar + DocumentViewer | — | PDF highlight on source line |
| UB full drill-down | `2c48717` | 3-level: All › Category › Payee |
| Bulk action bar | `8b3c92d` | 3 inline bulk actions |
| FilterToolbar + breadcrumb | `df36125` | Universal filter with clear |
| GST checkbox per row | `6a29470` | Toggle GST inline in grid |
| Account card + switcher | `13a9b82` | UB top, switches workspace |
| Ghost accounts eliminated | `49fdb6f` | No phantom accounts |
| Settings drawer rebuilt | `b1f0f81` | Theme/density/font, province selector |

### Reports Suite
| What | Commit | Notes |
|------|--------|-------|
| 8 report sub-components | `0c46e1b` | Full suite built |
| TB hardening (QB PDF) | `d2db216` | Dot separator, column detect, name matching |
| TB equity + retained earnings | `996aff3` | Proper year-end synthesis |
| GST section in TB | `06dcb19` | Correct accounting treatment |
| GST Report redesign | `2ec7f86` | Ledger detail, full drill-down |
| Prior Year Import | `83d757e` | CaseWare ZIP → side-by-side comparison |
| Reports hub redesign | `309240d` | Slim header, card grid, no wall bleed |
| Empty states all reports | `15c2a3f` | "Upload statements to get started" |

---

## 9. Current System Inventory — Honest Audit

### ✅ Working — Production Quality

| Component | Notes |
|-----------|-------|
| 26 bank PDF parsers | All with Amex audit parity |
| Signal Fusion categorization | 9 signals, real production accuracy |
| CC polarity enforcement | 3-layer guard |
| Refund/contra-expense routing | Automatic |
| COA engine | Full hierarchy, root types |
| GST auto-calculation | Province-aware (AB, BC, ON, QC configured) |
| Transaction grid | Virtualized, 10k+ rows smooth |
| Utility Bar drill-downs | 3-level breadcrumb, all stat rows drillable |
| Audit Sidebar + PDF viewer | parser_ref, raw text, PDF highlight |
| Trial Balance | CaseWare standard with prior year compare |
| Income Statement | GAAP |
| Balance Sheet | GAAP |
| General Ledger | Per-account transaction detail |
| General Journal | All entries chronological |
| COA Summary | Category breakdown with counts |
| GST Report | Full drill-down, collected/ITC/net |
| Financial Ratios | Current ratio, quick ratio, etc. |
| CaseWare ZIP export | Working |
| XLSX/CSV export | Working |

### ⚠️ Partial — Needs Attention

| Component | Gap |
|-----------|-----|
| PDF highlight (DocumentViewer) | Y-coordinate precision — known bug, fix planned |
| TypeScript core (src/core/) | Architecturally correct but dead code — not called at runtime |
| ScoringEngine (src/brain/) | Returns 0 for all 5 dimensions — mocked, real scorer is SignalFusionEngine.js |
| Financial Ratios report | Needs more ratios (DSO, DPO, EBITDA margin) |
| Comparative column in reports | Prior year data imported but comparative view in IS/BS needs polish |

### ❌ Not Built — Required for Firm Use

| Component | Priority |
|-----------|----------|
| Multi-client isolation (client_id everywhere) | 🔴 Critical |
| Client Registry UI | 🔴 Critical |
| IndexedDB persistence (replace localStorage) | 🔴 Critical |
| Fiscal year management | 🔴 Critical |
| Industry profile switching | 🔴 Critical |
| Period locking | 🔴 Critical |
| Cash Flow Statement | 🟠 High |
| Bank Reconciliation | 🟠 High |
| Adjusting Journal Entries (AJEs) | 🟠 High |
| HST-34 auto-fill | 🟡 Medium |
| T4A generation | 🟡 Medium |
| AR/AP Aging | 🟡 Medium |
| Budget vs Actual | 🟡 Medium |
| More parsers (National Bank, Tangerine, Simplii, EQ Bank, Desjardins) | 🟡 Medium |
| Investment bookkeeping (ACB) | 🟢 Future |
| Crypto bookkeeping | 🟢 Future |
| Live bank feed (Flinks/Inverite) | 🟢 Future |
| CRA letter analysis | 🟢 Future |
| Client portal (Tier 2) | 🟢 Future |

---

## 10. Technical Debt Register

| ID | Problem | Impact | Fix |
|----|---------|--------|-----|
| TD-1 | **Dual-layer architecture** — TypeScript core (src/core/) never called. Vanilla JS layer (app.js, ledger.core.js) is the real runtime. Two parallel implementations of the same domain. | Every feature requires building twice or risks divergence | Decision: commit to JS runtime for now, delete dead TS code after multi-client shell is built cleanly |
| TD-2 | **localStorage ceiling** — ~5MB, lost on browser wipe, no binary support for PDF blobs | Cannot store real client data reliably | Migrate to IndexedDB. For multi-client: SQLite via WASM (sql.js/wa-sqlite) — one .db file per client |
| TD-3 | **Monolithic app.js** — 4,200+ lines handling UI, state, events, parsing, reporting, all in one file | Untestable, hard to navigate, merge conflicts constant | Decompose progressively: extract WorkspaceManager, LedgerController, AccountManager as separate modules |
| TD-4 | **ScoringEngine mocked** — src/brain/scoring.ts returns 0 for all 5 dimensions | Brain TypeScript layer has no real implementation | Bridge: have scoring.ts call window.RoboLedger.SignalFusionEngine, or port SignalFusionEngine to TS |
| TD-5 | **Dead dependencies** — Tabulator CSS, AG-Grid CSS fragments referenced but never installed | Bundle size waste, confusing imports | npm prune + clean imports |
| TD-6 | **PDF highlight Y-coord** — DocumentViewer.jsx uses `(pdfPageHeight - top - height) * scale`. Works for bottom-origin PDF coords but needs validation across all parsers | Yellow highlight box may appear misaligned | Use `page.getViewport({ scale: 1.0 }).height` as unscaled reference |

---

## 11. Multi-Client Architecture — The Foundation

This is the single most important thing to build next. Every feature after this depends on `client_id` existing.

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
├── start_date: 2024-01-01
├── end_date: 2024-12-31
├── locked: boolean
└── status: "OPEN" | "IN_REVIEW" | "FINALIZED"

Account
├── id: uuid
├── client_id → Client.id
├── fiscal_year_id → FiscalYear.id
├── bank: "RBC"
├── account_type: "CHEQUING"
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
├── parser_ref, pdfLocation{}, audit{}
└── human_overrides[] — every manual change, timestamped

AuditEntry
├── id: uuid
├── transaction_id, client_id
├── changed_by: "system" | "accountant@swift.com"
├── changed_at: timestamp
├── field, old_value, new_value
└── reason (optional note)
```

### Storage: SQLite via WASM

- Each client = one `.db` file — portable, exportable, downloadable
- Runs in-browser via `wa-sqlite` — zero server infrastructure needed now
- 400 clients × ~50MB avg = 20GB — manageable on any machine
- Schema designed so migration to Postgres is a one-week job when Tier 2 requires it

### Client Registry UI

```
  ┌──────────────────────────────────────────────────────────────────┐
  │  Swift Accounting — Client Registry              [+ New Client]  │
  │                                                                  │
  │  [🔍 Search clients...]   [Status ▼] [Industry ▼] [FY ▼]       │
  │                                                                  │
  │  ● Canmore Co-Host Inc.      Short-term rental   IN_REVIEW  ►   │
  │    FY2024 · 3 accounts · 847 transactions · ⚠ 3 flags           │
  │                                                                  │
  │  ● Dr. Smith Consulting Ltd. Medical/Professional OPEN      ►   │
  │    FY2024 · 2 accounts · 124 transactions · ✓ All clear          │
  │                                                                  │
  │  ○ Johnson Grocery Ltd.      Retail              FINALIZED   ►  │
  │    FY2023 · 5 accounts · 3,247 transactions · Exported           │
  │  ...                                                             │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 12. Industry Profiles — COA Parameterization

Different industries have fundamentally different COA structures and signal weights.

| Code | Industry | Key Revenue COA | Key Expense COA | Special |
|------|----------|----------------|----------------|---------|
| `SHORT_TERM_RENTAL` | Airbnb/VRBO | 4100 Rental Income | 5400 Platform Fees, 5410 Cleaning | GST if >$30k |
| `PROFESSIONAL_SERVICES` | Consultant/Lawyer | 4000 Professional Income | 5200 Meals/Travel, 5300 Professional Dues | T4A from clients |
| `MEDICAL_PROFESSIONAL` | Doctor/Dentist | 4050 Professional Corp Income | 5150 CMPA/Malpractice, 5160 CME | No GST on medical |
| `RETAIL` | Grocery/Store | 4200 Sales Revenue | 5000 COGS, 5100 Inventory | COGS tracking |
| `CONSTRUCTION` | GC/Subcontractor | 4300 Contract Revenue | 5500 Subcontractors, 5510 Equipment | T5018, holdbacks |
| `RESTAURANT` | Food service | 4250 Food Sales | 5050 Food COGS, 5060 Liquor COGS | Tip tracking |
| `REAL_ESTATE` | Property investor | 4100 Rental Income | 5700 Mortgage Interest, 5710 Property Tax | CCA classes |
| `E_COMMERCE` | Online seller | 4200 E-Commerce Sales | 5400 Platform Fees (Amazon/Shopify) | Cross-border GST |
| `CONSTRUCTION_GOV` | Federal contractor | 4350 Progress Claims | 5500 Subcontractors, 5520 Holdback Retained | PWGSC |

---

## 13. Reporting Suite — Target State

### Currently Working ✅
Trial Balance (CaseWare standard) · Income Statement · Balance Sheet · General Ledger · General Journal · COA Summary · GST Report (full drill-down) · Financial Ratios

### Needs to Be Built

**Cash Flow Statement** — Direct + Indirect method
```
  Operating Activities:
    Net Income                          $37,110
    ± Working capital changes:
      Accounts Receivable               -$5,200
      Accounts Payable                  +$2,100
  Net Operating Cash                   $34,010

  Investing Activities:
    Equipment purchase                 -$12,000
  Net Investing Cash                   -$12,000

  Financing Activities:
    Loan repayment                      -$8,000
  Net Financing Cash                    -$8,000

  Net Change in Cash                   $14,010
```

**Bank Reconciliation**
```
  Book Balance (GL)          $24,350.00
  + Deposits in transit       +1,200.00
  - Outstanding cheques       -3,450.00
  = Adjusted Book Balance    $22,100.00

  Bank Statement Balance     $22,100.00  ✓ RECONCILED
```

**AJE Module** — Year-end adjustments through COA with full audit trail

**Comparative Reports** — Current vs prior year side-by-side

---

## 14. CRA Integration — Compliance Layer

```
  ┌─────────────────────────────────────────────────────────┐
  │                 CRA INTEGRATION LAYER                   │
  └─────────────────────────────────────────────────────────┘

  GST Report
      │
      ▼
  ┌──────────────────────────────────┐
  │  HST-34 AUTO-FILL                │
  │                                  │
  │  Line 101  Sales:   $124,350    │
  │  Line 105  Collected: $6,218    │
  │  Line 106  ITC paid: -$4,372   │
  │  Line 109  Net remit: $1,846   │
  │                                  │
  │  [Export XML] [Print PDF]        │
  └──────────────────────────────────┘

  Contractor Payments
      │
      ▼
  ┌──────────────────────────────────┐
  │  T4A GENERATION                  │
  │                                  │
  │  John Smith       $15,200  Box020│
  │  ABC Plumbing Ltd $8,750   Box048│
  │                                  │
  │  [Export CRA XML] [Print Slips]  │
  └──────────────────────────────────┘

  CRA Letter (uploaded PDF)
      │
      ▼
  ┌──────────────────────────────────┐
  │  CRA LETTER ANALYSIS (AI)        │
  │                                  │
  │  Type: HST Audit Notice          │
  │  Period: Jan-Dec 2022            │
  │  Amount in question: $4,200      │
  │  Deadline: March 15, 2026        │
  │                                  │
  │  Your GST Report 2022 shows:     │
  │  Collected $6,100 / ITC $1,900  │
  │  Net $4,200 — matches CRA ask    │
  │                                  │
  │  [View Draft Response] [Review]  │
  └──────────────────────────────────┘
```

---

## 15. Bank Feed

The PDF parsers are the offline fallback. The live feed is the same pipeline, real-time.

```
  Bank (RBC/TD/BMO etc.)
       │
       │  Open Banking API / Flinks webhook
       ▼
  ┌──────────────────────────────────┐
  │  FEED ADAPTER                    │
  │  Maps Flinks/Plaid fields        │
  │  → same BaseBankParser schema    │
  └────────────────┬─────────────────┘
                   │
                   ▼  (same as PDF pipeline)
  ┌──────────────────────────────────┐
  │  SIGNAL FUSION ENGINE            │
  │  (real-time categorization)      │
  └────────────────┬─────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────┐
  │  CLIENT NOTIFICATION             │
  │  Push / mobile alert             │
  │  "New $420 SYSCO — COGS? ✓ / ✗" │
  └──────────────────────────────────┘
```

**Canadian providers:** Flinks (Montreal), Inverite — both cover all major Canadian banks.
**Regulation:** Bill C-37 (Canada's open banking law, enacted 2024) — full rollout ~2026-2027.

---

## 16. Investment & Crypto Bookkeeping

### Investment — ACB Tracking (T1 Schedule 3)

```
  Security: XEQT.TO
  ┌────────────────────────────────────────────────────────────────┐
  │  Date        Action    Shares    Price     ACB/share   Total ACB│
  │  2022-03-15  BUY       100      $25.00    $25.00      $2,500   │
  │  2022-06-01  DRIP      2        $26.50    $25.09      $2,553   │
  │  2023-08-20  BUY       50       $28.00    $26.06      $3,909   │
  │  2024-01-10  SELL      75       $30.00    $26.06      Capital  │
  │                                                       Gain:    │
  │                                                       $294.50  │
  └────────────────────────────────────────────────────────────────┘
  T1 Schedule 3 auto-populated
```

**Parsers needed:** Questrade CSV, Wealthsimple CSV, TD Direct Investing, RBC Direct Investing, Interactive Brokers Activity Report.

### Crypto — Canadian Tax Treatment

Every crypto disposition = taxable event (CRA 2022 guidance: crypto is property, not currency).

```
  Wallet Activity Import (Etherscan/Coinbase CSV)
       │
       ▼
  ┌──────────────────────────────────────────────────┐
  │  CRYPTO ACB ENGINE                               │
  │                                                  │
  │  ETH: 2 ETH purchased @ $2,000 CAD (ACB $1,000/ETH) │
  │  ETH: 1 ETH sold @ $3,500 CAD                   │
  │  Capital gain: $3,500 - $1,000 = $2,500         │
  │                                                  │
  │  Staking income: 0.05 ETH @ $3,400 = $170       │
  │  → T1 Line 13000 (Other Income)                 │
  └──────────────────────────────────────────────────┘
```

**Sources:** Coinbase, Kraken, Bitbuy, Newton, Binance CSV exports + on-chain wallet history.

---

## 17. AI Intelligence — The Automation Engine

### Already Working
- **SignalFusionEngine** — 9-signal weighted categorization
- **Smart 2-line description splitter** — merchant name from raw bank text
- **Refund mirror signal** — contra-expense routing
- **Training brain** — SWIFT workpapers corrections feed back into weights

### To Build

```
  ┌─────────────────────────────────────────────────────────┐
  │               AI INTELLIGENCE ROADMAP                   │
  └─────────────────────────────────────────────────────────┘

  ┌──────────────────────────────┐
  │  ANOMALY DETECTION           │
  │  - Duplicate txn alert       │
  │    (same amount, same vendor,│
  │     within 7 days)          │
  │  - New high-value payee      │
  │  - Amount spike (3× avg)    │
  │  - GST inconsistency         │
  │  → surfaces in UB "Needs    │
  │    Review" drill             │
  └──────────────────────────────┘

  ┌──────────────────────────────┐
  │  VENDOR INTELLIGENCE DB      │
  │  Firm-level shared mapping   │
  │  "PETRO-CANADA" → 5800       │
  │  Across all 400 clients      │
  │  Firm rules > client rules   │
  │  > system defaults           │
  └──────────────────────────────┘

  ┌──────────────────────────────┐
  │  INDUSTRY DETECTION          │
  │  On first import:            │
  │  "I see Amazon, Shopify,     │
  │   Canada Post — e-commerce?" │
  │  Accountant confirms         │
  │  Profile applied             │
  └──────────────────────────────┘

  ┌──────────────────────────────┐
  │  AI MEMO GENERATOR           │
  │  Input: P&L + BS + ratios    │
  │  Output: 2-3 para English    │
  │  "Revenue increased 12%..."  │
  │  Accountant edits → sends    │
  └──────────────────────────────┘
```

---

## 18. Client Portal — Collaboration Layer (Tier 2)

```
  ACCOUNTANT SIDE                    CLIENT SIDE
  ──────────────────                 ──────────────────────
  Finalizes FY2024                   Receives invite link
       │                                    │
       ▼                                    ▼
  Pushes to portal              ┌──────────────────────────┐
       │                        │  CLIENT VIEW             │
       ▼                        │  Revenue: $124,350       │
  ┌──────────────────────────┐  │  Expenses: $87,240       │
  │  PUSH NOTIFICATION       │  │  Net: $37,110            │
  │  "Your 2024 books are    │  │                          │
  │   ready for review"      │  │  ⚠ 3 items need input   │
  └──────────────────────────┘  │  [Review flagged items]  │
                                │                          │
                                │  [Upload receipts: 3]    │
                                └──────────────────────────┘
```

**Access control:**

| Role | Permissions |
|------|------------|
| Accountant | Full read/write — all clients, all periods |
| Client (view) | Read-only — own data, P&L, BS, GST summary |
| Client (annotate) | Flag, upload receipts, add notes — cannot change categories |
| Client (approve) | Digital sign-off on finalized year-end package |

---

## 19. Export Layer

| Export | Status | Format | Notes |
|--------|--------|--------|-------|
| CaseWare ZIP | ✅ Working | ZIP | TB in CaseWare Working Papers format |
| XLSX | ✅ Working | Excel | Any filtered grid selection |
| CSV | ✅ Working | CSV | Any filtered grid selection |
| CaseWare full package | ❌ Future | ZIP | TB + JE + AJE + FS + Notes |
| QuickBooks Online | ❌ Future | CSV/IIF/API | QBO bank feed import or REST API |
| Xero | ❌ Future | CSV/API | Statement CSV or Xero REST API |
| HST-34 | ❌ Future | CRA XML | GIFI format, NETFILE compatible |
| T4A | ❌ Future | CRA XML | Year-end contractor slips |
| T5018 | ❌ Future | CRA XML | Construction subcontractor payments |

---

## 20. Prioritized Roadmap — 25 Points

### 🔴 Phase 1 — Foundation (Feb–Apr 2026)
*Goal: Support 400 isolated clients. Every client gets their own workspace, fiscal year, and industry profile.*

| # | Point | Why |
|---|-------|-----|
| 1 | **Multi-client shell — Client Registry** | Firm dashboard with client list, create/select/archive. Navigation: Firm → Client → FY → Account → Transactions. Foundation everything else sits on. |
| 2 | **Scoped ledger per client (`client_id` everywhere)** | All transactions, accounts, statements, reports filtered by active client. No data bleeds between clients. Single most important architectural change. |
| 3 | **IndexedDB persistence (replace localStorage)** | 50MB+ per origin, persistent across sessions, binary support for PDF blobs. Required before onboarding real client data. |
| 4 | **Fiscal year management UI** | Per client: open FY, set start/end dates, view/switch between years. FY-scoped reports. Year-end rollover (retained earnings carry forward). |
| 5 | **Industry profile selection on client creation** | Sets default COA mappings, signal boost table, GST applicability, T4A flag. Drives first-import accuracy. |
| 6 | **Period locking** | Finalize a FY → lock it. No changes to locked periods. Required for professional accounting standards. |
| 7 | **Cash Flow Statement** | Indirect method: Net Income ± operating WC changes ± investing ± financing. Required for complete financial package. |
| 8 | **Bank Reconciliation module** | Side-by-side: book vs bank statement balance. Outstanding items list. Reconciliation sign-off. Audit-defensible. |
| 9 | **Adjusting Journal Entries (AJE)** | Dr/Cr entry screen with COA picker. AJEs appear in Trial Balance. Reversal option. Year-end accruals, depreciation, prepaid amortization. |
| 10 | **Comparative reports** | Current vs prior year side-by-side in P&L and Balance Sheet. Variance in $ and %. |

### 🟠 Phase 2 — Professional Output (Apr–Aug 2026)
*Goal: CRA compliance-ready output. File HST-34 directly from RoboLedger.*

| # | Point | Why |
|---|-------|-----|
| 11 | **CaseWare full working paper export** | TB + JE + AJE + Financial Statements + Notes in CaseWare-compatible ZIP. Full package download. |
| 12 | **More parsers** | National Bank (6th major bank), Tangerine, Simplii, EQ Bank, Desjardins. Covers ~98% of Canadian client base. |
| 13 | **HST-34 auto-fill** | From GST Report → auto-populate CRA HST-34 fields. Export as printable PDF or CRA NETFILE XML. Quarterly + annual. |
| 14 | **T4A generation** | Flag vendors as T4A recipients. Year-end T4A slips auto-generated. CRA XML export. |
| 15 | **AR/AP Aging Report** | 30/60/90+ day aging buckets. Outstanding balance by vendor/customer. |

### 🟡 Phase 2B — Firm Competitive Advantage (May–Aug 2026)
*Goal: Operational intelligence. Features that save accountant hours every week.*

| # | Point | Why |
|---|-------|-----|
| 16 | **Budget vs Actual** | Import budget from Excel or enter per COA/period. Variance report: actual vs budget, $ and %, monthly. |
| 17 | **CFO Dashboard per client** | Burn rate, runway, quick ratio, current ratio, DSO, DPO at a glance. One-page printable for client meetings. |
| 18 | **Anomaly detection** | Duplicate tx alerts, new-payee high-value alerts, amount spikes, GST inconsistency flags. Surfaced in UB Needs Review. |
| 19 | **Vendor intelligence (firm-level)** | Shared vendor → COA DB across all 400 clients. Firm-wide rules override client-level rules. Significantly improves first-import accuracy for new clients. |

### 🟢 Phase 3 — Platform Scale (2027+)
*Goal: Clients manage their own books live. RoboLedger as a multi-firm SaaS product.*

| # | Point | Why |
|---|-------|-----|
| 20 | **Client portal (Tier 2)** | Read-only client view with annotation, receipt upload, flagging. Email magic link auth. Year-end sign-off. |
| 21 | **Investment bookkeeping (ACB)** | T1 Schedule 3 capital gains tracking. Questrade/Wealthsimple CSV parsers. DRIP handling. Annual ACB report per security. |
| 22 | **Crypto bookkeeping** | Coinbase/Kraken/Bitbuy/Newton CSV parsers. On-chain wallet history. ACB per coin. Staking income classification. Annual crypto gain/loss report. |
| 23 | **Live bank feed (Tier 3)** | Flinks/Inverite Canadian bank feed API. Webhook receiver → same parser pipeline, real-time. First target: your own firm's operating account as proof of concept. |
| 24 | **CRA letter analysis** | PDF upload → AI identifies type, extracts figures, cross-references client ledger, drafts response. Accountant reviews and sends. High-value differentiator. |
| 25 | **AI memo / narrative generator** | Year-end plain-English financial summary from P&L + BS + ratios. Accountant edits and signs off. CPD-quality client letter output. |

---

## 21. Next Immediate Steps

**The right order to build Phase 1:**

```
  Step 1 ── Design client data schema
            (client, fiscal_year, account, statement, transaction — all with client_id)
                │
                ▼
  Step 2 ── Build IndexedDB persistence layer
            Replace localStorage with a proper database abstraction
            SQLite via WASM (wa-sqlite or sql.js)
                │
                ▼
  Step 3 ── Build Client Registry UI
            Firm dashboard: client cards, create client, select client
            Status indicators: OPEN / IN_REVIEW / FINALIZED
                │
                ▼
  Step 4 ── Scope existing ledger to active_client_id
            All queries, all reports, filtered by active client
            Migrate existing single-client data to first client slot automatically
                │
                ▼
  Step 5 ── Fiscal Year selector per client
            Drives date filtering for all reports
            Year-end rollover (retained earnings carry forward)
                │
                ▼
  Step 6 ── Industry profile on client creation
            Sets default COA weights + signal boost table
                │
                ▼
  Step 7 ── Verify: existing engine slots into multi-client shell
            Parsers, categorization, reports, audit trail work
            within any client context unchanged
```

Once these 7 steps are complete, the entire existing engine — 26 parsers, SignalFusion, 8 reports, GST ledger, CaseWare export, audit trail — slots directly into the multi-client shell with minimal changes. The intelligence layer is already client-agnostic. It just needs `client_id` passed through.

**The shell is the product. The engine is already built.**

---

*Mega Game Plan — RoboLedger*
*Branch: `hungry-villani` · Build: 60+ commits · 26 parsers · 8 reports · 1 client (for now)*
*Swift Accounting and Business Solutions Ltd. — February 18, 2026*
