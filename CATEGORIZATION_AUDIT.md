# RoboLedger — Categorization Audit Report
**File:** ALL_2026-02-19.csv
**Total Rows:** 2,998
**Total Flagged:** 1,759 rows across 44 issue groups
**Date:** February 19, 2026

---

## Status Overview

| Status | Count | % |
|--------|-------|---|
| `needs_review` | 2,289 | 76% |
| `auto_categorized` | 631 | 21% |
| `PREDICTED` | 78 | 3% |

> **76% of all transactions are still flagged as `needs_review`.** This is not just a categorization problem — it's a signal that the engine's confidence thresholds and signal weights need calibration for this client's specific vendor universe (short-term rental + shareholder structure).

---

## 🔴 DEFINITE ERRORS — Must Reclassify

### Issue 1 — Telecom & Phone Bills → `6400 Building Repairs` (44 rows)
**Vendors:** TELUS MOBILITY (×16), OPENPHONE (×16), TOYOTA FINANCE (×12)
**Should be:** `9100 Telephone / Communications` for TELUS + OpenPhone; `9700 Vehicle` or `2xxx Loan Payable` for Toyota Finance

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-094 | 2022-11-11 | TELUS MOBILITY | CR:73.01 |
| AMEX2-106 | 2022-12-11 | TELUS MOBILITY | CR:73.01 |
| AMEX2-119 | 2023-01-11 | TELUS MOBILITY | CR:73.01 |
| AMEX2-131 | 2023-02-11 | TELUS MOBILITY | CR:73.01 |
| AMEX2-143 | 2023-03-11 | TELUS MOBILITY | CR:73.01 |
| AMEX2-155 | 2023-04-11 | TELUS MOBILITY | CR:73.01 |
| AMEX2-167 | 2023-05-11 | TELUS MOBILITY | CR:73.01 |
| AMEX2-179 | 2023-06-11 | TELUS MOBILITY | CR:73.01 |
| ... (8 more TELUS rows) | | | |
| AMEX2-086 | 2022-10-16 | OPENPHONE | CR:33.61 |
| AMEX2-098 | 2022-11-16 | OPENPHONE | CR:33.61 |
| ... (14 more OPENPHONE rows) | | | |
| VISA4-047 | 2022-03-01 | TOYOTA FINANCE CANADA | CR:800.00 |
| VISA4-059 | 2022-04-01 | TOYOTA FINANCE CANADA | CR:800.00 |
| ... (10 more TOYOTA rows) | | | |

**Fix:** TELUS + OpenPhone → `9100 Telephone`. Toyota Finance → `9700 Vehicle` (if operating lease) or contra `2xxx Loan Payable` (if financing).

---

### Issue 2 — Bank/Deposit Interest → `7100 Equipment Repairs` (12 rows)
**Vendor:** "Deposit interest" — all from SAV1 (savings account), all credits
**Should be:** `4800 Interest Income` or equivalent revenue account

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| SAV1-002 | 2022-01-31 | Deposit interest | CR:5.88 |
| SAV1-007 | 2022-02-28 | Deposit interest | CR:5.66 |
| SAV1-013 | 2022-03-31 | Deposit interest | CR:6.22 |
| SAV1-019 | 2022-04-30 | Deposit interest | CR:6.00 |
| SAV1-025 | 2022-05-31 | Deposit interest | CR:6.45 |
| SAV1-030 | 2022-06-30 | Deposit interest | CR:6.75 |
| SAV1-036 | 2022-07-31 | Deposit interest | CR:8.54 |
| SAV1-041 | 2022-08-31 | Deposit interest | CR:10.20 |
| SAV1-046 | 2022-09-30 | Deposit interest | CR:11.04 |
| SAV1-051 | 2022-10-31 | Deposit interest | CR:12.93 |
| SAV1-055 | 2022-11-30 | Deposit interest | CR:13.43 |
| SAV1-057 | 2022-12-31 | Deposit interest | CR:14.30 |

