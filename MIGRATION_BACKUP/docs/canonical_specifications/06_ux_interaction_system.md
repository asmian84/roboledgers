# RoboLedgers: UX System Prompts & Interaction Specification

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Principal Product Designer & UX Systems Architect

This document defines the interaction philosophy and mode-based UX contracts for the RoboLedgers system. The UX SHALL serve as a protective layer that exposes financial truth while preventing any violation of the underlying Canonical Accounting Invariants.

---

## SECTION 1 — UX Design Laws

The following laws SHALL govern every interaction within the RoboLedgers interface:

1.  **NO SILENT MUTATION**: Every action that changes the state of a transaction or ledger MUST provide immediate, visible feedback of the change and its audit trail consequence.
2.  **NO DESTRUCTIVE ACTIONS**: The interface SHALL NEVER offer a "Delete" option for transactions. Only "Void" and "Correction" actions SHALL be exposed.
3.  **TRUTH BEFORE BEAUTY**: Financial data from unreconciled periods MUST be visually demarcated (e.g., with "DRAFT" watermarks or distinct styling) to prevent it from being mistaken for final, audit-ready numbers.
4.  **AUTHORITY-GATED CLARITY**: UI elements for actions outside a user's role authority SHALL be hidden or definitively disabled, never "transparently failing" upon click.

---

## SECTION 2 — Mode-Based UX Contracts

### 2.1 Zen User (Business Owner)
-   **Visible**: Cash balances, categorized spend, high-level profit/loss, simplified runway.
-   **Editable**: Transaction metadata (notes, tags, clean descriptions), basic category confirmation.
-   **Forbidden**: Adjusting entries, period locking, COA metadata management.
-   **Confidence UX**: High-confidence brain predictions are "Auto-Applied" with subtle indicators; low-confidence items are presented as "Needs Your Help."

### 2.2 Bookkeeper
-   **Visible**: Audit trails, reconciliation drawers, multi-account ledger views.
-   **Editable**: Transfer matching, reconciliation inputs, statement imports.
-   **Forbidden**: Posting to locked periods, AJE creation, structural COA changes.
-   **Confidence UX**: Full display of TCV (Transaction Context Vector) scores for debugging auto-categorization anomalies.

### 2.3 Accountant
-   **Visible**: Full General Ledger, Adjustments Ledger, Restatement History.
-   **Editable**: Everything in Bookkeeper mode PLUS Adjusting Journal Entries (AJEs), Period Locking/Unlocking, and COA Intelligence Metadata.
-   **Forbidden**: Deletion of audit logs.
-   **Confidence UX**: Override authority for any Brain-categorized transaction, with mandatory "Reason for Change" documentation.

### 2.4 CFO
-   **Visible**: Liquidity/Leverage ratios, DSCR, Certified Bank Approval Packages.
-   **Editable**: Forecasting assumptions, target budget thresholds.
-   **Forbidden**: Direct transaction entry (typically read-heavy role).
-   **Confidence UX**: Focus on "Data Certified" vs "Data Draft" indicators.

### 2.5 Auditor (Read-Only)
-   **Visible**: All data, all proofs, all versions of every transaction, full security logs.
-   **Editable**: NONE.
-   **Forbidden**: ANY mutation.
-   **Confidence UX**: Ability to "Drill-to-Source" from any balance sheet line item to the original bank/crypto statement event.

---

## SECTION 3 — Progressive Disclosure Model

The complexity of RoboLedgers SHALL scale linearly with role authority:
-   **Tier 1 (Zen)**: Focus on "What happened?" and "Am I okay?". Uses vernacular language (e.g., "Money In" vs "Money Out").
-   **Tier 2 (Accountant/CFO)**: Focus on "Why did this happen?" and "Is it compliant?". Uses technical terminology (e.g., "Debit/Credit Polarity," "Variance Proof").
-   **Transition Logic**: Specialized accounting jargon (e.g., "Accumulated Amortization") SHALL BE grouped under "Advanced Detail" for Zen users but remain primary for Accountants.

---

## SECTION 4 — UX ↔ Proof Alignment

The UX SHALL surface cryptographic and mathematical proofs without requiring deep domain knowledge for non-experts.

1.  **Reconciliation Proofs**: Surfaced as a "Green Check" or "Shield" icon next to account balances. Clicking reveals the "Reconciliation Summary" (Math proof).
2.  **Lock Certificates**: Surfaced as a stylized "Seal of Integrity" on reported outputs. Clicking reveals the Accountant and Timestamp of the lock.
3.  **AJEs**: Visually distinct from standard transactions (e.g., shaded or "AJE" badge) to indicate they are professional overrides, not source bank data.

---

## SECTION 5 — Error & Warning UX

### 5.1 Blocking UX Errors
-   **Authority Violation**: Hard modal rejection for attempted actions (e.g., "Post to Locked Period").
-   **Math Discrepancy**: Red-state lock on reconciliation screens if $Variance > 0$.

### 5.2 Advisory Warnings
-   **Accountant-Only**: "Shareholder Loan Flip Risk" or "Capitalization Threshold Breach" alerts.
-   **CFO Risk Indicators**: "Liquidity Alert: Quick Ratio < 1.0" or "Unreconciled Period Warning."

---

## VERIFICATION SECTION

-   **User Modes Covered**: Zen, Bookkeeper, Accountant, CFO, Auditor (Confirmed).
-   **Accounting Integrity**: UX enforces NO DELETION and NO MUTATION of Locked data (Confirmed).
-   **Open Questions**: NONE.

**END OF SPECIFICATION**
