# RoboLedger V5: Project Master Archive

This document serves as the "Massive Recall" vault for the RoboLedger V5 project. It details the architectural evolution, technical breakthroughs, and forensic milestones achieved from inception to the final migration freeze.

## 🏛️ Project Vision
RoboLedger V5 is an institutional-grade, browser-native financial OS designed for forensic accounting accuracy. It prioritizes mathematical truth (ledger invariants) and high-fidelity visual alignment with professional bookkeeping benchmarks.

---

## 📈 Development Timeline & Milestones

### Phase 1-9: The Core Constitution (LOCKED)
- **Objective**: Establish the bedrock of double-entry integrity.
- **Milestones**:
    - Implementation of the `Truth Vault` (Atomic transaction storage).
    - `txsig` (Transaction Fingerprinting): SHA-256 hashing of core transaction properties to prevent duplicates.
    - `COA Intelligence Layer`: Deterministic prediction engine mapping merchant names to GL codes.
    - `Reconciliation Proof Engine`: Mathematical verification of Assets vs. Liabilities.

### Phase 24-26: Aesthetic Restoration & V5 Shell
- **Objective**: Port the professional look and feel from the legacy V4 into the modern V5 architecture.
- **Milestones**:
    - Glassmorphic UI foundation with Purple/Teal high-performance themes.
    - Restoration of Screenshot-Perfect Header Cards and Breadcrumb navigation.

### Phase 28-33: Forensic Grid Engineering
- **Objective**: Achieve 1:1 parity with target visual benchmarks (Screenshots 1-3).
- **Milestones**:
    - `Tabulator v5.5` Implementation: High-density, virtual-scroll grid capable of 10,000+ rows.
    - Multi-File Batch Ingestion: Simultaneous processing of PDF, CSV, and Excel buffers.
    - `Wall-To-Wall` responsive layout refinement.

### Phase 34-51: Forensic Refinement & Logic Stabilization
- **Objective**: Solve edge-case parsing bugs and sharpen UI fidelity.
- **Milestones**:
    - Surgical extraction of Payee names (Merchant Strip logic).
    - Session Persistence & In-Page Recovery Banners.
    - Forensic Audit Drawer: Split-pane source viewer for 1:1 document verification.
    - Rainbow Header Theme & Uniform Typography (Removal of all unnecessary bolding).

### Phase 52-58: The Ingestion Engine Masterpiece (V5.2.35)
- **Objective**: Institutional-grade reliability for Mastercard and RBC statements.
- **Technical Breakthroughs**:
    - **Mastercard Date Fix**: Resolved the "00 APR" bug by stabilizing capture group indices for double-date formats.
    - **Liability Polarity Logic**: Fixed the running balance math specifically for Credit Cards (Purchases = Increase Debt).
    - **Institutional ID Card**: Left-aligned header card with INST/TRANSIT/ACC metadata.
    - **Restricted Upload Zone**: Enforced `.pdf`, `.csv`, `.xlsx` individual or batch uploads.
    - **Minimalist Pass**: Reverted to powerful one-line professional text across the entire grid.

---

## 🛠️ Core Technology Stack
- **Engine**: Browser-native Javascript (IIFE Module Pattern).
- **Storage**: `localStorage` with `crypto.subtle` hashing for txsig.
- **Grid**: Tabulator.js (Virtual DOM).
- **Icons**: Phosphor Icons.
- **PDF Core**: PDF.js (Text extraction layer).

## 🛡️ Invariants & Rules
1. **Uniqueness**: No transaction may exist without a unique `txsig`.
2. **Polarity**: Assets (Opening - Dr + Cr = Ending) | Liabilities (Opening + Dr - Cr = Ending).
3. **Forensic Trace**: Every clean transaction MUST preserve its `raw_description` trace for audit trail accountability.

---

### MOVE AUTHORIZED: Project Frozen at V5.2.35
*Prepared for migration to new environment.*