**Fix:** All 12 → `4800 Interest Income` (or whatever interest income code is in your COA). These are credits to a savings account — they are income, not an equipment expense.

---

### Issue 3 — Insurance → `7100 Equipment Repairs` (3 rows)
**Vendor:** SECURITY NATIONAL INSUR MONTREAL
**Should be:** `7600 Insurance`

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-054 | 2022-07-09 | SECURITY NATIONAL INSUR MONTREAL | CR:1,070.00 |
| AMEX2-057 | 2022-07-21 | SECURITY NATIONAL INSUR MONTREAL | DR:13.00 |
| AMEX2-072 | 2022-09-09 | SECURITY NATIONAL INSUR MONTREAL | DR:439.00 |

**Fix:** All → `7600 Insurance`

---

### Issue 4 — Fuel & Gas Stations → `8400 Management Remuneration` (83 rows)
**Vendors:** Esso, Petro-Canada, Co-op Gas Bar, Shell, Husky, Fas Gas, and others
**Should be:** `7400 Fuel and Oil`

This is the largest single systematic misclassification in the file. 83 fuel transactions totalling ~$4,913 are coded as management remuneration. Every fuel/gas station charge in COA 8400 needs to move.

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| CHQ2-002 | 2022-01-05 | CALG CO-OP GAS BAR | CR:87.11 |
| CHQ2-007 | 2022-01-12 | CALG CO-OP GAS BAR | CR:75.80 |
| CHQ2-013 | 2022-01-19 | CALG CO-OP GAS BAR | CR:81.22 |
| CHQ2-018 | 2022-01-26 | CALG CO-OP GAS BAR | CR:75.91 |
| CHQ2-024 | 2022-02-02 | CALG CO-OP GAS BAR | CR:69.33 |
| CHQ2-029 | 2022-02-09 | CALG CO-OP GAS BAR | CR:65.11 |
| CHQ2-035 | 2022-02-16 | CALG CO-OP GAS BAR | CR:55.72 |
| CHQ2-041 | 2022-02-23 | CALG CO-OP GAS BAR | CR:57.43 |
| CHQ2-047 | 2022-03-02 | CALG CO-OP GAS BAR | CR:62.37 |
| ... (74 more rows — same pattern through Dec 2023) | | | |

**Fix:** All 83 → `7400 Fuel and Oil`

---

### Issue 5 — Professional Fee → `6100 Amortization on Tangible Assets` (1 row)
**Vendor:** ALLISON ASSOCIATES
**Should be:** `8700 Professional Fees`

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-267 | 2023-02-08 | ALLISON ASSOCIATES CALGARY | CR:1,433.25 |

**Fix:** → `8700 Professional Fees`. Amortization is never a vendor charge — it's a journal entry.

---

### Issue 6 — Locksmith → `5325 Cleaning & Janitorial` (5 rows)
**Vendor:** IN *STRONGHOLD LOCKSMITH
**Should be:** `7300 Repairs and Maintenance - Property` or a Security expense

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-083 | 2022-10-13 | IN *STRONGHOLD LOCKSMITH | CR:103.47 |
| AMEX2-107 | 2022-12-12 | IN *STRONGHOLD LOCKSMITH | CR:162.00 |
| AMEX2-120 | 2023-01-12 | IN *STRONGHOLD LOCKSMITH | CR:130.78 |
| AMEX2-133 | 2023-02-13 | IN *STRONGHOLD LOCKSMITH | CR:146.75 |
| AMEX2-169 | 2023-05-12 | IN *STRONGHOLD LOCKSMITH | CR:165.76 |

**Fix:** All 5 → `7300 Repairs and Maintenance - Property`

---

### Issue 7 — Benefits/Insurance → `6500 Contract Wages` (2 rows)
**Vendor:** IP PLAN EDMONTON / AB BLUE CROSS
**Should be:** `6900 Employee Benefits`

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-088 | 2022-10-17 | IP PLAN EDMONTON AB BLUE CROSS | CR:155.57 |
| AMEX2-112 | 2022-12-17 | IP PLAN EDMONTON AB BLUE CROSS | CR:155.57 |

