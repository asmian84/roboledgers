# AutoBookkeeping-V4 Comprehensive Feature Reference

**Source:** `txn-import-v5-v2.js` (14,083 lines)  
**Purpose:** Complete feature, function, and UI component inventory for RoboLedger integration

---

## 1. DRAWER & MODAL IMPLEMENTATIONS

### 1.1 Audit Mode Drawer
- **Function:** `window.renderAuditModeContainer()`
- **Structure:**
  - Container ID: `v5-audit-mode-container` (fixed overlay)
  - Backdrop ID: `v5-drawer-backdrop` (click-outside close)
  - Drawer ID: `v5-audit-drawer` (right-side panel, 450px width)
- **Key Elements:**
  - Header: `v5-audit-title`, close button
  - Visual Context: `v5-audit-img-container` (PDF crop with zoom)
  - Metadata Grid: `v5-meta-inst`, `v5-meta-transit`, `v5-meta-account`, `v5-meta-page`, `v5-meta-confidence`
  - Blockchain Audit ID: `v5-meta-audit-id` (monospace display)
  - Raw Extraction: `v5-audit-raw` (pre-formatted text)
  - Receipt Dropzone: `v5-receipt-dropzone` (drag-and-drop file upload)
  - Footer Actions: Verify & Flag buttons
- **Key Functions:**
  - `window.openV5AuditDrawer(rowId)` - Open drawer for specific row
  - `window.closeV5AuditDrawer()` - Close with animation
  - `window.verifyActiveRow()` - Mark row as verified
  - `window.flagActiveRow()` - Flag row for review
  - `window.moveToNextAuditRow()` - Navigate between audit rows

### 1.2 Reconciliation Drawer (Source Control Hub)
- **Function:** `window.renderReconciliationDrawer()`
- **Structure:**
  - Container ID: `v5-recon-drawer` (left-side panel)
  - Backdrop: `v5-recon-backdrop`
- **Key Components:**
  - Header: Icon + "Source Control Hub" title + global status badge
  - Source List: `v5-recon-source-list` (flex column, gap-16px)
  - Status Badge: `v5-recon-global-status` (shows "All Balanced" or "Action Required")
  - Cards per Source:
    - Bank name displayed
    - Account (masked) with status indicator
    - Opening Balance input (editable)
    - Statement Balance input (editable)
    - In/Out sums in grid layout
    - Calculated Ending Balance (bold)
    - Unbalanced Diff alert (if applicable)
    - "Review Grid" button to filter main grid
  - Footer: "Complete Reconciliation" button
- **Key Functions:**
  - `window.toggleV5ReconDrawer()` - Open/close with animation
  - `window.refreshV5ReconciliationSummary()` - Recalculate all sources
  - `window.updateV5ReconAccountData(key, field, value)` - Update opening/statement balance
  - `window.finalizeV5Reconciliation()` - Complete reconciliation flow

### 1.3 Settings Panel/Drawer
- **Function:** `window.openV5SettingsPanel()`
- **Structure:**
  - Panel ID: `v5-settings-panel` (right-side slide-in)
  - Tabs: Tab buttons with active indicator (bottom border)
  - Content sections: tab-specific divs with class `v5-settings-tab-content`
- **Tabs:**
  1. **Appearance** - Theme (25+ themes), Font Size (slider), Row Density (radio)
  2. **Grid Columns** - Toggle visibility for: date, source, description, debit, credit, balance, account, refNumber, salesTax, foreignBalance
  3. **Auto-Categorization** - Enable/disable, confidence threshold (slider), show scores, review before apply
  4. **Import Preferences** - Ref# prefix input, date format dropdown, province selector, auto-expand
  5. **Currency** - Home currency, foreign pairs, exchange rate refresh
  6. **Performance** - Rows per page, virtualization toggle, auto-save interval
  7. **Validation** - Duplicate detection, balance alerts, negative warnings
  8. **Export Format** - Format dropdown (xlsx, csv, etc.)
  9. **Shortcuts** - Toggle visibility and drag-reorder shortcuts
- **Key Functions:**
  - `window.toggleV5Settings()` - Open settings panel
  - `window.openV5SettingsPanel()` - Display with fade animation
  - `window.closeV5SettingsPanel()` - Close with fade animation
  - `window.switchV5SettingsTab(tabName, btn)` - Change tabs
  - `window.syncV5SettingsUI()` - Load current state into UI controls
  - `window.saveV5Settings()` - Persist to localStorage, apply changes
  - `window.resetV5SettingsToDefaults()` - Clear all settings with confirmation
- **Settings Storage:**
  - Key: `v5_settings_v4` (localStorage)
  - Structure: `V5State.settings` object with nested sections
  - Staged settings: `V5State.stagedSettings` (workspace mode, theme) - applied on Save

### 1.4 Assignment Banner (Pending Statements)
- **Structure:** `v5-assignment-banner` (glassmorphic, full-width banner)
- **Display:** Show when `V5State.pendingStatements.length > 0`
- **Components:**
  - Banner Title: "Link Pending Statements"
  - Custom COA Dropdown: Custom-built grouped selector
  - "Complete Assignment" button
  - Pulsing animation when active
- **Key Functions:**
  - `window.showV5AssignmentBanner()` - Display banner with animation
  - `window.hideV5AssignmentBanner()` - Hide banner
  - `window.populateV5BannerCOA()` - Populate COA options
  - `window.selectV5BannerCOAAccount(code, name)` - Update selection

---

## 2. PDF VIEWER & CURTAIN FUNCTIONALITY

### 2.1 PDF Source Curtain (Vertical Slide-out)
- **Structure:**
  - Overlay ID: `v5-pdf-overlay` (transparent backdrop)
  - Curtain ID: `v5-pdf-curtain` (650px, right-side)
  - Position: Right edge, 100vh height
  - Animation: Slide in from right (`right: 0` from `right: -100%`)
- **Header Components:**
  - File icon badge (blue background)
  - Filename display: `v5-curtain-filename`
  - Pop-out button: `v5-pdf-popout-btn` (new window)
  - Close button: `v5-pdf-close-btn`
- **Content Area:** `v5-pdf-curtain-content` (flex: 1, overflow hidden)
- **Magnetic Handle:** `.v5-curtain-handle`
  - Position: Absolute left (-32px) at top 140px
  - Expands on hover (36px)
  - Icon: caret-left + file-pdf
  - Function: Toggle curtain visibility
- **Key Functions:**
  - `window.viewSourcePDF(rowId)` - Open curtain for transaction's source PDF
  - `window.closeV5PDFCurtain()` - Close curtain with slide animation
  - `window.initPDFCurtain()` - Initialize curtain infrastructure
  - `window.renderVisualAudit(row, containerId)` - Render cropped PDF snippet
  - `window.toggleV5SourceCurtain()` - Toggle from audit drawer handle
- **PDF Logic:**
  - Uses PDFJS library for rendering
  - Crops to transaction location (y position + padding)
  - Highlights transaction line with amber overlay + border
  - Zoom on hover (2.5x scale)
  - ESC key to close

