# RoboLedgers: Canonical Accounting Invariants
**Version:** 1.0.0  
**Status:** DRAFT (LOCKED Pending Final Review)  
**Author:** Principal Accounting Systems Architect

This document defines the immutable laws of RoboLedgers. These rules are non-negotiable and must be enforced at the database and application logic layers.

---

## SECTION 1 — Canonical Transaction Object

The Canonical Transaction Object is the atomic unit of financial truth.

### 1.1 Field Definitions

| Field | Type | Required | Mutation Rule | Hashed in `txsig` |
| :--- | :--- | :--- | :--- | :--- |
| `tx_id` | UUID | YES | **IMMUTABLE** | NO |
| `version` | INT | YES | INCREMENTAL | NO |
| `date` | DATE (ISO) | YES | **IMMUTABLE** | YES |
| `amount` | DECIMAL | YES | **IMMUTABLE** | YES |
| `currency` | STRING (3) | YES | **IMMUTABLE** | YES |
| `account_id` | UUID | YES | **IMMUTABLE** | YES |
| `polarity` | ENUM | YES | **IMMUTABLE** | NO |
| `raw_desc` | STRING | YES | **IMMUTABLE** | YES |
| `source_sys` | STRING | YES | **IMMUTABLE** | NO |
| `txsig` | STRING (64) | YES | **IMMUTABLE** | NO |
| `ext_id` | STRING | NO | **IMMUTABLE** | YES |
| `clean_desc` | STRING | NO | VERSIONED | NO |
| `cat_id` | UUID | NO | VERSIONED | NO |
| `status` | ENUM | YES | AUDITED-VERSIONED | NO |
| `created_at` | TIMESTAMP | YES | **IMMUTABLE** | NO |
| `updated_at` | TIMESTAMP | YES | MUTABLE | NO |

### 1.2 Immutability Guarantees
- **IMMUTABLE**: Once written, these fields can NEVER be modified. Any change requires a reversing entry or a voiding status change with a new version.
- **VERSIONED**: Fields that can be updated (e.g., `cat_id`) must create a new record in the audit version table linked by `tx_id`.

### 1.3 New Transaction vs. Revision
- **NEW TRANSACTION**: A record with a `txsig` that does not currently exist in the ledger for the specific `account_id`.
- **REVISION**: A metadata update (category, cleaner description, notes) to an existing `tx_id`. 
- **CRITICAL**: Changing the `amount`, `date`, or `account_id` is NOT a revision; it is a DESTRUCTION of the original fact. In such cases, the original must be VOIDED and a NEW transaction created.

---

## SECTION 2 — Transaction Fingerprinting (txsig)

The `txsig` (Transaction Signature) is the forensic fingerprint of a transaction. It guarantees uniqueness across all time and space.

### 2.1 Hashing Specification
The `txsig` is a SHA-256 hash of the following fields, concatenated with a pipe separator (`|`):

1. `date` (format: `YYYY-MM-DD`)
2. `amount` (formatted as integer cents/smallest unit, no decimals)
3. `currency` (uppercase ISO 4217, e.g., `USD`)
4. `account_id` (the source bank/ledger account identifier)
5. `raw_desc` (trimmed, lowercase, special characters removed)
6. `ext_id` (if available, else empty string)

**Formula:**  
`txsig = SHA256(date|amount|currency|account_id|raw_desc|ext_id)`

### 2.2 Collision & Duplicate Handling
- **Exact Match**: If an incoming transaction generates a `txsig` already present in the database for the given `account_id`, it is REJECTED as a duplicate.
- **Statement Overlap**: The `txsig` is the primary mechanism for handling overlapping bank statement imports. Duplicate imports will be caught by the `txsig` invariant.
- **Collision Policy**: In the mathematically improbable event of a SHA-256 collision, the system will check the `source_sys`. If `source_sys` is different but `txsig` is the same, throw `INVARIANT_VIOLATION_TXSIG_COLLISION`.

