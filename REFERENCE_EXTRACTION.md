# AutoBookkeeping-V4 Reference Extraction
**Source:** `/Users/asmian/Library/CloudStorage/GoogleDrive-asmian.backup@gmail.com/My Drive/New folder/Projects/AutoBookkeeping-V4/`

---

## 1. SETTINGS PAGE LAYOUT (`src/pages/settings.js`)

### Grid Layout
```
.settings-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    height: calc(100vh - 80px);
    background: #f8fafc;
    overflow: hidden;
    margin: -32px;
}
```

### Sidebar Navigation Structure
- **Width:** 240px fixed
- **Padding:** 20px 12px
- **Border:** 1px solid rgba(226, 232, 240, 0.8) on right
- **Header:** "App Settings" title + "Configure RoboLedgers" subtitle

### Settings Nav Items
Each `.settings-nav-item` has:
- **Icon** (Phosphor icons): `.ph ph-{icon}`
- **Title** (bold): "General", "Accounts", "Appearance", "Data", "Integrations", "Billing", "Vendors", "About"
- **Description** (small): "Preferences", "Bank & cards", "Themes", "Backup / AI", etc.
- **Styling:** 
  - Normal: `color: #64748b;`
  - Hover: `background: #f8fafc; color: #2563eb;`
  - Active: `background: #eff6ff; color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.1);`

### Settings Sections
The main panel renders different content based on `panel` parameter:
- `general` - Preferences (default)
- `accounts` - Bank & cards
- `appearance` - Themes & fonts
- `data` - Backup / AI options
- `integrations` - Cloud & Wiki
- `subscription` - Billing/Plan
- `vendors` - Vendor Dictionary
- `about` - Version info

---

## 2. ACTION BAR & METADATA PANEL (`src/pages/txn-import-v5-v2.js`)

### Action Bar Container
```html
<div class="v5-action-bar v5-control-toolbar" id="v5-action-bar" 
     style="display: none; align-items: center; padding: 0 20px; height: 56px;">
```

**Properties:**
- Height: 56px
- Display: none (toggled dynamically)
- Padding: 0 20px
- Alignment: flex, center
- Background: white (from class)

### REF# Input Section
```html
<div class="v5-ref-input-wrapper">
    <label style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase;">Ref#</label>
    <input type="text" 
           id="v5-ref-prefix" 
           class="v5-ref-input" 
           placeholder="REF" 
           style="width: 80px; padding: 6px 10px; height: 32px; font-weight: 600; 
                  text-align: center; font-family: 'Courier New', monospace; 
                  text-transform: uppercase; border: 1px solid #ddd; border-radius: 4px;">
    oninput="window.updateRefPrefix(this.value)">
</div>
```

**Features:**
- Label: "REF#" (uppercase, 0.75rem, 600 weight)
- Input width: 80px
- Height: 32px
- Font: Courier New (monospace), uppercase
- Event: `oninput` for real-time updates
- Stores in `V5State.refPrefix`

### Metadata Panel Display
```html
<div id="v5-metadata-panel" 
     style="display: flex; align-items: center; gap: 12px; padding: 4px 16px; 
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); 
            border-radius: 6px; font-size: 0.75rem; color: #cbd5e1; 
            font-family: 'Courier New', monospace; margin: 0 12px; 
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);">
  <span id="v5-meta-bank" style="white-space: nowrap;">
    <i class="ph ph-bank" style="margin-right: 4px;"></i>...
  </span>
  <span style="color: #475569;">|</span>
  <span id="v5-meta-inst" style="white-space: nowrap;">Inst: <strong>...</strong></span>
  <span style="color: #475569;">|</span>
  <span id="v5-meta-transit" style="white-space: nowrap;">Transit: <strong>...</strong></span>
  <span style="color: #475569;">|</span>
  <span id="v5-meta-account" style="white-space: nowrap;">Acct: <strong>...</strong></span>
</div>
```

**Styling:**
- Background: Dark gradient `#1e293b 0%, #0f172a 100%`
- Text: `#cbd5e1` (light), mono font
- Font-size: 0.75rem (11px)
- Padding: 4px 16px
- Separators: `|` with `color: #475569`
- Box shadow: inset dark
- Border-radius: 6px

**Displayed Fields:**
1. **Bank Icon** - `<i class="ph ph-bank"></i>`
2. **Institution** - `Inst: <strong>{number}</strong>`
3. **Transit Number** - `Transit: <strong>{number}</strong>`
4. **Account** - `Acct: <strong>{masked}</strong>`

