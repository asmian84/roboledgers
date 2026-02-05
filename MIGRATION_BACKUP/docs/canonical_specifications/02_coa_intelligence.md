# RoboLedgers: Canonical COA Intelligence Layer Specification

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Principal Accounting Systems Architect

This specification defines how the Chart of Accounts is interpreted, classified, and constrained to power automated intelligence.

---

## SECTION 1 — Canonical Account Classes

| Class ID | Description | Normal Balance | Statement | Eligible Instruments |
| :--- | :--- | :--- | :--- | :--- |
| **CASH_LIQ** | Unrestricted cash and bank balances | DEBIT | BS | Bank, Crypto |
| **INV_MKT** | Marketable securities and portfolio investments | DEBIT | BS | Investment, Crypto |
| **AR_TRADE** | Amounts due from customers for sales/services | DEBIT | BS | Cash |
| **AR_OTHER** | Non-trade receivables (loans, advances, NSF) | DEBIT | BS | Cash |
| **INV_STOCK** | Inventory held for resale or production | DEBIT | BS | Asset |
| **PREPAID** | Payments for future benefits/services | DEBIT | BS | Asset |
| **FA_LAND** | Non-depreciable real estate assets | DEBIT | BS | Asset |
| **FA_BLDG** | Buildings and structures | DEBIT | BS | Asset |
| **FA_EQUIP** | Furniture, computers, heavy equipment | DEBIT | BS | Asset |
| **FA_VEHIC** | Motor vehicles and transport gear | DEBIT | BS | Asset |
| **FA_LEASE** | Leasehold improvements | DEBIT | BS | Asset |
| **FA_INTAN** | Goodwill, software, incorporation costs | DEBIT | BS | Asset |
| **FA_CONTRA** | Accumulated amortization/depreciation | CREDIT | BS | Asset |
| **AP_TRADE** | Trade payables and credit card balances | CREDIT | BS | Card, Cash |
| **TAX_SALES** | Sales tax clearing (GST/HST) | CREDIT | BS | Liability |
| **TAX_CORP** | Current and future income tax liabilities | CREDIT | BS | Liability |
| **ACCR_LIAB** | Accrued wages and matching liabilities | CREDIT | BS | Liability |
| **DEBT_ST** | Demand loans and current portion of LT debt | CREDIT | BS | Loan |
| **DEBT_LT** | Bank loans, mortgages, finance contracts | CREDIT | BS | Loan |
| **SH_LOAN** | Shareholder loans and intercompany dues | CREDIT | BS | Liability |
| **EQUITY_CAP** | Common and preferred share capital | CREDIT | BS | Equity |
| **EQUITY_RE** | Retained earnings and surplus | CREDIT | BS | Equity |
| **REV_OP** | Primary sales, fees, and commissions | CREDIT | IS | Revenue |
| **REV_NON_OP** | Interest, rent, and asset gains/losses | CREDIT | IS | Revenue |
| **COGS_DIRECT** | Direct materials, labor, and subcontractors | DEBIT | IS | Expense |
| **EXP_OP_G&A** | General admin, office, and rent expenses | DEBIT | IS | Expense |
| **EXP_OP_SAL** | Wages, benefits, and contract labor | DEBIT | IS | Expense |
| **EXP_OP_MRKT** | Advertising and business development | DEBIT | IS | Expense |
| **EXP_OP_MNT** | Repairs, fuel, and shop supplies | DEBIT | IS | Expense |
| **EXP_OP_FIN** | Interest, bank charges, and foreign exchange | DEBIT | IS | Expense |
| **EXP_NON_OP** | Amortization, taxes, and unusual items | DEBIT | IS | Expense |

---

## SECTION 2 — Intelligence Constraints

### 2.1 Categorization Constraints
- **AUTO-CATEGORIZATION BANNED**: The following accounts SHALL NEVER be auto-categorized by AI:
    - 2650-2664 (Shareholder Loans)
    - 2950-2964 (Long-term Shareholder Loans)
    - 4950-4973 (Gains/Losses on Investment/Asset Sale)
    - 9970 (Unusual Items)
- **ACCOUNTANT AUTHORITY REQUIRED**: Any transaction exceeding a **$1,000 threshold** hitting a Fixed Asset (1500-1865) MUST be flagged for professional review.

### 2.2 Capitalization Thresholds
- Any transaction hitting 8800 (Repairs) or 8450 (Supplies) over **$2,500** SHALL be flagged as a potential Capital Asset (Fixed Asset) for review.

### 2.3 Shareholder Loan Monitoring
- Any combined liability in accounts 2650-2664 (SH Loans) that flips to a net DEBIT balance for >90 days SHALL emit a "Shareholder Debit Risk" alert for tax compliance.

### 2.4 Tax Risk Flags
- Transactions hitting 2150 (GST Paid) without a corresponding 4001/4002 (Revenue) event SHALL be flagged as a high-risk tax audit anomaly.

---

## SECTION 3 — CFO / Bank Intelligence Enablement

### 3.1 Liquidity Ratios
- **Current Ratio**: Sum(CASH_LIQ + AR_TRADE + AR_OTHER + INV_STOCK) / Sum(AP_TRADE + TAX_SALES + ACCR_LIAB + DEBT_ST).
- **Quick Ratio**: Sum(CASH_LIQ + AR_TRADE) / Sum(AP_TRADE + ACCT_LIAB + DEBT_ST).

---

## SECTION 4 — Debugging & Validation Rules

### 4.1 Validation Errors
- `DESIGN_INCOMPLETE_COA_ERROR`: Thrown if a transaction hits an account string not explicitly mapped.
- `COA_METADATA_MISSING_ERROR`: Thrown if an account used in a posting trial balance lacks metadata.
- `COA_POLARITY_CONFLICT_ERROR`: Thrown if a transaction's polarity violates the "Normal Balance" of its Canonical Class (e.g., a CREDIT to Bank Chequing that results in a negative balance).
