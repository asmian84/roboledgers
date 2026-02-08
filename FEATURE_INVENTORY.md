# RoboLedger Feature Inventory
**Status:** February 5, 2026 | Current Implementation vs AutoBook-V4 Reference

---

## 📊 WHAT WE ALREADY HAVE

### ✅ Core Architecture
- [x] **Ledger Engine** (`src/ui/enterprise/ledger.core.js` - 715 lines)
  - Transaction storage (in-memory `txnsCollection`)
  - `getAll()`, `get(id)`, `save()`, `load()`, `resetData()`
  - `updateMetadata(tx_id, patch)` with immutable field protection
  - GL account assignment (`gl_account_id`)
  - Balance tracking

- [x] **Workspace Manager** (`src/ui/workspace/ledgerWorkspace.js` - 125 lines)
  - `buildFromEngine()` - Group transactions by account
  - `switchAccount(accId)` - Filter view by account
  - `moveTransaction()` - Transfer between accounts
  - UNASSIGNED account ("0000" virtual account)
  - ALL view (all GL-coded transactions)

- [x] **Column Management System** (NEW)
  - `columnRegistry.js` - Master column definitions (8 columns)
  - `columnState.js` - localStorage persistence
  - `buildColumns.js` - Dynamic column builder
  - `columnManager.js` - Modal UI for toggling visibility

### ✅ Main UI/UX Features
- [x] **Action Bar (56px)**
  - Search input with toggle
  - Column Manager button (⚙️)
  - Export button (↓) with dropdown (CSV/XLSX/PDF)
  - Popout Grid button
  - Grid Settings button

- [x] **Account Switching**
  - Pill-based navigation (UNASSIGNED | ALL | Bank accounts)
  - Visual indicators (count badges on UNASSIGNED)
  - Instant switching (no reload)
  - Virtual "0000" INBOX for unassigned

- [x] **Export Functionality**
  - CSV export via Tabulator
  - XLSX export via Tabulator  
  - PDF export via Tabulator
  - Glassmorphic dropdown menu

- [x] **Column Management**
  - Modal UI for visibility toggles
  - localStorage persistence (`rl_hidden_columns`)
  - Auto-restore on page load
  - Only optional columns toggleable

- [x] **Grid Core**
  - Tabulator v5.5.0 integration
  - 8 columns: Ref, Date, Description, Debit, Credit, Balance, Category (GL), Actions
  - Pagination (50 rows/page)
  - Row editing (Category column with dropdown)
  - Movable rows (visual reordering)
  - Header sorting (tri-state: asc, desc, none)

- [x] **Settings Drawer**
  - Basic toggle (`toggleSettings()`)
  - Minimal implementation (sidebar slide-in)
  - Closes on X button

- [x] **Workbench/Audit Panel**
  - `toggleWorkbench(open, fileId)` function
  - PDF curtain placeholder
  - Source file viewer (basic)

- [x] **Orchestration Layer**
  - Unified `render()` lifecycle
  - `waitForGrid()` polling for tableBuilt event
  - Grid → Workspace → Audit sequencing

### ✅ Data Management
- [x] **GL Assignment Architecture**
  - Primary field: `gl_account_id`
  - Category column uses updateMetadata()
  - Immutable field protection (amount, date, account_id, currency)
  - Auto-save on cell edit

- [x] **Pill Rendering**
  - Derives state from Ledger engine directly
  - UNASSIGNED: transactions without `gl_account_id`
  - ALL: only GL-coded transactions
  - Bank pills: appear after first GL assignment
  - Count badges

- [x] **Balance Tracking**
  - Running balance in grid
  - Calculated per transaction
  - `getUnassignedCount()` helper

### ✅ UI Components
- [x] **Phosphor Icons** - Full icon library integrated
- [x] **Buttons** - Cloudy buttons with hover states
- [x] **Dropdowns**
  - Export menu (glassmorphic)
  - Data action dropdowns
- [x] **Modals**
  - Column Manager modal
  - Settings drawer (basic)

---

## ❌ WHAT WE'RE MISSING

### Priority 1: Critical Foundation (High Impact)

#### 1. ❌ **PDF Curtain & Visual Audit**
- No PDF rendering in source viewer
- No surgical line highlighting
- No zoom-on-hover
- No magnetic handle (caret toggle)
- Pop-out grid is stubbed but incomplete

**What's needed:**
- PDFJS integration for page rendering
- Coordinate extraction from row metadata
- Crop + highlight overlay logic
- Zoom implementation
- New functions: `viewSourcePDF(rowId)`, `renderVisualAudit()`

#### 2. ❌ **Audit Drawer (Right-side Panel)**
- Settings drawer exists but no audit drawer
- No receipt dropzone
- No metadata grid (Institution, Transit, Account, Page, Confidence)
- No Verify/Flag buttons
- No Blockchain Audit ID display

**What's needed:**
- New drawer structure (v5-audit-drawer)
- Receipt upload zone with base64 encoding
- Metadata display grid
- Action buttons (Verify, Flag)
- New functions: `openAuditDrawer(rowId)`, `closeAuditDrawer()`, `verifyRow()`, etc.

