# RoboLedger Code Audit Report
**Date:** 2026-02-22 | **Branch:** claude/nice-williamson

**CRITICAL FAILURES: 7 | WARNINGS: 14 | PASSES: 56 | Dead Code: 6 | Consistency Issues: 5**

---

## CRITICAL FAILURES (must fix)

### CRITICAL-1. `ledger.core.js` — `Brain.rules` contains wrong/nonexistent COA codes

`Brain.rules` references codes that are wrong for this COA:
- `'4000'` for `adobe|google|aws|github` — 4000 is **Revenue - general**. These are expenses.
- `'8500'` for `starbucks|uber|tim hortons` — **8500 does not exist in COA_DEFAULTS**. Correct code is `6415`.
- `'8100'` for `rent|lease|office` — 8100 is **Meals and entertainment**. Wrong account.
- `'6000'` for `salary|payroll|wage` — **6000 is not in COA_DEFAULTS**. Wages are at 9800.
- `'8800'` for `monthly fee|service charge` — 8800 is **Repairs and maintenance**. Correct code is `7700`.

**Impact:** Silently writes transactions to nonexistent or incorrect GL accounts. `state.coa['8500']` is `undefined` — producing `gl_account_name: 'Unknown'` with no error, corrupting the ledger.

**Fix:** Update Brain.rules: `'4000'` → `'6800'`, `'8500'` → `'6415'`, `'8100'` → remove or use correct rent code, `'6000'` → `'9800'`, `'8800'` → `'7700'`.

---

### CRITICAL-2. `ledger.core.js` — `autoCategorizTransaction()` silently accepts nonexistent COA codes

```js
const coaEntry = state.coa[rule.category];  // undefined if code not in COA
// ...
gl_account_name: coaEntry ? coaEntry.name : 'Unknown'  // no error thrown
```

**Impact:** Any transaction matched by a rule whose category code is not in `state.coa` gets written with category_code set to the bad code and category_name = `'Unknown'`. Silent data corruption.

**Fix:** Add validation — if `!state.coa[rule.category]`, log a warning and return `{ status: 'needs_review', confidence: 0 }`.

---

### CRITICAL-3. `RBCChequingParser.js` — Uses `parseWithRegex()` instead of `async parse()`, missing `_resetAuditState()`

Every other parser implements `async parse()` and calls `this._resetAuditState()` at the top. `RBCChequingParser` implements `parseWithRegex()` (the base-class fallback stub) and never resets audit state.

**Impact:** When the singleton parser is reused across multiple file uploads, `_txSeq` and `_cachedStmtId` are never reset. `parser_ref` values accumulate monotonically across files making audit references non-unique per statement.

**Fix:** Rename to `async parse()`, add `this._resetAuditState()` at the start, add `_getStmtId()` and `_resetAuditState()` helpers.

---

### CRITICAL-4. `AuditSidebar.jsx` — Null crash on `transaction.pdfLocation` in legacy PDF path

In the else-branch of the "View in PDF" button handler (when `transaction.source_pdf?.url` is falsy):

```js
page: transaction.source_pdf.page || transaction.pdfLocation.page,  // CRASHES if pdfLocation is null
top: transaction.pdfLocation.top,     // CRASHES
```

If `transaction.pdfLocation` is `null`, this throws `TypeError: Cannot read properties of null (reading 'page')`.

**Fix:** Add optional chaining throughout: `transaction.pdfLocation?.page`. Guard: if neither `source_pdf?.url` nor `pdfLocation` are available, show the "no PDF" alert and return early.

---

### CRITICAL-5. `app.js` — `computeCOABalances()` income-statement side reverses revenue account balances

```js
const signedAmount = tx.polarity === 'DEBIT' ? absAmount : -absAmount;
```

For REVENUE accounts (credit-normal), a CREDIT polarity produces a **negative** balance. This always shows revenue as negative.

**Impact:** COA page displays revenue balances as negative even when the business has income.

**Fix:** Inspect the COA entry's `.sign` field and invert accordingly:
```js
const coaEntry = ledger.COA?.get(catCode);
const isCreditNormal = coaEntry?.sign === 'Credit';
const signedAmount = tx.polarity === 'DEBIT'
    ? (isCreditNormal ? -absAmount : absAmount)
    : (isCreditNormal ? absAmount : -absAmount);
```

---

### CRITICAL-6. `ledger.core.js` — `Ingestion.parseCSV()` does not handle quoted fields

```js
const values = line.split(',').map(v => v.trim());
```

Any CSV with quoted fields containing commas (e.g. `"$1,234.56"` in a bank CSV export) will be split incorrectly.

**Impact:** All currency-formatted amounts in bank CSV exports (e.g. RBC formats as `"1,234.56"`) will parse as broken values. All amounts for those rows will be zero or incorrect.

