# RoboLedgers V5: Architectural Bug Log

This log tracks critical failures, layout collapses, and engine conflicts encountered during the V5 UX restoration. It serves as a regression prevention blueprint.

---

## 🛑 [2026-02-03] - Grid Data Wiring Failure (ReferenceError: dataAdjustedForAccount)
- **Status**: RESOLVED
- **Symptoms**: Grid showed dummy placeholders with no actual data. Dates showed "(Invalid)", accounts showed "Uncategorized", no real transaction data loaded.
- **Root Cause**: Grid initialization called non-existent function `dataAdjustedForAccount()` which caused silent failure. Data never reached the grid.
- **Fix**: Replaced with `window.RoboLedger.Ledger.getAll()` to properly retrieve transaction data from the ledger.
- **Prevention**: Always verify function existence before calling. Add console logging for data flow debugging.

## 🛑 [2026-02-03] - Date Column Showing "(Invalid)"
- **Status**: RESOLVED
- **Symptoms**: All dates displayed as "(Invalid)" instead of formatted dates like "05 Jan 2023".
- **Root Cause**: Date column was configured to read from `field: "date"` but the actual data uses `field: "date_iso"`.
- **Fix**: Changed date column field mapping from `"date"` to `"date_iso"` and verified Luxon formatter handles ISO date strings correctly.
- **Prevention**: Add debug logging to inspect actual data structure. Document canonical field names in data model.

## 🛑 [2026-02-03] - Double File Browser Dialog
- **Status**: RESOLVED
- **Symptoms**: Clicking "Browse files" button opened the file picker twice, causing confusion.
- **Root Cause**: Upload zone had nested button inside clickable div. Both elements triggered `fileInput.click()` causing double execution.
- **Fix**: Removed nested `<button>` element from upload zone. Made entire div clickable with proper hover states.
- **Prevention**: Avoid nesting interactive elements. Use single click handler on parent container.

## 🛑 [2026-02-03] - Missing File Type Restrictions
- **Status**: RESOLVED
- **Symptoms**: File input accepted all file types, allowing users to upload unsupported formats.
- **Root Cause**: No `accept` attribute on file input element.
- **Fix**: Added `accept=".csv,.xlsx,.xls,.pdf"` to restrict to supported formats only.
- **Prevention**: Always specify accepted file types on file inputs for better UX and security.

## 🛑 [2026-02-03] - Excessive Bold Text in Grid
- **Status**: RESOLVED
- **Symptoms**: Credit and Balance columns had bold text (`font-weight: 700` and `font-weight: 600`) making the grid visually heavy.
- **Root Cause**: Overly aggressive font-weight styling in column formatters.
- **Fix**: Removed `font-weight` declarations from Credit and Balance column formatters. Text now displays in regular weight with color coding only.
- **Prevention**: Use color for emphasis, reserve bold for headers and critical alerts only.

## 🛑 [2026-02-03] - ReferenceError: hasData is not defined
- **Status**: RESOLVED
- **Symptoms**: Grid failed to initialize with console error about undefined `hasData` variable.
- **Root Cause**: Description column formatter tried to access `hasData` variable from outer scope, but it wasn't accessible in formatter context.
- **Fix**: Changed conditional from `${hasData && hasContext ? ...}` to `${hasContext ? ...}` since only context check was needed.
- **Prevention**: Ensure all variables used in formatters are either in scope or passed as parameters.

---

## 🛑 [2026-02-03] - COA Layout Collapse (Vertical Stacking)
- **Status**: RESOLVED
- **Symptoms**: Table cells stacked vertically instead of horizontally. Grid appeared "broken" and unreadable.
- **Root Cause**: 
    1. **CSS Over-specificity**: `display: flex !important` applied to `.tabulator-cell` overrode Tabulator's internal layout engine.
    2. **DOM Collision**: Duplicate `#sharedAccountsGrid` IDs existed in both the shell (`index.html`) and the dynamic page (`app.js`), causing the renderer to target the wrong/hidden element.
- **Fix**: Centralized grid storage to `index.html` shell. Removed aggressive flexbox overrides from cells.
- **Prevention**: Never apply `display` properties to library-managed classes. Keep "Shared Instance" IDs unique to the app shell.

## 🛑 [2026-02-03] - Accordion "Ghost Gap" Persistence
- **Status**: RESOLVED
- **Symptoms**: After minimizing a category (e.g., Assets), a large 300px white gap remained.
- **Root Cause**: `min-height: 300px` was applied inline to the content container during expansion but was not cleared during the minimize transition.
- **Fix**: Explicitly set `minHeight = '0px'` and `height = '0px'` in the `toggleCoARow` closure.
- **Prevention**: Always pair `height: auto` expansion with explicit `min-height` resets in shared instance logic.

## 🛑 [2026-02-03] - ReferenceError: agGrid is not defined
- **Status**: RESOLVED
- **Symptoms**: Console errors blocked script execution, preventing the grid from loading.
- **Root Cause**: Residual `agGrid.createGrid` calls remained in the `initGrid()` function after the library was removed from the header.
- **Fix**: Replaced all remaining legacy grid logic with Tabulator equivalents.
- **Prevention**: Perform a global string search for legacy dependencies (`agGrid`, `ag-theme`) after performing an architectural swap.

## 🛑 [2026-02-03] - Tabulator Scoping Error (ReferenceError)
- **Status**: RESOLVED
- **Symptoms**: Help commands and console debuggers returned `coaTable is not defined`.
- **Root Cause**: Grid instances were trapped in a private IIFE closure in `app.js`.
- **Fix**: Exchanged local `let` declarations for `window.` global exposure.
- **Prevention**: Expose mission-critical UI instances to the `window` object for forensic auditability and remote debugging.

---