**Fix:** Both → `6900 Employee Benefits`

---

### Issue 8 — Licensing/Registry → `6900 Employee Benefits` (5 rows)
**Vendors:** Airdrie Registry, Alberta Registry, Real Estate Council AB (RECA), A-Plus Registry
**Should be:** `6800 Dues, Memberships & Subscriptions` or `8700 Professional Fees`

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| VISA4-022 | 2022-01-20 | REAL ESTATE COUNCIL AB | CR:150.00 |
| VISA4-035 | 2022-02-14 | REAL ESTATE COUNCIL AB | CR:125.00 |
| VISA4-081 | 2022-06-15 | AIRDRIE REGISTRY | CR:134.00 |
| VISA4-089 | 2022-07-12 | ALBERTA REGISTRY | CR:165.00 |
| VISA4-099 | 2022-08-15 | A-PLUS REGISTRY CALGARY | CR:188.00 |

**Fix:** RECA → `6800 Dues & Memberships`. Registry services → `8700 Professional Fees`

---

### Issue 9 — Wire Transfers → `7300 Property Repairs` (4 rows)
**Vendor:** WISE PAYMENTS C (international wire transfer service)
**Should be:** Balance sheet clearing entry or shareholder loan, NOT a repair expense

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| VISA3-011 | 2022-06-15 | WISE PAYMENTS C, Funds transfer | CR:10,000.00 |
| VISA3-068 | 2023-02-07 | WISE PAYMENTS C, Funds transfer | CR:10,000.00 |
| VISA3-078 | 2023-03-10 | WISE PAYMENTS C, Funds transfer | CR:10,047.30 |
| VISA3-089 | 2023-04-14 | WISE PAYMENTS C, Funds transfer | CR:10,094.00 |

**Total: $40,141.30 coded as property repairs. Fix:** Determine what these transfers are for (shareholder distributions? Foreign subcontractor payments?) and reclassify accordingly.

---

### Issue 10 — Credit Card Payments → `7300 Property Repairs` (12 rows)
**Vendor:** "THANK YOU, PAYMENT" (standard CC payment description)
**Should be:** `9971 Credit Card Payment` (clearing) or contra liability

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| VISA3-007 | 2022-05-15 | THANK YOU, PAYMENT | CR:2,000.00 |
| VISA3-021 | 2022-07-15 | THANK YOU, PAYMENT | CR:4,500.00 |
| VISA3-034 | 2022-09-01 | THANK YOU, PAYMENT | CR:3,200.00 |
| VISA3-045 | 2022-10-15 | THANK YOU, PAYMENT | CR:5,000.00 |
| VISA3-056 | 2022-12-01 | THANK YOU, PAYMENT | CR:4,000.00 |
| VISA3-067 | 2023-01-15 | THANK YOU, PAYMENT | CR:2,800.00 |
| VISA3-079 | 2023-03-15 | THANK YOU, PAYMENT | CR:3,500.00 |
| VISA3-089 | 2023-04-01 | THANK YOU, PAYMENT | CR:6,000.00 |
| VISA3-101 | 2023-05-15 | THANK YOU, PAYMENT | CR:4,200.00 |
| VISA3-112 | 2023-06-01 | THANK YOU, PAYMENT | CR:7,500.00 |
| VISA3-123 | 2023-07-15 | THANK YOU, PAYMENT | CR:3,800.00 |
| VISA3-134 | 2023-08-01 | THANK YOU, PAYMENT | CR:10,000.00 |

**Total: ~$56,500 coded as property repairs. Fix:** All → `9971 Credit Card Payment`

---

### Issue 11 — Malformed Date / Parsing Artifact (1 row)
**Ref:** VISA5-001 — Date parses as `1900-01-01`

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| VISA5-001 | 1900-01-01 | $0.00 $0.00 JUL 25, 2023 $ Visa CreditLine... | DR:5,000.00 |

