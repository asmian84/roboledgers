# RoboLedgers: Automated Test & Invariant Enforcement Specification

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Principal Quality & Invariant Engineer

This specification defines the non-negotiable automated test suite required to enforce the Financial Constitution of RoboLedgers. Every test listed here MUST exist and pass for a build to be considered valid for deployment.

---

## SECTION 1 — TEST PHILOSOPHY

Testing in RoboLedgers is not a measure of "feature correctness" or "QA coverage," but a **Constitutional Enforcement Mechanism**. Because the system is built on immutable accounting laws, the test suite functions as a mathematical proof that the software is behaving within its legal boundaries. Any violation of an invariant MUST result in an immediate, CI-blocking failure. We test for what must **ALWAYS** be true and what must **NEVER** happen, ensuring that neither AI drift nor developer error can silently corrupt the ledger.

---

## SECTION 2 — LEDGER CORE TESTS

### 2.1 txsig Generation (Prompt 1)
-   **TEST_TXSIG_DETERMINISM**: Assert that identical input payloads (account_id, date, amount, currency, description) always produce the exact same SHA-256 fingerprint.
-   **TEST_TXSIG_NORMALIZATION**: Assert that variations in leading/trailing whitespace or casing in the description do not alter the generated `txsig`.
-   **TEST_DUPLICATE_REJECTION**: Assert that the Ledger service throws `INVARIANT_VIOLATION_TXSIG_DUPLICATE` when attempting to post a transaction with a pre-existing `txsig` in the same `account_id`.

### 2.2 Transaction Immutability (Prompt 1, 4)
-   **TEST_IMMUTABLE_FIELD_MUTATION**: Assert that any attempt to update `amount_cents`, `date`, `currency`, `polarity`, or `tx_id` on an existing transaction throws `INVARIANT_VIOLATION_CORE_IMMUTABILITY`.
-   **TEST_VERSION_INCREMENT**: Assert that modifying a **VERSIONED** field (e.g., tags, notes) results in the `version` count increasing by exactly 1 and a new audit record being linked.
-   **TEST_VOID_PRESERVATION**: Assert that a **VOIDED** transaction remains in the database with its original CORE-IMMUTABLE data intact, and that a new replacement transaction is required for corrections.

### 2.3 Audit Logging (Prompt 5)
-   **TEST_LOG_ON_CREATE**: Assert that every successful `post()` action emits an audit record with `timestamp`, `actor_id`, and a full state JSON payload.
-   **TEST_LOG_ON_STATUS_CHANGE**: Assert that changing a transaction state (e.g., `RAW` to `CONFIRMED`) is recorded in the audit log with a before/after diff.

---

## SECTION 3 — PARSER & INGESTION FIREWALL TESTS

### 3.1 Quarantine Isolation (Safe Parser Import Plan)
-   **TEST_PARSER_ISOLATION**: (Automated File Scan) Assert that no file in `/src/parsers_raw/` contains imports or references to `/src/core`, `/src/ledger`, `/src/reconciliation`, or `/src/brain`.
-   **TEST_PARSER_TXSIG_PROHIBITION**: Assert that no raw parser generates hashes or fingerprints locally.

### 3.2 Ingestion & Adapter Logic
-   **TEST_POLARITY_ASSIGNMENT_PROHIBITION**: Assert that raw parsers DO NOT output `polarity` (Debit/Credit) or `category_id`.
-   **TEST_ADAPTER_NORMALIZATION**: Assert that the `ParserAdapter` is the only point where raw strings are converted to `ISO-8601` and `integer cents`.

---

## SECTION 4 — COA & CLASSIFICATION TESTS

### 4.1 Schema Integrity (Prompt 2)
-   **TEST_ACCOUNT_CODE_RANGE**: Assert that every account code in the COA falls strictly within the `1000–9999` range.
-   **TEST_COA_METADATA_COMPLETENESS**: Assert that no account can be initialized without `instrument_type`, `reconciliation_method`, and `tax_behavior`.

### 4.2 Posting Constraints
-   **TEST_ILLEGAL_POLARITY_MAPPING**: Assert that attempting to map a transaction to a COA class with a conflicting "Normal Balance" (e.g., Credit a Cash account that makes it negative) triggers `COA_POLARITY_CONFLICT_ERROR`.
-   **TEST_COA_GATE_ENFORCEMENT**: Assert that any categorization attempt that fails `Instrument_Type` compatibility is hard-rejected by the gate.

