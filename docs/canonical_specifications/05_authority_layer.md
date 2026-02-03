# RoboLedgers: Authority, Period Close, and Adjustment Model Specification

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Principal Accounting Governance Architect

This specification defines the final authority and governance layer of RoboLedgers.

---

## SECTION 1 — Authority Model & Roles

Authority in RoboLedgers SHALL be role-based and strictly enforced.

| Role | Allowed Actions | Forbidden Actions |
| :--- | :--- | :--- |
| **Zen User** | Metadata edits, Category confirmation | Period locking, AJE creation |
| **Bookkeeper** | Reconciliation execution, Transfer matching | Final Period Locking, AJE posting |
| **Accountant** | Period Locking, AJE creation/posting, Sign-off | Deletion of audit logs |
| **Auditor** | Read-only access to all ledgers | Any mutation of any data |

---

## SECTION 2 — Period Lifecycle Model

1.  **OPEN**: Transactions are added; Brain categorizations are `PREDICTED`.
2.  **RECONCILED**: Mathematical Proof Objects generated.
3.  **LOCKED**: Final accountant verification. No further transaction entries allowed.
4.  **ADJUSTED**: A LOCKED period that contains subsequent Adjusting Journal Entries (AJEs).

---

## SECTION 3 — Adjusting Journal Entries (AJEs)

### 3.1 AJE Invariants
- AJEs SHALL ONLY be created by actors with **Accountant** authority.
- AJEs SHALL NEVER mutate the original transaction data. They provide an additive layer of truth.
- AJEs SHALL be stored in an independent `Adjustments Ledger`.

---

## SECTION 4 — Downstream Output Trust Model

### 4.1 Trust Tiers
- **UNCERTIFIED (Tier 3)**: Any output referencing `OPEN` periods.
- **RECONCILED (Tier 2)**: Outputs referencing `RECONCILED` but unlocked periods.
- **CERTIFIED (Tier 1)**: Outputs referencing `LOCKED` periods with Accountant Sign-off.

MANDATE: Bank approval packages and tax filings MUST ONLY be generated as Tier 1 Certified outputs.
