# RoboLedger Transactions Page - UI Flow & Architecture
**Document Date:** 2026-02-05  
**MVP Commit:** `9f6cbe9`  
**Purpose:** Complete UI/UX flow reference for audit, reconstruction, and LLM modeling

---

## 📊 PAGE STRUCTURE OVERVIEW

The Transactions page is rendered by `renderTransactionsRestored()` function (lines 927-1160 in app.js).

**Container Hierarchy:**
```
V5 MAIN CONTENT WRAPPER (flex column, flex: 1)
  └─ V5 UNIFIED ISLAND WRAPPER (max-width: 1400px, margin: 0 auto)
      ├─ CARD 1: Merged Horizontal Header Card
      ├─ CARD 2: Action Bar (when hasData)
      ├─ CARD 3: Switcher Bar + Recon Hub (when hasData)
      ├─ GRID CONTAINER
      └─ State Overlays (Ingestion, Empty, Popped-out)
```

---

## 🎨 CARD 1: MERGED HORIZONTAL HEADER CARD

**Location:** Lines 947-1000  
**Classes:** `v5-main-header fade-in`  
**Layout:** Flexbox horizontal `gap: 12px`  
**Responsive Width:** 100% (contained in 1400px wrapper)

### Left Section: Account Info Box
**Class:** `header-card v5-glass`  
**Style:** `flex: 1` (grows to fill available space)  
**Padding:** 12px 20px  
**Contents:**
1. **Icon Box** - 44×44px gradient blue box with bank icon (ph-bank)
2. **Title Section** - Dynamic content based on `hasData` state:

#### When NO DATA (Empty State):
```
Title:       "Transactions" (static)
Subtitle:    "Waiting to get started..." (animated dots)
Font Size:   15px subtitle, 1.1rem title
Color:       #1e293b title, #64748b subtitle
```

#### When HAS DATA:
```
Title:       "[Bank Name] / [Account Type]"
             Example: "RBC Royal Bank / CHECKING"
Subtitle:    "INST: 003 • TRANSIT: 12345 • ACCOUNT: 8822991"
Font:        JetBrains Mono, uppercase, letter-spacing
Color:       #1e293b title, #64748b subtitle
```

**Data Source:**
- `activeAcc.name` - Bank name from account object
- `activeAcc.accountType` - Account type (CHECKING, SAVINGS, AMEX, etc.)
- `activeAcc.inst` - Institution number
- `activeAcc.transit` - Transit number
- `activeAcc.accountNumber` - Full account number

### Right Section: Upload Zone
**Class:** `upload-zone-v5 v5-glass`  
**Style:** Fixed width 420px
**Border:** 1.5px dashed #cbd5e1, border-radius: 8px  
**Background:** Transparent blue rgba(59, 130, 246, 0.04)

**Contents:**
1. **Icon** - Cloud arrow up (ph-cloud-arrow-up), 22px, blue
2. **Text Group:**
   - Main: "Drag and drop files here" (12px, bold)
   - Sub: "Limit 200MB per file • PDF, CSV, Excel" (9.5px, gray)
3. **Browse Button** - #3b82f6 background, white text, right-aligned

**Behavior:**
- `onclick="document.getElementById('fileInput').click()"` - Triggers file input
- Hidden file input: `accept=".csv,.xlsx,.xls,.pdf"`
- Calls: `window.handleFiles(this.files)` on change

---

## 🔄 STATE OVERLAYS (Called Between Header & Data-Dependent Cards)

### Overlay #1: Ingestion Progress
**Condition:** `UI_STATE.isIngesting === true`  
**Shows:** Centered spinner + progress bar  
**Content:**
- Large CPU icon (60px) with pulsing animation
- Title: "Forensic Ingestion In Progress"
- Progress bar: 6px height, full-width fill animation
- Label: `UI_STATE.ingestionLabel` (default: "Processing...")

**Min Height:** 400px (ensures space)