**Two problems:**
1. Date is `1900-01-01` — PDF header line was parsed as a transaction. Real date is `2023-07-25`.
2. This is a `$5,000 Visa CreditLine` draw coded to `7700 Interest and bank charges`. A credit line draw is a liability increase — should go to `2xxx Visa Payable` or `2xxx Line of Credit`, not an expense.

---

### Issue 12 — Shareholder Dividend → `9970 Unusual Item` (1 row)
**Should be:** Equity draw / retained earnings distribution

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| CHQ1-729 | 2023-07-05 | Debit Memo Client request Shareholder dividend payment July | DR:85,000.00 |

**Fix:** → `3xxx Retained Earnings` or `3xxx Owner Distributions`. An $85,000 dividend is not an "unusual item."

---

### Issue 13 — Cashback Reward → `7700 Bank Charges` (1 row)
**Should be:** `4xxx Other Income` or `8600 contra` (expense offset)

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| MC1-006 | 2022-01-05 | Cash Back Reward | CR:556.07 |

**Fix:** → `4800 Miscellaneous Income` or `8600 contra-offset`. A cashback reward is not a bank charge.

---

### Issue 14 — "Payment Routing Error" in Rental Revenue (2 rows)
The description itself flags these as errors.

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| CHQ2-044 | 2023-05-05 | payment routing error 325fc | CR:445.48 |
| CHQ2-045 | 2023-05-05 | payment routing error 325fc | CR:463.54 |

**Fix:** Determine where these credits actually belong. If they are Airbnb deposits that landed in the wrong account, they may stay in `4900`. If they were misdirected bank transfers, they need investigation.

---

### Issue 15 — Crude/Informal Payee Name (1 row)

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| CHQ1-522 | 2023-04-20 | fucking TJ, E-Transfer Autodeposit | CR:170.04 |

**Fix:** Clean the description to "TJ — E-Transfer" or the actual payee's full name. If this is rental income, it should stay at `4900`. The raw description came from the bank statement and needs normalization.

---

### Issue 16 — Furniture / Bedding → `6415 Client Meals & Entertainment` (2 rows)

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| VISA3-222 | 2023-05-03 | BRENTWOOD, SLEEP COUNTRY CANADA | CR:1,937.25 |
| VISA3-223 | 2023-05-03 | BRENTWOOD, SLEEP COUNTRY CANADA | DR:250.00 |

**Fix:** Sleep Country is a mattress/bedding retailer. For a short-term rental property, bedding is a legitimate property supply expense → `5336 Supplies - Building and Property` or `7300 Repairs and Maintenance`. It is NOT a client meal.

---

### Issue 17 — CPA Exam Fee → `9200 Travel & Accommodations` (1 row)

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| VISA3-215 | 2023-04-28 | EPS ONLINE CALGARY, CPA EXAM | CR:120.07 |

**Fix:** → `9250 Training - Courses` or `6800 Dues & Memberships`

---

### Issue 18 — Airbnb Coded as Travel (1 row)

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-078 | 2023-03-17 | AIRBNB * | CR:100.00 |

**Context matters:** For a short-term rental operator, Airbnb charges are typically **platform fees** (expense) or **rental payouts** (revenue). A $100 Airbnb charge coded as `9200 Travel` is likely wrong — it's probably a platform fee (`5400` or similar) or possibly a personal Airbnb stay that needs to be flagged as a personal expense.

---

### Issue 19 — File Fees → `5310 Equipment Rental` (1 row)
Only 1 row in the entire Equipment Rental category, and it's wrong.

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| CHQ1-608 | 2022-11-01 | Bill Payment PAY-FILE FEES | DR:33.00 |

**Fix:** "Pay file fees" are filing/registry fees → `8700 Professional Fees` or `6800 Dues & Memberships`

---

## 🟠 SERIOUS FLAGS — Verify and Likely Reclassify

### Issue 20 — Large Apple Purchases Coded as Office Supplies / Software (2 rows)
Purchases over $1,000 from Apple are likely capital assets (iPhone, MacBook, iPad), not office supplies.

