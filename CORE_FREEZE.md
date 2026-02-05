# ROBOLEDGERS CORE CONSTITUTION: THE FREEZE (v1.0.0-core)

> [!IMPORTANT]
> This document marks the completion of the RoboLedgers Core Accounting Engine. 
> As of this version, the fundamental logic of truth is strictly locked.

## ❄️ LOCKED DIRECTORIES
The following directories represent the "Accounting Constitution." They are now considered READ-ONLY by architectural policy:

- `/src/ledger/` (TxSig, Immutability)
- `/src/core/coa/` (Intelligence, Gates)
- `/src/brain/` (Determinism, Scoring)
- `/src/reconciliation/` (Math, Proofs)
- `/src/authority/` (RBAC, Guard)
- `/src/adjustments/` (AJE, Restatement)

## ⚖️ THE AMENDMENT RULE
Any future modification to the logic within these directories SHALL REQUIRE:
1. **Prompt-Level Justification**: A clear explanation of why the change is safe and necessary.
2. **Invariant Proof**: New or updated automated tests that prove no existing accounting law is violated.
3. **Master Runner Verification**: 100% pass rate on all 45+ existing core tests.

## 🏛️ UI/UX SEPARATION MANDATE
The UI layer is a **Projection Layer**. 
- It MAY NOT determine truth.
- It MAY NOT mutate state directly.
- It MUST route every intent through the `AuthorityGuard` and Domain Services.
- It MUST always display the **Truth Badge** (RAW, PREDICTED, RECONCILED, etc.).

---
**SIGNED: THE PRINCIPAL ARCHITECT**
**DATE: 2026-02-02**
**STATUS: v1.0.0-core-constitution LOCKED**