**Fix:** Replace `line.split(',')` with an RFC 4180-compliant quoted-field parser.

---

### CRITICAL-7. `HSBCParser.js` — Debit/credit column logic is incorrect

```js
if (amounts.length >= 3) {
    debit = amount;                                        // amounts[0]
    credit = parseFloat(amounts[1].replace(/,/g, ''));    // amounts[1]
} else {
    debit = amount;   // Default: no credit path at all
}
```

For a deposit row (Withdrawal=blank, Deposit=100, Balance=1000): amounts = `[100, 1000]` (2 amounts) → hits `else` → sets `debit = 100`. Transaction posted as debit (withdrawal) when it is actually a deposit.

**Impact:** All HSBC deposit transactions appear as debits (withdrawals). All HSBC statement balances incorrect.

**Fix:** Determine column assignment by comparing running balance. Use keyword/prefix heuristics or balance delta to distinguish withdrawal vs deposit when only one amount is present.

---

## WARNINGS (should fix)

**W1** — `ledger.core.js`: Code `9970` ("Unusual item", root: EXPENSE) used as uncategorized fallback shows uncategorized transactions on the income statement. Add exclusion or new UNCLASSIFIED root.

**W2** — `ledger.core.js`: `_assignCOACode()` has no guard against non-canonical `accountType` values from parsers. A savings account labelled `'Chequing'` gets a Chequing COA code.

**W3** — `ledger.core.js`: `Brain.cleanDescription()` Rule 1 regex `/^[A-Z][a-z]+\s+\d+,\s+/` may strip legitimate vendor names. Constrain to known month names.

**W4** — `RBCChequingParser.js`: Transactions pushed from the gap-solver path have no `rawText` field. `statement_text` in ingestion falls back to `raw_description` instead of the original PDF line.

**W5** — `RBCMastercardParser.js`: `pending.accountNumber` is never set. `_acct` is always empty string on every RBC Mastercard transaction. Fix: use `rawAcct` directly.

**W6** — `ScotiaVisaParser.js`, `ATBParser.js`, `BMOMastercardParser.js`, `CIBCVisaParser.js`, `CIBCChequingParser.js`, `HSBCParser.js`: No year-rollover logic. Statements spanning December-January assign wrong year to January transactions.

**W7** — `BMOCreditCardParser.js`: `audit` field missing from returned transaction objects. AuditSidebar cannot display audit metadata.

**W8** — `BMOMastercardParser.js`: Missing `_accountType: 'CreditCard'` on returned transactions. `_isLiabilityTx()` guarding may fail.

**W9** — `ATBParser.js`: `_accountType` not set on extracted transactions (only on parsedMetadata). Same impact as W8.

**W10** — `CIBCChequingParser.js`: Year rollover not implemented (same as W6).

**W11** — `app.js`: `renderAdminDashboard()` uses deprecated `t.debit`/`t.credit` fields. Recent transactions use `amount_cents` + `polarity`, producing zero revenue/expense totals in the admin dashboard.

**W12** — `ReportGenerator.js`: `isGSTExempt()` uses string comparison `accountCode >= '3000'` — relies on lexicographic ordering. Fix: use `parseInt(account.code)`.

**W13** — `SignalFusionEngine.js`: WEIGHTS object ordering inconsistent with header comment.

**W14** — `AuditSidebar.jsx` Lines 60-66, 293: Debug `console.log` statements logging full transaction objects left in production render path. Remove or gate on `NODE_ENV === 'development'`.

---

## PASSES (verified correct)

### `ledger.core.js`
- `COA.register()` template-claiming fix is correct. PASS
- `_assignCOACode()` range assignments correct (CreditCard: 2101-2199, Savings: 1035-1099, Chequing: 1000-1034). PASS
- AUTO_CATEGORIZE_RULES code `2149` (GST payments) verified in COA_DEFAULTS. The 2110→2149 fix is correct. PASS
- Revenue rules correctly guard with `!_isLiabilityTx(tx)`. PASS
- `statement_text: row.rawText || raw_description` correctly implemented. PASS
- `9970` and `9971` exist in COA_DEFAULTS. PASS
- `Brain.cleanDescription()` pagination artifact removal is correct and minimal. PASS
- LEDGER_VERSION check on load auto-clears incompatible cache. PASS
- `generateTxSig()` uses `Math.abs(amount_cents)` correctly. PASS
- `_isLiabilityTx()` checks `accountType.toLowerCase() === 'creditcard'` then falls back. PASS