### Shortcuts Container (Left Side)
```html
<div id="v5-shortcuts-container" 
     style="display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; 
            overflow: hidden; max-width: 100%;">
```

**Shortcut Buttons in Action Bar:**
1. **Undo** - `<i class="ph ph-arrow-counter-clockwise"></i>` onclick="undoV5()"
2. **History** - `<i class="ph ph-clock-counter-clockwise"></i>` onclick="toggleV5History()"
3. **Start Over** - `<i class="ph ph-arrows-counter-clockwise"></i>` onclick="startOverV5()"
4. **Pop Out** - `<i class="ph ph-arrow-square-out"></i>` onclick="popOutV5Grid()"

**Button Styling:**
- Class: `btn-icon-secondary`
- Draggable: true (drag-and-drop reordering)
- Cursor: move
- Gap: 8px between buttons

### Right Menu Items
```html
<div class="v5-actions-right">
  <!-- GL Dashboard Toggle -->
  <button class="btn-icon" onclick="window.toggleGLDashboard()" 
          title="Integrated GL Dashboard" style="margin-right: 8px;">
    <i class="ph ph-chart-line-up"></i>
  </button>

  <!-- Reconciliation Toggle -->
  <button id="v5-recon-toggle-btn" class="btn-icon accountant-only-section" 
          onclick="window.toggleV5ReconDrawer()" 
          title="Source Control Hub (Reconciliation)" 
          style="margin-right: 8px; display: none; color: #8b5cf6;">
    <i class="ph ph-scales" style="font-size: 1.25rem;"></i>
  </button>

  <!-- Settings Dropdown -->
  <div style="position: relative; overflow: visible;">
    <button class="btn-icon" onclick="window.toggleV5Settings()" title="Settings">
      <i class="ph ph-gear"></i>
    </button>
    <div class="v5-dropdown-menu" id="v5-dropdown-menu" 
         style="display: none; position: absolute; right: 0; top: 100%; 
                margin-top: 8px; min-width: 200px; background: white; 
                border: 1px solid #e5e7eb; border-radius: 8px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 9999;">
      <button onclick="window.showV5Appearance(); window.toggleV5Settings();">
        <i class="ph ph-palette"></i> Grid Appearance
      </button>
    </div>
  </div>
</div>
```

---

## 3. METADATA STRUCTURE

### Account Metadata Schema
```javascript
{
  bank: "RBC",                    // Bank name
  institution: "001",             // Institution number
  transit: "12345",               // Transit number
  account: "1112443",             // Full account number
  accountMasked: "***2443",       // Masked (last 4 digits)
  fileName: "RBC_Jan_2024.csv"    // Source file
}
```

### Transaction Metadata Fields
```javascript
{
  totalIn: 50000,         // Total credits
  totalOut: 45000,        // Total debits
  txnCount: 125,          // Number of transactions
  bank: "Royal Bank",
  transit: "12345",
  accountMasked: "***2443",
  institution: "001"
}
```

### Audit ID Format
Format: `{AccountType}-{AccountNumber}-{InstCode}-{TransitNumber}-{DateYYYYMMDD}-{SequenceXXX}`

Example: `Chequing-1112443-001-12345-20240105-001`

---

## 4. SETTINGS DRAWER CHARACTERISTICS

