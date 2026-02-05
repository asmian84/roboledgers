# RoboLedgers: Canonical Accounting Invariants Locked Specification

**Version:** 1.1.0  
**Status:** LOCKED  
**Authority:** Principal Accounting Systems Architect

This document constitutes the definitive technical and accounting constitution of the RoboLedgers system. These invariants are non-negotiable and SHALL be enforced at the architecture, database, and logic layers.

---

## SECTION 1 — Canonical Transaction Object

The Canonical Transaction Object is the atomic unit of financial truth. It represents a immutable fact of financial history.

### 1.1 Field Definitions

| Field | Type | Requirement | Category |
| :--- | :--- | :--- | :--- |
| `tx_id` | UUID v4 | REQUIRED | **CORE-IMMUTABLE** |
| `account_id` | UUID v4 | REQUIRED | **CORE-IMMUTABLE** |
| `date` | DATE (ISO-8601) | REQUIRED | **CORE-IMMUTABLE** |
| `amount_cents` | INTEGER | REQUIRED | **CORE-IMMUTABLE** |
| `currency` | STRING (ISO-4217) | REQUIRED | **CORE-IMMUTABLE** |
| `polarity` | ENUM (DEBIT, CREDIT) | REQUIRED | **CORE-IMMUTABLE** |
| `raw_description` | STRING | REQUIRED | **CORE-IMMUTABLE** |
| `txsig` | STRING (SHA-256) | REQUIRED | **CORE-IMMUTABLE** |
| `source_system` | STRING | REQUIRED | **CORE-IMMUTABLE** |
| `created_at` | TIMESTAMP | REQUIRED | **CORE-IMMUTABLE** |
| `version` | INTEGER (Positive) | REQUIRED | VERSIONED |
| `status` | ENUM | REQUIRED | VERSIONED |
| `category_id` | UUID v4 | OPTIONAL | VERSIONED |
| `clean_description` | STRING | OPTIONAL | VERSIONED |
| `notes` | STRING | OPTIONAL | VERSIONED |

### 1.2 Immutability Guarantees
- **CORE-IMMUTABLE** fields SHALL NEVER be modified. Any change to these values constitutes a destruction of truth and MUST be handled via a **VOID and REPLACE** protocol.
- **VERSIONED** fields MAY be updated. Every update MUST increment the `version` field and create a new record in the audit version linking table.

### 1.3 New Transaction vs. Revision
- **NEW TRANSACTION**: A record with a `txsig` that does not currently exist for the specific `account_id`.
- **REVISION**: A metadata update (classification, notes, status) to an existing `tx_id`. It preserves the `tx_id` but increments the `version`.

### 1.4 Fingerprint Triggers
The following fields SHALL trigger the generation of a new `txsig`: `account_id`, `date`, `amount_cents`, `currency`, `raw_description`.

---

## SECTION 2 — Transaction Fingerprinting (txsig)

The `txsig` guarantees forensic uniqueness without reliance on internal database auto-increment IDs.

### 2.1 Exact Inputs to txsig
The input string for the hash MUST be a pipe-delimited (`|`) concatenation of the following:
1. `account_id` (UUID string)
2. `date` (YYYY-MM-DD)
3. `amount_cents` (Absolute value integer)
4. `currency` (Uppercase ISO code)
5. `raw_description` (Trimmed, leading/trailing whitespace removed)

### 2.2 Hashing Strategy
The algorithm SHALL be **SHA-256**. The output MUST be represented as a 64-character hexadecimal string.

### 2.3 Collision & Duplicate Handling
- **DUPLICATE DETECTION**: The system SHALL enforce a unique constraint on `(account_id, txsig)`. Any attempt to insert a matching pair SHALL be rejected with `INVARIANT_VIOLATION_TXSIG_DUPLICATE`.
- **COLLISION HANDLING**: In the mathematically improbable event of a hash collision where input data differs, the system SHALL throw `CRITICAL_SECURITY_HASH_COLLISION`.

### 2.4 Overlapping Statement Handling
When importing bank statements with overlapping date ranges, the `txsig` invariant SHALL serve as the primary filter. Transactions with existing `txsig` values SHALL be ignored as "Previously Recorded."

---

## SECTION 3 — Instrument Polarity Rules

### 3.1 Immutable Polarity Mapping

| Instrument | Normal Balance | Increase (+) | Decrease (-) |
| :--- | :--- | :--- | :--- |
| **Bank Account (Asset)** | DEBIT | DEBIT | CREDIT |
| **Credit Card (Liability)** | CREDIT | CREDIT | DEBIT |
| **Loans (Liability)** | CREDIT | CREDIT | DEBIT |
| **Investments (Asset)** | DEBIT | DEBIT | CREDIT |
| **Crypto Wallet (Asset)** | DEBIT | DEBIT | CREDIT |