### Overlay #2: Empty State
**Condition:** `!hasData && !UI_STATE.isIngesting === true`  
**Shows:** Centered welcome message  
**Content:**
- Large book icon (70px) in light gray (#cbd5e1)
- Title: "No transactions yet." (1.5rem bold)
- Subtitle: "Import your bank statement or add your first entry manually to get started." (multiline text)

**Min Height:** 480px

---

## 📋 CARD 2: ACTION BAR (Visible Only When `hasData === true`)

**Location:** Lines 1001-1060  
**Class:** `v5-action-bar v5-glass`  
**Style Layout:** `display: flex; justify-content: space-between`  
**Height:** 53px (fixed)  
**Padding:** 0 24px (horizontal)  
**Gap:** 6px between items

### Section 1: LEFT - REF# Input
**Width:** min-width 170px  
**Display:** Flex with gap 10px

**Components:**
1. **Label** - "REF#" (13px, bold, #94a3b8)
2. **Input Field:**
   - Class: `cloudy-ref-input`
   - Width: 100px, Height: 34px
   - Font: 14px bold
   - Value: `activeAcc.ref || ''`
   - Placeholder: "AUTO"
   - Events:
     - `onblur="window.handleRefUpdate(this.value)"`
     - `onkeydown="if(event.key === 'Enter') this.blur()"`

**Purpose:** Store/update account reference prefix for dynamic Ref# generation

### Section 2: CENTER - METADATA LINE
**Class:** `v5-ati-line-center`  
**Font:** JetBrains Mono, 13px, #64748b  
**Display:** Flex, justify-content: center  
**Text Transform:** uppercase  
**Letter Spacing:** 0.01em

**Content Branches:**

#### If `selectedAccount === 'ALL'`:
```
Text: "ALL LEDGERS • UNIFIED VIEW"
Color: #64748b, opacity: 0.7
```

#### If Credit Card Account (`activeAcc.id === 'CC' || activeAcc.brand`):
```
BRAND: [activeAcc.name] • CARD#: [formatted card number]
Example: "BRAND: VISA • CARD#: 4111 1111 1111 1111"
```

#### If Bank Account (Default):
```
INST: [code] • TRANSIT: [code] • ACC#: [number]
Example: "INST: 003 • TRANSIT: 12345 • ACC#: 8822991"
```

**Helper Function:** `formatCardNumber(num, brand)` - Formats card number with spaces (standard or AMEX 4-6-5)

### Section 3: RIGHT - UTILITY BUTTONS
**Width:** min-width 170px, justify-content: flex-end  
**Gap:** 6px between buttons

**Button 1: Search Toggle**
- **Class:** `cloudy-btn`
- **Icon:** ph-magnifying-glass (18px)
- **Size:** 34×34px
- **Active Style:** Added class when `UI_STATE.isSearchOpen === true`
- **Event:** `onclick="window.toggleSearch()"`
- **Conditional:** Shows search input (170px) when active

**Search Input (When Active):**
- Placeholder: "Search..."
- Width: 170px, Height: 34px
- Events:
  - `oninput="window.handleSearch(this.value)"` - Live filter
  - `onkeydown="if(event.key === 'Escape') window.toggleSearch(false)"` - Close on ESC

**Button 2: Popout Grid**
- **Icon:** ph-arrow-square-out (18px)
- **Size:** 34×34px
- **Event:** `onclick="window.popOutGrid()"`
- **Purpose:** Opens grid in separate window

**Button 3: Grid Settings**
- **Icon:** ph-sliders-horizontal (18px)
- **Size:** 34×34px
- **Event:** `onclick="window.toggleSettings(true)"`
- **Purpose:** Opens grid configuration panel

---

## 🎯 CARD 3: SWITCHER BAR + RECON HUB (Visible Only When `hasData === true`)

**Location:** Lines 1061-1130  
**Class:** `v5-switcher-bar v5-glass`  
**Style Layout:** `display: flex; justify-content: space-between`  
**Height:** 53px (fixed)  
**Padding:** 8px 24px  
**Gap:** Between left and right sections

### Left Section: Account Pills
**Display:** Flex, gap 10px  
**Content:** Dynamic button group

**Button: ALL Accounts**
- **Label:** "ALL"
- **Active State:** `UI_STATE.selectedAccount === 'ALL'`
  - If active: blue background (#eff6ff), blue text (#3b82f6)
  - If inactive: default style
- **Event:** `onclick="window.switchAccount('ALL')"`
- **Style:** Auto padding (0 14px), height 32px

**Buttons: Individual Accounts (Dynamic)**
- **Data Source:** `accounts` array sorted by:
  1. Account type (AMEX→VISA→MC→CHQ→CHECKING→SAVINGS)
  2. Account ID (alphabetical)
- **Label Generation Logic:**
  - If account has `ref` property: use custom ref
  - Else if multiple accounts of same type: append number (CHQ1, CHQ2, etc.)
  - Else: use type abbreviation (CHQ, AMEX, VISA)
- **Active State:** Same as ALL button
- **Event:** `onclick="window.switchAccount('[acc.id]')"`
- **Count Management:** Tracks duplicate types with `counts` object

### Right Section: Recon Hub (Asset Reconciliation Display)
**Condition:** Only visible if:
- `UI_STATE.selectedAccount !== 'ALL'`
- `activeAcc` exists

**Display:** Flex, gap 15px, monospace font  
**Font:** JetBrains Mono, 13px, #64748b

**Component 1: Opening Balance**
- **Label:** "OPENING" (10px uppercase)
- **Input Field:** Type number
  - Width: 85px, Height: 29px
  - Background: Semi-transparent gray
  - Value: `activeAcc.openingBalance || 0`
  - Event: `onblur="window.handleOpeningBalanceUpdate('[accId]', this.value)"`

**Component 2: Debit Total**
- **Display:** Red (#ef4444) number + "DR" label (9px)
- **Calculation:** Sum of all transactions where `polarity === 'DEBIT'`
- **Format:** Localized USD currency (2 decimals)

**Separator:** "-" (gray)

**Component 3: Credit Total**
- **Display:** Green (#10b981) number + "CR" label (9px)
- **Calculation:** Sum of all transactions where `polarity === 'CREDIT'`
- **Format:** Localized USD currency (2 decimals)

**Separator:** "+"

**Component 4: Ending Balance (Calculated)
- **Display:** Bold monospace number (15px, #1e293b)
- **Calculation Logic:**
  ```javascript
  const isLiability = /VISA|MC|AMEX|CREDIT/i.test(account.type);
  if (isLiability) {
    ending = opening + totalDebit - totalCredit;
  } else {
    ending = opening - totalDebit + totalCredit;
  }
  ```
- **Style:** Blue-tinted background box with dashed border
- **Label:** "ENDING" (10px uppercase)

**Purpose:** Real-time balance reconciliation showing Opening → DR - CR = Ending

---

## 📊 GRID CONTAINER

**Location:** Lines 1131-1155  
**Class:** `grid-container-wall`  
**Style:**
- Width: 100%, max-width 1400px (contained)
- Flex: 1 (fills remaining vertical space)
- Min-height: 0 (allows flex to work)
- Display: flex, flex-direction: column

### Grid States

#### State 1: Grid Popped Out
**Condition:** `UI_STATE.isPoppedOut === true`  
**Shows:** Centered message with restore button  
**Content:**
- Monitor icon (80px, blue, semi-transparent)
- Title: "Grid Popped Out"
- Subtitle: "Active in standalone window."
- Button: "Restore" → `onclick="window.popInGrid()"`

#### State 2: Grid Active
**Condition:** `!UI_STATE.isPoppedOut`  
**Shows:** Tabulator grid instance  
**Container:** `<div id="txnGrid" style="height: 100%; width: 100%;"></div>`

---

## 🗂️ GRID INITIALIZATION & COLUMNS

**Function:** `initGrid()` (Lines 1170-1550)  
**Grid Library:** Tabulator v5.5  
**Container ID:** `#txnGrid`  
**Height:** 100% (fills parent container)  
**Layout Mode:** `fitColumns` (auto-distribute)

### Data Preparation
Before columns initialize, data undergoes:

1. **Filtering:** Account selection (ALL vs single account)
2. **Year Repair:** Replace 2026 → 2023 in all date fields (aggressive)
3. **Balance Calculation:**
   - Asset accounts: CR increases, DR decreases
   - Liability accounts (CC): DR increases, CR decreases
   - Running balance calculated per row
4. **Ref Generation:** Injects `source_ref` as `[prefix]-[index]`

### Column Definitions (8 Columns)

#### Column 1: Ref# (Reference Number)
- **Field:** `ref`
- **Width:** 120px
- **Sort:** Yes
- **Formatter:** Dynamic calculation
  - If row has explicit `ref` value: show it
  - Else: calculated as `[prefix]-[rowIndex]` (1-based)
  - Prefix from REF# input in action bar
- **Color:** #64748b (explicit) or #94a3b8 (calculated/auto)

#### Column 2: Source
- **Field:** `source_ref`
- **Width:** 145px
- **Sort:** Yes
- **Formatter:** Bold uppercase source code
- **Example:** "CHQ1-001", "CSV"
- **Data:** Pre-calculated during grid init

#### Column 3: Date
- **Field:** `date`
- **Width:** 130px
- **Sort:** Yes
- **Formatter:** Plain text with fallback
  - If empty: "---" in light gray
  - Else: Formatted date (M/D/YYYY or DD MMM)
- **Color:** #475569

#### Column 4: Payee / Description (WIDEST)
- **Field:** `description`
- **WidthGrow:** 2 (grows to fill available space)
- **Sort:** Yes, editable
- **Formatter:** 2-Line vertical layout
  - **Line 1 (Top):** Clean merchant name (sentence case, bold #1e293b)
  - **Line 2 (Bottom):** Transaction detail (smaller 11px, gray #64748b)
  - **Logic:**
    - Uses `row.description` for name
    - Uses `row.raw_description` for detail
    - Removes dates via regex
    - Removes duplicates between name & detail
    - Applies sentence case to both lines
    - Shows "—" em-dash if detail empty
- **Ellipsis:** Truncates line 2 with text-overflow

#### Column 5: Debit
- **Field:** `debit_col`
- **Width:** 110px
- **Sort:** Yes, editable (number)
- **Formatter:**
  - If row.polarity === 'DEBIT' AND amount > 0: Red ($X.XX)
  - Else: Light gray "-"
- **Align:** Right
- **Edit Params:** Min 0, step 0.01
- **Color:** #ef4444 (red for debits)

#### Column 6: Credit
- **Field:** `credit_col`
- **Width:** 110px
- **Sort:** Yes, editable (number)
- **Formatter:**
  - If row.polarity === 'CREDIT' AND amount > 0: Green ($X.XX)
  - Else: Light gray "-"
- **Align:** Right
- **Color:** #10b981 (green for credits)

#### Column 7: Balance
- **Field:** `balance`
- **Width:** 130px
- **Sort:** Yes
- **Formatter:** Right-aligned currency
  - Shows running balance after each transaction
  - Calculated during data prep
  - Format: USD currency notation
- **Color:** #475569

#### Column 8: Account# (Category)
- **Field:** `category`
- **Width:** 180px
- **Sort:** Yes
- **Formatter:** Category label or "Suspense (Uncategorized)"
- **Editable:** Dropdown (future enhancement)

---

## 🎬 DATA FLOW & LIFECYCLE

### 1. Page Load
```
User clicks "Transactions" in sidebar
  ↓
renderTransactionsRestored() executes
  ↓
Fetches from window.RoboLedger.Ledger.getAll() & Accounts.getAll()
  ↓
Renders HTML with 3 cards + state overlays
  ↓
setTimeout(initGrid, 50) queues grid initialization
```

### 2. Grid Initialization
```
initGrid() fires (50ms delay)
  ↓
Filters data by UI_STATE.selectedAccount
  ↓
Repairs year (2026 → 2023) in date fields
  ↓
Calculates running balance (asset vs liability logic)
  ↓
Injects source_ref codes
  ↓
Creates Tabulator instance on #txnGrid
  ↓
Attaches event handlers (cellEdited, dataSorted, rowClick, selection)
```

### 3. User Interactions

**Account Switch:**
```
User clicks pill button (ALL, CHQ1, etc.)
  ↓
window.switchAccount('[accId]') fires
  ↓
UI_STATE.selectedAccount = accId
  ↓
window.render() called
  ↓
Full page re-renders with new account data
```

**Search:**
```
User types in search input
  ↓
window.handleSearch(value) fires
  ↓
txnTable.setFilter([column], 'like', value)
  ↓
Grid updates live (600ms debounce)
```

**REF# Update:**
```
User edits REF# input & blurs
  ↓
window.handleRefUpdate(value) fires
  ↓
Saves to account.ref
  ↓
txnTable.redraw(true) re-renders Ref# column
```

**Opening Balance Update:**
```
User edits opening balance in recon hub
  ↓
window.handleOpeningBalanceUpdate(accId, value) fires
  ↓
Recalculates all running balances
  ↓
Grid refreshes balance column
```

**File Upload:**
```
User drags/clicks upload zone
  ↓
window.handleFiles(fileList) fires
  ↓
Ingests CSV/PDF bank statements
  ↓
UI_STATE.isIngesting = true
  ↓
Progress bar shows during processing
  ↓
On complete: data added to Ledger, page re-renders
```

**Row Click:**
```
User clicks transaction row
  ↓
rowClick event handler fires
  ↓
Checks if target is checkbox/editor/button (skips if so)
  ↓
window.toggleWorkbench(true, data.sourceFileId) fires
  ↓
Audit drawer opens showing source PDF/CSV
```

---

## 🔐 STATE MANAGEMENT

**Key State Properties** (UI_STATE object):
- `currentRoute` - Current page (import, coa, home)
- `selectedAccount` - Active account ID or 'ALL'
- `isIngesting` - Upload in progress
- `ingestionProgress` - 0-100 percent
- `ingestionLabel` - Status text (e.g., "Parsing CSV...")
- `isPoppedOut` - Grid in separate window
- `isSearchOpen` - Search input visible
- `searchQuery` - Current search text
- `recoveryPending` - Session recovery banner

**Persistence:** UI_STATE stored in localStorage for session recovery

---

## 🎨 STYLING FRAMEWORK

**Core Classes:**
- `.v5-glass` - Frosted glass effect (translucent background, border)
- `.cloudy-btn` - Standard button (hover effects, transitions)
- `.v5-waiting-container` - Centered overlay state
- `.v5-waiting-title` - Large center text
- `.v5-waiting-subtitle` - Supporting text
- `.fade-in` - Entrance animation

**Color Palette:**
- Primary: #3b82f6 (blue)
- Dark text: #1e293b
- Medium text: #475569
- Light text: #64748b
- Lighter text: #94a3b8
- Border: #e2e8f0 (#cbd5e1 for dashed)
- Debit: #ef4444 (red)
- Credit: #10b981 (green)
- Glass: rgba(..., 0.05) - Translucent backgrounds

**Fonts:**
- Headers/UI: Inter, system sans-serif
- Monospace: JetBrains Mono (metadata, ref#)
- Icons: Phosphor Icons (@phosphor-icons/web)

---

## 📑 QUICK REFERENCE: FUNCTION MAPPING

| Function | Purpose | Triggers |
|----------|---------|----------|
| `renderTransactionsRestored()` | Main page template | Page load, account switch |
| `initGrid()` | Tabulator initialization | After render, 50ms delay |
| `window.switchAccount(id)` | Change active account | Click account pill |
| `window.handleRefUpdate(val)` | Save REF# prefix | Blur REF# input |
| `window.handleSearch(val)` | Filter grid by text | Type in search input |
| `window.handleOpeningBalanceUpdate(id, val)` | Update opening balance | Blur opening input |
| `window.handleFiles(files)` | Upload bank statements | Drop/select files |
| `window.toggleSearch()` | Show/hide search input | Click search button |
| `window.toggleWorkbench(open, fileId)` | Open/close audit drawer | Click row / close button |
| `window.popOutGrid()` | Open grid in new window | Click popout button |
| `window.popInGrid()` | Restore grid to page | Click restore button |

---

## ⚙️ CONFIGURATION & CUSTOMIZATION

### Grid Settings
- **Row Height:** 32px (professional V5 density)
- **Pagination:** 50 rows/page (selector: 50, 100, 200, 300, 500)
- **Virtual Rendering:** Enabled (performance for 200+ rows)
- **Progressive Render:** Enabled

### Layout Constraints
- **Max Width:** 1400px (all cards and grid)
- **Container Padding:** 24px horizontal
- **Card Gap:** 12px (header to action bar)
- **Header Height:** 60-80px (variable with content)
- **Action Bar Height:** 53px
- **Row Handle:** 25px width (drag handle)

### Responsive Behavior
- All cards use `width: 100%` with max-width constraint
- Account pill buttons shrink/grow on flex
- Metadata line center-justifies on `space-between` flex
- Grid fills remaining vertical space with flex: 1
- Upload zone fixed 420px width (may need adjustment on mobile)

---

## 🚀 NOTES FOR RECONSTRUCTION

**Key Implementation Points:**
1. All rendering is template literal (single HTML string returned from render function)
2. Conditional rendering uses ternary operators (` ? ` : ` `)
3. Dynamic content loops with `.map()` for account pills
4. Data flows through window.RoboLedger API (Ledger & Accounts)
5. Event handlers all use `window.` global scope
6. Tabulator instance stored as `window.txnTable` (global reference)
7. Grid columns use `formatter` function for custom rendering
8. Balance calculation happens once during grid init (no real-time update currently)
9. Running balance uses account opening balance as starting point
10. Account type determines polarity logic (asset vs liability)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-05  
**Review Status:** Ready for LLM audit