### Sidebar Navigation Items
Each item is a route link with:
- **Icon** - Phosphor icon (18-24px)
- **Title** - Bold, uppercase-like semibold (0.9rem)
- **Description** - Smaller text, tertiary color (0.7rem, #94a3b8)
- **Active Indicator** - Light blue background + left border accent
- **Hover State** - Subtle background change, slight color shift

### Settings Panels Content
Each panel contains:
- **Section Headers** - Bold titles, dark text (#1e293b)
- **Form Groups** - Labeled inputs with helper text
- **Toggles** - Checkboxes for features
- **Dropdowns** - Select elements for configuration
- **Sliders** - Range inputs (e.g., confidence threshold, font size)
- **Save/Cancel Buttons** - Always at bottom

### Settings Categories Implemented
1. **General / Preferences**
   - Default REF# prefix
   - Date format
   - Province/Region
   - Auto-expand rows

2. **Accounts**
   - Bank account list
   - Add/remove accounts
   - Set opening balances
   - Account reconciliation

3. **Appearance**
   - Theme selection
   - Font size slider
   - Row density options (compact, normal, spacious)
   - Grid styling

4. **Data**
   - Backup options
   - AI integration settings
   - Data export

5. **Integrations**
   - Cloud service connections
   - Wiki/API integrations

6. **Billing**
   - Plan information
   - Payment method
   - Usage stats

7. **Vendors**
   - Vendor dictionary manager
   - Vendor categorization

---

## 5. KEYBOARD & INTERACTION PATTERNS

### REF# Input Behavior
- **Auto-uppercase:** Text transforms to uppercase automatically
- **Bidirectional sync:** Input syncs with toolbar and settings
- **Event:** `oninput` for real-time updates
- **Placeholder:** "REF"
- **Width:** 80px (fixed, monospace)

### Shortcut Buttons
- **Icon-only buttons**: No text labels, only Phosphor icons
- **Tooltips:** `title=` attribute for hover info
- **Draggable:** Each button can be reordered in the action bar
- **Max Capacity:** Visual warning when too many shortcuts

### Dropdown Menu
- **Position:** Absolute, right: 0, top: 100% + 8px margin
- **Style:** White background, subtle border, rounded corners
- **Shadow:** `0 10px 25px rgba(0,0,0,0.1)`
- **Z-index:** 9999
- **Items:** Hover changes to light background (#f1f5f9)

---

## 6. COLOR PALETTE USED

### Text Colors
- Primary: #1e293b (dark)
- Secondary: #334155 (medium)
- Tertiary: #64748b (light)
- Muted: #94a3b8 (faint)
- Inverses: #cbd5e1 (light text)

### Background Colors
- White: #ffffff
- Light: #f8fafc
- Lighter: #f1f5f9
- Dark: #1e293b, #0f172a (gradient in metadata)

### Accent Colors
- Blue: #3b82f6, #2563eb, #1d4ed8
- Light Blue BG: #eff6ff
- Green (success): #10b981, #dcfce7
- Red (danger): #ef4444, #fef2f2
- Purple (secondary): #8b5cf6

### Borders & Shadows
- Border: #e2e8f0, #ddd, #e5e7eb
- Shadow: `0 10px 25px rgba(0,0,0,0.1)`, `inset 0 1px 2px rgba(0,0,0,0.3)`

---

## 7. RESPONSIVE DESIGN NOTES

### Mobile Breakpoint (max-width: 768px)
- Settings sidebar becomes horizontal (flex-direction: row)
- Sidebar scrolls horizontally
- Grid becomes single column
- Height adjusts to `100vh - 60px`
- Descriptions in nav items hidden for space

---

## 8. KEY FUNCTIONS TO IMPLEMENT

### Core Functions Referenced
```javascript
window.updateRefPrefix(value)              // Updates REF# prefix
window.updateActionBarMetadata(account, metadata)  // Updates metadata display
window.toggleV5Settings()                  // Toggle settings drawer
window.toggleGLDashboard()                 // Toggle GL dashboard
window.toggleV5ReconDrawer()               // Toggle reconciliation drawer
window.syncV5SettingsUI()                  // Sync UI with state
window.toggleV5Column(columnId, visible)   // Show/hide grid columns
window.undoLastAction()                    // Undo last transaction
window.popOutV5Grid()                      // Pop out grid to new window
```

### Metadata Update Function
```javascript
const metadata = {
  totalIn: creditSum,
  totalOut: debitSum,
  txnCount: rowCount,
  bank: activeAccount.bank,
  transit: activeAccount.transit,
  accountMasked: activeAccount.masked,
  institution: activeAccount.inst
};
window.updateActionBarMetadata(accountKey, metadata);
```

---

## SUMMARY

The AutoBookkeeping-V4 implementation features:

1. **Settings Page:** Nested sidebar + panel layout (240px + 1fr grid)
2. **Action Bar:** Compact 56px toolbar with REF# input, shortcuts, metadata, and right-side menu
3. **Metadata Panel:** Dark gradient background (monospace font), displaying: Bank, Institution, Transit, Account
4. **Navigation:** Route-based (hash routing), nested panels with active states
5. **Styling:** Glassmorphism elements, Phosphor icons, dark/light theme support
6. **Interactivity:** Draggable buttons, dropdowns, toggles, real-time input sync
7. **Color System:** Coherent slate/blue palette with accent colors for status

**Key Differences from RoboLedger - NEW:**
- Settings page is a dedicated route (not in-place drawer)
- Metadata displayed inline in action bar (not separate section)
- More extensive settings categories
- Draggable shortcut customization
- GL Dashboard integration button
- Reconciliation drawer (Source Control Hub)