### 2.3 Exception Logic
- If any required field for the `txsig` is missing, the system MUST throw `DESIGN_ERROR_INCOMPLETE_FINGERPRINT`.

---

## SECTION 3 — Instrument Polarity Rules

Polarity defines how a transaction affects the balance of an account. In RoboLedgers, we adhere to the standard accounting equation ($Assets = Liabilities + Equity$) while providing a "Zen" normalization for non-accountant users.

### 3.1 Basic Polarity Mapping

| Instrument Type | Normal Balance | Increase (+) | Decrease (-) |
| :--- | :--- | :--- | :--- |
| **Asset** (Bank, Cash, Crypto) | DEBIT | DEBIT | CREDIT |
| **Liability** (CC, Loan, AP) | CREDIT | CREDIT | DEBIT |
| **Equity** (Owner Capital) | CREDIT | CREDIT | DEBIT |
| **Revenue** (Sales, Income) | CREDIT | CREDIT | DEBIT |
| **Expense** (COGS, Rent) | DEBIT | DEBIT | CREDIT |

### 3.2 Zen Normalization (UI Layer)
To ensure users aren't confused by "Credit Cards having a negative balance" or "Revenue being a Credit", the system MUST apply the following normalization:

- **Amount Storage**: All amounts are stored as absolute positive values in the Canonical Transaction Object. The effect on the ledger is determined by the `polarity` field.
- **Directionality**: 
    - **Asset Accounts**: Debits are displayed as (+) and Credits as (-).
    - **Liability Accounts**: Credits are displayed as (+) [representing increase in debt] or normalized based on the view (e.g., "Balance Owed").

### 3.3 Rule Enforcements
- Every transaction must have a `polarity` defined. If `polarity` is NULL, throw `POLARITY_ERROR_UNDEFINED`.

---

## SECTION 4 — Immutability & Mutation Rules

MANDATE: No destructive updates. Ever.

### 4.1 Field Modifiability Matrix

| Field Category | Fields | Rule | Action on Attempted Mutation |
| :--- | :--- | :--- | :--- |
| **Core Facts** | `date`, `amount`, `currency`, `account_id`, `polarity`, `raw_desc`, `txsig` | **IMMUTABLE** | THROW `INVARIANT_VIOLATION_IMMUTABLE` |
| **Metadata** | `clean_desc`, `cat_id`, `tags`, `notes` | **VERSIONED** | CREATE `tx_version` record |
| **Life-cycle** | `status` | **AUDITED** | UPDATE status + Log Transition |

### 4.2 Revisions & Reversals
- **Revisions**: Updates to "Metadata" fields do not change the `tx_id`. Instead, they increment the `version` number and store the previous state in the audit table.
- **Reversals**: To correct an "IMMUTABLE" field error, the user must:
    1. Update status of the original transaction to `VOIDED`.
    2. Create a NEW transaction with the correct facts.
    3. The system will automatically create a "Reversing Entry" if the original was already posted to a closed period.

### 4.3 Adjusting Entries
Adjusting entries are distinct transactions used to correct or accrue balances at the end of a period. They must reference the original `tx_id` (if applicable) but remain independent objects in the ledger.

---

## SECTION 5 — Audit Trail Invariants

MANDATE: Auditor must be able to reconstruct the ledger at any historical point in time.

### 5.1 Event Logging
Every state change in the system must emit an audit event.

| Action | Log Requirement |
| :--- | :--- |
| **New Tx** | Full Payload + `txsig` |
| **Revision** | Diff of versioned fields + User/Actor ID |
| **Status Change** | State transition (e.g., `PENDING` -> `RECONCILED`) |
| **Recon Event** | Balance Snapshots + Date Range |

### 5.2 Mandatory Audit Fields
Each audit log entry must contain:
1. `audit_id`: UUID
2. `timestamp`: Nanosecond precision RFC 3339
3. `tx_id`: Reference to the Canonical Transaction
4. `actor_id`: UUID of the user or "SYSTEM_AI"
5. `action_type`: ENUM (CREATE, UPDATE, VOID, RECONCILE)
6. `change_log`: JSON Object `{ "field": { "old": val, "new": val } }`
7. `context`: Request ID / IP Address / Source System

