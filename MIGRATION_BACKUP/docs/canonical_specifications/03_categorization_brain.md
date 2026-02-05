# RoboLedgers: Categorization Brain Intelligence Specification

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Principal Financial Intelligence Architect

This specification defines the deterministic logic for the RoboLedgers Categorization Brain.

---

## SECTION 1 — Brain Architecture Overview

The Categorization Brain SHALL operate as a deterministic linear pipeline. Every transaction MUST pass through all stages in the exact order specified below.

### 1.1 Execution Pipeline Order
1.  **Normalization Stage**: Generation of the Transaction Context Vector (TCV).
2.  **Identity Engine**: Merchant resolution via Master Registry and Strip Rules.
3.  **Memory Stage**: Recall of historical assignments (Local and Global Memory).
4.  **Context Engine**: Evaluation of instrument type, polarity, and frequency patterns.
5.  **COA Compatibility Gate**: Hard filtering against the Canonical COA Intelligence Model.
6.  **Scoring Engine**: Calculation of the final confidence metric.
7.  **AI Validation**: Bounded verification of the proposed category.
8.  **Finalizer**: State transition and audit trace emission.

---

## SECTION 2 — Deterministic Scoring Engine

The Final Confidence Score ($S_{total}$) SHALL be the arithmetic sum of weighted component scores.

$$S_{total} = I + M + C + L + G - A$$

| Component | Signal | Range | Description |
| :--- | :--- | :--- | :--- |
| **I (Identity)** | Merchant Match | 0 - 100 | 100 for exact registry match. |
| **M (Memory)** | Historical Recurrence | 0 - 100 | 100 if >95% of history matches. |
| **C (Context)** | Profile Alignment | 0 - 50 | 50 if `amount` and `polarity` match norms. |
| **L (Similarity)** | String Distance | 0 - 50 | Levenshtein distance against known aliases. |
| **G (COA Gate)** | Eligibility Logic | 0 - 100 | 100 if COA match is valid; -1000 if invalid. |
| **A (Anomaly)** | Variance Penalty | 0 - 200 | Penalty for sudden jumps or sequence breaks. |

---

## SECTION 3 — COA Compatibility Gate (CRITICAL)

The COA Compatibility Gate is a boolean filter that MUST be satisfied for any category to be proposed.

### 3.1 Hard Constraints
-   A category SHALL be REJECTED if its Canonical Class `eligible_instrument_types` does not include the transaction's `instrument_type`.
-   A category SHALL be REJECTED if the transaction `polarity` does not match the Canonical Class `normal_balance` logic.
-   A category SHALL be REJECTED if the `amount_cents` exceeds the `capitalization_threshold` of a non-asset account without accountant flagging.

Any failure at this gate SHALL throw `INVARIANT_VIOLATION_COA_GATE`.

---

## SECTION 4 — Categorization State Machine

### 4.1 State Transitions
1.  **RAW**: Initial state upon import.
2.  **PREDICTED**: Categorization proposed by the Brain.
3.  **CONFIRMED**: Accepted by a user or high-confidence auto-confirm rule.
4.  **LOCKED**: Assigned to a `LOCKED` reconciliation period.
