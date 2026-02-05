# RoboLedgers: Reconciliation & Proof Layer Specification

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Principal Accounting Systems Architect

This specification defines the deterministic Proof Engine for RoboLedgers.

---

## SECTION 1 — Reconciliation Architecture Overview

Reconciliation SHALL be treated as a deterministic proof of ledger integrity. A "Reconciled" status is not a user-toggled flag; it is a calculated state.

### 1.1 Invariant Math (Banks)
For any bank account, the reconciliation SHALL satisfy the equation:  
`OpeningBalance + Sum(Debits) - Sum(Credits) = ClosingBalance`

### 1.2 Invariant Math (Cards)
For any credit card account, the reconciliation SHALL satisfy the equation:  
`PriorBalance + Sum(Charges) - Sum(Payments) - Sum(Refunds) = EndingBalance`

---

## SECTION 2 — Internal Transfer Matching

### 2.1 Matching Criteria
Two transactions SHALL be automatically matched as an internal transfer if:
1. The `amount_cents` are identical.
2. The `polarity` values are opposite.
3. The `date` fields fall within a tolerance window of **+/- 5 calendar days**.
4. Both accounts are owned by the same legal entity.

### 2.2 Matching Invariants
- **Global Net Zero**: Internal transfers MUST net to zero across the global ledger.
- **P&L Exclusion**: Matched transfers SHALL NEVER be mapped to `Revenue` or `Expense` Canonical Classes.

---

## SECTION 3 — Period Locking & Integrity Gates

### 3.1 Hard Locks
- **Forbidden**: No transaction with a `date` in a locked period SHALL be edited, voided, or added.
- **Adjusting Entries**: Corrections to locked periods MUST be executed as Adjusting Entries in the current open period, referencing the prior period's `tx_id`.

### 3.2 Reporting Invariants
- **CFO Ratios**: Liquidity/leverage ratios MUST ONLY be calculated for `LOCKED` periods.
- **External Exposure**: Certified bank packages MUST ONLY use data from verified periods.