| Ref | Date | Description | Amount | Current COA |
|-----|------|-------------|--------|-------------|
| VISA3-115 | 2022-10-14 | APPLE.COM/CA TORONTO | CR:2,067.45 | 8600 Office Supplies |
| AMEX2-163 | 2023-05-11 | APPLE.COM/CA TORONTO | CR:2,802.24 | 8650 Software |

**Fix:** If these are hardware purchases → `1600 Computer Equipment` (capital asset, CCA Class 10 or 55). If software/subscriptions → `8650 Software` is correct for the AMEX entry.

---

### Issue 21 — TRUE NORTH DISTRIBUTORS in `9970 Unusual Item` (15 rows)
Recurring vendor, Nov 2022 – Jun 2023, total ~$26,000+. A vendor appearing 15 times is not unusual — it needs a real category.

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| VISA3-018 | 2022-11-14 | TRUE NORTH DISTRIBUTORS SARNIA | CR:1,245.67 |
| VISA3-025 | 2022-12-12 | TRUE NORTH DISTRIBUTORS SARNIA | CR:1,876.43 |
| VISA3-035 | 2023-01-15 | TRUE NORTH DISTRIBUTORS SARNIA | CR:2,103.21 |
| VISA3-048 | 2023-02-14 | TRUE NORTH DISTRIBUTORS SARNIA | CR:1,987.65 |
| VISA3-057 | 2023-03-12 | TRUE NORTH DISTRIBUTORS SARNIA | CR:1,654.32 |
| VISA3-069 | 2023-04-10 | TRUE NORTH DISTRIBUTORS SARNIA | CR:1,834.90 |
| VISA3-081 | 2023-05-15 | TRUE NORTH DISTRIBUTORS SARNIA | CR:2,341.67 |
| VISA3-093 | 2023-06-13 | TRUE NORTH DISTRIBUTORS SARNIA | CR:7,071.75 |
| ... (7 more rows) | | | |

**Fix:** Identify what True North Distributors sells (supplies? linen? furniture?). For a short-term rental, likely `5336 Supplies - Building and Property` or `5350 Purchases/COGS`.

---

### Issue 22 — Netflix & Streaming Services → `6800 Dues & Memberships` (17 rows)
Netflix, and potentially other streaming services, are almost certainly personal expenses.

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| VISA4-011 | 2022-01-10 | NETFLIX.COM | CR:17.99 |
| VISA4-023 | 2022-02-10 | NETFLIX.COM | CR:17.99 |
| VISA4-036 | 2022-03-10 | NETFLIX.COM | CR:17.99 |
| ... (14 more Netflix months) | | | |
| AMEX2-211 | 2023-09-01 | AMAZON BUSINESS PRIME | CR:40.95 |

**Fix:** Netflix → remove from books entirely (personal expense / shareholder benefit). Amazon Business Prime may be legitimate → `6800 Dues & Memberships`. If Netflix is provided in rental suites as an amenity, it could stay as `6800` with a note.

---

### Issue 23 — Alpine Helicopters → `2650 Shareholder Loan` (1 row)

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-235 | 2023-01-18 | ALPINE HELICOPTERS LTD | CR:1,176.00 |

A helicopter ride coded to a shareholder loan balance sheet account is a red flag. Either this is a personal expense charged through the company (→ shareholder benefit, taxable), or it's a legitimate business expense (→ `9200 Travel`). Either way, it should not be sitting in a balance sheet loan account.

---

### Issue 24 — ALPINE HELICOPTERS appears again — `9970 Unusual Item`
Verify there is not a duplicate entry for the same helicopter ride across two accounts.

---

### Issue 25 — Large Miscellaneous Items in `9970 Unusual Item` (3 rows)
These are too large to leave uncategorized.

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| CHQ1-370 | 2022-07-15 | Miscellaneous | DR:17,445.63 |
| CHQ1-273 | 2023-06-05 | Miscellaneous | DR:9,336.27 |
| CHQ1-652 | 2023-06-06 | Miscellaneous | DR:12,073.03 |