---

## SECTION 5 — CATEGORIZATION BRAIN TESTS

### 5.1 Scoring & Thresholds (Prompt 3)
-   **TEST_SCORING_BOUNDARIES**: Assert that the weighted Scoring Engine always produces a value between `0.0` and `1.0`.
-   **TEST_CONFIDENCE_ACTIONS**: Assert that scores `< 0.7` result in a `DEFER` state and `> 0.9` (with identity match) result in `AUTO-CONFIRM` logic.

### 5.2 AI Constraints
-   **TEST_AI_ACCOUNT_SELECTION_BAN**: Assert that the AI layer is physically unable to provide an authoritative `account_id` or `category_id` to the ledger.
-   **TEST_DETERMINISTIC_OVERRIDE**: Assert that if deterministic Scoring Engine identifies a match, AI suggestions are ignored or moved to "Advisor Only" notes.

---

## SECTION 6 — RECONCILIATION & PROOF TESTS

### 6.1 Mathematical Validity (Prompt 6)
-   **TEST_RECON_MATH_BANK**: Assert that `(Opening + Debits - Credits) == Closing` must hold to reach `RECONCILED` status.
-   **TEST_RECON_MATH_CC**: Assert that `(Opening + Charges - Payments - Refunds) == Closing` must hold.
-   **TEST_VARIANCE_FAILURE**: Assert that a variance of even `$0.01` prevents a Period Lock.

### 6.2 Proof & Matching
-   **TEST_PROOF_OBJECT_REQUIREMENT**: Assert that the system cannot transition to `LOCKED` state without a cryptographically signed Proof Object for the period.
-   **TEST_TRANSFER_ZERO_SUM**: Assert that any matched internal transfer leg without a corresponding opposite leg in the global ledger blocks reconciliation completion.

---

## SECTION 7 — AUTHORITY & PERIOD GOVERNANCE TESTS

### 7.1 Lifecycle & Rules (Prompt 5)
-   **TEST_LIFECYCLE_ORDER**: Assert that a period cannot move to `LOCKED` directly from `OPEN` (it must pass through `RECONCILED`).
-   **TEST_LOCKED_PERIOD_IMMUTABILITY**: Assert that `post()`, `void()`, or `update()` attempts on a transaction within a `LOCKED` date range are blocked with `AUTHORITY_VIOLATION_LOCK_BREACH`.

### 7.2 Corrections & Roles
-   **TEST_AJE_AUTHORITY**: Assert that only the `Accountant` role can create Adjusting Journal Entries.
-   **TEST_ROLE_REJECTION**: Assert that a `Zen User` attempting to trigger a Period Lock receives a `403 Forbidden` error.

---

## SECTION 8 — FEATURE FLAG & PRICING TESTS

### 8.1 Capability Enforcement (Prompt 7)
-   **TEST_CAPABILITY_LEAK_API**: Assert that API endpoints for `CAN_POST_AJE` reject requests from users on the `Plus` or `Free` tiers.
-   **TEST_UI_BYPASS_LOGIC**: Assert that if a required capability is absent in the backend, the logic remains unreachable regardless of UI state.

---

## SECTION 9 — FAILURE MODE & SAFETY TESTS

### 9.1 System Resilience
-   **TEST_INVARIANT_HALT**: Assert that an unhandled `INVARIANT_VIOLATION` immediately halts a batch ingestion process.
-   **TEST_READ_ONLY_FALLBACK**: Assert that if the `AuditLog_Write` stream fails, the Ledger service enters a global "Read-Only" mode.
-   **TEST_KILL_SWITCH_BEHAVIOR**: Assert that when the `Automation_Kill_Switch` is active, the Brain is disabled and all categorization defaults to `RAW`.

---

## SECTION 10 — CI & RELEASE TESTS

### 10.1 Integrity Checks
-   **TEST_MIGRATION_SAFETY**: Assert that database migrations do not alter pre-existing `txsig` values or `CORE-IMMUTABLE` history.
-   **TEST_RELEASE_INTEGRITY_CERT**: Assert that every production build generates a `Release Integrity Certificate` that hashes the master system prompt and all locked specifications.

---

**TEST COVERAGE: COMPLETE**