### `app.js`
- `computeCOABalances()` balance sheet side: CC uses CREDIT+ / DEBIT-; CHQ/SAV uses DEBIT+ / CREDIT-. PASS
- `toggleCoARow()` calls `computeCOABalances()` before rendering. PASS
- `initCOAGrid()` columns: Account #, Account Name, Sign, Type, L/S, Balance — correct. PASS
- `Ledger.getAll()` consistently used via `window.RoboLedger.Ledger.getAll()`. PASS

### Parsers
- All 10 audited parsers extend `BaseBankParser`. PASS
- `_resetAuditState()` called at start of `parse()` in: RBCMastercard, ScotiaVisa, ATB, BMOCreditCard, BMOMastercard, CIBCChequing, CIBCVisa, HSBC. PASS (all except RBCChequing)
- Debit/credit sign convention correct in RBCMastercard, ScotiaVisa, BMOMastercard, CIBCVisa. PASS
- `rawText`, `parser_ref`, `pdfLocation`, `audit` fields present in all major parsers. PASS (with exceptions noted)
- AmexParser produces all required fields. PASS

### `AuditSidebar.jsx`
- GST Summary block absent — correctly removed. PASS
- Optional chaining used for most `pdfLocation` accesses. PASS

### `ReportGenerator.js`
- `_effectivePolarity()` used throughout income statement, balance sheet, GST, GL. PASS
- `generateIncomeStatement()`, `generateGSTReport()`, `generateBalanceSheet()` all correct. PASS

### `SignalFusionEngine.js`
- Deterministic pre-check, post-fuse CC credit guard, signal weights all correct. PASS

### `CategorizationEngine.js`
- Three-layer architecture, EXPENSE/REVENUE_KEYWORDS codes all correct. PASS

### `utility-bar.js`
- No stale API references; `resolveCOAName()` and `resolveRootFromCode()` handle null COA correctly. PASS

---

## Dead Code / Cleanup

**D1** — `ledger.core.js`: `Brain.predict()` and `Brain.rules` are dead code — `autoCategorizTransaction()` is the only active categorizer. Remove after verifying no external callers.

**D2** — `RBCChequingParser.js`: `extractTransaction()` method is never called from `parseWithRegex()`. Dead code containing the only `rawText` construction logic for this parser.

**D3** — `app.js`: `version: '1.5.0'` appears twice. Verify which is canonical.

**D4** — `SignalFusionEngine.js`: `AMOUNT_RULES` entry routing tiny debits (<$6) to Professional Fees (8700) is a poor heuristic. Low-confidence so doesn't auto-apply, but adds noise.

**D5** — `AuditSidebar.jsx`: Receipt upload handler is a stub (`console.log` only). Remove the UI button until implemented.

**D6** — `CategorizationEngine.js`: Duplicate FUEL pattern (SUNOCU appears twice). Remove one instance.

---

## Consistency Issues

**C1** — Parser method signature: `RBCChequingParser` uses `parseWithRegex()`, all others use `async parse()`. Creates a two-tier API.

**C2** — `_accountType: 'CreditCard'` field inconsistently set across CC parsers. Standardize in every CC parser's `extractTransaction()`.

**C3** — `_getStmtId()` and `_resetAuditState()` duplicated identically across 8+ parsers. Should be methods of `BaseBankParser`.

**C4** — `ReportGenerator.js`: `generateCOASummary()` uses dual-format COA lookup while all other methods use single format.

**C5** — `CategorizationEngine.js`: Comment says "6800 also covers registries/dues" but code maps to `8950`. Contradictory.

---

## Summary Table

| File | Critical | Warning | Pass | Dead/Cleanup |
|------|----------|---------|------|--------------|
| ledger.core.js | 3 | 3 | 11 | 1 |
| app.js | 1 | 2 | 5 | 1 |
| utility-bar.js | 0 | 0 | 2 | 0 |
| RBCChequingParser | 1 | 1 | 2 | 1 |
| RBCMastercardParser | 0 | 1 | 3 | 0 |
| ScotiaVisaParser | 0 | 1 | 3 | 0 |
| ATBParser | 0 | 1 | 3 | 0 |
| BMOCreditCardParser | 0 | 1 | 2 | 0 |
| BMOMastercardParser | 0 | 1 | 2 | 0 |
| CIBCChequingParser | 0 | 1 | 2 | 0 |
| CIBCVisaParser | 0 | 0 | 3 | 0 |
| AmexParser | 0 | 0 | 3 | 0 |
| HSBCParser | 1 | 0 | 2 | 0 |
| AuditSidebar.jsx | 1 | 1 | 3 | 1 |
| ReportGenerator.js | 0 | 1 | 4 | 0 |
| CategorizationEngine.js | 0 | 0 | 3 | 2 |
| SignalFusionEngine.js | 0 | 1 | 3 | 1 |
| **TOTAL** | **7** | **14** | **56** | **6** |

---

*End of audit report. No code changes were made during audit.*