### 2.2 Visual Audit (PDF Snippet Rendering)
- **Function:** `window.renderVisualAudit(row, 'v5-audit-img-container')`
- **Processing:**
  - Fetches PDF by filename from `row.sourceFileName`
  - Gets page number from `row.audit.page`
  - Extracts coordinates: `row.audit.y`, `row.audit.height`
  - Renders full page to canvas (PDFJS)
  - Crops viewport around transaction
  - Applies surgical highlight (amber semi-transparent)
  - Adds zoom wrapper with mouse-track zoom
- **Output:** Canvas with zoom-on-mousemove interaction
- **Container:** `v5-audit-img-container` (div with loader while rendering)

---

## 3. GRID INTERACTION FEATURES

### 3.1 Core Grid Configuration (AG Grid)
- **Container ID:** `v5-grid-container`
- **Grid Options:** `gridOptions` object (line ~8500)
- **Pagination:** Enabled, configurable page size (default 100)
- **Row Selection:** Multiple rows with checkboxes
- **Virtualization:** Optional, controlled by settings
- **Suppressed Features:**
  - Horizontal scroll (wall-to-wall)
  - Row click selection (manual checkbox only)
  - Row dragging
- **Key Events:**
  - `onCellFocused` - Update header metadata based on focused cell
  - `onRowClicked` - Track row selection
  - `onSortChanged` - Recalculate balances
  - `onFilterChanged` - Recalculate balances
  - `onCellValueChanged` - Save data + recalculate
  - `onGridReady` - Initialize API, size columns

### 3.2 Column Definitions
| ColId | Header | Field | Type | Key Features |
|-------|--------|-------|------|---|
| checkbox | - | - | checkbox | Header select-all, width 40px fixed |
| refNumber | Ref# | refNumber | numeric | Dynamic: `{prefix}-{sequence}` |
| date | Date | date | text | Editable, with date formatter |
| source | Source | sourceFileName | text | Shows source tag (CHQ, VISA, etc.) |
| description | Description | description | text | Editable, clickable for audit drawer, multi-line |
| debit | Debit | debit | numeric | Editable, right-aligned, red color |
| credit | Credit | credit | credit | Editable, right-aligned, green color |
| salesTax | Sales Tax | salesTax | numeric | Hidden by default, toggleable |
| balance | Balance | balance | numeric | Read-only, calculated running total |
| account | Account | account | text | Editable with V5GroupedAccountEditor |

### 3.3 Custom Cell Editors
- **V5GroupedAccountEditor Class:**
  - Input: Searchable COA dropdown
  - Structure: 
    - Search box (top, fixed)
    - Scrollable list container
    - Collapsible groups: ACTIVE LEDGERS, ASSETS, LIABILITIES, EQUITY, REVENUE, EXPENSES
  - Features:
    - Type-to-filter
    - Group expand/collapse
    - Arrow key navigation
    - Enter key to select first match
  - Exit: ESC or selection
  - Returns: Selected account code + name

### 3.4 Cell Rendering & Styling
- **Description Cell:**
  - Audit status icon (verified green, flagged red, pending gray)
  - Multi-part text: Bold first part (main description) + gray metadata
  - Clickable to open audit drawer
  - Auto-height for multi-line text