### 5.3 Time-Travel reconstruction
The system must support "Point-in-Time" querying.
- **Rule**: A query for "Account Balance as of 2025-01-01" must filter only for transactions with `created_at <= 2025-01-01 23:59:59` and sum their `amount * polarity`.

---

## SECTION 6 — Reconciliation Invariants

Reconciliation is the process of proving the ledger matches reality.

### 6.1 Bank & CC Reconciliation
- **Invariant**: A reconciliation record is valid ONLY if ($Opening Balance + \sum Transactions = Closing Balance$).
- **Discrepancy Policy**: Any variance ($variance > 0$) must throw `INVARIANT_VIOLATION_RECON_DISCREPANCY` and block the locking of the period.

### 6.2 Transfer Matching (The Two-Leg Rule)
- All Internal Transfers must be linked.
- **Invariant**: If Account A sends $100 to Account B, both sides must have a `polarity` that cancels out globally. Missing a "leg" of a transfer prevents reconciliation of both accounts.

### 6.3 Crypto & Investment Reconciliation
- **Dual Layer**: Must reconcile **Cash Basis** (fiat value) and **Unit Basis** (total shares/tokens).
- **Invariant**: On-chain balance (fetched via provider) must match Ledger Unit Balance. A variance of even 0.000000001 (satoshis/gwei) must be flagged for "Network Fee" adjustment.

### 6.4 Reporting Restrictions
- MANDATE: No profit/loss or balance sheet report may be generated for a period that has not been `LOCKED` (fully reconciled) without a "DRAFT: UNRECONCILED" disclaimer.

---

## SECTION 7 — Debugging & Exception Strategy

Every invariant violation must be caught and categorized to ensure the integrity of the ledger.

### 7.1 Error Naming Convention
All invariant errors must follow the pattern: `INVARIANT_VIOLATION_[OBJECT]_[CONDITION]`.

| Error Code | Level | Description |
| :--- | :--- | :--- |
| `INVARIANT_VIOLATION_TXSIG_DUPLICATE` | BLOCKING | A transaction with the same signature already exists. |
| `INVARIANT_VIOLATION_TXSIG_COLLISION` | CRITICAL | Identical hash for different source data (Security Alert). |
| `INVARIANT_VIOLATION_IMMUTABLE_FIELD` | BLOCKING | Attempt to PATCH an immutable field. |
| `INVARIANT_VIOLATION_LOCKED_PERIOD` | BLOCKING | Attempt to write to a date in a reconciled/locked period. |
| `INVARIANT_VIOLATION_RECON_MATH` | WARNING | Sum of entries does not match closing balance. |
| `POLARITY_ERROR_UNDEFINED` | BLOCKING | Transaction missing debit/credit polarity. |
| `AUDIT_ERROR_LINK_BROKEN` | CRITICAL | A version record exists without a parent `tx_id`. |

### 7.2 Handling Behavior
- **Development Environment**: Errors must be **LOUD**. Throw hard exceptions that stop the execution flow and surface a full stack trace + metadata payload (the offending transaction state).
- **Production Environment**: Errors must be **SILENTLY SAFE**. 
    - Log to specialized "Audit Failure" table.
    - Notify System Admin via high-priority alert.
    - REJECT the offending mutation/transaction but keep the system running.

### 7.3 Debug Metadata
Every invariant error must be accompanied by a JSON context containing:
- `offending_payload`: The data that triggered the violation.
- `current_state`: The existing record in the DB (for updates/duplicates).
- `rule_id`: Reference to this document's section.
- `fingerprint`: The `txsig` involved.

---

**FINAL MANDATE:** These invariants represent the technical constitution of RoboLedgers. No feature, AI optimization, or user request shall ever supersede these laws.

**END OF DOCUMENT**