#### 3. ❌ **Reconciliation Drawer (Left-side Panel)**
- No per-source reconciliation UI
- No balance inputs (opening/statement)
- No variance checking
- No global reconciliation status

**What's needed:**
- New drawer: `v5-recon-drawer`
- Per-source cards with balance inputs
- In/Out sums display
- Calculated Ending Balance
- Variance alerts ($0.01 threshold)
- Global status badge
- New functions: `toggleReconDrawer()`, `updateReconData()`, `refreshReconSummary()`

#### 4. ❌ **Account Navigation Strip**
- Pills exist but limited functionality
- No account type icons (bank, credit-card, savings)
- No source detection/naming (CHQ1, VISA1, etc.)
- No metadata sync on switch
- No "ALL" view badge

**What's needed:**
- Enhanced pill styling with icons
- Source detection logic (grouping by account number)
- Account type tagging
- Metadata panel (dark gradient, monospace)
- New functions: `refreshSourceNaming()`, `updateMetadataPanel()`

#### 5. ❌ **Comprehensive Settings Panel (9 Tabs)**
- Current: Basic drawer with some options
- Missing: Tabbed interface, most settings categories

**What's needed:**
1. Appearance tab (25+ themes, font size slider, row density)
2. Grid Columns tab (visibility toggles)
3. Auto-Categorization tab (enable, confidence threshold, review mode)
4. Import Preferences tab (Ref# prefix, date format, province)
5. Currency tab (home/foreign pairs, live rates)
6. Performance tab (rows/page, virtualization, auto-save)
7. Validation tab (duplicate detection, balance alerts, warnings)
8. Export Format tab
9. Shortcuts tab (visibility + drag-reorder)

### Priority 2: Major Features (Medium Impact)

#### 6. ❌ **Reconciliation System**
- No per-source balance tracking
- No opening/statement balance inputs
- No variance calculation
- No "Review Grid" filter by source

**What's needed:**
- V5State.reconciliationBalances object
- Input fields in recon drawer
- Variance checking logic
- Updated balance card display
- New functions: `updateReconBalance()`, `calculateVariance()`, `focusSource()`

#### 7. ❌ **Auto-Categorization Engine**
- No dictionary-based matching
- No confidence scoring UI
- No progress bar
- No review-before-apply mode
- No heuristic fallbacks

**What's needed:**
- MerchantDictionary class integration
- Progress overlay with real-time updates
- Confidence score display + color-coding
- Review modal before batch apply
- New functions: `autoCategorizeAll()`, `matchTransaction()`, `applyConfidence()`

#### 8. ❌ **Bulk Operations**
- No bulk rename (find & replace)
- No bulk categorize
- No selection count display
- No state machine for bulk actions

**What's needed:**
- Selection count badge
- Bulk menu with:
  - Categorize (COA selection)
  - Rename (find/replace modal)
  - Delete (with confirmation)
- State machine (idle → selecting → mode → confirm → apply)
- New functions: `selectAll()`, `clearSelection()`, `bulkRename()`, etc.

#### 9. ❌ **Advanced Grid Features**
- No Ref# auto-generation
- No running balance calculation
- No custom COA editor with search/grouping
- No row density controls
- No floating header filters

**What's needed:**
- Ref# generation logic with account-based prefixes
- Balance recalculation on sort/filter
- Custom COA dropdown component with search + collapsible groups
- Row density CSS classes (compact, comfortable, spacious)
- AG Grid floating filters (native feature)

#### 10. ❌ **Workspace Modes**
- Currently: Single "bookkeeping" mode
- Missing: zen, hybrid, audit, accountant modes
- No feature hiding/showing per mode

**What's needed:**
- Mode selector in settings
- Column visibility rules per mode
- Drawer availability per mode
- UI simplification logic per mode
- New state: `V5State.workspaceMode`

### Priority 3: Important Features (Low-Medium Impact)

#### 11. ❌ **Keyboard Shortcuts & Hotkeys**
- No documented shortcuts
- No shortcut toggle UI
- No keyboard-driven bulk operations

**What's needed:**
- Keyboard handler for: Undo, History, Categorize, Delete, etc.
- Shortcuts panel showing available keys
- Toggle visibility per shortcut
- Drag-reorder shortcut toolbar

#### 12. ❌ **Theme System (25+ Themes)**
- No theme switching
- No premium glassmorphic themes
- No font size control
- No row density UI

**What's needed:**
- Theme registry (25 themes)
- CSS class injection on apply
- Font size slider (13px-16px)
- Row density radio buttons
- Staged settings (apply on Save)

#### 13. ❌ **Receipt & Evidence Matching**
- No drag-drop upload in audit drawer
- No receipt preview
- No base64 encoding/storage
- No matched receipt display

**What's needed:**
- File input + dropzone in audit drawer
- Base64 conversion on select
- Storage in row.receipt object
- Preview canvas/image display
- New functions: `handleReceiptDrop()`, `uploadReceipt()`

#### 14. ❌ **Audit ID Generation**
- No blockchain-style transaction signatures
- No audit trail tracking

**What's needed:**
- Audit ID format: `{Type}-{Account}-{Inst}-{Transit}-{DateYYYYMMDD}-{Seq}`
- Hash-based signature generation
- Storage in row.auditId
- Display in audit drawer
- New function: `generateAuditIds()`

#### 15. ❌ **Search & Filter Enhancements**
- Basic search exists (Ref# + Description)
- Missing: Account filter, status filter, floating column filters
- No filter indicator badge
- No "Clear Filters" button

**What's needed:**
- Account dropdown filter (focus by source)
- Status filter (verified, flagged, pending)
- Floating header filters on each column
- Active filter badge display
- Clear filters function

### Priority 4: Polish & UX (Lower Impact)

#### 16. ❌ **Glassmorphism Styling**
- Basic styling exists
- Missing: Frosty blur effects, transparency patterns
- No premium theme visuals

#### 17. ❌ **Toast Notifications**
- Using basic console/alerts
- Missing: Toast UI (success, info, warning, error)
- No transient message system

#### 18. ❌ **Animations & Transitions**
- Basic CSS transitions exist
- Missing: Pulsing animations, smooth drawer slides
- No hover pop effects

#### 19. ❌ **Responsive Design**
- Desktop-optimized
- Missing: Mobile/tablet layouts
- No touch-friendly button sizing

#### 20. ❌ **Advanced Features**
- No pop-out grid to external window
- No print-optimized bank statement format
- No currency conversion
- No historical data/versioning

---

## 📈 IMPLEMENTATION ROADMAP (Ranked by Impact × Effort)

### Phase 1: Foundation (Weeks 1-2)
**High Impact, Medium Effort**

1. **Account Navigation Strip** (6-8 hours)
   - Enhanced pills with icons
   - Source detection logic
   - Metadata panel (dark gradient)

2. **Per-Source Reconciliation** (8-10 hours)
   - Drawer layout
   - Balance inputs
   - Variance checking

3. **Ref# Auto-Generation** (4-6 hours)
   - Sequence numbering
   - Account-based prefixes
   - Running balance recalc

### Phase 2: Audit System (Weeks 3-4)
**High Impact, High Effort**

4. **Audit Drawer** (8-10 hours)
   - Right-side panel structure
   - Metadata grid
   - Verify/Flag workflow
   - Receipt upload

5. **PDF Curtain Integration** (10-12 hours)
   - PDFJS setup
   - Visual audit rendering
   - Zoom + highlight logic
   - Magnetic handle

### Phase 3: Customization (Week 5)
**Medium Impact, Medium Effort**

6. **Settings Panel (9 Tabs)** (12-15 hours)
   - Tab navigation
   - All settings categories
   - Staged settings (save confirmation)

7. **Theme System** (8-10 hours)
   - 25+ theme definitions
   - CSS injection
   - Font/density controls

### Phase 4: Advanced (Week 6+)
**Medium Impact, Lower Effort**

8. **Bulk Operations UI** (4-6 hours)
   - Selection counter
   - Bulk menu + modals
   - State machine

9. **Auto-Categorization** (10-12 hours)
   - Dictionary integration
   - Confidence scoring
   - Progress UI

10. **Workspace Modes** (6-8 hours)
    - Mode selector
    - Feature visibility rules

---

## 🎯 CURRENT STATE: BY THE NUMBERS

| Category | Implemented | Missing | % Complete |
|----------|------------|---------|-----------|
| **Drawers/Modals** | 2 | 4 | 33% |
| **Grid Features** | 60% | 40% | 60% |
| **Account Management** | 50% | 50% | 50% |
| **Settings** | 20% | 80% | 20% |
| **Audit & Compliance** | 5% | 95% | 5% |
| **Validation & Alerts** | 40% | 60% | 40% |
| **Export & Reporting** | 60% | 40% | 60% |
| **Auto-Categorization** | 0% | 100% | 0% |
| **Search & Filter** | 40% | 60% | 40% |
| **UX & Styling** | 50% | 50% | 50% |
| **TOTAL** | ~30% | ~70% | **30%** |

---

## 💡 QUICK WINS (Easy to Implement)

1. **Metadata Panel** (2-3 hours)
   - Dark gradient background
   - Display: Bank, Institution, Transit, Account
   - Updates on row focus

2. **Receipt Upload Zone** (2 hours)
   - Add to existing audit panel
   - Base64 file handling

3. **Audit ID Display** (1 hour)
   - Generate + display in modal

4. **Account Icons** (1-2 hours)
   - Icons for pill badges
   - CSS class mapping

5. **Toast Notifications** (3-4 hours)
   - Simple toast component
   - Replace console/alerts

---

## 🚀 NEXT STEPS

1. **Create Reconciliation Drawer** - Unlock balance tracking
2. **Implement Account Icons** - Polish navigation
3. **Add Metadata Panel** - Display account context
4. **Build Audit Drawer** - Enable verification workflow
5. **Integrate PDF Curtain** - Complete visual audit

**Estimated Total Time to Parity:** 50-70 hours (1-2 weeks, full-time)

---

**Last Updated:** February 5, 2026  
**Codebase Status:** ~30% complete vs AutoBookkeeping-V4 reference