### 3.2 Polarity Normalization
- **Ledger Math**: All calculations MUST strictly adhere to the Debit/Credit table above.
- **"Zen" User Normalization**: The UI layer MAY present these as positive/negative based on the account type for user clarity (e.g., a "Credit" to a Bank account is a decrease in cash), but the underlying ledger MUST store and process the correct `polarity` ENUM.

---

## SECTION 4 — Immutability & Mutation Rules

### 4.1 No Destructive Updates
The system SHALL NEVER perform a SQL `UPDATE` on **CORE-IMMUTABLE** fields. The system SHALL NEVER perform a SQL `DELETE` on any transaction record.

### 4.2 Revisions
Revisions SHALL be stored as a full state snapshot in a `transaction_versions` table. The main `transactions` table SHALL always reflect the current state and highest `version`.

### 4.3 Reversals
To correct a CORE error (e.g., wrong amount):
1. The original transaction status MUST be set to `VOIDED`.
2. A new transaction MUST be created with a status of `VOID-REPLACEMENT`.
3. If the transaction was in a closed/locked period, an **Adjusting Reversing Entry** MUST be created in the current open period.

### 4.4 Adjusting Entries
Adjusting entries SHALL be marked with an `adjustment_flag` and MUST reference the `tx_id` they are modifying in a `parent_tx_id` field.

---

## SECTION 5 — Audit Trail Invariants

### 5.1 Audit Log Minimum Fields
- `audit_id` (UUID v4)
- `timestamp` (RFC-3339 Nanosecond)
- `actor_id` (User or system process ID)
- `tx_id` (Target transaction)
- `action` (CREATE, UPDATE, VOID, RECONCILE)
- `diff` (JSON Object of before/after states)

### 5.2 Mandatory Logging
The system SHALL log:
- Every transaction insertion.
- Every state change of any VERSIONED field.
- Every instance of an invariant violation attempt.
- All reconciliation status changes.

### 5.3 Time-Travel Reconstruction
The system MUST be able to produce a Trial Balance as of any historical timestamp by filtering for `created_at <= target_time` and ignoring modifications made after `target_time`.

---

## SECTION 6 — Reconciliation Invariants

### 6.1 Mathematical Proof of Reality
- A reconciliation record is ONLY valid if: `(Opening Balance + sum(Debits) - sum(Credits)) == Closing Balance`.
- Any variance ($ > 0$) SHALL block the reconciliation from reaching `LOCKED` status.

### 6.2 Transfer Matching (Two-Leg Rule)
Every internal transfer MUST have two linked entries. If a transfer is marked as "matched", both legs MUST have the same absolute `amount_cents` and opposite `polarity`.

### 6.3 Reporting Constraints
MANDATE: No balance sheet or income statement SHALL be generated for a period that lacks a `RECONCILED` status for all primary cash/liability accounts without a prominent "DRAFT: UNRECONCILED" watermark.

---

## SECTION 7 — Debugging & Exception Strategy

### 7.1 Error Naming Convention
All invariant errors MUST follow: `INVARIANT_VIOLATION_[CATEGORY]_[SPECIFIC]`.

### 7.2 Error Hierarchy

| Error Code | Severity | Description |
| :--- | :--- | :--- |
| `INVARIANT_VIOLATION_TXSIG_DUPLICATE` | BLOCKING | Duplicate transaction fingerprint detected. |
| `INVARIANT_VIOLATION_CORE_IMMUTABILITY` | BLOCKING | Attempted update to an immutable field. |
| `INVARIANT_VIOLATION_RECON_DISCREPANCY` | BLOCKING | Reconciliation math does not balance. |
| `POLARITY_ERROR_UNDEFINED` | BLOCKING | Transaction missing polarity ENUM. |
| `AUDIT_LOG_FAILURE` | CRITICAL | System unable to write to audit log (Stop execution). |

### 7.3 Environmental Behavior
- **Development**: Invariant violations SHALL throw high-visibility exceptions (LOUD).
- **Production**: Invariant violations SHALL return a safe `400 Bad Request` or `500 Server Error` and log the full context to the internal audit trail (SILENTLY SAFE).

### 7.4 Metadata Logging
Every exception MUST capture: `Rule ID`, `Offending Payload`, `Actor ID`, `Request ID`, and `Timestamp`.

---

**FINAL DECLARATION**: This specification is the absolute source of truth for RoboLedgers. No performance optimization or feature request SHALL be permitted to violate these laws.

**LOCKED AS OF: 2026-02-02**
