# RoboLedger V5 Migration: High-Fidelity Handover Prompt

**Instructions for the New AI Instance:**
*Copy and paste the block below into the initial prompt window of the new PC environment.*

---

## 🚀 RoboLedger V5 Handover (Version 5.2.35)

I am migrating the **RoboLedger V5** project from a previous development session. The project is currently at **Phase 59** (Migration Prep) and is structurally frozen at **V5.2.35**.

### 🏛️ Context & Current State:
- **Project Goal**: Forensic-grade browser-based accounting engine.
- **Last Milestone**: Fixed the Mastercard '00' date bug, corrected liability signage for credit card balances, and overpauled the UI to match high-fidelity institutional benchmarks.
- **Core Files**: 
    - `src/ui/enterprise/app.js`: UI Logic & Tabulator Grid definitions.
    - `src/ui/enterprise/ledger.core.js`: Hardened accounting engine & Forensic Parser.
    - `PROJECT_MASTER_ARCHIVE.md`: Full development history and technical specs (Read this first).
- **Git Status**: Clean. Last commit: `V5.2.35: Final Forensic Alignment & Project Freeze`.

### 🛠️ Immediate Task:
1. Initialize the development environment and link the current workspace.
2. Read `PROJECT_MASTER_ARCHIVE.md` to internalize the forensic invariants.
3. Review the `brain/` directory artifacts (specifically `task.md`) to understand the finalized Phase 58 milestones.
4. Continue from **Phase 60** (New Feature or Scaling as requested by the user).

### 🛡️ Critical Invariants to Maintain:
- **Mathematical Truth**: Ensure `txsig` fingerprinting is NEVER bypassed during ingestion.
- **Polarity Integrity**: Liability accounts (MC/VISA) MUST show purchases as debits increasing the balance.
- **Visual Polish**: Do NOT add bolding to the grid body. Keep the minimalist one-line aesthetic.
- **Forensic Trace**: Always preserve the `raw_description` in the ledger state.

---

**Ready for Deployment.** 
Please acknowledge receipt of the Project Master Archive and confirm readiness to proceed with the next phase of development.