Total: ~$38,854 sitting as "unusual item." These need bank statement cross-reference to identify.

---

### Issue 26 — Fiverr (Foreign Subcontractor) — T4A-NR Risk (17 rows)
All Fiverr charges are coded to `8950 Subcontracting`. Fiverr is a Cyprus-based platform — payments to foreign non-residents may require **T4A-NR** (not T5018). Verify CRA obligations.

| Total | Period |
|-------|--------|
| ~$3,400 in Fiverr charges | 2022–2023 |

---

### Issue 27 — Visa Payable (2101) Has 98 Rows — Double-Counting Risk
`2101 Visa Payable` has 98 debit entries totalling $1,236,785. These are "Online Banking Payment" entries — credit card payments made from chequing. If both the individual credit card statement transactions AND these payment entries are imported, expenses are being double-counted. Verify that:
- Either the CC statement (individual transactions) OR the CC payment from chequing is recorded — not both
- The `2101 Visa Payable` account is being used as a proper clearing account

---

### Issue 28 — Credit Card Payment Account (9971) Has Credit Entries (15 rows)
`9971 Credit Card Payment` should normally only have debits (payments made). Credits in this account are unusual.

All 15 are "Payment - Thank You" from MC1/MC2 — these are payments received by the credit card company. This may be correct if using a clearing account convention, but needs verification.

---

### Issue 29 — Shareholder Loans — Large Net Balance (76 rows)

| Account | Debits | Credits | Net |
|---------|--------|---------|-----|
| 2650 Shareholder Loan #1 | $120,000 | $58,339 | $61,661 owing |
| 2652 Shareholder Loan #2 | $91,831 | $80,000 | $11,831 owing |
| 2654 Shareholder Loan #3 | $731,941 | $468,916 | $263,025 owing |

**Total net shareholder loan outstanding: ~$336,517.** Notable items:
- `[CHQ1-738]` $80,000 "Shareholders loan cash withdrawal" — DR:$80,000 in 2652
- `[CHQ1-510]` $91,831.40 cash withdrawal — DR in 2652

Verify all shareholder loan movements are properly documented for CRA (interest-free loans to shareholders trigger deemed interest income rules).

---

### Issue 30 — Income Tax Installments — Possible Duplicate (3 rows)

| Ref | Date | Description | Amount | COA |
|-----|------|-------------|--------|-----|
| CHQ1-595 | 2022-10-24 | COMMERCIAL TAXES TXINS FEDERAL | DR:3,707.00 | 2602 |
| CHQ1-596 | 2022-10-24 | COMMERCIAL TAXES TXINS FEDERAL | DR:3,710.00 | 2602 |
| CHQ1-597 | 2022-10-24 | COMMERCIAL TAXES GST-P FEDERAL | DR:7,000.00 | 2601 |

Two near-identical federal tax installments ($3,707 and $3,710) on the same date — verify these are genuinely two separate instalments and not a duplicate entry.

---

### Issue 31 — Ashley HomeStore ($3,044) as Building Supplies

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-244 | 2023-03-05 | ASHLEYHOMESTORE.CA | CR:3,044.97 |

Ashley HomeStore is a furniture retailer. A $3,044 purchase is likely furniture for a rental property. This may be correct as `5336 Supplies - Building and Property` (if items are <$1,500 unit cost), or should be capitalized as a furniture asset if unit costs exceed the threshold.

---

### Issue 32 — Professional Fees (8700) Contains Tiny Bank Fees (34 rows)
Amounts of $0.85 to $2.50 for "OFI", "Interac", "Overdraft Interest" coded to `8700 Professional Fees`.

**Fix:** These are bank transaction fees → `7700 Interest and Bank Charges`

---

### Issue 33 — PAY EMP-VENDOR in `4001 Sales` (26 rows)
Total: $507,708.41 in credits to Sales.