- **Debit/Credit Cells:**
  - Conditional formatting: color based on value
  - Number formatting: $X,XXX.XX
  - Debit: Red (#EF4444)
  - Credit: Green (#10B981)
- **Balance Cell:**
  - Color based on sign: Green (positive), Red (negative)
  - Bold font weight
  - Right-aligned
- **Row Styling:**
  - Row classes by source: `v5-row-chq`, `v5-row-visa`, `v5-row-mc`, `v5-row-amex`, `v5-row-sav`
  - Used for row-level styling

### 3.5 Cell Editing Logic
- **Debit/Credit Mutual Exclusion:**
  - `valueSetter` for both columns
  - Setting debit clears credit (and vice versa)
  - Triggers balance recalculation
- **Balance Recalculation:**
  - Function: `window.recalculateAllBalances()`
  - Iterates all rows (or visible grid nodes)
  - Running total: Opening Balance + Sum(Credits - Debits) [for assets]
  - Updates `txn.balance` in state + grid
  - Also updates Ref# sequence numbers
  - Called on: sort, filter, cell value change

### 3.6 Selection & Bulk Operations
- **Selection UI:** `v5-selection-info` shows count
- **Bulk Bar Visibility:** Shows when `selectedCount > 0`
- **Key Functions:**
  - `window.selectAllV5()` - Select all visible rows
  - `window.deselectAllV5()` - Clear selection
  - `window.clearV5Selection()` - Deselect all (shortcut)
  - `window.updateV5SelectionUI()` - Update selection indicators
  - `window.updateV5BulkBar()` - Show/hide bulk actions based on count

### 3.7 Filtering & Search
- **Global Quick Filter:** `V5State.gridApi.setGridOption('quickFilterText', searchTerm)`
- **Column-Specific Filter:** `V5State.gridApi.setFilterModel({columnId: {...}})`
- **Key Functions:**
  - `window.filterV5Grid(searchText)` - Apply quick filter across columns
  - `window.filterV5ByRef(refText)` - Filter by Ref# column
  - `window.handleV5Search(event)` - Search bar input handler
- **Floating Filters:** Native AG Grid header filters enabled

---

## 4. STATE MANAGEMENT PATTERNS

### 4.1 Global V5State Object
```javascript
V5State = {
  // Core Data
  gridData: [],                          // Array of transaction objects
  importHistory: [],                     // File import history
  selectedFiles: [],                     // Currently selected files
  
  // Grid Management
  gridApi: null,                         // AG Grid API reference
  undoStack: [],                         // Undo history (max 10 steps)
  isProcessing: false,                   // File processing lock
  currentProgress: { current, total, message }, // Real-time progress
  
  // Account Context
  currentAccountCode: null,              // Currently active account (CHQ1, VISA1, etc.)
  accountType: null,                     // e.g., "CHECKING", "CREDIT_CARD"
  refPrefix: '',                         // Current Ref# prefix (e.g., "CHQ")
  
  // Reconciliation
  openingBalance: 0,                     // Opening balance for statement
  pendingStatements: [],                 // Unassigned statement files
  multiSourceData: {},                   // {accountCode: [rows]}
  reconciliationBalances: {              // {accountCode: {opening, statement, book}}
    [key]: { opening: 0, statement: 0, book: 0 }
  },
  
  // Audit & Verification
  activeAuditRowId: null,                // Currently opened audit row
  auditModeActiveRowId: null,            // (alternate name)
  
  // Workspace Modes
  workspaceMode: 'bookkeeping',          // 'zen', 'bookkeeping', 'hybrid', 'audit', 'accountant'
  powerMode: false,                      // High-density throughput mode
  
  // Settings
  settings: {
    appearance: {
      theme: 'light',                    // Active theme
      fontSize: 14,                      // Base font size
      rowDensity: 'comfortable'          // 'compact', 'comfortable', 'spacious'
    },
    columns: {
      visible: [],                       // Array of visible column IDs
      salesTax: false,                   // GST/HST column toggle
      foreignBalance: false              // Foreign currency balances
    },
    autoCategorize: {
      enabled: true,
      confidenceThreshold: 75,           // %
      showScores: false,
      reviewBeforeApply: false
    },
    importPrefs: {
      defaultRefPrefix: 'REF',
      dateFormat: 'MM/DD/YYYY',
      province: 'ON',
      autoExpandRows: false
    },
    currency: {
      home: 'CAD',
      foreignPairs: ['USD', 'EUR', ...],
      rates: {},                         // Live exchange rates
      lastUpdated: null,
      autoRefresh: true,
      refreshInterval: 3600000
    },
    performance: {
      rowsPerPage: 100,
      virtualization: true,
      autoSaveInterval: 60000
    },
    validation: {
      duplicateDetection: true,
      balanceAlerts: true,
      negativeWarnings: true
    },
    exportFormat: 'xlsx',
    shortcuts: {                         // Shortcut visibility toggles
      refBox: true,
      autoCat: true,
      search: true,
      undo: false,
      history: false,
      startOver: false,
      popout: false
    },
    shortcutsOrder: []                   // Drag-reorderable shortcut sequence
  },
  stagedSettings: {                      // Temporary settings before "Save"
    workspaceMode: 'bookkeeping',
    theme: 'light'
  }
}
```

### 4.2 Important Data Structures
- **Transaction Row Object:**
  ```javascript
  {
    id: 'v5-unique-id',
    date: '2024-01-15',
    description: 'Payment description',
    debit: 100.00,
    credit: 0.00,
    balance: 500.00,
    account: '5000 - Office Expense',
    refNumber: 'CHQ-001',
    source: 'CHQ',                     // Account tag
    bankName: 'TD Canada Trust',
    institutionNumber: '002',
    transitNumber: '12345',
    accountNumber: '1112443',
    sourceFileName: 'statement.pdf',
    confidence: 0.98,
    auditStatus: 'verified|flagged|pending',
    auditId: 'txsig-abc123...',       // Blockchain-style signature
    audit: {
      page: 1,
      y: 150,                          // PDF coordinate
      height: 14
    },
    receipt: {                          // Optional matched receipt
      name: 'receipt.jpg',
      type: 'image/jpeg',
      data: 'data:image/jpeg;base64,...',
      timestamp: '2024-01-17T...'
    },
    _inst: '002',                       // Raw extraction metadata
    _transit: '12345',
    _acct: '1112443',
    _tag: 'CHEQUING',
    _brand: 'TD'
  }
  ```

### 4.3 Persistence & Storage
- **Auto-Save:** `window.saveData()` (async)
- **Storage Keys:**
  - `ab_v5_grid_data` - Serialized gridData array
  - `ab_v5_opening_balance` - Opening balance value
  - `ab_v5_ref_prefix` - Current Ref# prefix
  - `v5_settings_v4` - Full settings object
  - `v5_current_detection` - Last detected bank/account
  - `v5_current_account` - Currently active account code
- **Load Function:** `window.loadSavedData()` - Restore on init

### 4.4 Undo System
- **Function:** `window.undoLastAction()`
- **Mechanism:**
  - `V5State.undoStack` array (max 10 items)
  - `captureState()` creates snapshot: `{gridData, timestamp}`
  - `undoLastAction()` pops state, restores gridData, refreshes grid
  - `updateUndoButton()` updates menu text with stack size
- **Key Functions:**
  - `captureState()` - Push current state to undo stack
  - `undoLastAction()` - Restore previous state

---

## 5. ACCOUNT SWITCHING & NAVIGATION

### 5.1 Account Navigation Strip
- **Container:** `v5-account-nav-strip` (horizontal scrolling)
- **Function:** `window.renderAccountNavStrip(sourceMap)`
- **Buttons:**
  - "ALL" button (shows all sources)
  - Per-source buttons (CHQ1, VISA1, SAV1, etc.)
  - Icons based on type (bank, credit-card)
  - Active state highlighting
- **Key Functions:**
  - `window.switchV5Source(sourceKey)` - Switch active source + filter grid
  - `window.updateAccountNavStrip()` - Re-render buttons

### 5.2 Source Metadata Display
- **Container:** `v5-metadata-panel` (dark gradient background)
- **Display Format:** Monospace, right-aligned on action bar
- **Fields:**
  - Bank name + icon
  - Institution code
  - Transit number
  - Account (masked: `***1234`)
- **Key Function:** `window.updateActionBarMetadata(accountKey, syncOverride)`
  - Shows single-account metadata or "Multi-Ledger View" for "all"
  - Updates display: `v5-meta-bank`, `v5-meta-inst`, `v5-meta-transit`, `v5-meta-account`

### 5.3 Source Detection & Naming
- **Function:** `window.refreshSourceNaming()`
- **Logic:**
  - Groups transactions by unique account number
  - Detects account type from `_tag` field (VISA, MASTERCARD, CHEQ, SAV, etc.)
  - If multiple accounts of same type: Add numeric suffix (CHQ1, CHQ2)
  - If single type: No suffix (CHQ, VISA, SAV, etc.)
  - Filters out HSBC dummy data (client-side exclusion)
  - Maps to `row.source` property
- **Output:** `sourceMap` object: `{accountCode: sourceTag}`
- **Side Effects:**
  - Generates audit IDs (`generateAuditIds()`)
  - Updates action bar metadata
  - Refreshes grid cells (source, refNumber columns)

### 5.4 Breadcrumb Header Interface
- **Structure:** Interactive breadcrumb in main header
- **Items:**
  - Bank selector: `v5-breadcrumb-bank` (dropdown on click)
  - Tag/Account selector: `v5-breadcrumb-tag` (dropdown on click)
  - Status text: `v5-status-text` (pulsing animation)
  - Bank logo: Embedded SVG or URL
- **Popover:** `v5-header-popover` (shared dropdown)
  - Search input: `v5-popover-search`
  - Options list: `v5-popover-list`
  - Button map: `popoverOptions.bank` and `popoverOptions.tag`
- **Key Functions:**
  - `showV5Popover(type, event)` - Show bank/tag dropdown
  - `filterV5Popover(text)` - Filter dropdown options
  - `onBankTagChange()` - Handle breadcrumb selection change

---

## 6. COLUMN MANAGEMENT FEATURES

### 6.1 Column Visibility Toggles
- **UI Locations:**
  - Settings panel "Grid Columns" tab
  - Checkbox inputs for each column
- **Key Functions:**
  - `window.toggleV5Column(columnId, visible)` - Show/hide individual column
  - `window.toggleV5SalesTax(enabled)` - Show/hide GST column
  - `window.toggleV5ForeignBalance(enabled)` - Show/hide FX balances
- **Persistence:** Saved in `V5State.settings.columns.visible` array
- **Grid Refresh:** Calls `V5State.gridApi.sizeColumnsToFit()` after toggle

### 6.2 Column Width Management
- **Config Properties per Column:**
  - `width` - Initial width in pixels
  - `minWidth` - Minimum allowed width
  - `maxWidth` - Maximum allowed width
  - `flex` - Flex ratio (e.g., description uses flex:2)
  - `suppressSizeToFit` - Exclude from auto-fit (checkbox, refNumber)
- **Auto-Fit Logic:**
  - Called on grid ready: `params.api.sizeColumnsToFit()`
  - Called on resize: `onGridSizeChanged` event
  - Wall-to-wall design: Columns expand to fill viewport
- **Key Functions:**
  - `V5State.gridApi.sizeColumnsToFit()` - Distribute width across columns
  - `V5State.gridApi.autoSizeAllColumns()` - Size based on content

### 6.3 Default Column Visibility
- **Always Visible:** checkbox, refNumber, date, source, description, debit, credit, balance, account
- **Hidden by Default:** salesTax, foreignBalance, gifi_code, evidence_status
- **Conditional (Mode-Based):**
  - Audit/Accountant Mode: Show gifi_code, evidence_status
  - Hybrid Mode: Show evidence_status only
  - Zen/Bookkeeping: Hide audit columns

---

## 7. VALIDATION & ALERT SYSTEMS

### 7.1 Balance Alerts & Reconciliation
- **Summary Card:** `v5-balances-card` (fixed on action bar)
- **Fields Displayed:**
  - Opening Balance: Editable input field (`v5-opening-bal`)
  - Total In: Sum of credit transactions (with count superscript)
  - Total Out: Sum of debit transactions (with count superscript)
  - Ending Balance: Calculated total (blue color)
- **Calculation:** `Ending = Opening + Credits - Debits`
- **Key Functions:**
  - `window.updateReconciliationCard()` - Refresh all balance values
  - `window.recalculateAllBalances()` - Recalculate entire grid balances

### 7.2 Duplicate Detection
- **Mechanism:** Blockchain-style transaction signature
- **Function:** `generateTransactionSignature(tx)`
  - Components: Date + Description + Amount + Institution# + Transit + Account
  - Hash-based identification
  - Signature format: `txsig-{hash}`
- **Setting:** `V5State.settings.validation.duplicateDetection` (toggle)
- **Integration:** Check before importing files; warn on match

### 7.3 Negative Balance Warnings
- **Setting:** `V5State.settings.validation.negativeWarnings`
- **Trigger:** Balance < 0 in any row
- **Display:** Color-coded cell (red) + optional toast notification

### 7.4 Status Badges & Confidence Display
- **Confidence Levels:**
  - `HIGH` (>0.9): Green badge, checkmark icon
  - `MEDIUM` (0.7-0.9): Pill badge, colored text
  - `LOW` (<0.7): Red background pill
  - `LEARNED`: Purple background (previously learned account)
- **Display:** In-grid status column or header status text
- **Key Function:** `updateConfidenceBadge(confidence, source)`

---

## 8. AUTO-CATEGORIZATION & CONFIDENCE SCORES

### 8.1 Auto-Categorization Engine
- **Main Function:** `window.autoCategorizeV5()`
- **Settings:**
  - Enable/disable: `V5State.settings.autoCategorize.enabled`
  - Confidence threshold: `V5State.settings.autoCategorize.confidenceThreshold` (0-100)
  - Show scores UI: `V5State.settings.autoCategorize.showScores`
  - Review mode: `V5State.settings.autoCategorize.reviewBeforeApply`
- **Processing:**
  1. Shows progress bar (fixed overlay with blur)
  2. Iterates all rows (shows progress: "Categorizing X of Y")
  3. Per row:
     - Dictionary match: Uses `MerchantDictionary` class
     - Fallback heuristics on no match:
       - E-transfers: Revenue (4200)
       - Bank fees: Bank Charges (5010)
       - Dividends: Dividends Paid (3500)
   - Sets: `row.accountCode`, `row.categoryName`, `row.confidence`, `row.matchMethod`
  4. Applies updates to grid
  5. Persists changes
- **Confidence Calculation:** Based on dictionary match quality and rule matching
- **Key Functions:**
  - `window.autoCategorizeV5()` - Run full auto-categorization
  - `MerchantDictionary.matchTransaction(description)` - Dictionary lookup

### 8.2 Confidence Score Integration
- **Score Display:** Optional column or inline badge
- **Color Coding:**
  - High (green): Show in cell
  - Medium (yellow): Show with flag
  - Low (red): Show with warning
- **User Actions:**
  - Accept confidence suggestion: Click cell or use Verify button
  - Override confidence: Edit category manually
  - Learn from user choice: Brain bank updates (future)

---

## 9. SEARCH, FILTER, AND QUERY FUNCTIONALITY

### 9.1 Global Search Bar
- **Container:** `v5-search-wrapper` (with icon)
- **Input ID:** `v5-search-input` (rounded corners, with magnifying glass icon)
- **Key Function:** `window.handleV5Search(event)`
  - Applies quick filter: `gridApi.setGridOption('quickFilterText', searchTerm)`
  - Searches across all columns simultaneously
  - Clears on empty input
  - Logs result count
- **Placeholder:** "Search all transactions..."
- **Position:** Integrated in toolbar, flex-grow to available space

### 9.2 Ref# Filter
- **Function:** `window.filterV5ByRef(refText)`
- **Mechanism:** Column-specific filter on refNumber
  - Filter type: "contains" (partial match)
  - Applied to Ref# column only
- **Use Case:** Quick jump to transaction by reference number

### 9.3 Account-Based Filtering
- **Function:** `window.focusV5Source(sourceKey)`
- **Logic:**
  - Creates filter model for source column
  - Highlights active source with filter badge
  - "Clear" button on badge
- **Display:** Badge on top of grid (`v5-grid-filter-badge`)
- **Key Functions:**
  - `window.focusV5Source(sourceKey)` - Apply source filter
  - `window.clearV5GridFocus()` - Remove filter

### 9.4 Floating Column Filters
- **Feature:** Native AG Grid floating filters in headers
- **Per Column:** Type, operator, and filter value
- **Operators:** Contains, equals, starts with, etc. (auto-detected by column type)

---

## 10. EXPORT & DOWNLOAD FEATURES

### 10.1 Print Styles & Bank Statement Format
- **Print Stylesheet:** Extensive `@media print` rules
- **Hidden on Print:**
  - Sidebar, nav, buttons, checkboxes
  - Header/footer toolbars
  - Action menus
- **Preserved on Print:**
  - Grid with full formatting
  - Column headers with borders
  - Alternating row colors
  - Number formatting (monospace)
- **Page Setup:**
  - Size: A4
  - Margin: 15mm
  - Page breaks: `page-break-inside: avoid` on rows
- **Header Section:** Optional "Bank Statement" title block (centered, with metadata)

### 10.2 Export Format Selection
- **Setting:** `V5State.settings.exportFormat`
- **Dropdown ID:** `v5-setting-exportformat`
- **Default:** 'xlsx'
- **Supported:** CSV, Excel, PDF (planned)
- **Key Function:** `window.setV5ExportFormat(format)` - Update setting

### 10.3 Bulk Download/Export
- **Data Source:** Selected rows or all rows
- **Format:** Respects `exportFormat` setting
- **Columns Included:** All visible columns
- **Filename:** Auto-generated with bank name + date
- **Trigger:** Export button in toolbar menu

### 10.4 Pop-Out Grid to New Window
- **Function:** `window.popOutV5Grid()`
- **Validation:** Checks if gridData has rows; warns if empty
- **New Window Features:**
  - Full HTML doc with embedded styles
  - Standalone grid with same columns & data
  - Copy appearance settings (theme, font, density)
  - Action bar with Ref#, Search, Balance info
  - Header metadata
  - Bulk actions bar (fixed bottom)
- **Style Injection:** Embedded CSS to new document for complete styling
- **Pop-In Function:** `window.popInV5Grid()` - Restore main window grid
- **Reverse Logic:** Click overlay to restore from pop-out

---

## 11. KEYBOARD SHORTCUTS & HOTKEYS

### 11.1 Documented Shortcuts
- **Ctrl+S** - Save data
- **Ctrl+Z** - Undo last action
- **Delete** - Delete selected row(s)
- **Double Click** - Edit cell
- **⇄** Button - Swap Debit/Credit
- **×** Button - Delete row

### 11.2 Keyboard Navigation
- **Tab** - Move between cells (horizontal)
- **Enter** - Confirm edit, move to next cell
- **Shift+Tab** - Move backwards
- **Arrow Keys:** Navigate grid (depends on ag-grid config)
- **ESC** - Exit modals, drawers, pop-overs, close audit drawer

### 11.3 Shortcuts Modal
- **Display Function:** `window.showKeyboardShortcuts()`
- **Style:** Fixed overlay modal with grid of key combinations
- **Content:** Visual kbd elements + descriptions
- **Close:** Click outside or ESC key

### 11.4 Shortcut Customization
- **Visible Shortcuts:** Configurable via Settings
- **Drag-Reorder:** Each shortcut can be reordered by drag-drop
- **Max Capacity:** 6 shortcuts shown (warning if > 6 enabled)
- **Shortcuts Available:**
  - refBox (Ref# input)
  - undo
  - history
  - startOver
  - popout
  - autoCat
  - search
- **Key Functions:**
  - `window.toggleV5Shortcut(key, val)` - Toggle visibility
  - `window.handleV5ShortcutDragStart/Over/Drop` - Drag-reorder handlers
  - `window.renderV5Shortcuts()` - Render active shortcuts in toolbar

---

## 12. PERFORMANCE OPTIMIZATION SETTINGS

### 12.1 Grid Performance
- **Pagination:** 
  - Setting: `V5State.settings.performance.rowsPerPage`
  - Default: 100 rows per page
  - Controls: `gridApi.setGridOption('paginationPageSize', val)`
- **Virtualization:**
  - Setting: `V5State.settings.performance.virtualization`
  - When enabled: Row buffer = 10, reduces DOM nodes
  - Uses AG Grid's virtual scrolling
- **Auto-Save Interval:**
  - Setting: `V5State.settings.performance.autoSaveInterval` (milliseconds)
  - Default: 60000 (1 minute)
  - Debounced save on edits
- **Function:** `window.setV5RowsPerPage(val)` - Update pagination

### 12.2 Rendering Optimization
- **suppressHorizontalScroll:** True (wall-to-wall design)
- **suppressRowClickSelection:** True (use checkboxes only)
- **ensureDomOrder:** True (maintain DOM order for accessibility)
- **sizeColumnsToFit():** Called on ready, resize, and column toggle
- **requestAnimationFrame:** Used for async DOM updates
- **Row Height Calculation:** Auto-height for multi-line description

### 12.3 Memory Management
- **Undo Stack:** Limited to 10 items (V5_MAX_UNDO_STEPS)
- **Garbage Collection:** Closed drawers/modals remove from DOM
- **Storage Limits:** localStorage has ~5-10MB limit per site

---

## 13. APPEARANCE & THEME CUSTOMIZATION

### 13.1 Theme System
- **Setting:** `V5State.settings.appearance.theme`
- **25+ Available Themes:** (Caseware-inspired + Custom)
  1. vanilla
  2. classic
  3. default
  4. source-pad
  5. postit
  6. rainbow
  7. social
  8. spectrum
  9. wave
  10. vintage
  11. subliminal
  12. subtle
  13. tracker
  14. webapp
  15. **Premium Themes (Glassmorphism):**
     - frosted (blur + gradient background)
     - swiss (minimalist, no borders)
     - midnight (gold headers, dark background)
  16. dark (full dark mode)
  17. mint (green theme)
  18. contrast (high accessibility)
- **Implementation:**
  - CSS variables per theme
  - Apply via class: `ag-theme-alpine.theme-{name}`
  - Main container class: `v5-layout-{name}` for layout-wide themes
- **Key Functions:**
  - `window.applyV5Theme(theme, fromSave)` - Apply theme
  - `window.applyAllV5Settings()` - Apply all appearance settings
  - Staged application: Theme only applies on Settings Save

### 13.2 Font & Sizing
- **Font Size:**
  - Setting: `V5State.settings.appearance.fontSize` (px)
  - Range: 12-18px (typical)
  - UI Control: Slider with live preview label
  - Applies to: Grid container font-size CSS
- **Row Density:**
  - Options: compact (30px), comfortable (42px), spacious (56px)
  - Function: `window.applyV5RowDensity(density)`
  - Sets row height via: `gridApi.forEachNode(node => node.setRowHeight(height))`
- **Font Family:** Inter (primary), with fallbacks: Open Sans, Roboto, Public Sans

### 13.3 Color Schemes
- **CSS Variables Per Theme:**
  - `--ag-background-color`
  - `--ag-foreground-color`
  - `--ag-header-background-color`
  - `--ag-header-foreground-color`
  - `--ag-odd-row-background-color`
  - `--ag-border-color`
  - `--ag-row-hover-color`
- **Premium Gradient Management (Frosted, Swiss, Midnight)**
- **Responsive Color Adaptation:** Light/dark modes

### 13.4 Responsive Design
- **Breakpoints:**
  - Mobile: `max-width: 767px`
  - Tablet: `768px - 1023px`
  - Desktop: `1024px+`
- **Mobile Adaptations:**
  - Touch-friendly buttons (44px min height)
  - Increased padding for touch targets
  - Stack layouts vertically
  - Drawer width: `max-width: 90vw`
- **Themes Responsive On All Screens**

---

## 14. RECONCILIATION FEATURES

### 14.1 Statement Reconciliation
- **Data Structure:**
  ```javascript
  reconciliationBalances[accountCode] = {
    opening: 0.00,         // Opening balance input
    statement: 0.00,       // Statement balance input
    book: 0.00             // Calculated from transactions
  }
  ```
- **Calculations:**
  - Total Credits: Sum of all credit transactions
  - Total Debits: Sum of all debit transactions
  - Book Balance: Opening + Credits - Debits
  - Variance: |Book Balance - Statement Balance|
  - Status: Balanced if variance < $0.01

### 14.2 Source-Level Reconciliation
- **Per Account Card in Recon Drawer:**
  - Bank name + account (masked last 4)
  - Status badge (Balanced/Unbalanced)
  - Opening balance input
  - Statement balance input
  - In/Out totals
  - Calculated ending balance
  - Variance display (if unbalanced)
  - "Review Grid" link to filter main grid
- **Key Functions:**
  - `window.refreshV5ReconciliationSummary()` - Recalculate all sources
  - `window.updateV5ReconAccountData(key, field, value)` - Update input on change
  - `window.finalizeV5Reconciliation()` - Complete & accept reconciliation

### 14.3 Variance Checking
- **Display:** Red badge only if unbalanced
- **Calculation:** Checks for debits/credits > 0.01
- **Auto-Detection:** Flags unbalanced sources
- **Navigation:** "Review Grid" button to focus that source

---

## 15. RECEIPT & EVIDENCE MATCHING

### 15.1 Receipt Upload Interface
- **Location:** Audit drawer, section "Match Receipt / Support"
- **Dropzone:** `v5-receipt-dropzone` (drag-and-drop)
  - Icon: Upload arrow
  - Placeholder text
  - Clickable to browse files
  - Accepts: Images (JPEG, PNG) + PDF
- **File Input:** Hidden, triggered on zone click or drag
- **Key Functions:**
  - `window.handleReceiptDrop(event)` - Handle drag-drop
  - `window.handleReceiptFile(file)` - Process selected file

### 15.2 Receipt Storage & Display
- **Storage Location:** `row.receipt` object on transaction
  ```javascript
  receipt: {
    name: 'filename.jpg',
    type: 'image/jpeg',
    data: 'data:image/jpeg;base64,...',
    timestamp: '2024-01-17T12:34:56Z'
  }
  ```
- **Display:** Preview box in drawer
  - Image thumbnail (48x48px, cropped)
  - Filename label (ellipsis on long names)
  - Remove button (×)
  - PDF icon fallback for non-image files
- **Key Functions:**
  - `window.renderMatchedReceipt(rowId)` - Render receipt preview
  - `window.removeReceipt(rowId)` - Delete matched receipt
  - `window.handleReceiptFile(file)` - Load & save receipt

### 15.3 Receipt Metadata
- **Captured:** Filename, MIME type, file size (via FileReader), timestamp
- **Persistence:** Serialized in localStorage with gridData
- **Sync:** Updates grid when receipt added/removed

---

## 16. AUDIT ID GENERATION & TRACKING

### 16.1 Audit ID Format & Generation
- **Function:** `window.generateAuditIds(transactions)`
- **Format:** `{AccountType}-{AccountNumber}-{InstitutionCode}-{TransitNumber}-{Date}-{Sequence}`
- **Example:** `Chequing-1112443-002-12345-20230605-001`
- **Components:**
  - Account Type: Full name (Chequing, Savings, Visa, Mastercard, etc.)
  - Account Number: Last 4 or full account #
  - Institution Code: Bank institution number
  - Transit Number: Transit/routing number
  - Date: YYYYMMDD format
  - Sequence: Daily counter (001, 002, 003...)
- **Daily Grouping:** Sequences reset per date

### 16.2 Transaction Signature (Blockchain-Style)
- **Function:** `generateTransactionSignature(tx)`
- **Components:** date + description + amount + institution + transit + account
- **Process:**
  1. Concatenate all parts with pipe separator
  2. Convert to lowercase, remove whitespace
  3. Hash using simple JS hash algorithm
  4. Return: `txsig-{hash_in_base36}`
- **Purpose:** Perfect duplicate deduplication (idempotency)
- **Usage:** Check before import; prevent duplicate entries

### 16.3 Audit Trail
- **Stored:** `row.auditId` field on each transaction
- **Display:** In audit drawer ("Blockchain Audit ID")
- **Read-Only:** User cannot edit
- **Generated:** On data load or auto-categorize

---

## 17. HISTORY & UNDO SYSTEM

### 17.1 Undo Stack
- **Capacity:** 10 snapshots max (V5_MAX_UNDO_STEPS)
- **Data Captured:** Full gridData array + timestamp
- **FIFO:** Last-in-first-out pop on undo
- **Structure:** Array of `{gridData: [], timestamp: Date.now()}`

### 17.2 Undo Triggers
- **Automatic Capture:** `captureState()` called on:
  - Cell value changes
  - Row deletions
  - Bulk operations (categorize, rename, delete)
  - Settings changes that affect grid
- **Manual Trigger:** User clicks Undo button / Ctrl+Z

### 17.3 Import History
- **Field:** `V5State.importHistory` array
- **Stored:** Per-file metadata (filename, date, row count)
- **Display:** History panel (if implemented)
- **Persistence:** localStorage key `ab_import_history`

### 17.4 History Panel
- **Toggle Function:** `window.toggleV5History()`
- **Container:** `v5-history-panel` or `v5-history-zone`
- **States:** collapsed / expanded
- **Items:** List of prior imports with delete buttons
- **Key Function:** `window.renderV5History()` - Render history list

---

## 18. SELECTION & BULK OPERATIONS

### 18.1 Row Selection UI
- **Method:** Checkbox column (first column)
- **Header Checkbox:** Select/deselect all visible rows
- **Selection Info:** Shows count in sidebar (`v5-selection-info`)
- **Selection Count:** Updated real-time (`v5-selection-count`)

### 18.2 Bulk Actions Available
1. **Categorize:** Apply account to selected rows
   - Function: `window.enterCategorizeMode()`
   - UI: Dropdown to choose account
   - Confirmation: Inline message
   - Function: `window.executeBulkCategorize(...)`
   
2. **Rename (Find & Replace):** Modify description text
   - Function: `window.enterRenameMode()`
   - Inputs: Find (optional) + Replace text
   - Autocomplete: Populated from existing descriptions
   - Function: `window.executeBulkRename(...)`
   
3. **Delete:** Remove selected rows
   - Confirmation: "Are you sure?" message
   - Function: `window.bulkDeleteRows()`
   - Execution: `executeBulkDelete(selectedRows)`
   - Recalculates balances after deletion

### 18.3 Bulk State Machine
- **States:**
  - `initial` - Show 3 action buttons (Categorize, Rename, Delete)
  - `categorize` - Show COA dropdown + Apply button
  - `rename` - Show Find/Replace inputs + Apply button
  - `confirm` - Show confirmation message + Yes/No buttons
- **Transitions:** Each action → confirmation → reset to initial
- **Functions:**
  - `resetToInitialState()`
  - `enterCategorizeMode()`, `enterRenameMode()`, `enterConfirmMode()`
  - `confirmBulkAction()`, `cancelConfirmation()`

### 18.4 COA Dropdown (Bulk Operations)
- **Container:** `coa-dropdown-menu` (custom implementation)
- **Search:** Filter by code or name
- **Groups:** Collapsible (ASSETS, LIABILITIES, EQUITY, REVENUE, EXPENSES)
- **Icons:** Parent accounts (1000, 2000, etc.) show ⚡ icon
- **Selection:** Updates trigger text, closes dropdown
- **Functions:**
  - `window.populateGlassCOA()` - Populate all accounts
  - `window.toggleCOAGroup(groupName)` - Expand/collapse
  - `window.selectCOAAccount(fullName)` - Handle selection
  - `window.toggleCustomDropdown()` - Open/close dropdown

---

## 19. REAL-TIME METADATA SYNCHRONIZATION

### 19.1 Metadata Breadcrumb Updates
- **Trigger:** Cell focus or row click
- **Event Handler:** `onCellFocused`, `onRowClicked`
- **Updated Fields:** Bank, account type, institution, transit, confidence
- **Display Function:** `window.updateBrandDisplay(detection)`
  ```javascript
  {
    brand: 'TD Canada Trust',
    subType: 'CHECKING',
    institutionCode: '002',
    transit: '12345',
    accountNumber: '1112443',
    confidence: 0.98,
    source: 'row_focus|source_switch|user_override'
  }
  ```

### 19.2 Balance Synchronization
- **Trigger:** Any cell edit or sort/filter
- **Function:** `window.updateBalanceSummary()`
- **Calls:** `window.recalculateAllBalances()`
- **Updates:** Metadata panel + balance card + grid cells

### 19.3 Reconciliation Sync
- **Update Trigger:** Recon drawer input changes
- **Debounce:** 300ms delay before recalculation
- **Function:** `window.updateV5ReconAccountData(...)`
- **Side Effects:**
  - Re-renders reconciliation cards
  - Updates source naming (if unbalanced status changes)
  - Refreshes balance card

### 19.4 Grid-to-UI Sync
- **Row Data Updates:** Grid applies via `applyTransaction({update: [rows]})`
- **Cell Refresh:** `gridApi.refreshCells({columns: [...], force: true})`
- **Display Updates:** Balance, refNumber, source tags refresh immediately

---

## 20. ERROR HANDLING & LOGGING

### 20.1 Console Logging Patterns
- **Error Levels:**
  - `console.error()` - Critical failures (e.g., missing grid container)
  - `console.warn()` - Warning conditions (e.g., no grid API)
  - `console.log()` - Info messages (operations, state changes)
  - `console.group()` - Diagnostic reports (debug functions)
- **Key Prefixes:**
  - `[Grid]`, `[Init]`, `[Settings]`, `[Source]`, `[Bulk]`, `[AutoCat]`, etc.
- **Example:** `console.log('[Settings:Columns] Toggling column:', columnId, 'to', visible);`

### 20.2 Error Recovery
- **Null Checks:** All DOM selections & API calls protected
- **Fallback Mechanisms:**
  - Grid missing → Create from template
  - Grid API destroyed → Recreate gridOptions
  - Account list empty → Inject baseline COA
  - Missing localStorage keys → Use defaults
- **Repair Function:** `window.debugRepairV5()`
  - Force UI mode sync
  - Re-render drawers
  - Clear stuck processing states

### 20.3 State Validation
- **Grid Re-hydration:**
  - Checks `V5State.gridApi.isDestroyed()`
  - Re-initializes if dead
  - Restores rowData from V5State.gridData
  - Validates column widths > 0
- **Storage Fallback:**
  - Try window.storage first (BrainStorage)
  - Fall back to localStorage
  - Inject baseline COA if all empty

### 20.4 Debug Utilities
- **Function:** `window.debugV5()`
  - Logs current state snapshot
  - Shows COA retrieval status
  - Sample row inspection
  - Storage key check
  - Response grouped for clarity
- **Function:** `window.debugLastParserResult()`
  - Dumps raw text from last parsed file
  - Useful for parser testing
- **Function:** `window.reinitCOAs()`
  - Force COA reload from storage
  - Shows account count
  - Checks for pending statements
- **Function:** `window.debugRepairV5()`
  - Force UI repair (apply settings, re-render drawers)
  - Clear processing lock
  - Synchronize all IDs

---

## 21. WORKSPACE MODES & LENSES

### 21.1 Mode System
- **Modes:** zen, bookkeeping, hybrid, audit, accountant
- **Active Setting:** `V5State.workspaceMode` (also staged before save)
- **Function:** `window.switchV5WorkspaceMode(mode)`
  - Updates staged settings
  - Updates UI slider
  - Reconfigures grid columns
  - Shows/hides drawers
  - Updates shortcuts

### 21.2 Column Visibility by Mode
| Mode | Checkboxes | Audit Cols | Recon |
|------|-----------|-----------|-------|
| zen | Hidden | Hidden | Hidden (overlay) |
| bookkeeping | Hidden | Hidden | Available |
| hybrid | Visible | evidence_status only | Available |
| audit | Visible | All (gifi, evidence) | Available |
| accountant | Visible | All + premium | Available |

### 21.3 Feature Availability by Mode
- **Zen:** Simplified card-based interface (coming soon)
- **Bookkeeping:** Fast grid-only, ideal for data entry
- **Hybrid:** Balance audit status + grid
- **Audit:** Full compliance & evidence features
- **Accountant:** Premium layer, adjusting entries, precision exports

### 21.4 Zen Mode Overlay
- **Display:** Full-screen centered message
- **Message:** "A simplified, card-based review flow is coming soon. Use Hybrid or Bookkeeping for now."
- **Button:** "Return to Grid" (switches to bookkeeping)
- **Hides:** Main grid container

---

## 22. FILE PARSING & IMPORT INTEGRATION

### 22.1 File Upload
- **Input:** `v5-file-input` (hidden file selector)
- **Dropzone:** `v5-upload-zone` (drag-drop + click)
- **Accepted Types:** .pdf, .csv, .xlsx
- **Max Size:** 200MB per file
- **Function:** `window.handleV5DragDrop(event)` - Drag-drop handler
- **Function:** `window.handleV5FileSelect(event)` - Browse button handler

### 22.2 Progress Tracking
- **Container:** `v5-progress-container` (fixed overlay when processing)
- **Message:** Real-time status (`v5-progress-message`)
- **Progress Bar:** `.v5-progress-bar` with `.v5-progress-fill` (animated width)
- **Function:** `updateV5Progress(current, total, message)` - Update progress UI

### 22.3 Statement Inventory
- **Container:** `v5-inventory-tray` (collapsible section above grid)
- **Display:** Shows pending statements before assignment
- **Cards:**
  - Filename (truncated)
  - Bank name + logo
  - Date range
  - Transaction count
  - Assign/Delete buttons
  - Duplicate badge (if duplicate detected)
- **Key Functions:**
  - `window.renderV5Inventory()` - Render pending statements
  - `window.assignStatementToAccount(statementId, accountCode)` - Assign to account

### 22.4 Parser Output
- **Data Extraction:** Bank-specific parsers (RBC, TD, BMO, etc.)
- **Output Structure:** Array of transaction objects with raw metadata
  - `_inst` - Institution code
  - `_transit` - Transit number
  - `_acct` - Account number
  - `_tag` - Account type tag (CHEQUING, VISA, etc.)
  - `_brand` - Bank name

---

## 23. PERFORMANCE MONITORING & OPTIMIZATION

### 23.1 Grid Performance
- **Virtual Scrolling:** Enabled by default (rowBuffer: 10)
- **Pagination:** Default 100 rows/page
- **requestAnimationFrame:** Used for async height/resize calculations
- **Lazy Column Sizing:** Deferred until grid visible (robust resize function)

### 23.2 Caching & Persistence
- **Auto-Save:** Debounced on cell edits (default 1 min interval)
- **In-Memory Cache:** V5State holds all data (gridData array)
- **localStorage Limits:** ~5-10MB, serialized JSON

### 23.3 Memory Optimization
- **Undo Stack:** Limited to 10 (prevents unbounded memory)
- **DOM Cleanup:** Closed drawers removed from DOM
- **Grid Virtualization:** Only visible rows rendered

### 23.4 Breakpoint Optimization
- **Mobile (< 768px):** Single-column layouts, touch-friendly buttons
- **Tablet (768-1023px):** Flexible grid, responsive drawer
- **Desktop (1024px+):** Full-width layout, all features

---

## 24. INTEGRATION POINTS & EXTERNAL DEPENDENCIES

### 24.1 External Libraries
- **AG Grid:** Enterprise data grid with advanced filtering, sorting, editing
- **Phosphor Icons:** Icon library (ph-* classes)
- **PDFJS:** PDF rendering and extraction
- **MerchantDictionary:** (Imported) Auto-categorization dictionary
- **localStorage:** Client-side persistence

### 24.2 Global Functions Used
- **Bank Detection:** `window.brandDetector`, `detectAccountType()`
- **Brain Storage:** `window.BrainStorage.clearAllFileHashes()`
- **Cache Manager:** `window.CacheManager.clearAll()`
- **Toast Manager:** `window.ToastManager.show(message, type)`
- **GL Dashboard:** `window.refreshGLDashboard()`, `window.toggleGLDashboard()`
- **Parser Results:** `window.rbcChequingParser`, etc.

### 24.3 Window Scope Functions (Exposed)
- **Core:** `initTxnImportV5Grid()`, `initV5()`, `renderTxnImportV5Page()`
- **Data:** `loadSavedData()`, `saveData()`, `saveDataAsync()`
- **Grid:** `recalculateAllBalances()`, `filterV5Grid()`, `filterV5ByRef()`
- **UI:** `applyAllV5Settings()`, `applyV5Theme()`, `applyV5RowDensity()`
- **Modals:** `toggleV5Settings()`, `toggleV5ReconDrawer()`, `openV5AuditDrawer()`
- **Shortcuts:** `renderV5Shortcuts()`, etc.
- [60+ additional global functions exposed for extensibility]

---

## 25. MISSING FEATURES IN ROBOLEDGER (GAPS)

Based on comprehensive analysis, these AutoBookkeeping-V4 features are **not yet in RoboLedger**:

### 25.1 Core Missing Features
- ❌ PDF curtain (source document viewer with highlights)
- ❌ Receipt/evidence matching (drag-drop file attachment)
- ❌ Audit ID generation (blockchain-style transaction signatures)
- ❌ Reconciliation per-source (opening + statement balance inputs)
- ❌ Bulk rename (find & replace in descriptions)
- ❌ 25+ theme system with premium themes (frosted, swiss, midnight)
- ❌ Workspace modes (zen, hybrid, audit, accountant)
- ❌ Floating filters in grid headers
- ❌ Account switching/navigation strip
- ❌ Metadata synchronization panel (dark monospace display)

### 25.2 Grid & Interaction Gaps
- ❌ Custom COA editor with search + grouping
- ❌ Ref# auto-generation with account-based prefixes
- ❌ Running balance calculation
- ❌ Row density controls (compact/comfortable/spacious)
- ❌ Floating filter headers (native AG Grid feature)
- ❌ Bulk operations UI (state machine for categorize/rename/delete)

### 25.3 Settings & Customization Gaps
- ❌ 9-tab settings panel (appearance, columns, autoCat, etc.)
- ❌ Staged settings (save confirmation for mode/theme changes)
- ❌ Shortcut visibility toggles + drag-reorder
- ❌ Font size slider + row density radio
- ❌ Currency settings (home/foreign pairs, live rates)
- ❌ Validation rule toggles (duplicate, balance alerts, negatives)

### 25.4 Validation & Reconciliation Gaps
- ❌ Per-source reconciliation cards with balance inputs
- ❌ Variance checking ($0.01 threshold)
- ❌ "Review Grid" button to filter by unbalanced sources
- ❌ Global reconciliation status badge
- ❌ Duplicate detection by transaction signature

### 25.5 Auto-Categorization Gaps
- ❌ Progress bar UI during categorization
- ❌ Dictionary-based merchant matching
- ❌ Heuristic fallback rules (e.g., bank fees, transfers, dividends)
- ❌ Confidence score display + color-coding
- ❌ Review-before-apply mode
- ❌ Confidence threshold control

### 25.6 Search & Filter Gaps
- ❌ Account-based filter (focus view by source)
- ❌ Filter status badge with "Clear" button
- ❌ Column-specific Ref# search
- ❌ Floating header filters on all columns

### 25.7 Export & Reporting Gaps
- ❌ Pop-out grid to new window (with embedded styles)
- ❌ Print-optimized bank statement format
- ❌ Export format selection (xlsx, csv)
- ❌ Bulk download/export with filename generation

### 25.8 Audit & Compliance Gaps
- ❌ Audit drawer with visual context + metadata
- ❌ PDF page extraction with surgical highlighting
- ❌ Zoom-on-hover for PDF snippets
- ❌ Magnetic handle for curtain toggle
- ❌ Receipt upload & preview
- ❌ Blockchain audit ID generation
- ❌ Verify/Flag workflow
- ❌ Audit status tracking (verified, flagged, pending)

### 25.9 Navigation & Discovery Gaps
- ❌ Account breadcrumb selector (bank + account type)
- ❌ Bank/account popover with logo + search
- ❌ Source tag automatic detection (CHQ, VISA, etc.)
- ❌ Account grouping logic (CHQ1, CHQ2 if multiple)
- ❌ Metadata panel (institution, transit, account display)

### 25.10 UX & Workflow Gaps
- ❌ Glassmorphism styling (blur + transparency)
- ❌ Inline confirmation messages (instead of alert boxes)
- ❌ Pulsing animations for pending actions
- ❌ Smooth drawer animations (translateX, slide-in)
- ❌ Hover effects on cards/buttons (pop effect)
- ❌ Toast notifications (success/info/warning)
- ❌ Responsive design for mobile/tablet
- ❌ Touch-friendly button sizing (44px min)

---

## 26. IMPLEMENTATION PRIORITY MATRIX

### High Impact + Medium Effort (Recommend First)
1. **Account Switching Strip** - Enable multi-source workflows
2. **Per-Source Reconciliation** - Critical for accounting
3. **Ref# Auto-Generation** - Improve data quality
4. **Bulk Rename** - Complete bulk operations
5. **Settings Panel Tabs** - User customization

### Medium Impact + Low Effort (Quick Wins)
1. **Receipt Upload** - Evidence matching
2. **Theme System** - Visual appeal
3. **Floating Filters** - Native AG Grid feature
4. **Balance Card** - Key reconciliation metric
5. **Audit ID Generation** - Compliance tracking

### High Impact + High Effort (Long-term)
1. **PDF Curtain + Visual Audit** - Rich audit workflow
2. **Workspace Modes** - Complete feature layering
3. **Advanced Auto-Categorization** - Dictionary + rules
4. **Comprehensive Validation** - Balance alerts + duplicate detection
5. **Full Settings Panel** - All 9 tabs + persistence

### Nice-to-Have (Lower Priority)
1. **Pop-Out Grid** - External window editing
2. **25+ Themes** - Visual variety
3. **Keyboard Shortcuts Legend** - Discoverability
4. **History Panel** - Audit trail
5. **Mobile Optimization** - iPhone/iPad support

---

## Summary Statistics

- **Total Functions Exposed:** 60+
- **Drawers/Modals:** 5 (Audit, Reconciliation, Settings, Assignment Banner, PDF Curtain)
- **UI Components:** 25+
- **Settings Categories:** 9
- **Themes:** 25+
- **Workspace Modes:** 5
- **Column Definitions:** 10
- **Validation Rules:** 5
- **Shortcut Buttons:** 7 (customizable)
- **Export Formats:** 3+ (xlsx, csv, pdf)
- **Keyboard Shortcuts:** 6+ documented

---

**Last Updated:** February 5, 2026  
**Reference File:** `txn-import-v5-v2.js` (14,083 lines)  
**Purpose:** Complete feature inventory for RoboLedger integration planning