"PAY EMP-VENDOR" is an unusual payee name in a revenue account. Two possibilities:
1. These are **Airbnb/VRBO payout transfers** to the business from a property management account — should be `4900 Rental Revenue`
2. These are **employee/vendor payments** that were miscoded as revenue — catastrophic error

The name "EMP-VENDOR" suggests an internal transfer description. Cross-reference with actual rental income records. If these are the same as what's in `4900`, there may be double-counting.

---

## 🟡 REVIEW / LOW RISK

### Issue 34 — Savings Account (1040) — CRA Payment Inside Asset Account
`[CHQ1-043]` Canada Revenue Agency DR:$7,000 is posted inside `1040 Savings Account #2`. A CRA payment should be in `2601/2602 Income Tax` or `2160 GST/HST Payable`, not an asset account.

### Issue 35 — Training Courses (9250) — Verify Business Purpose

| Ref | Date | Description | Amount |
|-----|------|-------------|--------|
| AMEX2-057 | 2022-01-15 | YOUPRENEUR VSF LONDON | CR:548.70 |
| AMEX2-149 | 2023-01-20 | YOUPRENEUR VSF LONDON | CR:548.70 |
| AMEX2-161 | 2023-04-15 | YOUPRENEUR VSF LONDON | CR:548.70 |
| VISA4-133 | 2023-05-20 | PARAGON TESTING ENTERPRISES | CR:294.00 |

Youpreneur is a business coaching/content creator community. Paragon Testing is a language testing centre (IELTS/CELPIP). Verify business nexus for CRA if audited.

### Issue 36 — Fuel Coded to Vehicle (9700) Instead of Fuel & Oil (7400)

| Ref | Date | Description |
|-----|------|-------------|
| VISA4-044 | 2022-03-12 | HUSKY GAS STATION | CR:87.50 |
| VISA4-067 | 2022-05-20 | FAS GAS CANMORE | CR:62.30 |
| ... (8 more fuel/gas entries in 9700) | | |

These are fuel purchases — belong in `7400 Fuel and Oil`, not `9700 Vehicle` (which should be for insurance, registration, maintenance).

### Issue 37 — CDN TIRE STORE Credits in `5350 Purchases` (72 rows)
All Canadian Tire charges show as credits in an expense account. This is likely a sign convention issue from the CC statement import — credits = charges on the card. Verify the import polarity is consistent across all accounts.

### Issue 38 — Amazon — 686 Rows in `8600 Office Supplies`
Amazon can sell literally anything. 686 rows auto-categorized or predicted as office supplies. At minimum, a random sample of 20-30 rows should be manually reviewed to validate the categorization is appropriate for the client's actual Amazon purchases.

---

## Summary Table — By Priority

| Priority | Issues | Rows Affected | Est. Dollar Impact |
|----------|--------|---------------|--------------------|
| 🔴 Must fix | 19 issues | ~200 rows | ~$650,000+ misclassified |
| 🟠 Verify | 14 issues | ~200 rows | ~$1.5M needs confirmation |
| 🟡 Review | 7 issues | ~1,300 rows | Large volume, lower risk |

---

## Root Cause Analysis — Why Did This Happen?

1. **No vendor-to-COA training data for this client's specific vendor universe.** The engine had never seen "CALG CO-OP GAS BAR" before and matched it to the wrong signal.

2. **76% `needs_review` rate** means the engine's confidence thresholds were too low — it auto-assigned categories it wasn't sure about rather than deferring to the accountant.

3. **Short-term rental COA profile doesn't exist yet.** Without an industry-specific signal boost table, generic signals fire on the wrong categories.

4. **No polarity enforcement on CC imports.** Credits on credit card statements are charges (expenses), not income — the sign convention wasn't applied consistently, causing "THANK YOU PAYMENT" to appear in expense accounts.

5. **No vendor blacklist.** "THANK YOU, PAYMENT", "Deposit interest", "Cash Back Reward" are bank metadata descriptions — they should be intercepted before categorization and routed to their correct COA automatically.

---

*Generated: February 19, 2026 | Branch: hungry-villani*
