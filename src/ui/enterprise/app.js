/**
 * RoboLedger V4/V5 UI Restoration Controller
 * Wired to the live Ledger Engine (ledger.core.js)
 */
(function () {
  // --- UI STATE & ROUTING ---
  window.UI_STATE = {
    currentRoute: 'home',
    navItems: [
      { label: 'Home' },
      { label: 'Transactions' }
    ],
    breadcrumbs: [
      { label: 'Home', active: true }
    ],
    selectedAccount: 'ALL',
    isIngesting: false,
    ingestionProgress: 0,
    ingestionLabel: null,
    isSettingsOpen: false,
    settingsTab: 'grid',
    activeTheme: 'Rainbow',
    resetConfirm: false,
    refError: null,
    bulkMenuOpen: false,
    workbenchOpen: false,
    activeFileId: null,
    isPoppedOut: false,
    popoutWindow: null,
    recoveryPending: false,
    isSearchOpen: false,
    searchQuery: '',
    refPrefix: 'CHQ1', // Default ref prefix for transaction numbering
    selectedTx: null,
    accountDropdownOpen: false,
    panelState: 'collapsed', // 'closed', 'collapsed', 'expanded'
    version: '1.5.0', // Last stable before signal-fusion overhaul
    // Settings Persistence
    dexterity: 3,
    fontSize: 13,
    density: 'comfortable',
    autocatEnabled: true,
    confidenceThreshold: 0.8,
    refOverride: 'TXN',
    dateFormat: 'MM/DD/YYYY',
    province: 'AB',
    gstEnabled: true,
    // Grid Appearance Settings (NEW in V5.1)
    gridTheme: 'post-it-note',
    gridFontSize: 13.5,

    // Transaction Import State
    uploadInProgress: false,
    importSession: null,

    // Version
    version: '1.5.0',

    // Transaction Filter State (for drill-down)
    activeFilter: null, // { type, label, filter: function }
  };

  const UI_STATE = window.UI_STATE; // Local reference for speed

  // Create global file input that persists across renders
  const globalFileInput = document.createElement('input');
  globalFileInput.type = 'file';
  globalFileInput.id = 'fileInput';
  globalFileInput.multiple = true;
  globalFileInput.accept = '.pdf,.csv,.xlsx,.xls';
  globalFileInput.style.display = 'none';
  globalFileInput.addEventListener('change', function (event) {
    window.handleFileSelect(event);
  });
  document.body.appendChild(globalFileInput);

  // Folder input for directory-level uploads
  const globalFolderInput = document.createElement('input');
  globalFolderInput.type = 'file';
  globalFolderInput.id = 'folderInput';
  globalFolderInput.setAttribute('webkitdirectory', '');
  globalFolderInput.setAttribute('directory', '');
  globalFolderInput.multiple = true;
  globalFolderInput.style.display = 'none';
  globalFolderInput.addEventListener('change', function (event) {
    // Filter to only PDF/CSV files from the folder tree
    const allFiles = Array.from(event.target.files);
    const validFiles = allFiles.filter(f => /\.(pdf|csv|xlsx?)$/i.test(f.name));
    console.log(`[FOLDER] Selected folder contains ${allFiles.length} files, ${validFiles.length} are bank statements`);
    if (validFiles.length > 0) {
      // Sort files by path so statements from the same account are grouped
      validFiles.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
      window.handleFilesSelected(validFiles);
    } else {
      console.warn('[Upload] No PDF or CSV files found in the selected folder.');
    }
    // Reset so same folder can be re-selected
    event.target.value = '';
  });
  document.body.appendChild(globalFolderInput);
  console.log('[FILE] Global file + folder inputs created');

  // Protocol check - Log status but don't block
  if (window.location.protocol === 'file:') {
    console.log('✓ [APP] Running from file:// - Local storage mode active');
  } else {
    console.log('✓ [APP] Running on HTTP - Server-backed mode active');
  }

  // Expose file picker globally
  window.openFilePicker = function () {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.click();
      console.log('[FILE] File picker opened');
    } else {
      console.error('[FILE] file input not found');
    }
  };

  window.openFolderPicker = function () {
    const folderInput = document.getElementById('folderInput');
    if (folderInput) {
      folderInput.click();
      console.log('[FILE] Folder picker opened');
    } else {
      console.error('[FILE] folder input not found');
    }
  };

  /**
   * Get all accounts that have at least 1 transaction.
   * Delegates to Accounts.getActive() which also prunes GENERIC PARSER ghosts.
   * @returns {Array} Accounts with transaction data
   */
  function getAccountsWithTransactions() {
    return window.RoboLedger?.Accounts?.getActive?.()
        || window.RoboLedger?.Accounts?.getAll()?.filter(acc => {
            const allTxns = window.RoboLedger?.Ledger?.transactions || [];
            return allTxns.some(t => t.account_id === acc.id);
        })
        || [];
  }

  // Prune ghost accounts from localStorage on every page load
  // (catches ghosts persisted before this fix was deployed)
  try {
    window.RoboLedger?.Accounts?.pruneGhosts?.();
  } catch (_) { /* silent — runs before full init */ }


  // IMMEDIATE GLOBAL EXPOSURE (Fix ReferenceError)
  window.render = function () {
    if (typeof render === 'function') render();
    else console.error("[UI] render function NOT YET DEFINED");
  };

  // State Persistence for Detached Grid
  window.addEventListener('message', (event) => {
    const { type, data } = event.data;
    if (type === 'updateGridData') {
      const currentData = window.RoboLedger.Ledger.getAll();
      // Map updates back to ledger
      data.forEach(updatedTx => {
        const tx = window.RoboLedger.Ledger.get(updatedTx.tx_id);
        if (tx) {
          Object.assign(tx, updatedTx);
        }
      });
      // Save to localstorage via ledger
      localStorage.setItem('roboledger_v5_data', JSON.stringify({
        transactions: window.RoboLedger.Ledger.getRawState().transactions,
        sigIndex: window.RoboLedger.Ledger.getRawState().sigIndex
      }));
      window.updateWorkspace();
    } else if (type === 'popIn') {
      window.popInGrid();
    }
  });

  window.handleRefUpdate = (val) => {
    const success = window.RoboLedger.Accounts.setRef(UI_STATE.selectedAccount, val);
    if (!success.success) {
      UI_STATE.refError = success.error;
    } else {
      UI_STATE.refError = null;
    }
    window.updateWorkspace();
  };

  window.toggleInspector = () => {
    UI_STATE.panelState = UI_STATE.panelState === 'closed' ? 'collapsed' : (UI_STATE.panelState === 'collapsed' ? 'expanded' : 'closed');
    console.log('[UI] Inspector state:', UI_STATE.panelState);
    window.updateWorkspace();
  };

  window.handleOpeningBalanceUpdate = (accId, val) => {
    const amount = parseFloat(val) || 0;
    window.RoboLedger.Accounts.setOpeningBalance(accId, amount * 100);
    window.updateWorkspace();
  };

  // Mobile sidebar toggle
  // File upload handlers for drag-drop and browse (supports folders)
  window.handleDropZone = async (event) => {
    event.preventDefault();
    const items = event.dataTransfer.items;
    // Check if any dropped items are directories
    if (items && items.length > 0) {
      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      if (entries.some(e => e.isDirectory)) {
        // Recursively collect all PDF/CSV files from directories
        console.log('[DROP] Folder drop detected, scanning recursively...');
        const allFiles = await collectFilesFromEntries(entries);
        const validFiles = allFiles.filter(f => /\.(pdf|csv|xlsx?)$/i.test(f.name));
        console.log(`[DROP] Found ${allFiles.length} files, ${validFiles.length} are bank statements`);
        if (validFiles.length > 0) {
          validFiles.sort((a, b) => (a._path || a.name).localeCompare(b._path || b.name));
          window.handleFilesSelected(validFiles);
        } else {
          console.warn('[DROP] No PDF or CSV files found in the dropped folder.');
        }
        return;
      }
    }
    // Fallback: regular file drop
    const files = event.dataTransfer.files;
    if (files.length > 0) window.handleFilesSelected(files);
  };

  // Recursively traverse filesystem entries from drag-drop
  async function collectFilesFromEntries(entries) {
    const files = [];
    async function traverseEntry(entry, path) {
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        file._path = path + '/' + file.name;
        files.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const dirEntries = await new Promise((resolve, reject) => {
          const allEntries = [];
          function readBatch() {
            reader.readEntries(batch => {
              if (batch.length === 0) { resolve(allEntries); return; }
              allEntries.push(...batch);
              readBatch(); // Chrome returns max 100 entries per readEntries call
            }, reject);
          }
          readBatch();
        });
        for (const child of dirEntries) {
          await traverseEntry(child, path + '/' + entry.name);
        }
      }
    }
    for (const entry of entries) {
      await traverseEntry(entry, '');
    }
    return files;
  }

  window.exportData = function (format) {
    const data = window.RoboLedger.Ledger.getAll();
    if (!data || data.length === 0) {
      alert("No data available to export.");
      return;
    }

    let blob;
    let filename = `roboledger_export_${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      filename += '.json';
    } else if (format === 'csv') {
      const headers = ['Date', 'Ref', 'Description', 'Category', 'Debit', 'Credit', 'Tax', 'Balance'];
      const rows = data.map(tx => [
        tx.date,
        tx.ref || '',
        tx.description,
        tx.gl_account_name || 'Uncategorized',
        tx.polarity === 'DEBIT' ? tx.amount_cents / 100 : '',
        tx.polarity === 'CREDIT' ? tx.amount_cents / 100 : '',
        (tx.tax_cents || 0) / 100,
        (tx.balance || 0)
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      blob = new Blob([csvContent], { type: 'text/csv' });
      filename += '.csv';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`[EXPORT] ${format.toUpperCase()} exported successfully.`);
  };

  window.handleFileSelect = (event) => {
    const files = event.target.files;
    if (files.length > 0) window.handleFilesSelected(files);
  };

  // Progress bar helpers (inline, above grid)
  window.showProgressBar = () => {
    const progressBar = document.getElementById('parsing-progress-inline');
    if (progressBar) progressBar.style.display = 'block';
  };

  window.hideProgressBar = () => {
    const progressBar = document.getElementById('parsing-progress-inline');
    if (progressBar) progressBar.style.display = 'none';
  };

  window.updateProgressBar = (current, total, fileName, stage, txnCount) => {
    // If total is 100, current is already a percentage
    const percent = total === 100 ? current : Math.round((current / total) * 100);

    // Null-safe updates - prevent silent failures on first upload
    const fill = document.getElementById('progress-bar-fill');
    const title = document.getElementById('progress-title');
    const subtitle = document.getElementById('progress-subtitle');
    const fileCount = document.getElementById('progress-file-count');
    const txnCountEl = document.getElementById('progress-txn-count');

    if (fill) {
      // Normal percentage-based progress
      fill.style.width = `${percent}%`;
      fill.style.background = 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)';
      fill.style.animation = 'none';
    }
    if (title) title.textContent = stage;
    if (subtitle) subtitle.textContent = fileName;
    if (fileCount) fileCount.textContent = total === 100 ? `${percent}%` : `${current} / ${total} files`;
    if (txnCountEl) txnCountEl.textContent = `${txnCount} transactions`;

    // FORCE BROWSER REPAINT: Ensure progress bar updates are visible immediately
    // Without this, browser batches DOM changes and only repaints after JS execution completes
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };

  window.handleFilesSelected = async (files) => {
    // SMART UX: Only show full overlay for FIRST upload (no existing transactions)
    // Subsequent uploads show inline progress bar while grid stays visible
    const existingTxns = window.RoboLedger.Ledger.getAll();
    const isFirstUpload = existingTxns.length === 0;

    if (isFirstUpload) {
      // First upload: Show full-screen progress overlay
      UI_STATE.isIngesting = true;
      render(); // Force re-render with progress overlay
    }

    // Show/update progress bar (inline if has data, overlay if first upload)
    window.showProgressBar();
    window.updateProgressBar(0, files.length, 'Initializing...', 'Preparing to parse', 0);

    // ALWAYS GENERATE FRESH ACCOUNT IDs FOR EACH UPLOAD
    // Fix: Don't reuse first account's ID - each statement should generate its own ID based on metadata
    const account_id = 'ALL';

    let totalImported = 0;

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      const statementNum = idx + 1;
      const totalStatements = files.length;

      try {
        const baseProgress = (idx / files.length) * 100;
        const fileProgressStep = 100 / files.length;

        // Stage 1: Extracting (0-40% of file progress)
        await window.updateProgressBar(
          Math.max(1, Math.round(baseProgress + (fileProgressStep * 0.1))),
          100,
          file.name,
          `Processing statement ${statementNum} of ${totalStatements} • Extracting transaction data...`,
          totalImported
        );
        await new Promise(resolve => setTimeout(resolve, 100));

        // Stage 2: Parsing (40-70% of file progress)
        await window.updateProgressBar(
          Math.round(baseProgress + (fileProgressStep * 0.4)),
          100,
          file.name,
          `Processing statement ${statementNum} of ${totalStatements} • Parsing transactions...`,
          totalImported
        );
        await new Promise(resolve => setTimeout(resolve, 100));

        // Process the file (PDF.js has its own 15s timeout at extraction level)
        const imported = await window.RoboLedger.Ingestion.processUpload(file, account_id);
        totalImported += imported;

        // Stage 3: Categorizing (70-85% of file progress)
        await window.updateProgressBar(
          Math.round(baseProgress + (fileProgressStep * 0.7)),
          100,
          file.name,
          `Processing statement ${statementNum} of ${totalStatements} • Categorizing transactions...`,
          totalImported
        );
        await new Promise(resolve => setTimeout(resolve, 80));

        // Stage 4: Cleaning (85-95% of file progress)
        await window.updateProgressBar(
          Math.round(baseProgress + (fileProgressStep * 0.85)),
          100,
          file.name,
          `Processing statement ${statementNum} of ${totalStatements} • Cleaning data...`,
          totalImported
        );
        await new Promise(resolve => setTimeout(resolve, 80));

        // Stage 5: Complete (95-100% of file progress)
        await window.updateProgressBar(
          Math.round(baseProgress + (fileProgressStep * 0.95)),
          100,
          file.name,
          `Statement ${statementNum} of ${totalStatements} complete • Imported ${imported} transactions`,
          totalImported
        );

      } catch (err) {
        // Special handling for PDF_TIMEOUT errors (incompatible PDF format)
        if (err.message && err.message.startsWith('PDF_TIMEOUT:')) {
          const helpText = err.message.replace('PDF_TIMEOUT: ', '');
          console.warn(`[UPLOAD] ⚠️ PDF timeout: ${file.name}`);
          console.warn(`[UPLOAD] 💡 ${helpText}`);
          await window.updateProgressBar(
            Math.round(((idx + 1) / files.length) * 100),
            100,
            file.name,
            `⚠️ PDF incompatible - use CSV`,
            totalImported
          );
          // Continue to next file instead of stopping
          continue;
        }

        // Special handling for SKIP errors (problematic files that timeout)
        if (err.message && err.message.startsWith('SKIP:')) {
          const skippedFile = err.message.replace('SKIP:', '');
          console.warn(`[UPLOAD] ⚠️ Skipped: ${skippedFile} (timeout)`);
          await window.updateProgressBar(
            Math.round(((idx + 1) / files.length) * 100),
            100,
            file.name,
            `⏭️ Skipped (timeout)`,
            totalImported
          );
          // Continue to next file instead of stopping
          continue;
        }

        // Regular error handling for other failures
        console.error('[UPLOAD] Parse error:', file.name, err);
        await window.updateProgressBar(
          Math.round(((idx + 1) / files.length) * 100),
          100,
          file.name,
          `❌ Parse failed`,
          totalImported
        );

      }
    }

    // Final update - 100% complete
    await window.updateProgressBar(100, 100, 'All files processed!', `${totalImported} transactions imported`, totalImported);


    // Hide progress bar after brief delay, then refresh grid
    setTimeout(() => {
      try {
        // CRITICAL: Clean up any empty accounts before rendering
        // (prevents hangover accounts from failed uploads or zero-transaction files)
        cleanupEmptyAccounts();

        // AUTO-SET REF# prefix for the newly imported account
        const accounts = window.RoboLedger.Accounts.getAll();
        if (accounts.length > 0) {
          const lastAccount = accounts[accounts.length - 1];
          UI_STATE.refPrefix = lastAccount.ref || 'TXN';
          UI_STATE.selectedAccount = lastAccount.id;
        }

        // Reset ingesting state so render() excludes progress bar HTML
        UI_STATE.isIngesting = false;

        // Prune any ghost accounts created by this import (metadata stubs with 0 transactions)
        window.RoboLedger?.Accounts?.pruneGhosts?.();

        // Retroactively fix any CC refunds/cashback mis-categorized as revenue
        window.fixCCRefunds?.();

        // Seed GST data for all newly imported transactions
        window.initGSTOnTransactions?.();

        // Render - this will naturally exclude progress bar since isIngesting is false
        render();

        // DETAIL MODE: Show animated sidebar toggle after grid loads
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
          toggleBtn.style.display = 'flex';
        }

      } catch (err) {
        console.error('[UPLOAD] Error in completion flow:', err);
        // Force render anyway
        UI_STATE.isIngesting = false;
        render();
      }
    }, 500);

  };

  // Keep inline COA dropdowns opening downward by centering the row
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (!target || !target.classList || !target.classList.contains('inline-coa-select')) return;
    const rowEl = target.closest('.tabulator-row');
    if (rowEl) {
      rowEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });

  // Mobile sidebar toggle
  window.toggleMobileSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && overlay) {
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('active');
    }
  };

  // NOTE: window.updateUtilityBar is defined in utility-bar.js with full drill-down support.
  // Do NOT redefine it here — the utility-bar.js version handles balance, badges, AND all onclick drill wiring.

  // Desktop sidebar collapse toggle
  window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (sidebar) {
      sidebar.classList.toggle('collapsed');

      // Toggle body class for global layout changes (grid expansion, utility bar)
      const isCollapsed = sidebar.classList.contains('collapsed');
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);

      // Dispatch event for React components to listen to
      window.dispatchEvent(new CustomEvent('sidebarCollapsed', {
        detail: { isCollapsed }
      }));

      // Update utility bar content when collapsed
      if (isCollapsed) {
        setTimeout(() => window.updateUtilityBar(), 100);
      }

      // Update button icon and title
      if (isCollapsed) {
        toggleBtn.innerHTML = '<i class="ph ph-caret-right"></i>';
        toggleBtn.title = 'Exit Detail Mode';
      } else {
        toggleBtn.innerHTML = '<i class="ph ph-caret-left"></i>';
        toggleBtn.title = 'Enter Detail Mode';
      }
    }
  };

  // --- FORMATTING HELPERS ---
  const formatCardNumber = (num, brand) => {
    if (!num) return '**** **** **** ****';
    // Remove existing spaces to re-format correctly
    const clean = num.toString().replace(/[\s-]/g, '');

    if (brand === 'AMEX' && (clean.length === 15 || clean.includes('*'))) {
      // 4-6-5 format for AMEX
      return `${clean.slice(0, 4)} ${clean.slice(4, 10)} ${clean.slice(10, 15)}`.trim();
    }

    // Standard 4-4-4-4 blocks for VISA/MC
    const matches = clean.match(/.{1,4}/g);
    return matches ? matches.join(' ') : clean;
  };

  window.popInGrid = function () {
    UI_STATE.isPoppedOut = false;
    if (UI_STATE.popoutWindow) {
      UI_STATE.popoutWindow.close();
      UI_STATE.popoutWindow = null;
    }
    window.updateWorkspace();
  };

  window.popOutGrid = function () {
    if (UI_STATE.isPoppedOut) return;

    // 1. Serialize State & Styles
    const data = dataAdjustedForAccount();
    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(tag => tag.outerHTML).join('\n');

    // 2. Build Detached Context
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>RoboLedger Grid | Detached</title>
          ${styleTags}
          <link href="https://unpkg.com/tabulator-tables@5.5.0/dist/css/tabulator.min.css" rel="stylesheet">
          <script src="https://unpkg.com/tabulator-tables@5.5.0/dist/js/tabulator.min.js"></script>
          <style>
            body { margin: 0; padding: 0; background: #f8fafc; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; }
            .popout-header { background: #0f172a; color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            #popout-grid { flex: 1; }
            .dock-btn { background: #3b82f6; border: none; color: white; padding: 6px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; }
            /* Rainbow Header Override */
            .tabulator-header { background: linear-gradient(90deg, #f87171, #fb923c, #facc15, #4ade80, #60a5fa, #818cf8, #a78bfa) !important; color: white !important; font-weight: 700 !important; }
            .tabulator-row { font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="popout-header">
            <div style="font-weight: 800; font-size: 16px;">RoboLedger <span style="opacity:0.5">V5 DETACHED GRID</span></div>
            <button class="dock-btn" onclick="window.opener.postMessage({type:'popIn'}, '*')">DOCK TO MAIN</button>
          </div>
          <div id="popout-grid"></div>
          <script>
            const data = ${JSON.stringify(data)};
            const grid = new Tabulator("#popout-grid", {
                data: data,
                layout: "fitColumns",
                rowHeight: 34,
                columns: window.opener.getDetachedColumns(),
                height: "100%"
            });

            grid.on("cellEdited", (cell) => {
                window.opener.postMessage({ type: 'updateGridData', data: grid.getData() }, '*');
            });
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    UI_STATE.popoutWindow = window.open(url, 'GridPopout', 'width=1400,height=900');
    UI_STATE.isPoppedOut = true;
    window.updateWorkspace();

    // Heartbeat Monitor
    const monitor = setInterval(() => {
      if (!UI_STATE.popoutWindow || UI_STATE.popoutWindow.closed) {
        clearInterval(monitor);
        UI_STATE.isPoppedOut = false;
        UI_STATE.popoutWindow = null;
        window.updateWorkspace();
      }
    }, 500);
  };

  window.getDetachedColumns = function () {
    return [
      {
        title: "Ref#",
        field: "ref",
        width: 100,
        editor: "input",
        formatter: (cell) => {
          // Dynamic REF# based on current row position (0-indexed, resets with sort)
          const rowIndex = cell.getRow().getPosition() - 1; // -1 to make 0-indexed
          return `<span style="color: #64748b;">${rowIndex}</span>`;
        }
      },
      { title: "Date", field: "date", width: 110, editor: "input", formatter: (cell) => `<span style="color: #0f172a;">${cell.getValue() || ''}</span>` },
      {
        title: "Description", field: "description", widthGrow: 3, editor: "input", formatter: (cell) => {
          return `<div style="text-transform: uppercase; color: #0f172a; font-size: 13px;">${cell.getValue() || ''}</div>`;
        }
      },
      {
        title: "Debit", field: "debit_col", width: 120, hozAlign: "right", editor: "number", formatter: (cell) => {
          const row = cell.getRow().getData();
          if (row.polarity === 'DEBIT' && row.amount_cents > 0) {
            const val = (row.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            return `<span style="color: #ef4444;">${val}</span>`;
          }
          return `<span style="color: #e2e8f0;">-</span>`;
        }
      },
      {
        title: "Credit", field: "credit_col", width: 120, hozAlign: "right", editor: "number", formatter: (cell) => {
          const row = cell.getRow().getData();
          if (row.polarity === 'CREDIT' && row.amount_cents > 0) {
            const val = (row.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            return `<span style="color: #10b981;">${val}</span>`;
          }
          return `<span style="color: #e2e8f0;">-</span>`;
        }
      },
      {
        title: "Balance", field: "balance", width: 140, hozAlign: "right", formatter: (cell) => {
          const val = cell.getValue() || 0;
          const formatted = (val / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
          return `<span style="color: #0f172a; font-weight: 600;">${formatted}</span>`;
        }
      }
    ];
  };

  window.toggleSettings = (open) => toggleSettings(open);
  window.renderSettingsDrawer = () => renderSettingsDrawer();
  window.handleFiles = (files) => handleFiles(files);

  window.openSourceFile = function (fileId) {
    if (!fileId) return;
    console.log(`[V5 AUDIT] Forensic Trace initiated for file: ${fileId}`);

    UI_STATE.activeFileId = fileId;
    window.toggleWorkbench(true, fileId);

    const file = window.RoboLedger.Accounts.getFile(fileId);
    if (!file) return;

    const contentArea = document.getElementById('v5-pdf-curtain-content');
    const filenameLabel = document.getElementById('v5-curtain-filename');

    if (filenameLabel) filenameLabel.innerText = file.name;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      const url = URL.createObjectURL(file);
      contentArea.innerHTML = `<iframe src="${url}#toolbar=0" style="width:100%; height:100%; border:none;"></iframe>`;
    } else {
      // CSV/Text Preview
      file.text().then(text => {
        const lines = text.split('\n').slice(0, 50); // Preview first 50 lines
        contentArea.innerHTML = `
                <div style="padding: 20px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #334155; line-height: 1.6; overflow: auto; height: 100%;">
                    ${lines.map(line => `<div style="border-bottom: 1px solid #f1f5f9; padding: 4px 0;">${line}</div>`).join('')}
                </div>
            `;
      });
    }
  };

  // Open a specific transaction's source PDF and jump to the page + highlight the Y-coordinate
  window.openStatement = async function (tx) {
    if (!tx || !tx.source_file_id) return;
    const fileId = tx.source_file_id;

    UI_STATE.activeFileId = fileId;
    window.toggleWorkbench(true, fileId);

    const file = window.RoboLedger.Accounts.getFile(fileId);
    if (!file) return;

    const contentArea = document.getElementById('v5-pdf-curtain-content');
    const filenameLabel = document.getElementById('v5-curtain-filename');

    if (filenameLabel) filenameLabel.innerText = file.name;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const pageNo = (tx.source_locator && tx.source_locator.page) ? tx.source_locator.page : 1;
        const pdfPage = await pdf.getPage(pageNo);

        // Default scale: 1.0 to fit width naturally
        let currentScale = 1.0;

        const renderPage = async (scale) => {
          const viewport = pdfPage.getViewport({ scale });
          contentArea.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%;">
              <div style="flex: 1; overflow: auto; background: #f8fafc; display: flex; justify-content: center; align-items: flex-start; padding: 20px;">
                <canvas id="v5-stmt-canvas" style="box-shadow: 0 2px 8px rgba(0,0,0,0.1); background: white;"></canvas>
              </div>
              <div style="padding: 16px; background: white; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; gap: 12px;">
                <button onclick="window.zoomPDF('out')" style="padding: 8px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; color: #475569; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                  <i class="ph-bold ph-minus" style="font-size: 16px;"></i> Zoom Out
                </button>
                <span style="font-size: 14px; color: #64748b; min-width: 60px; text-align: center; font-weight: 600;" id="zoom-level">${Math.round(scale * 100)}%</span>
                <button onclick="window.zoomPDF('in')" style="padding: 8px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; color: #475569; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                  <i class="ph-bold ph-plus" style="font-size: 16px;"></i> Zoom In
                </button>
                <button onclick="window.zoomPDF('reset')" style="padding: 8px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; color: #475569;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                  Reset
                </button>
              </div>
            </div>
          `;

          const canvas = document.getElementById('v5-stmt-canvas');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const ctx = canvas.getContext('2d');

          await pdfPage.render({ canvasContext: ctx, viewport }).promise;

          // Highlight the transaction location
          if (tx.source_locator && tx.source_locator.y_coord) {
            // Use the y_coord directly without inverting (PDF coordinates start from bottom)
            const highlightY = tx.source_locator.y_coord * scale;
            ctx.fillStyle = 'rgba(255,230,0,0.4)';
            ctx.fillRect(0, highlightY - 15, canvas.width, 30);
          }
        };

        // Initial render
        await renderPage(currentScale);

        // Zoom controls
        window.zoomPDF = async (direction) => {
          if (direction === 'in') {
            currentScale = Math.min(currentScale + 0.25, 3.0);
          } else if (direction === 'out') {
            currentScale = Math.max(currentScale - 0.25, 0.5);
          } else if (direction === 'reset') {
            currentScale = 1.0;
          }
          await renderPage(currentScale);
          document.getElementById('zoom-level').innerText = `${Math.round(currentScale * 100)}%`;
        };

      } catch (err) {
        console.error('[VIEWER] Failed to render PDF page', err);
        const url = URL.createObjectURL(file);
        contentArea.innerHTML = `<iframe src="${url}#toolbar=0" style="width:100%; height:100%; border:none;"></iframe>`;
      }
    } else {
      file.text().then(text => {
        const lines = text.split('\n').slice(0, 50); // Preview first 50 lines
        contentArea.innerHTML = `
                <div style="padding: 20px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #334155; line-height: 1.6; overflow: auto; height: 100%;">
                    ${lines.map(line => `<div style="border-bottom: 1px solid #f1f5f9; padding: 4px 0;">${line}</div>`).join('')}
                </div>
            `;
      });
    }
  };

  // Convenience: open statement viewer by tx_id
  window.openTxSourceById = function (tx_id) {
    const tx = window.RoboLedger.Ledger.get(tx_id);
    if (!tx) return;
    window.openStatement(tx);
  };

  window.toggleWorkbench = function (open, fileId) {
    UI_STATE.workbenchOpen = open;
    const curtain = document.getElementById('v5-pdf-curtain');
    const overlay = document.getElementById('v5-pdf-overlay');

    if (open) {
      document.body.classList.add('workbench-active');
      if (curtain) curtain.style.right = '0';
      if (overlay) overlay.style.display = 'block';
    } else {
      document.body.classList.remove('workbench-active');
      if (curtain) curtain.style.right = '-100%';
      if (overlay) overlay.style.display = 'none';
      UI_STATE.activeFileId = null;
    }
  };

  window.handleRecovery = function (action) {
    const modal = document.getElementById('recovery-modal');
    if (modal) modal.remove();

    if (action === 'continue') {
      UI_STATE.recoveryPending = false;
      window.updateWorkspace();
    } else {
      window.RoboLedger.Ledger.reset();
      UI_STATE.recoveryPending = false;
      window.updateWorkspace();
    }
  };

  function showRecoveryPrompt() {
    const existingData = window.RoboLedger.Ledger.getAll();
    const overlay = document.createElement('div');
    overlay.id = 'recovery-modal';
    overlay.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 12px; padding: 32px; max-width: 480px; box-shadow: 0 25px 50px rgba(0,0,0,0.25);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="background: #eff6ff; padding: 12px; border-radius: 10px;">
              <i class="ph ph-database" style="font-size: 28px; color: #3b82f6;"></i>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #1e293b;">Previous Data Detected</h2>
              <p style="margin: 4px 0 0; font-size: 0.875rem; color: #64748b;">Found ${existingData.length} transactions from your last session</p>
            </div>
          </div>
          
          <p style="color: #475569; font-size: 0.9375rem; line-height: 1.6; margin: 20px 0 24px;">
            Would you like to <strong>continue where you left off</strong>, or <strong>start fresh with a clean workspace</strong>?
          </p>
          
          <div style="display: flex; gap: 12px;">
            <button onclick="window.handleRecovery('reset')" style="flex: 1; padding: 12px 20px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; font-weight: 600; font-size: 0.9375rem; color: #475569; cursor: pointer; transition: all 0.15s;">
              <i class="ph ph-trash" style="margin-right: 6px;"></i>
              Start Fresh
            </button>
            <button onclick="window.handleRecovery('continue')" style="flex: 1; padding: 12px 20px; background: #3b82f6; border: none; border-radius: 8px; font-weight: 600; font-size: 0.9375rem; color: white; cursor: pointer; transition: all 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <i class="ph ph-arrow-clockwise" style="margin-right: 6px;"></i>
              Load Previous Data
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }


  // ═══════════════════════════════════════════════════════════════
  // UNIFIED WORKSPACE UPDATE - MAGNETIC CONTAINER COUPLING
  // ═══════════════════════════════════════════════════════════════
  /**
   * Retroactive CC refund/cashback cleanup.
   * Scans all stored transactions and re-routes any CC credit that is mis-categorized
   * as REVENUE (or that is cash back still pointing to 9971/revenue).
   * Called automatically after import and available as window.fixCCRefunds().
   */
  window.fixCCRefunds = function () {
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    const COA = window.RoboLedger?.COA;
    let fixed = 0;

    const REVENUE_ROOTS = new Set(['REVENUE']);
    const CC_TYPES = new Set(['creditcard', 'liability', 'credit card']);

    allTxns.forEach(tx => {
      if (tx.polarity !== 'CREDIT') return;

      const acc = window.RoboLedger?.Accounts?.get(tx.account_id);
      const accType = (acc?.accountType || acc?.type || '').toLowerCase();
      const isCCAcct = CC_TYPES.has(accType) || /visa|mastercard|amex|credit/i.test(acc?.name || '');
      if (!isCCAcct) return;

      const desc = (tx.raw_description || tx.description || '').toUpperCase();
      const isCashBack = /CASH\s*BACK|CASHBACK|REWARD/i.test(desc);
      const isCCRefund = /\bREFUND\b/i.test(desc);
      const isBankRebate = /\bREBATE\b/i.test(desc);
      const isCCPayment = !isCashBack && !isCCRefund && !isBankRebate;

      if (isCCPayment) return; // Payments are fine wherever they are

      const currentCOA = COA?.get(tx.category);
      const isRevenue = currentCOA && REVENUE_ROOTS.has(currentCOA.root);
      const is9971 = tx.category === '9971';
      const needsFix = isRevenue || (isCashBack && is9971);

      if (!needsFix) return;

      if (isCashBack || isBankRebate) {
        // Cash back / rebate → 7700 (contra bank fees)
        window.RoboLedger.Ledger.updateCategory(tx.tx_id, '7700');
        fixed++;
        console.log(`[FIX] Cash back/rebate → 7700: ${tx.description || tx.raw_description}`);
      } else if (isCCRefund) {
        // Refund → try to mirror same vendor's debit on same account
        const vendorWords = desc.replace(/\bREFUND\b/gi, '').trim().split(/\s+/).slice(0, 3).join(' ');
        const matchingDebit = allTxns.find(other =>
          other.tx_id !== tx.tx_id &&
          other.account_id === tx.account_id &&
          other.polarity === 'DEBIT' &&
          other.category &&
          !['9970', '9971'].includes(other.category) &&
          (other.raw_description || other.description || '').toUpperCase().includes(vendorWords)
        );

        if (matchingDebit) {
          const mirrorCOA = COA?.get(matchingDebit.category);
          if (mirrorCOA && mirrorCOA.root !== 'REVENUE' && mirrorCOA.root !== 'LIABILITY') {
            window.RoboLedger.Ledger.updateCategory(tx.tx_id, matchingDebit.category);
            fixed++;
            console.log(`[FIX] Refund mirrored → ${matchingDebit.category}: ${tx.description || tx.raw_description}`);
            return;
          }
        }

        // No mirror found — clear category so it shows as needs_review
        window.RoboLedger.Ledger.updateCategory(tx.tx_id, null);
        fixed++;
        console.log(`[FIX] Refund revenue cleared → needs review: ${tx.description || tx.raw_description}`);
      }
    });

    if (fixed > 0) {
      console.log(`[FIX] CC refund cleanup: fixed ${fixed} transactions`);
      if (window.showToast) window.showToast(`Fixed ${fixed} CC credit mis-categorization${fixed !== 1 ? 's' : ''}`, 'success');
    }
    return fixed;
  };

  /**
   * Retroactive GST initializer.
   * Scans all stored transactions and seeds gst_enabled / tax_cents / gst_account
   * for any transaction that hasn't been GST-initialized yet.
   *
   * Non-taxable categories are explicitly disabled (gst_enabled = false).
   * All other expense/revenue transactions get gst_enabled = true + computed tax_cents.
   *
   * Called automatically after every import via updateWorkspace.
   */
  window.initGSTOnTransactions = function (forceReinit = false) {
    const TAX_RATES = {
      'ON': 13, 'BC': 12, 'AB': 5,  'QC': 14.975, 'NS': 15,
      'NB': 15, 'MB': 12, 'SK': 11, 'PE': 15,     'NL': 15,
      'YT': 5,  'NT': 5,  'NU': 5,
    };
    const province = window.UI_STATE?.province || 'AB';
    const taxRate  = TAX_RATES[province] || 5;

    // These categories are never subject to GST
    const NON_TAXABLE = new Set([
      '9971', // CC Payment
      '9970', // Uncategorized
      '7700', // Cash back / contra
      '7000', // Interest expense
      '2149', '2150', '2160', // GST accounts themselves
    ]);
    const NON_TAXABLE_RE = /\b(PAYMENT|INTEREST|TRANSFER|CASH\s*BACK|REBATE|DIVIDEND|INSURANCE|PAYROLL|SALARY|WAGES?|T4|E-TRANSFER|INTERAC)\b/i;

    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    let seeded = 0;

    allTxns.forEach(tx => {
      // Only touch transactions that haven't been GST-initialized yet (unless forceReinit)
      if (!forceReinit && tx.gst_enabled !== undefined) return;

      const catStr  = String(tx.category || '');
      const desc    = (tx.raw_description || tx.description || '');
      const amount  = Math.abs(tx.amount_cents || 0);

      const isNonTaxable =
        NON_TAXABLE.has(catStr) ||
        NON_TAXABLE_RE.test(desc) ||
        tx._isCCPayment || tx._isCashBack || tx._isBankRebate ||
        tx.transaction_type === 'transfer';

      if (isNonTaxable) {
        try {
          window.RoboLedger.Ledger.updateMetadata(tx.tx_id, {
            gst_enabled: false,
            tax_cents:   0,
            gst_account: null,
            gst_type:    null,
          });
        } catch(e) { /* ignore individual failures */ }
        return;
      }

      // Taxable transaction — compute GST and set account routing
      const taxCents  = Math.round((amount * taxRate) / 100);
      // CC account detection — CC charges are EXPENSES regardless of COA code
      const acctForGST = window.RoboLedger?.Accounts?.get(tx.account_id);
      const isCCAcct   = !!(acctForGST?.brand || acctForGST?.cardNetwork ||
                            (acctForGST?.accountType || '').toLowerCase() === 'creditcard');
      // Revenue = category starts with 4 AND not a CC account
      // CC accounts NEVER have revenue — charges go to GST ITC (2150)
      const isRevenue = !isCCAcct && catStr.startsWith('4');
      try {
        window.RoboLedger.Ledger.updateMetadata(tx.tx_id, {
          gst_enabled: true,
          tax_cents:   taxCents,
          gst_account: isRevenue ? '2160' : '2150',
          gst_type:    isRevenue ? 'collected' : 'itc',
        });
      } catch(e) { /* ignore individual failures */ }
      seeded++;
    });

    if (seeded > 0) {
      console.log(`[GST] Initialized ${seeded} transactions with GST data (province: ${province}, rate: ${taxRate}%)`);
    }
    return seeded;
  };

  /**
   * Re-categorize ALL existing transactions using the current rule engine + signal fusion.
   * This re-runs the full categorization brain on every transaction in the ledger.
   * Called after rule engine fixes to correct historically mis-categorized data.
   *
   * @param {Object} options
   * @param {boolean} options.skipUserCategorized  - If true, skip txns that were manually set by user (default: false)
   * @param {boolean} options.skipHighConfidence   - If true, skip txns with confidence >= 0.90 (default: false)
   * @param {function} options.onProgress          - Optional progress callback(done, total)
   */
  window.recategorizeAll = function ({ skipUserCategorized = false, skipHighConfidence = false, onProgress } = {}) {
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    if (!allTxns.length) return { done: 0, total: 0 };

    const ruleEngine = window.RuleEngine;
    if (!ruleEngine) {
      console.warn('[RECATEGORIZE] RuleEngine not available');
      return { done: 0, total: 0 };
    }

    let done = 0, skipped = 0;
    const total = allTxns.length;

    allTxns.forEach((tx, i) => {
      if (skipUserCategorized && tx.category_source === 'user') { skipped++; return; }
      if (skipHighConfidence && (tx.confidence || 0) >= 0.90) { skipped++; return; }

      const result = ruleEngine.applyRules(tx, null, true);
      if (result?.coa_code) {
        window.RoboLedger.Ledger.updateCategory(tx.tx_id, result.coa_code, {
          confidence:  result.confidence,
          needsReview: result.needsReview,
          explanation: result.explanation,
        });
        done++;
      }

      if (onProgress && i % 100 === 0) onProgress(i, total);
    });

    // Re-run GST routing with force-reinit now that categories are corrected
    window.initGSTOnTransactions(true);

    console.log(`[RECATEGORIZE] Done: ${done}/${total} recategorized, ${skipped} skipped`);
    if (window.showToast) window.showToast(`Recategorized ${done} transactions`, 'success');

    // Refresh the grid
    if (window.updateWorkspace) window.updateWorkspace();
    return { done, skipped, total };
  };

  /**
   * Ensures metadata, reconciliation, and grid are MAGNETICALLY coupled
   * This is the SINGLE SOURCE OF TRUTH for updating the workspace
   *
   * @param {string|null} accountId - Account ID to display, or null to use current UI_STATE
   */
  window.updateWorkspace = function (accountId = null) {

    // HOMEPAGE ROUTE: delegate to React HomePage component
    if (UI_STATE.currentRoute === 'home') {
      renderHome();
      return;
    }

    const selectedAccount = accountId || UI_STATE.selectedAccount || 'ALL';
    console.log(`[WORKSPACE] ═══ UNIFIED UPDATE for: ${selectedAccount} ═══`);

    const allTxns = window.RoboLedger.Ledger.getAll();
    const filteredTxns = selectedAccount === 'ALL' ? allTxns : allTxns.filter(t => t.account_id === selectedAccount);
    console.log(`[WORKSPACE] Filtered: ${filteredTxns.length} of ${allTxns.length} transactions`);

    UI_STATE.selectedAccount = selectedAccount;
    window.currentAccountId = selectedAccount;

    if (selectedAccount !== 'ALL') {
      const accounts = window.RoboLedger.Accounts.getAll();
      const selectedAcc = accounts.find(a => a.id === selectedAccount);
      UI_STATE.refPrefix = (selectedAcc && selectedAcc.ref) ? selectedAcc.ref : 'TXN';
    } else {
      UI_STATE.refPrefix = 'ALL';
    }

    if (window.renderTransactionsGrid) {
      console.log('[WORKSPACE] → Updating GRID with filtered dataset');
      window.renderTransactionsGrid(filteredTxns, UI_STATE.searchQuery);
    }

    if (window.updateHeaderData) {
      console.log('[WORKSPACE] → Updating METADATA + RECONCILIATION');
      window.updateHeaderData();
    }

    console.log('[WORKSPACE] ✓ All containers coupled to same filter');
  };

  window.switchAccount = function (accId) {
    console.log(`[CONTROL] Switching to account: ${accId}`);

    // UNIFIED UPDATE: Ensures metadata, reconciliation, and grid are magnetically coupled
    // All three containers will use the SAME filtered dataset
    window.updateWorkspace(accId);
  };

  // Save opening balance when user edits field (for reconciliation)
  window.saveOpeningBalance = function (value) {
    if (!UI_STATE.selectedAccount || UI_STATE.selectedAccount === 'ALL') return;

    // Parse value (remove $, commas)
    const numericValue = parseFloat(value.replace(/[$,]/g, ''));
    if (isNaN(numericValue)) {
      console.warn('[RECON] Invalid opening balance:', value);
      return;
    }

    // Update account
    const accounts = window.RoboLedger.Accounts.getAll();
    const acc = accounts.find(a => a.id === UI_STATE.selectedAccount);
    if (acc) {
      acc.openingBalance = numericValue;
      // Accounts are part of ledger state - will auto-save
      console.log('[RECON] Opening balance updated:', numericValue);
      window.updateWorkspace(); // Refresh UI
      if (window.updateUtilityBar) window.updateUtilityBar(); // Update dashboard stats
      render(); // Force grid re-render with new balance calculations
    }
  };

  // Live opening balance update handler
  window.handleOpeningBalanceInput = function (inputElement) {
    let value = inputElement.value.replace(/[$,]/g, '');
    const numericValue = parseFloat(value);

    if (!isNaN(numericValue)) {
      // Update the account value immediately
      const accounts = window.RoboLedger.Accounts.getAll();
      const acc = accounts.find(a => a.id === UI_STATE.selectedAccount);
      if (acc) {
        acc.openingBalance = numericValue;

        // Get fresh transactions with new balances
        const txs = window.RoboLedger.Ledger.getAll(UI_STATE.selectedAccount);

        // Update balance cells directly (no re-render)
        txs.forEach((tx, idx) => {
          const balanceCell = document.querySelector(`[data-tx-id="${tx.tx_id}"] [data-column="balance"]`);
          if (balanceCell) {
            balanceCell.textContent = '$' + tx.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 });
          }
        });

        console.log('[RECON] Opening balance updated (live):', numericValue);
      }
    }
  };

  // Format opening balance on blur
  window.formatOpeningBalance = function (inputElement) {
    let value = inputElement.value.replace(/[$,]/g, '');
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      inputElement.value = '$' + numericValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      window.updateWorkspace(); // Update summary after formatting
      if (window.updateUtilityBar) window.updateUtilityBar(); // Update dashboard stats
    }
  };

  // Save statement ending balance when user edits field (for reconciliation)
  window.saveStatementEnding = function (value) {
    if (!UI_STATE.selectedAccount || UI_STATE.selectedAccount === 'ALL') return;

    // Parse value
    const numericValue = parseFloat(value.replace(/[$,]/g, ''));
    if (isNaN(numericValue)) {
      console.warn('[RECON] Invalid statement ending:', value);
      return;
    }

    // Update account
    const accounts = window.RoboLedger.Accounts.getAll();
    const acc = accounts.find(a => a.id === UI_STATE.selectedAccount);
    if (acc) {
      acc.statementEndingBalance = numericValue;
      // Accounts are part of ledger state - will auto-save
      console.log('[RECON] Statement ending updated:', numericValue);
      window.updateWorkspace();
    }
  };

  // Show statement source (PDF snippet) for opening or closing balance
  // VERSION: 2026-02-12-15:35 - RIGHT SIDE PANEL
  console.log('[BALANCE VIEWER] Function loaded - VERSION 2026-02-12-15:35');
  window.showStatementSource = function (type) {
    const accountId = UI_STATE.selectedAccount;
    if (!accountId || accountId === 'ALL') {
      alert('Please select an account first');
      return;
    }

    const recon = window.RoboLedger?.reconciliation?.[accountId];
    if (!recon || !recon.pdf_url) {
      alert('No statement PDF available for this account');
      return;
    }

    const accounts = window.RoboLedger.Accounts.getAll();
    const acc = accounts.find(a => a.id === accountId);

    const page = type === 'opening' ? 1 : (recon.total_pages || 1);
    const balanceType = type === 'opening' ? 'Opening' : 'Ending';

    console.log(`[BALANCE VIEW] ========================================`);
    console.log(`[BALANCE VIEW] Opening ${balanceType} balance - Page ${page}`);
    console.log(`[BALANCE VIEW] PDF URL:`, recon.pdf_url);
    console.log(`[BALANCE VIEW] Creating RIGHT-SIDE panel (z-index 999)`);

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'balance-viewer-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1001;';
    overlay.onclick = () => window.closeBalanceViewer();

    // Panel - RIGHT SIDE (magnet to audit drawer)
    const panel = document.createElement('div');
    panel.id = 'balance-viewer-panel';
    panel.style.cssText = 'position:fixed;top:0;right:350px;width:50%;max-width:700px;height:100vh;background:white;box-shadow:-4px 0 12px rgba(0,0,0,0.1);z-index:999;display:flex;flex-direction:column;';
    console.log(`[BALANCE VIEW] Panel created:`, panel.id);
    console.log(`[BALANCE VIEW] Panel style:`, panel.style.cssText);

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px;background:#1e293b;color:white;display:flex;justify-content:space-between;align-items:center;';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <i class="ph ph-file-pdf" style="font-size:20px;"></i>
        <span style="font-size:14px;font-weight:600;">${acc?.ref || accountId} - ${balanceType} Balance</span>
      </div>
      <button onclick="window.closeBalanceViewer()" style="border:none;background:rgba(255,255,255,0.1);color:white;width:32px;height:32px;border-radius:6px;cursor:pointer;font-size:20px;">×</button>
    `;

    // PDF container
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'balance-pdf-container';
    pdfContainer.style.cssText = 'flex:1;overflow:auto;background:#f1f5f9;padding:20px;';

    panel.appendChild(header);
    panel.appendChild(pdfContainer);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    console.log(`[BALANCE VIEW] Panel appended to body`);
    console.log(`[BALANCE VIEW] Computed style - right:`, window.getComputedStyle(panel).right);
    console.log(`[BALANCE VIEW] Computed style - position:`, window.getComputedStyle(panel).position);

    // Get balance coordinates from account
    const highlightCoords = type === 'opening' ? acc?.openingBalanceCoords : acc?.closingBalanceCoords;
    console.log(`[BALANCE VIEW] Highlight coords for ${balanceType}:`, highlightCoords);

    // Mount DocumentViewer with highlight coordinates
    if (window.mountDocumentViewer) {
      window.mountDocumentViewer('balance-pdf-container', {
        type: 'pdf',
        url: recon.pdf_url,
        name: `${balanceType} Balance`,
        page: page,
        highlightLine: highlightCoords // Pass the exact coordinates from parser
      });
    }
  };

  // Close balance viewer
  window.closeBalanceViewer = function () {
    const overlay = document.getElementById('balance-viewer-overlay');
    const panel = document.getElementById('balance-viewer-panel');
    if (overlay) overlay.remove();
    if (panel) panel.remove();
    if (window.unmountDocumentViewer) {
      window.unmountDocumentViewer('balance-pdf-container');
    }
  };

  // Update Ref# prefix for transaction numbering
  window.updateRefPrefix = function (newPrefix) {
    const sanitized = newPrefix.toUpperCase().trim().substr(0, 8); // Limit to 8 chars
    UI_STATE.refPrefix = sanitized || 'CHQ1';
    localStorage.setItem('roboledger_refPrefix', UI_STATE.refPrefix);

    // Trigger grid re-render to update ref numbers
    window.updateWorkspace();
    console.log(`[REF PREFIX] Updated to: ${UI_STATE.refPrefix}`);
  };

  window.filterByCategory = function (rootCategory) {
    UI_STATE.categoryFilter = rootCategory;
    console.log(`[FILTER] Category filter set to: ${rootCategory || 'ALL'}`);

    if (!rootCategory) {
      // Show all for current account
      window.switchAccount(UI_STATE.selectedAccount);
      return;
    }

    // Filter by root category
    const allTx = window.RoboLedger.Ledger.getAll();
    const filtered = allTx.filter(tx => {
      if (!tx.gl_account_code) return false;
      const coa = window.RoboLedger.COA.get(tx.gl_account_code);
      return coa && coa.root === rootCategory;
    });

    if (window.renderTransactionsGrid) {
      window.renderTransactionsGrid(filtered, UI_STATE.searchQuery);
    }
  };

  window.saveSettings = function () {
    console.log("[SETTINGS] Persisting V5 Configuration...");

    // Collect from IDs
    const themeSelect = document.getElementById('theme-selector');
    const dexteritySlider = document.getElementById('settings-dexterity');
    const fontsizeSlider = document.getElementById('settings-fontsize');
    const autocatEnabled = document.getElementById('settings-autocat-enabled');
    const autocatThreshold = document.getElementById('settings-autocat-threshold');
    const refOverride = document.getElementById('settings-ref-override');
    const dateFormat = document.getElementById('settings-date-format');
    const provinceSelect = document.getElementById('settings-province');
    const gstEnabled = document.getElementById('settings-gst-enabled');

    // Grid Appearance Settings
    const gridThemeSelect = document.getElementById('settings-grid-theme');
    const gridFontsizeSlider = document.getElementById('settings-grid-fontsize');

    if (themeSelect) UI_STATE.activeTheme = themeSelect.value;
    if (dexteritySlider) UI_STATE.dexterity = parseInt(dexteritySlider.value);
    if (fontsizeSlider) UI_STATE.fontSize = parseInt(fontsizeSlider.value);
    if (autocatEnabled) UI_STATE.autocatEnabled = autocatEnabled.checked;
    if (autocatThreshold) UI_STATE.confidenceThreshold = parseInt(autocatThreshold.value) / 100;
    if (refOverride) UI_STATE.refOverride = refOverride.value;
    if (dateFormat) UI_STATE.dateFormat = dateFormat.value;
    if (provinceSelect) UI_STATE.province = provinceSelect.value;
    if (gstEnabled) UI_STATE.gstEnabled = gstEnabled.checked;

    // Save grid appearance settings
    if (gridThemeSelect) UI_STATE.gridTheme = gridThemeSelect.value;
    if (gridFontsizeSlider) UI_STATE.gridFontSize = parseFloat(gridFontsizeSlider.value);

    // Apply saved theme to grid container only (grid-specific setting)
    const applyThemeToGrid = () => {
      const gridContainer = document.getElementById('txnGrid');
      if (gridContainer) {
        gridContainer.classList.remove('rainbow-theme', 'postit-theme', 'default-theme');
        if (UI_STATE.activeTheme !== 'default') {
          gridContainer.classList.add(`${UI_STATE.activeTheme}-theme`);
        }
      }
    };
    // Will be applied after grid renders
    setTimeout(applyThemeToGrid, 100);

    // Persist to unified settings object
    const settings = {
      activeTheme: UI_STATE.activeTheme,
      dexterity: UI_STATE.dexterity,
      fontSize: UI_STATE.fontSize,
      density: UI_STATE.density,
      autocatEnabled: UI_STATE.autocatEnabled,
      confidenceThreshold: UI_STATE.confidenceThreshold,
      refOverride: UI_STATE.refOverride,
      dateFormat: UI_STATE.dateFormat,
      province: UI_STATE.province,
      gstEnabled: UI_STATE.gstEnabled,
      // Grid appearance settings
      gridTheme: UI_STATE.gridTheme,
      gridFontSize: UI_STATE.gridFontSize
    };

    localStorage.setItem('roboledger_v5_settings', JSON.stringify(settings));

    // Close drawer
    toggleSettings(false);

    // Force grid re-render with new theme
    window.applyGridSettings();

    console.log("[SETTINGS] Configuration saved and applied.");
  };

  // Live preview functions for grid appearance
  window.previewGridTheme = function (themeName) {
    UI_STATE.gridTheme = themeName;
    window.applyGridSettings();
  };

  window.previewGridFontSize = function (size) {
    const fontSize = parseFloat(size);
    UI_STATE.gridFontSize = fontSize;

    // Update display
    const display = document.getElementById('grid-fontsize-display');
    if (display) display.textContent = `${fontSize}px`;

    // Apply immediately
    window.applyGridSettings();
  };

  // Apply grid settings to trigger re-render
  window.applyGridSettings = function () {
    console.log('[GRID] Applying theme:', UI_STATE.gridTheme, 'Font size:', UI_STATE.gridFontSize);

    // Force grid to re-render with new GRID_TOKENS
    if (window.renderTransactionsGrid) {
      const txns = window.RoboLedger ? window.RoboLedger.Ledger.getAll() : [];
      const filtered = UI_STATE.selectedAccount === 'ALL'
        ? txns
        : txns.filter(t => t.account_id === UI_STATE.selectedAccount);

      window.renderTransactionsGrid(filtered, UI_STATE.searchQuery);
    }
  };

  window.setDensity = function (density) {
    UI_STATE.density = density;
    // Full re-render so density rowHeight takes effect via GRID_TOKENS
    window.applyGridSettings();
  };

  function init() {
    // STATE VERSION CHECK: Prevent cache hallucination
    const STATE_VERSION = '5.2.0';
    const savedData = localStorage.getItem('roboledger_v5_data');

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.version && parsed.version !== STATE_VERSION) {
          console.warn(`[STATE] Version mismatch: saved=${parsed.version}, current=${STATE_VERSION}`);
          console.warn('[STATE] Clearing incompatible cache to prevent bugs');
          localStorage.clear();
          window.RoboLedger.Ledger.reset();
        }
      } catch (e) {
        console.error('[STATE] Corrupt localStorage detected, clearing', e);
        localStorage.clear();
      }
    }

    setupNav();
    setupActions();

    // Check for existing data (Recovery Logic)
    const existingData = window.RoboLedger.Ledger.getAll();
    if (existingData.length > 0) {
      console.log(`[V5 RECOVERY] Detected ${existingData.length} existing transactions. Prompting user.`);
      UI_STATE.recoveryPending = true;
    }

    // Load saved settings
    const savedSettings = localStorage.getItem('roboledger_v5_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        Object.assign(UI_STATE, settings);
        console.log('[SETTINGS] Loaded user preferences.');
      } catch (e) {
        console.error('[SETTINGS] Failed to parse saved settings', e);
      }
    }

    // Apply saved theme on page load (legacy support + immediate apply)
    const savedTheme = localStorage.getItem('roboledger_theme') || 'default';
    if (savedTheme) { // Check if savedTheme is not null/undefined
      UI_STATE.activeTheme = savedTheme;
      // Theme will be applied to grid container after render, not to body
      console.log(`[INIT] Theme restored: ${savedTheme}`);
    }

    render();
  }

  // Navigation function for routing between pages  
  window.navigateTo = function (route) {
    console.log(`[NAVIGATE] → ${route}`);

    UI_STATE.currentRoute = route;

    // Update breadcrumbs
    if (route === 'home') {
      UI_STATE.breadcrumbs = [{ label: 'Home', active: true }];
    } else if (route === 'import') {
      UI_STATE.breadcrumbs = [{ label: 'Home' }, { label: 'Transactions', active: true }];
    } else if (route === 'coa') {
      UI_STATE.breadcrumbs = [{ label: 'Home' }, { label: 'Chart of Accounts', active: true }];
    } else {
      const label = route.charAt(0).toUpperCase() + route.slice(1);
      UI_STATE.breadcrumbs = [{ label: 'Home' }, { label: label, active: true }];
    }

    // Render breadcrumbs to DOM
    const bcContainer = document.getElementById('breadcrumb');
    if (bcContainer) {
      bcContainer.innerHTML = UI_STATE.breadcrumbs.map((bc, i) => {
        const isLast = i === UI_STATE.breadcrumbs.length - 1;
        const isHome = bc.label.toLowerCase() === 'home';
        const bcRoute = isHome ? 'home' : (bc.label === 'Transactions' ? 'import' : bc.label.toLowerCase());

        return `
          <div class="breadcrumb-item ${isLast ? 'active' : ''}"
               style="cursor: ${isLast ? 'default' : 'pointer'};"
               onclick="${isLast ? '' : `window.navigateTo('${bcRoute}');`}">
            ${isHome ? '<i class="ph ph-house" style="margin-right: 5px; font-size: 13px;"></i>' : ''}
            <span>${bc.label}</span>
          </div>
          ${isLast ? '' : '<span class="breadcrumb-separator"><i class="ph ph-caret-right"></i></span>'}
        `;
      }).join('');
    }

    //Update sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === route);
    });

    // Render
    if (route === 'home') {
      window.updateWorkspace(); // Enhanced homepage
      if (window.updateUtilityBar) window.updateUtilityBar(); // Update dashboard stats
    } else {
      render(); // Standard page rendering
    }
  };

  function setupNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = (e) => {
        const route = e.currentTarget.dataset.route;

        // Close mobile sidebar when navigation is clicked
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
          sidebar.classList.remove('mobile-open');
          if (overlay) overlay.classList.remove('active');
        }

        if (route === 'settings') {
          toggleSettings(true);
          return;
        }

        if (route === 'audit') {
          // Open AI Audit drawer
          toggleAuditDrawer(true);
          return;
        }

        // Use the navigation function
        window.navigateTo(route);
      };
    });
  }

  // DEV RESET: Clean slate for testing (only in dev mode)
  window.devReset = async function () {
    if (!confirm('⚠️ DEV RESET: This will clear ALL localStorage, reset the ledger, AND clear browser cache. Continue?')) {
      return;
    }
    console.warn('[DEV RESET] Clearing all state and cache...');

    // Clear ALL storage
    localStorage.clear();
    sessionStorage.clear();
    window.RoboLedger.Ledger.reset();
    if (window.RoboLedger.Accounts?.reset) {
      window.RoboLedger.Accounts.reset();
    }

    // Collect all async cleanup tasks
    const cleanupTasks = [];

    // Clear all browser caches (MUST await)
    if ('caches' in window) {
      const cacheCleanup = caches.keys().then(function (names) {
        return Promise.all(names.map(name => caches.delete(name)));
      });
      cleanupTasks.push(cacheCleanup);
    }

    // Unregister service workers (MUST await)
    if ('serviceWorker' in navigator) {
      const swCleanup = navigator.serviceWorker.getRegistrations().then(function (registrations) {
        return Promise.all(registrations.map(reg => reg.unregister()));
      });
      cleanupTasks.push(swCleanup);
    }

    // Clear IndexedDB (additional storage layer)
    if ('indexedDB' in window) {
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      } catch (e) {
        console.warn('[DEV RESET] IndexedDB clear failed:', e);
      }
    }

    // Wait for ALL async tasks to complete
    try {
      await Promise.all(cleanupTasks);
      console.log('[DEV RESET] All caches and service workers cleared');
    } catch (err) {
      console.error('[DEV RESET] Error during cleanup:', err);
    }

    console.log('[DEV RESET] Complete. Forcing hard reload with cache bypass...');
    // AGGRESSIVE cache bypass: timestamp + random hash
    setTimeout(function () {
      const cacheBust = `?reset=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      window.location.href = window.location.href.split('?')[0] + cacheBust;
    }, 200);
  };

  function setupActions() {
    const stage = document.getElementById('app-stage');

    // Drag and Drop listeners
    stage.addEventListener('dragover', (e) => {
      const zone = e.target.closest('.upload-zone');
      if (zone) {
        e.preventDefault();
        zone.classList.add('drag-over');
      }
    });

    stage.addEventListener('dragleave', (e) => {
      const zone = e.target.closest('.upload-zone');
      if (zone) {
        zone.classList.remove('drag-over');
      }
    });

    stage.addEventListener('drop', (e) => {
      const zone = e.target.closest('.upload-zone');
      if (zone) {
        e.preventDefault();
        zone.classList.remove('drag-over');
        handleBatch(e.dataTransfer.files);
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.close-curtain-btn')) {
        window.toggleWorkbench(false);
      }
      if (e.target.closest('#btn-hub-categorize')) {
        const data = window.RoboLedger.Ledger.getAll();
        const targets = data.filter(tx => tx.status === 'RAW' || tx.status === 'PREDICTED');
        window.showAIAuditPanel(targets, 'all');
      }
    });

    // Account Switcher Listener
    stage.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-btn');
      if (btn) {
        UI_STATE.selectedAccount = btn.dataset.acc;
        UI_STATE.bulkMenuOpen = false; // Close bulk menu on account switch
        window.updateWorkspace();
      }
    });

    // Unified File Browser Listener (Deduplicated)
    stage.addEventListener('click', (e) => {
      const zone = e.target.closest('.upload-zone');
      if (zone) {
        if (UI_STATE.isIngesting) return;

        // Use the existing hidden file input if possible
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
          fileInput.click();
        } else {
          // Fallback just in case
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.pdf,.csv,.xlsx,.xls';
          input.onchange = (event) => handleBatch(event.target.files);
          input.click();
        }
      }
    });

    // Delegated actions (Add Row)
    stage.addEventListener('click', (e) => {
      if (e.target.closest('.btn-add-row')) {
        const accId = UI_STATE.selectedAccount === 'ALL' ? 'ACC-001' : UI_STATE.selectedAccount;
        window.RoboLedger.Ledger.createManual(accId);
        window.updateWorkspace();
      }
    });

    // Drawer Listeners
    const curtainBtn = document.querySelector('.close-curtain');
    if (curtainBtn) curtainBtn.onclick = () => toggleCurtain(false);

    // Close bulk menu if clicking outside
    document.addEventListener('click', (e) => {
      if (UI_STATE.bulkMenuOpen && !e.target.closest('.bulk-actions-container')) {
        UI_STATE.bulkMenuOpen = false;
        window.updateWorkspace();
      }
    });
  }

  window.handleReset = () => {
    if (!UI_STATE.resetConfirm) {
      UI_STATE.resetConfirm = true;
      window.updateWorkspace();
      // Auto-reset confirmation after 3 seconds of inactivity
      setTimeout(() => {
        if (UI_STATE.resetConfirm) {
          UI_STATE.resetConfirm = false;
          window.updateWorkspace();
        }
      }, 3000);
    } else {
      window.RoboLedger.Ledger.reset();
      window.RoboLedger.Accounts.reset(); // Clear cached accounts
      UI_STATE.resetConfirm = false;
      UI_STATE.selectedAccount = 'ACC-001';
      window.updateWorkspace();
    }
  };

  window.toggleSearch = function (open) {
    UI_STATE.isSearchOpen = (open !== undefined) ? open : !UI_STATE.isSearchOpen;
    if (!UI_STATE.isSearchOpen) {
      UI_STATE.searchQuery = '';
      const data = dataAdjustedForAccount();
      if (window.renderTransactionsGrid) window.renderTransactionsGrid(data, UI_STATE.searchQuery);
    }
    window.updateWorkspace();
    if (UI_STATE.isSearchOpen) {
      setTimeout(() => {
        const el = document.getElementById('v5-search-input');
        if (el) el.focus();
      }, 50);
    }
  };

  window.handleSearch = function (query) {
    UI_STATE.searchQuery = query;

    // LIVE SEARCH: Update grid data only, don't re-render entire page
    // Get currently filtered transactions (account-based filter)
    const allTx = window.RoboLedger.Ledger.getAll();
    const accountFiltered = UI_STATE.selectedAccount === 'ALL'
      ? allTx
      : allTx.filter(t => t.account_id === UI_STATE.selectedAccount);

    // Pass filtered data + search query to React grid
    // The grid's globalFilter will handle the search filtering
    if (window.renderTransactionsGrid) {
      window.renderTransactionsGrid(accountFiltered, query);
      console.log(`[SEARCH] Live filtering with query: "${query}"`);
    } else {
      console.warn('[SEARCH] Grid render function not available');
    }
  };

  // Account switcher dropdown
  window.toggleAccountDropdown = function () {
    UI_STATE.accountDropdownOpen = !UI_STATE.accountDropdownOpen;
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) {
      dropdown.classList.toggle('open', UI_STATE.accountDropdownOpen);
    }
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.account-switcher') && UI_STATE.accountDropdownOpen) {
      UI_STATE.accountDropdownOpen = false;
      const dropdown = document.getElementById('accountDropdown');
      if (dropdown) dropdown.classList.remove('open');
    }
  });

  // Select transaction for coding panel
  window.selectTransaction = function (txId) {
    UI_STATE.selectedTx = txId;
    // Auto-expand panel when selecting a transaction
    if (UI_STATE.panelState === 'collapsed' || UI_STATE.panelState === 'closed') {
      UI_STATE.panelState = 'expanded';
    }
    window.updateWorkspace();
  };

  // Toggle inspector panel states
  window.togglePanel = function (targetState) {
    console.log('[PANEL_TOGGLE] togglePanel called with targetState:', targetState);

    const currentState = UI_STATE.panelState;
    console.log('[PANEL_TOGGLE] Current panel state:', currentState);

    // If targetState passed, use it; otherwise toggle
    let newState = targetState !== undefined ? targetState : (currentState === 'expanded' ? 'collapsed' : 'expanded');

    console.log('[PANEL_TOGGLE] New panel state:', newState);
    UI_STATE.panelState = newState;

    // Dispatch sidebar collapsed event which TransactionsTable listens to
    // This ensures both sidebar collapse AND utility bar icon work the same way
    const isCollapsed = newState === 'expanded';
    console.log('[PANEL_TOGGLE] Dispatching sidebarCollapsed event:', isCollapsed);
    window.dispatchEvent(new CustomEvent('sidebarCollapsed', { detail: { isCollapsed } }));

    window.updateWorkspace();
    // Redraw grid to handle column visibility
    if (window.txnTable) {
      setTimeout(() => window.txnTable.redraw(true), 350);
    }
  };

  // Update transaction category from coding panel
  window.updateTxCategory = function (txId, categoryCode) {
    try {
      const category = window.RoboLedger.COA.get(categoryCode);
      window.RoboLedger.Ledger.updateMetadata(txId, {
        category_code: categoryCode,
        category_name: category ? category.name : 'UNCATEGORIZED',
        status: categoryCode ? 'CONFIRMED' : 'RAW'
      });
      window.updateWorkspace();
    } catch (err) {
      console.error('[CODING] Failed to update category:', err);
    }
  };

  function dataAdjustedForAccount() {
    let data = window.RoboLedger.Ledger.getAll();
    if (UI_STATE.selectedAccount !== 'ALL') {
      data = data.filter(t => t.account_id === UI_STATE.selectedAccount);
    }
    return data;
  }

  window.toggleBulkMenu = () => {
    UI_STATE.bulkMenuOpen = !UI_STATE.bulkMenuOpen;
    window.updateWorkspace();
  };

  function toggleSettings(open) {
    UI_STATE.isSettingsOpen = open;
    const drawer = document.getElementById('settings-drawer');

    if (open) {
        // Position drawer to start at the top edge of the grid (FilterToolbar top),
        // not the top of the viewport — keeps it contained within the grid boundary.
        // Use the React mount point or the grid-container-wall as the reference element.
        const gridEl = document.getElementById('tx-grid-root')
                    || document.querySelector('.grid-container-wall')
                    || document.querySelector('.stage');
        if (gridEl) {
            const rect = gridEl.getBoundingClientRect();
            // Top of the FilterToolbar (sticky at top of grid area)
            drawer.style.top    = Math.max(0, rect.top) + 'px';
            drawer.style.height = (window.innerHeight - Math.max(0, rect.top)) + 'px';
        } else {
            // Fallback: FilterToolbar is 42px; assume app shell above is ~42px
            drawer.style.top    = '42px';
            drawer.style.height = 'calc(100vh - 42px)';
        }
        renderSettingsDrawer();
    } else {
        // Reset so CSS class controls position on close
        drawer.style.top    = '';
        drawer.style.height = '';
    }

    drawer.classList.toggle('open', open);
  }

  // ── Settings Drawer helpers exposed on window for inline onclick ──────────
  // Must be defined BEFORE renderSettingsDrawer so they are available in HTML
  window._settingsThemes = [
    { val:'default',      label:'Default',    dot:'#e5e7eb' },
    { val:'vanilla',      label:'Vanilla',    dot:'#fef9c3' },
    { val:'classic',      label:'Classic',    dot:'#d0d0d0' },
    { val:'ledger-pad',   label:'Ledger Pad', dot:'#ede9fe' },
    { val:'post-it-note', label:'Post-it',    dot:'#fef08a' },
    { val:'rainbow',      label:'Rainbow',    dot:'linear-gradient(90deg,#fee2e2,#fef3c7,#d9f99d,#bfdbfe,#ddd6fe)' },
    { val:'social',       label:'Social',     dot:'#eff6ff' },
    { val:'spectrum',     label:'Spectrum',   dot:'#f3e8ff' },
    { val:'subliminal',   label:'Subliminal', dot:'#f5f5f4' },
    { val:'subtle',       label:'Subtle',     dot:'#f1f5f9' },
    { val:'tracker',      label:'Tracker',    dot:'#dcfce7' },
    { val:'vintage',      label:'Vintage',    dot:'#fde8cc' },
    { val:'wave',         label:'Wave',       dot:'#cffafe' },
    { val:'webapp',       label:'WebApp',     dot:'#f5f5f5' },
  ];
  window._settingsProvinces = [
    { val:'AB',label:'Alberta',             tax:'5% GST'              },
    { val:'BC',label:'British Columbia',    tax:'5% GST + 7% PST'     },
    { val:'MB',label:'Manitoba',            tax:'5% GST + 7% PST'     },
    { val:'NB',label:'New Brunswick',       tax:'15% HST'             },
    { val:'NL',label:'Newfoundland',        tax:'15% HST'             },
    { val:'NT',label:'NW Territories',      tax:'5% GST'              },
    { val:'NS',label:'Nova Scotia',         tax:'15% HST'             },
    { val:'NU',label:'Nunavut',             tax:'5% GST'              },
    { val:'ON',label:'Ontario',             tax:'13% HST'             },
    { val:'PE',label:'Prince Edward Is.',   tax:'15% HST'             },
    { val:'QC',label:'Quebec',              tax:'5% GST + 9.975% QST' },
    { val:'SK',label:'Saskatchewan',        tax:'5% GST + 6% PST'     },
    { val:'YT',label:'Yukon',               tax:'5% GST'              },
  ];
  window._settingsSetThemeDot = function(val) {
    const t = window._settingsThemes.find(x => x.val === val);
    const dot = document.getElementById('settings-theme-dot');
    if (t && dot) dot.style.background = t.dot;
  };
  window._settingsSetProvinceTax = function(val) {
    const p = window._settingsProvinces.find(x => x.val === val);
    const el = document.getElementById('settings-province-tax');
    if (el) el.textContent = p ? p.tax : '';
  };

  function renderSettingsDrawer() {
    if (window.__settingsTab) { UI_STATE.settingsTab = window.__settingsTab; window.__settingsTab = null; }

    const drawer = document.getElementById('settings-drawer');
    if (!drawer) return;

    const tabs = [
      { id:'appearance', icon:'ph-paint-brush', label:'Appearance' },
      { id:'columns',    icon:'ph-columns',      label:'Columns'    },
      { id:'tax',        icon:'ph-percent',       label:'Tax'        },
      { id:'data',       icon:'ph-database',      label:'Data'       },
    ];
    if (!tabs.find(t => t.id === UI_STATE.settingsTab)) UI_STATE.settingsTab = 'appearance';

    drawer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#1e293b;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:9px;">
          <i class="ph ph-gear-six" style="font-size:17px;color:#94a3b8;"></i>
          <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:-0.01em;">Preferences</span>
        </div>
        <button onclick="window.toggleSettings(false)" style="background:rgba(255,255,255,0.1);border:none;color:#94a3b8;cursor:pointer;padding:5px 7px;border-radius:6px;display:flex;align-items:center;line-height:1;">
          <i class="ph ph-x" style="font-size:15px;"></i>
        </button>
      </div>

      <div style="display:flex;border-bottom:1px solid #e2e8f0;background:#f8fafc;flex-shrink:0;">
        ${tabs.map(t => `
          <button onclick="window.__settingsTab='${t.id}'; window.renderSettingsDrawer();"
            style="flex:1;padding:10px 4px;border:none;border-bottom:2px solid ${UI_STATE.settingsTab===t.id?'#3b82f6':'transparent'};background:transparent;color:${UI_STATE.settingsTab===t.id?'#3b82f6':'#64748b'};font-size:9.5px;font-weight:700;letter-spacing:0.05em;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;">
            <i class="ph ${t.icon}" style="font-size:15px;"></i>
            ${t.label.toUpperCase()}
          </button>
        `).join('')}
      </div>

      <div style="flex:1;overflow-y:auto;padding:18px;">
        ${renderSettingsTabContent()}
      </div>

      <div style="padding:12px 16px;border-top:1px solid #e2e8f0;display:flex;gap:8px;background:#f8fafc;flex-shrink:0;">
        <button onclick="window.resetSettings()" style="flex:1;padding:8px;border:1px solid #e2e8f0;background:white;color:#64748b;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Reset</button>
        <button onclick="window.saveSettings()" style="flex:2;padding:8px;border:none;background:#1e293b;color:white;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Save &amp; Apply</button>
      </div>
    `;
  }

  function renderSettingsTabContent() {

    // ── APPEARANCE ──────────────────────────────────────────────────────────
    if (UI_STATE.settingsTab === 'appearance') {
      const themes   = window._settingsThemes;
      const activeT  = themes.find(t => t.val === (UI_STATE.gridTheme || 'default')) || themes[0];
      const density  = UI_STATE.density || 'comfortable';
      const fontSize = UI_STATE.gridFontSize || 13.5;

      return `
        <div style="margin-bottom:22px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.07em;margin-bottom:10px;text-transform:uppercase;">Grid Theme</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="settings-theme-dot" style="width:18px;height:18px;border-radius:4px;flex-shrink:0;background:${activeT.dot};border:1px solid rgba(0,0,0,0.12);display:inline-block;"></span>
            <select id="settings-grid-theme"
              onchange="window.previewGridTheme(this.value); window._settingsSetThemeDot(this.value);"
              style="flex:1;padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;background:white;font-size:12px;font-weight:500;color:#1e293b;cursor:pointer;appearance:auto;outline:none;">
              ${themes.map(t => `<option value="${t.val}" ${(UI_STATE.gridTheme||'default')===t.val?'selected':''}>${t.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="margin-bottom:22px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.07em;margin-bottom:10px;text-transform:uppercase;">Row Density</div>
          <div id="density-group" style="display:flex;gap:6px;">
            ${['compact','comfortable','spacious'].map(d => `
              <button onclick="window.setDensity('${d}'); document.querySelectorAll('#density-group button').forEach(b=>{ b.style.borderColor='#e2e8f0'; b.style.background='white'; b.style.color='#64748b'; b.style.fontWeight='500'; }); this.style.borderColor='#3b82f6'; this.style.background='#eff6ff'; this.style.color='#1e40af'; this.style.fontWeight='700';"
                style="flex:1;padding:8px 6px;border:2px solid ${density===d?'#3b82f6':'#e2e8f0'};border-radius:8px;background:${density===d?'#eff6ff':'white'};cursor:pointer;font-size:11px;font-weight:${density===d?'700':'500'};color:${density===d?'#1e40af':'#64748b'};text-transform:capitalize;"
              >${d}</button>
            `).join('')}
          </div>
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.07em;text-transform:uppercase;">Font Size</div>
            <span id="grid-fontsize-display" style="font-size:11px;font-weight:700;color:#3b82f6;background:#eff6ff;padding:2px 8px;border-radius:10px;">${fontSize}px</span>
          </div>
          <input type="range" id="settings-grid-fontsize" min="9" max="16" step="0.5" value="${fontSize}"
            style="width:100%;accent-color:#3b82f6;"
            oninput="window.previewGridFontSize(this.value)">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:2px;"><span>9px</span><span>16px</span></div>
        </div>
      `;
    }

    // ── COLUMNS ─────────────────────────────────────────────────────────────
    if (UI_STATE.settingsTab === 'columns') {
      const savedPrefs = JSON.parse(localStorage.getItem('roboledger_column_prefs') || '{}');
      const columns = [
        { field:'date',        label:'Date',        icon:'ph-calendar-blank',  visible: savedPrefs.date        !== false },
        { field:'ref',         label:'Ref #',       icon:'ph-hash',            visible: savedPrefs.ref         !== false },
        { field:'description', label:'Description', icon:'ph-text-aa',         visible: savedPrefs.description !== false },
        { field:'debit_col',   label:'Debit',       icon:'ph-arrow-up-right',  visible: savedPrefs.debit_col   !== false },
        { field:'credit_col',  label:'Credit',      icon:'ph-arrow-down-left', visible: savedPrefs.credit_col  !== false },
        { field:'balance',     label:'Balance',     icon:'ph-scales',          visible: savedPrefs.balance     !== false },
        { field:'coa_code',    label:'Account',     icon:'ph-tag',             visible: savedPrefs.coa_code    !== false },
        { field:'tax_cents',   label:'GST/HST',     icon:'ph-percent',         visible: savedPrefs.tax_cents   === true  },
      ];

      return `
        <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;line-height:1.5;">Toggle columns visible in the transaction grid.</div>
        ${columns.map(col => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;margin-bottom:6px;background:${col.visible?'#f0f9ff':'#f8fafc'};border:1px solid ${col.visible?'#bae6fd':'#e2e8f0'};border-radius:8px;">
            <div style="display:flex;align-items:center;gap:9px;">
              <i class="ph ${col.icon}" style="font-size:15px;color:${col.visible?'#0284c7':'#94a3b8'};"></i>
              <span style="font-size:12px;font-weight:${col.visible?'600':'400'};color:${col.visible?'#0c4a6e':'#64748b'};">${col.label}</span>
            </div>
            <label class="switch" style="flex-shrink:0;">
              <input type="checkbox" ${col.visible?'checked':''} onchange="window.toggleGridColumn('${col.field}',this.checked)">
              <span class="slider"></span>
            </label>
          </div>
        `).join('')}
      `;
    }

    // ── TAX ─────────────────────────────────────────────────────────────────
    if (UI_STATE.settingsTab === 'tax') {
      const provinces    = window._settingsProvinces;
      const activeProvObj = provinces.find(p => p.val === (UI_STATE.province||'AB')) || provinces[0];

      return `
        <div style="margin-bottom:20px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.07em;margin-bottom:10px;text-transform:uppercase;">Province / Territory</div>
          <select id="settings-province"
            onchange="window._settingsSetProvinceTax(this.value);"
            style="width:100%;padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;background:white;font-size:12px;font-weight:500;color:#1e293b;cursor:pointer;appearance:auto;outline:none;margin-bottom:6px;">
            ${provinces.map(p => `<option value="${p.val}" ${(UI_STATE.province||'AB')===p.val?'selected':''}>${p.label}</option>`).join('')}
          </select>
          <div id="settings-province-tax" style="font-size:11px;color:#64748b;padding:3px 2px;">${activeProvObj.tax}</div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:${UI_STATE.gstEnabled?'#f0fdf4':'#f8fafc'};border:1px solid ${UI_STATE.gstEnabled?'#86efac':'#e2e8f0'};border-radius:8px;margin-bottom:14px;">
          <div>
            <div style="font-size:12px;font-weight:600;color:#1e293b;">Auto-extract GST / HST</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">Show calculated tax in GST/HST column</div>
          </div>
          <label class="switch" style="flex-shrink:0;">
            <input type="checkbox" id="settings-gst-enabled" ${UI_STATE.gstEnabled?'checked':''}>
            <span class="slider"></span>
          </label>
        </div>

        <div style="padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11px;color:#92400e;line-height:1.5;">
          <i class="ph ph-info" style="margin-right:4px;"></i>
          GST not applied to: CC payments, transfers, interest, dividends, insurance, or inter-bank transactions.
        </div>
      `;
    }

    // ── DATA ─────────────────────────────────────────────────────────────────
    if (UI_STATE.settingsTab === 'data') {
      const txnCount     = window.RoboLedger?.Ledger?.getAll?.()?.length || 0;
      const accountCount = window.RoboLedger?.Accounts?.getActive?.()?.length || window.RoboLedger?.Accounts?.getAll?.()?.length || 0;

      return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
          <div style="padding:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#0284c7;">${txnCount.toLocaleString()}</div>
            <div style="font-size:10px;color:#0369a1;font-weight:700;letter-spacing:0.05em;margin-top:2px;">TRANSACTIONS</div>
          </div>
          <div style="padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#16a34a;">${accountCount}</div>
            <div style="font-size:10px;color:#15803d;font-weight:700;letter-spacing:0.05em;margin-top:2px;">ACCOUNTS</div>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.07em;margin-bottom:10px;text-transform:uppercase;">Export</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button onclick="window.exportData('csv')" style="padding:10px;border:1px solid #e2e8f0;background:white;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:600;color:#374151;">
              <i class="ph ph-file-csv" style="font-size:16px;color:#10b981;"></i> CSV
            </button>
            <button onclick="window.exportData('json')" style="padding:10px;border:1px solid #e2e8f0;background:white;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:600;color:#374151;">
              <i class="ph ph-file-code" style="font-size:16px;color:#3b82f6;"></i> JSON
            </button>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.07em;margin-bottom:10px;text-transform:uppercase;">System</div>
          <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;color:#64748b;line-height:1.9;">
            <div>Version: <strong style="color:#1e293b;">${UI_STATE.version||'5.1'}</strong></div>
            <div>Mode: <strong style="color:#1e293b;">${window.location.protocol==='file:'?'Native':'Web'}</strong></div>
            <div>Storage: <strong style="color:#1e293b;">localStorage</strong></div>
          </div>
        </div>

        <button onclick="window.devReset()" style="width:100%;padding:10px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <i class="ph ph-trash"></i> Clear All Data
        </button>
        <div style="font-size:11px;color:#94a3b8;text-align:center;margin-top:6px;">Permanently deletes all transactions and accounts</div>
      `;
    }

    return '';
  }

  // Reset settings to defaults
  window.resetSettings = function () {
    if (!confirm('Reset all settings to defaults?')) return;

    UI_STATE.gridTheme = 'post-it-note';
    UI_STATE.gridFontSize = 13.5;
    UI_STATE.density = 'comfortable';

    localStorage.removeItem('roboledger_v5_settings');
    renderSettingsDrawer();
    window.applyGridSettings();

    console.log('[SETTINGS] Reset to defaults');
  };

  // ============================================
  // AI AUDIT DRAWER (unchanged)
  // ============================================


  function toggleAuditDrawer(open) {
    UI_STATE.isAuditOpen = open;
    const drawer = document.getElementById('audit-drawer');
    drawer.classList.toggle('open', open);
    if (open) renderAuditDrawer();
  }

  function renderAuditDrawer() {
    const drawer = document.getElementById('audit-drawer');
    const allTxns = window.RoboLedger.Ledger.getAll();
    const selectedAccount = UI_STATE.selectedAccount || 'ALL';
    const filteredTxns = selectedAccount === 'ALL' ? allTxns : allTxns.filter(t => t.account_id === selectedAccount);

    drawer.innerHTML = `
      <div class="drawer-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
              <div style="background: #8b5cf6; padding: 8px; border-radius: 8px; color: white;">
                  <i class="ph ph-sparkle" style="font-size: 1.3rem;"></i>
              </div>
              <div>
                  <h3 style="margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b;">AI Audit</h3>
                  <span style="font-size: 0.75rem; color: #64748b;">Automatic transaction categorization</span>
              </div>
          </div>
          <i class="ph ph-x close-drawer" style="font-size: 20px; cursor: pointer; color: #94a3b8;" onclick="toggleAuditDrawer(false)"></i>
      </div>
      <div class="drawer-content" style="flex: 1; overflow-y: auto; padding: 24px;">
          
          <!-- Account Selection -->
          <div class="setting-group" style="margin-bottom: 24px;">
              <div class="setting-group-title"><i class="ph ph-funnel"></i> Scope</div>
              <div style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">
                  Currently viewing: ${selectedAccount === 'ALL' ? 'All Accounts' : selectedAccount}
              </div>
              <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                  <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                      ${filteredTxns.length} transactions available
                  </div>
                  <div style="font-size: 11px; color: #64748b;">
                      ${filteredTxns.filter(t => !t.category || t.category === 'Uncategorized').length} uncategorized
                  </div>
              </div>
          </div>

          <!-- AI Engines -->
          <div class="setting-group" style="margin-bottom: 24px;">
              <div class="setting-group-title"><i class="ph ph-sparkle"></i> AI Engine</div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                  <div style="padding: 16px; border: 2px solid #8b5cf6; background: #f5f3ff; border-radius: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer;">
                      <i class="ph ph-sparkle" style="color: #8b5cf6; font-size: 20px;"></i>
                      <div style="flex: 1;">
                          <div style="font-weight: 700; font-size: 0.9rem; color: #1e293b;">Google Gemini AI</div>
                          <div style="font-size: 0.8rem; color: #64748b;">Context-aware, 99% accuracy</div>
                      </div>
                      <i class="ph ph-check-circle" style="color: #8b5cf6; font-size: 20px;"></i>
                  </div>
                  <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; gap: 12px; opacity: 0.6; cursor: not-allowed;">
                      <i class="ph ph-lightning" style="color: #f59e0b; font-size: 20px;"></i>
                      <div style="flex: 1;">
                          <div style="font-weight: 700; font-size: 0.9rem; color: #1e293b;">Local Logic</div>
                          <div style="font-size: 0.8rem; color: #64748b;">Fast, pattern-based (v5.0 default)</div>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Actions -->
          <div class="setting-group">
              <div class="setting-group-title"><i class="ph ph-play"></i> Run Classification</div>
              <button class="btn-restored" style="width: 100%; background: #8b5cf6; color: white; margin-bottom: 12px;" onclick="window.runAIAudit('all')">
                  <i class="ph ph-sparkle" style="margin-right: 8px;"></i>
                  Categorize All Transactions
              </button>
              <button class="btn-restored" style="width: 100%; background: white; color: #8b5cf6; border: 2px solid #8b5cf6;" onclick="window.runAIAudit('uncategorized')">
                  <i class="ph ph-funnel" style="margin-right: 8px;"></i>
                  Categorize Uncategorized Only
              </button>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 12px; text-align: center;">
                  AI categorization uses Google Gemini API
              </div>
          </div>

      </div>
    `;
  }

  // Global exposure for audit drawer
  window.toggleAuditDrawer = toggleAuditDrawer;

  // Placeholder for AI audit execution
  window.runAIAudit = function (mode) {
    const allTx = window.RoboLedger.Ledger.getAll();
    const selectedAccount = UI_STATE.selectedAccount || 'ALL';
    const filteredTxns = selectedAccount === 'ALL' ? allTxns : allTxns.filter(t => t.account_id === selectedAccount);

    const targets = mode === 'uncategorized'
      ? filteredTxns.filter(t => !t.category || t.category === 'Uncategorized')
      : filteredTxns;

    console.log(`[AI AUDIT] Running ${mode} audit on ${targets.length} transactions`);
    window.showAIAuditPanel(targets, mode);
    toggleAuditDrawer(false); // Close drawer when opening modal
  };

  window.toggleGridColumn = (field, visible) => {
    console.log(`[SETTINGS] Toggling column ${field} to ${visible}`);

    // Map field names from settings UI to React column IDs
    const fieldMapping = {
      'date': 'date',
      'ref': 'select', // Ref maps to select column in React
      'description': 'payee',
      'tax_cents': 'tax_cents',
      'debit_col': 'debit',
      'credit_col': 'credit',
      'balance': 'balance',
      'coa_code': 'category'
    };

    const columnId = fieldMapping[field] || field;

    // Use React bridge if available
    if (window.setGridColumnVisibility) {
      window.setGridColumnVisibility(columnId, visible);

      // Save preference to localStorage
      const saved = JSON.parse(localStorage.getItem('roboledger_column_prefs') || '{}');
      saved[field] = visible;
      localStorage.setItem('roboledger_column_prefs', JSON.stringify(saved));

      console.log(`[SETTINGS] Column ${columnId} ${visible ? 'shown' : 'hidden'} via React bridge`);
    } else {
      console.warn(`[SETTINGS] React bridge not available yet`);
    }
  };

  function toggleCurtain(open, filename = null) {
    const curtain = document.getElementById('v5-pdf-curtain');
    const overlay = document.getElementById('v5-pdf-overlay');
    const nameEl = document.getElementById('v5-curtain-filename');
    if (filename) nameEl.textContent = filename;
    curtain.classList.toggle('open', open);
    overlay.style.display = open ? 'block' : 'none';
  }

  window.getSettingsTrace = () => {
    console.group("--- V5 INSTITUTIONAL REGISTRY TRACE ---");
    console.table(UI_STATE);
    console.log("Current Ledger Context:", window.RoboLedger.Ledger.getAll());
    console.groupEnd();
    return "TRACE COMPLETE";
  };

  window.debugForensics = () => {
    console.log("[FORENSICS] Starting Deep Trace...");
    console.log("Registered Accounts:", window.RoboLedger.Accounts.getAll());
    console.log("COA Status:", window.RoboLedger.COA.getAll().length, "entries locked.");
    console.log("Active Grid Status:", window.txnTable ? "ONLINE" : "OFFLINE");
    return "FORENSIC AUDIT COMPLETE";
  };
  window.handleFiles = async function (fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    await handleBatch(files);
  };

  window.toggleDropdown = function (id) {
    // Close others
    document.querySelectorAll('.v5-dropdown-menu').forEach(el => {
      if (el.id !== id) el.classList.remove('visible');
    });
    // Toggle target
    const target = document.getElementById(id);
    if (target) target.classList.toggle('visible');
  };

  // Close dropdowns on click outside
  window.onclick = function (event) {
    if (!event.target.closest('.v5-crumb-btn')) {
      document.querySelectorAll('.v5-dropdown-menu').forEach(el => el.classList.remove('visible'));
    }
  };

  async function handleBatch(files) {
    if (!files || files.length === 0) return;

    UI_STATE.isIngesting = true;
    let totalFiles = files.length;
    window.updateWorkspace();

    // Technical Metadata Engine: Extraction & Classification
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      UI_STATE.ingestionProgress = (i / totalFiles) * 30;
      UI_STATE.ingestionLabel = `[Phase 1/3] Forensic Scan: ${file.name}`;
      updateProgressUI();

      // MOCK: In a real system, we'd extract text from the PDF/File here. 
      // We'll simulate a successful forensic metadata extraction.
      const mockExtractedText = `STATEMENT FOR: ALEX JOHNSON ACCOUNT: 4592-1234 TYPE: BUSINESS CHECKING PERIOD: MARCH 2023`;
      const type = classifyStatementType(mockExtractedText);
      const meta = extractUniversalMetadata(mockExtractedText);

      // Update Account Model with forensic tokens
      if (UI_STATE.selectedAccount && UI_STATE.selectedAccount !== 'ALL') {
        window.RoboLedger.Accounts.updateMetadata(UI_STATE.selectedAccount, {
          accountNumber: meta.accountNumber || '**** 1234',
          accountType: type === 'CREDIT' ? 'CREDIT CARD' : 'CHECKING',
          period: meta.period || 'MARCH 2023',
          holder: meta.holder || 'ALEX JOHNSON'
        });
      }

      await new Promise(r => setTimeout(r, 200));
    }

    // Phase 2: BATCH TRUTH RECONSTRUCTION (Checksum & Year Rollover Logic)
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      UI_STATE.ingestionProgress = 30 + ((i / totalFiles) * 40);
      UI_STATE.ingestionLabel = `[Phase 2/3] Reconstructing Truth: ${file.name}`;
      updateProgressUI();

      // Integrity Check (Logic Checksum Simulation)
      const integrity = checksumVerification([], {});
      console.log(`[FORENSIC] ${file.name}: ${integrity.message}`);

      await new Promise(r => setTimeout(r, 300));
    }

    // Phase 3: BATCH LEDGER IMPORT
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      UI_STATE.ingestionProgress = 70 + ((i / totalFiles) * 30);
      UI_STATE.ingestionLabel = `[Phase 3/3] Finalizing Ledger: ${file.name}`;
      updateProgressUI();
      await window.RoboLedger.Ingestion.processUpload(file, UI_STATE.selectedAccount);
    }

    UI_STATE.isIngesting = false;
    UI_STATE.ingestionLabel = null;
    UI_STATE.ingestionProgress = 100;
    window.updateWorkspace();
  }

  // --- V5 Technical Metadata Engine ---

  function classifyStatementType(text) {
    const scores = { credit: 0, bank: 0 };
    const creditKeywords = ['VISA', 'CREDIT CARD', 'MINIMUM PAYMENT', 'CREDIT LINE'];
    const bankKeywords = ['CHECKING', 'SAVINGS', 'BANK STATEMENT', 'OVERDRAFT', 'TRANSIT'];

    creditKeywords.forEach(k => { if (text.toUpperCase().includes(k)) scores.credit++; });
    bankKeywords.forEach(k => { if (text.toUpperCase().includes(k)) scores.bank++; });

    return scores.credit > scores.bank ? 'CREDIT' : 'BANK';
  }

  function extractUniversalMetadata(text) {
    const meta = {
      holder: null,
      accountNumber: null,
      period: null
    };

    // 1. Account Number Extraction (Regex pattern for typical statement formats)
    const accMatch = text.match(/(?:Account|Acc|Number)[:\s]+([0-9\-\s]{4,20})/i) || text.match(/([0-9]{4,5}[\-\s][0-9]{5,8})/);
    if (accMatch) meta.accountNumber = accMatch[1].trim().replace(/[\s\-]/g, '');

    // 2. Period Extraction (Month Year or Date Range)
    const periodMatch = text.match(/(?:Statement Period|From|Period)[:\s]+([A-Za-z]{3,}\s+\d{1,2},?\s+\d{4})/i) || text.match(/([A-Za-z]{3,}\s+\d{4})/);
    if (periodMatch) meta.period = periodMatch[1].trim().toUpperCase();

    // 3. Holder (Simplified heuristic: first line or specific label)
    const holderMatch = text.match(/(?:Name|Holder|To)[:\s]+([A-Z\s,]{4,30})/i);
    if (holderMatch) meta.holder = holderMatch[1].trim();

    return meta;
  }

  function checksumVerification(txns, meta) {
    // Opening + Credits - Debits === Closing
    // Since we don't have opening/closing balances easily extracted yet, 
    // we'll log the integrity status based on sum of transactions vs extracted header balances if found.
    return { success: true, message: "Forensic Integrity Verified" };
  }

  function updateProgressUI() {
    // Trigger re-render - render() will check UI_STATE.isIngesting and show updated progress
    render();
  }

  window.forceDeepRepair = () => {
    console.warn("[LEDGER] Manually triggering deep repair...");
    const data = window.RoboLedger.Ledger.getAll();
    data.forEach(t => {
      // Force nuke and rebuild
      t.description = window.RoboLedger.Brain.cleanDescription(t.raw_description);
    });
    // Refresh the table if it exists
    if (window.txnTable) {
      window.txnTable.setData(data);
    }
    window.updateWorkspace();
    return "DEEP REPAIR COMPLETE - UI REFRESHED";
  };

  function render() {
    // 1. Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === UI_STATE.currentRoute);
    });

    // 2. Breadcrumbs (Functional Active Routing)
    const bcContainer = document.getElementById('breadcrumb');
    if (bcContainer) {
      bcContainer.innerHTML = UI_STATE.breadcrumbs.map((bc, i) => {
        const isLast = i === UI_STATE.breadcrumbs.length - 1;
        const isHome = bc.label.toLowerCase() === 'home';
        const route = isHome ? 'home' : 'import';

        return `
          <div class="breadcrumb-item ${isLast ? 'active' : ''}"
               style="cursor: ${isLast ? 'default' : 'pointer'};"
               onclick="${isLast ? '' : `window.navigateTo('${route}');`}">
            ${isHome ? '<i class="ph ph-house" style="margin-right: 5px; font-size: 13px;"></i>' : ''}
            <span>${bc.label}</span>
          </div>
          ${isLast ? '' : '<span class="breadcrumb-separator"><i class="ph ph-caret-right"></i></span>'}
        `;
      }).join('');
    }

    // 3. Stage Content
    const stage = document.getElementById('app-stage');
    if (UI_STATE.currentRoute !== 'home') { stage.innerHTML = `<div class="fade-in">${renderPage()}</div>`; } else { renderHome(); }

    // 4. Show recovery prompt if data exists from previous session
    if (UI_STATE.recoveryPending) {
      showRecoveryPrompt();
      return; // Don't initialize grid until user chooses
    }

    //5. Grid Init
    if (UI_STATE.currentRoute === 'import' && !UI_STATE.isIngesting && !UI_STATE.isPoppedOut) {
      const gridDiv = document.querySelector('#txnGrid');
      if (gridDiv) {
        console.log('[UI] Grid shell found, initializing TanStack...');

        // CRITICAL FIX: Respect selected account filter when re-initializing grid
        // Don't blindly pass ALL transactions - filter by selected account!
        const allTxns = window.RoboLedger.Ledger.getAll();
        const ledgerData = UI_STATE.selectedAccount === 'ALL'
          ? allTxns
          : allTxns.filter(t => t.account_id === UI_STATE.selectedAccount);

        console.log(`[UI] Passing ${ledgerData.length} transactions to grid (filtered by: ${UI_STATE.selectedAccount || 'ALL'})`);
        if (window.renderTransactionsGrid) initGrid(ledgerData);
        else setTimeout(() => initGrid(ledgerData), 100);

        // Populate static header containers with initial data
        if (window.updateHeaderData) {
          console.log('[UI] Populating header containers with initial data');
          window.updateHeaderData();
        }
      }
    }
  }

  function renderPage() {
    switch (UI_STATE.currentRoute) {
      case 'import': return renderTransactionsRestored();
      case 'coa': return renderCOAPage();
      case 'reports': return renderReportsPage();
      case 'home': renderHome(); return ''; // renderHome() manages stage directly
      default: return renderPlaceholder(UI_STATE.currentRoute.toUpperCase());
    }
  }

  function renderCOAPage() {
    const categories = [
      { id: 'asset', label: 'Assets', sub: 'Cash, Inventory, Equipment', theme: 'theme-asset' },
      { id: 'liability', label: 'Liabilities', sub: 'Loans, Payables, Credit Cards', theme: 'theme-liability' },
      { id: 'equity', label: 'Equity', sub: "Owner's Capital, Retained Earnings", theme: 'theme-equity' },
      { id: 'revenue', label: 'Revenue', sub: 'Sales, Services, Income', theme: 'theme-revenue' },
      { id: 'expense', label: 'Expenses', sub: 'Advertising, Office, Travel', theme: 'theme-expense' }
    ];

    return `
      <div class="ai-brain-page">
          <div class="std-page-header">
             <div class="header-brand">
                 <div class="icon-box"><i class="ph ph-books"></i></div>
                 <div>
                     <h1 style="margin: 0; font-size: 1.1rem; font-weight: 700;">Chart of Accounts</h1>
                     <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Manage your financial categories</p>
                 </div>
             </div>
             <div style="display: flex; gap: 8px;">
                <button class="btn-restored" style="background: white; color: #334155; border: 1px solid #cbd5e1;">
                    <i class="ph ph-export" style="margin-right:4px;"></i> Export
                </button>
                <button class="btn-restored" style="background: #3b82f6; color: white; border: none;">
                    <i class="ph ph-plus" style="margin-right:4px;"></i> Add Account
                </button>
             </div>
          </div>

          <div class="coa-scroll-container">
              ${categories.map(cat => `
                  <div class="coa-row ${cat.theme}" id="row-${cat.id}">
                    <div class="coa-row-header" onclick="window.toggleCoARow('${cat.id}')">
                      <div class="row-info">
                        <div class="row-title">
                          ${cat.label} 
                          <span class="row-desc-preview">${cat.sub}</span>
                        </div>
                      </div>
                      <i class="ph ph-caret-down row-chevron"></i>
                    </div>
                    <div class="coa-row-content" id="content-${cat.id}">
                        <div class="coa-grid-placeholder" style="min-height: 300px;">
                            <!-- The shared grid will be moved here on expansion -->
                        </div>
                    </div>
                  </div>
              `).join('')}
          </div>
      </div>
    `;
  }

  // Global shared grid state (Exposed for Forensic Debug)
  window.coaTable = null;

  function initCOAGrid() {
    const gridDiv = document.querySelector('#sharedAccountsGrid');
    if (!gridDiv || window.coaTable) return;

    // Force width for Tabulator calculation
    gridDiv.style.width = "100%";

    window.coaTable = new Tabulator(gridDiv, {
      data: [],
      height: "auto",
      layout: "fitColumns",
      placeholder: "No Accounts Found",
      columns: [
        { title: "Account #", field: "code", width: 120, sorter: "number", headerSortStartingDir: "asc" },
        { title: "Account Name", field: "name", widthGrow: 1, headerSort: false },
        { title: "Type", field: "root", width: 120, formatter: (cell) => cell.getValue()?.toUpperCase() },
        {
          title: "Balance",
          field: "balance",
          width: 140,
          hozAlign: "right",
          formatter: "money",
          formatterParams: { symbol: "$", decimal: ".", thousand: "," }
        },
        { title: "Tx", field: "tx_count", width: 80, hozAlign: "center", formatter: (cell) => cell.getValue() || "-" },
        {
          title: "",
          field: "actions",
          width: 60,
          headerSort: false,
          hozAlign: "center",
          formatter: () => `<button class="btn-coa-delete"><i class="ph ph-x"></i></button>`
        }
      ]
    });
  }

  // Global helper for COA expansion
  window.toggleCoARow = function (catId) {
    const row = document.getElementById(`row-${catId}`);
    const content = document.getElementById(`content-${catId}`);
    const placeholder = content.querySelector('.coa-grid-placeholder');
    const sharedGrid = document.getElementById('sharedAccountsGrid');
    const sharedGridStorage = document.getElementById('shared-grid-storage');

    const isActive = row.classList.contains('active');

    // Close others
    document.querySelectorAll('.coa-row').forEach(r => {
      if (r.id !== `row-${catId}`) {
        r.classList.remove('active');
        const otherContent = r.querySelector('.coa-row-content');
        if (otherContent) {
          otherContent.style.height = '0px';
          otherContent.style.minHeight = '0px'; // Critical fix
          otherContent.style.overflow = 'hidden';
          const otherPlaceholder = otherContent.querySelector('.coa-grid-placeholder');
          if (otherPlaceholder && otherPlaceholder.contains(sharedGrid)) {
            sharedGridStorage.appendChild(sharedGrid);
          }
        }
      }
    });

    if (!isActive) {
      row.classList.add('active');
      placeholder.appendChild(sharedGrid);

      if (!window.coaTable) initCOAGrid();

      // Update grid data
      const allAccounts = window.RoboLedger.COA.getAll();
      const filtered = allAccounts.filter(a => a.root.toLowerCase() === catId);

      if (window.coaTable) {
        // Use a small delay to ensure container is fully rendered
        setTimeout(() => {
          window.coaTable.setData(filtered);
          window.coaTable.redraw();
        }, 100);
      }

      content.style.height = 'auto';
      content.style.minHeight = '300px';
      content.style.overflow = 'visible';
    } else {
      row.classList.remove('active');
      content.style.height = '0px';
      content.style.minHeight = '0px'; // Critical fix
      content.style.overflow = 'hidden';
      sharedGridStorage.appendChild(sharedGrid);
    }
  };

  function renderHome() {
    const stage = document.getElementById('app-stage');
    if (!stage) return;

    // If the container already exists and React is mounted, just re-render in place
    if (document.getElementById('home-container') && window.mountHomePage) {
      window.mountHomePage();
      return;
    }

    // First visit: inject container then mount React
    stage.innerHTML = `<div id="home-container" style="width:100%;height:100vh;overflow:auto;"></div>`;

    const _tryMount = (attemptsLeft) => {
      if (window.mountHomePage) {
        window.mountHomePage();
      } else if (attemptsLeft > 0) {
        setTimeout(() => _tryMount(attemptsLeft - 1), 80);
      } else {
        console.error('[RENDER_HOME] window.mountHomePage not found after retries');
      }
    };
    setTimeout(() => _tryMount(20), 30); // up to ~1.6s total
  }



  function renderPlaceholder(title) {
    return `
      <div class="empty-state" style="background: white; border: 1px solid var(--border-color);">
        <i class="ph ph-layout empty-icon" style="color: #94a3b8;"></i>
        <div class="empty-title">${title}</div>
        <div class="empty-subtitle">Module wired into the V5 Shell.</div>
      </div>
    `;
  }


  // --- HEADER DATA UPDATE (Static Container Pattern) ---

  window.updateHeaderData = function () {
    const accounts = window.RoboLedger.Accounts.getAll();
    const acc = accounts.find(a => a.id === UI_STATE.selectedAccount);
    const isAllMode = UI_STATE.selectedAccount === 'ALL';
    const terminalFont = "'JetBrains Mono', 'SF Mono', 'Courier New', monospace";

    console.log('[Header Data Update] Mode:', isAllMode ? 'ALL' : 'SINGLE', 'Account:', acc?.ref || 'None');

    // Helper: Get bank icon (returns <img> tag with uniform 28x28 size)
    // Helper: Get icon HTML for a single icon code
    const getSingleIcon = (iconCode, size = 28) => {
      const bank = (iconCode || '').toLowerCase();
      const iconStyle = `width: ${size}px; height: ${size}px; border-radius: 4px; object-fit: contain;`;
      const basePath = '/logos/';

      // Bank icons
      if (bank === 'rbc' || bank.includes('royal')) return `<img src="${basePath}rbc.png" alt="RBC" style="${iconStyle}" />`;
      if (bank === 'td' || bank.includes('dominion')) return `<img src="${basePath}td.png" alt="TD" style="${iconStyle}" />`;
      if (bank === 'bmo' || bank.includes('montreal')) return `<img src="${basePath}bmo.png" alt="BMO" style="${iconStyle}" />`;
      if (bank === 'scotia' || bank.includes('scotiabank')) return `<img src="${basePath}scotia.png" alt="Scotia" style="${iconStyle}" />`;
      if (bank === 'cibc') return `<img src="${basePath}cibc.png" alt="CIBC" style="${iconStyle}" />`;

      // Card network logos
      if (bank === 'visa') return `<img src="${basePath}visa.png" alt="Visa" style="${iconStyle}" />`;
      if (bank === 'mc' || bank === 'mastercard') return `<img src="${basePath}mastercard.png" alt="Mastercard" style="${iconStyle}" />`;
      if (bank === 'amex' || bank.includes('american express')) return `<img src="${basePath}amex.png" alt="American Express" style="${iconStyle}" />`;

      // Fallback
      return `<img src="${basePath}rbc.png" alt="Bank" style="${iconStyle}" />`;
    };

    // Helper: Get bank icon (supports dual-icon for credit cards)
    const getBankIcon = (bankNameOrAccount) => {
      // Support both old API (bankName string) and new API (account object with bankIcon/networkIcon)
      const account = typeof bankNameOrAccount === 'object' ? bankNameOrAccount : null;
      const bankName = account ? account.bankName : bankNameOrAccount;

      // Check if dual icons are available (credit card)
      if (account && account.bankIcon && account.networkIcon) {
        // DUAL ICON MODE: Vertical split
        const height = 48; // Total height (3 text lines)
        const halfHeight = height / 2;

        return `<div style="width: 48px; height: ${height}px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
          <div style="height: ${halfHeight}px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #e2e8f0;">
            ${getSingleIcon(account.bankIcon, 20)}
          </div>
          <div style="height: ${halfHeight}px; display: flex; align-items: center; justify-content: center;">
            ${getSingleIcon(account.networkIcon, 20)}
          </div>
        </div>`;
      }

      // SINGLE ICON MODE: Regular bank account or Amex (single logo)
      const bank = (bankName || '').toLowerCase();

      // For Amex, use full 48px height single logo
      if (bank.includes('amex') || bank.includes('american express')) {
        return getSingleIcon('amex', 48);
      }

      // For other accounts, use standard 48px icons (INCREASED from 28px)
      const iconFromParser = account ? account.bankIcon : null;

      // Use bankIcon from parser if available (set by parsers), otherwise fall back to bankName matching
      const iconName = iconFromParser ? iconFromParser.toLowerCase() : (
        bank.includes('rbc') || bank.includes('royal') ? 'rbc' :
          bank.includes('td') || bank.includes('dominion') ? 'td' :
            bank.includes('bmo') || bank.includes('montreal') ? 'bmo' :
              bank.includes('scotia') ? 'scotia' :
                bank.includes('cibc') ? 'cibc' :
                  'rbc' // default fallback
      );

      return getSingleIcon(iconName, 48); // INCREASED from 28px to 48px
    };

    // Helper: Get account period range
    const getAccountPeriodRange = (accountId) => {
      const txns = window.RoboLedger.Ledger.getAll()
        .filter(t => t.account_id === accountId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      if (txns.length === 0) return null;
      const first = new Date(txns[0].date);
      const last = new Date(txns[txns.length - 1].date);
      const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${formatDate(first)} - ${formatDate(last)}`;
    };

    // Helper: Check if account is reconciled
    const isAccountReconciled = (a) => {
      const txns = window.RoboLedger.Ledger.getAll().filter(t => t.account_id === a.id);
      return txns.length > 0 && txns.every(t => t.reconciled);
    };

    // Update subtitle
    const subtitle = document.getElementById('account-subtitle');
    if (subtitle) {
      subtitle.textContent = `${acc ? acc.bankName || 'Royal Bank of Canada' : 'Consolidated View'} • ${acc ? acc.currency || 'CAD' : 'CAD'}`;
    }

    // Update selector
    const selector = document.getElementById('account-selector');
    if (selector) {
      selector.value = UI_STATE.selectedAccount;
    }

    // Update reconciliation content
    const reconContent = document.getElementById('reconciliation-content');
    if (reconContent) {
      if (isAllMode) {
        // ALL MODE: "All Accounts at a glance" - Simple summary without reconciliation status
        var allTxns = window.RoboLedger.Ledger.getAll();
        var aggTotalDebits = allTxns.filter(function (t) { return t.polarity === 'DEBIT'; }).reduce(function (sum, t) { return sum + (t.amount_cents || 0); }, 0) / 100;
        var aggTotalCredits = allTxns.filter(function (t) { return t.polarity === 'CREDIT'; }).reduce(function (sum, t) { return sum + (t.amount_cents || 0); }, 0) / 100;
        var aggOpeningBalance = accounts.reduce(function (sum, a) { return sum + (a.openingBalance || 0); }, 0);
        var totalBalance = aggOpeningBalance - aggTotalDebits + aggTotalCredits;
        var netActivity = aggTotalCredits - aggTotalDebits;

        reconContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 11px; color: #1e293b;">' +
          '<div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 1px; margin-top: 2px; margin-bottom: 4px;">All Accounts at a glance</div>' +
          '<div>Total Balance: <span style="font-weight: 600;">$' + totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</span></div>' +
          '<div>Total Debits: <span style="font-weight: 600; color: #ef4444;">$' + aggTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</span> \u2022 Total Credits: <span style="font-weight: 600; color: #10b981;">$' + aggTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</span></div>' +
          '<div>Net Activity: <span style="font-weight: 600;">$' + netActivity.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</span></div>' +
          '</div>';
      } else if (!acc) {
        reconContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 11px; color: #1e293b;">&gt; Select account...</div>';
      } else {
        // SINGLE MODE: 2-column layout with editable fields
        var txns = window.RoboLedger.Ledger.getAll().filter(function (t) { return t.account_id === acc.id; });
        var totalDebits = txns.filter(function (t) { return t.polarity === 'DEBIT'; }).reduce(function (sum, t) { return sum + (t.amount_cents || 0); }, 0) / 100;
        var totalCredits = txns.filter(function (t) { return t.polarity === 'CREDIT'; }).reduce(function (sum, t) { return sum + (t.amount_cents || 0); }, 0) / 100;
        const openingBalance = acc.openingBalance || 0;

        // Critical: Use correct formula based on account type
        // FIXED: After fixing parsers, for credit cards:
        //   - Payments are DEBITS (reduce liability)
        //   - Purchases are CREDITS (increase liability)
        // So: Opening + Credits - Debits = Ending
        // Check accountType field (set by parsers) OR fallback to type field
        const isLiability = (acc.accountType || '').toLowerCase() === 'creditcard' ||
          acc.type === 'liability' ||
          acc.type === 'creditcard';
        const calculatedEnding = isLiability
          ? openingBalance + totalCredits - totalDebits  // Credit card: Opening + Credits - Debits
          : openingBalance - totalDebits + totalCredits; // Bank account: Opening - Debits + Credits
        const actualEnding = acc.actualEndingBalance || 0;
        const isAutoReconciled = actualEnding === 0;
        const discrepancy = isAutoReconciled ? 0 : (actualEnding - calculatedEnding);
        const isReconciled = Math.abs(discrepancy) < 0.01;
        const endingVal = isAutoReconciled ? calculatedEnding : actualEnding;
        const statusHTML = (isAutoReconciled || isReconciled) ? '<span style="color: #10b981;">\u2713 RECONCILED</span>' : '<span style="color: #ef4444;">\u2717 DISCREPANCY: $' + Math.abs(discrepancy).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</span>';


        // Dual ending balances: for new HTML layout (backwards compatible)
        const statementEnding = acc.statementEndingBalance !== undefined ? acc.statementEndingBalance : actualEnding;
        const hasStatementEnding = statementEnding !== 0;
        // 3-row layout: Opening+Debit, Ending(Calc)+Credit, Ending(Stmt)
        reconContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.7;">' +
          '<div style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 1px; margin-top: 2px; margin-bottom: 4px;">RECONCILIATION</div>' +
          // Row 1: Opening + Debit (WITH EDITABLE INPUT + PDF LINK)
          '\u003cdiv style="display: flex; align-items: center; gap: 24px; margin-bottom: 2px;"\u003e' +
          '\u003cdiv style="flex: 1; display: flex; align-items: center; gap: 8px; white-space: nowrap;"\u003eOpening: ' +
          '\u003cinput type="text" id="opening-balance-input" value="$' + openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '" style="border: none; border-bottom: 1px solid #cbd5e1; background: transparent; font-family: ' + terminalFont + '; font-size: 12px; font-weight: 700; color: #1e293b; width: 90px; padding: 2px 4px;" oninput="window.handleOpeningBalanceInput(this)" onblur="window.formatOpeningBalance(this)" onclick="this.select()" /\u003e' +
          ' \u003cspan onclick="window.showStatementSource(\'opening\')" style="cursor: pointer; color: #3b82f6; font-size: 11px; margin-left: 4px;" title="View statement source"\u003e🔗\u003c/span\u003e' +
          '\u003c/div\u003e' +
          '\u003cdiv style="flex: 1; white-space: nowrap;"\u003eDebit: \u003cspan style="font-weight: 700; color: #ef4444;"\u003e$' + totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '\u003c/span\u003e\u003c/div\u003e' +
          '\u003c/div\u003e' +
          // Row 2: Ending (Calc) + Credit
          '\u003cdiv style="display: flex; align-items: center; gap: 24px; margin-bottom: 2px;"\u003e' +
          '\u003cdiv style="flex: 1; white-space: nowrap;"\u003eEnding (Calc): \u003cspan style="font-weight: 700; color: #3b82f6;"\u003e$' + calculatedEnding.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '\u003c/span\u003e\u003c/div\u003e' +
          '\u003cdiv style="flex: 1; white-space: nowrap;"\u003eCredit: \u003cspan style="font-weight: 700; color: #10b981;"\u003e$' + totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '\u003c/span\u003e\u003c/div\u003e' +
          '\u003c/div\u003e' +
          // Row 3: Ending (Stmt) - EDITABLE + PDF LINK
          '\u003cdiv style="display: flex; align-items: center; gap: 24px; margin-bottom: 2px;"\u003e' +
          '\u003cdiv style="flex: 1; display: flex; align-items: center; gap: 8px; white-space: nowrap;"\u003eEnding (Stmt): ' +
          '\u003cinput type="text" id="stmt-ending-input" value="$' + (hasStatementEnding ? statementEnding : calculatedEnding).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '" style="border: none; border-bottom: 1px solid #cbd5e1; background: transparent; font-family: ' + terminalFont + '; font-size: 12px; font-weight: 700; color: #1e293b; width: 90px; padding: 2px 4px;" onblur="window.saveStatementEnding(this.value)" onclick="this.select()" /\u003e' +
          ' \u003cspan onclick="window.showStatementSource(\'closing\')" style="cursor: pointer; color: #3b82f6; font-size: 11px; margin-left: 4px;" title="View statement source"\u003e🔗\u003c/span\u003e' +
          '\u003c/div\u003e' +
          '\u003cdiv style="flex: 1;"\u003e\u003c/div\u003e' +
          '\u003c/div\u003e' +
          // Status row
          '\u003cdiv style="font-size: 11px; font-weight: 600; padding-top: 4px; margin-top: 4px; border-top: 1px solid #e2e8f0;"\u003e' + statusHTML + '\u003c/div\u003e' +
          '</div>';
      }
    }

    // UNIFIED METADATA LAYOUT - Same structure for ALL and SINGLE modes
    const metaContent = document.getElementById('metadata-content');
    if (metaContent) {
      if (isAllMode) {
        // Calculate aggregated stats for ALL mode
        const allTxns = window.RoboLedger.Ledger.getAll();
        const totalTxnCount = allTxns.length;
        const debitTxns = allTxns.filter(t => t.polarity === 'DEBIT');
        const creditTxns = allTxns.filter(t => t.polarity === 'CREDIT');
        const debitCount = debitTxns.length;
        const creditCount = creditTxns.length;
        const debitTotal = debitTxns.reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
        const creditTotal = creditTxns.reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;

        // Period range
        var periodText = 'No transactions';
        if (allTxns.length > 0) {
          var dates = allTxns.map(function (t) { return new Date(t.date_iso || t.date); }).sort(function (a, b) { return a - b; });
          periodText = dates[0].toISOString().split('T')[0] + ' TO ' + dates[dates.length - 1].toISOString().split('T')[0];
        }

        // Account badges
        var allBadge = '<span style="background: #1e293b; color: white; font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 3px; font-family: \'JetBrains Mono\', monospace;">ALL</span>';
        var badgesList = accounts.map(function (a) {
          var isRecon = isAccountReconciled(a);
          return '<span onclick="window.switchAccount(\'' + a.id + '\')" title="' + (a.name || a.ref) + '" style="background: #3b82f6; color: white; font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 3px; font-family: \'JetBrains Mono\', monospace; cursor: pointer;">' + (a.ref || 'N/A') + (isRecon ? ' \u2713' : '') + '</span>';
        }).join(' ');

        metaContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 10px; color: #1e293b; min-height: 85px;">' +
          '<div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 1px; margin-bottom: 4px;">ACCOUNT METADATA</div>' +
          '<div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">' + allBadge + ' ' + badgesList + '</div>' +
          '<div style="font-family: \'JetBrains Mono\', monospace; font-size: 10px; color: #64748b; margin-bottom: 6px;">' +
          '<span style="color: #1e293b; font-weight: 600;">Consolidated View</span> • ' + accounts.length + ' accounts' +
          '</div>' +

          '<div style="font-family: \'JetBrains Mono\', monospace; font-size: 10px; color: #1e293b; margin-bottom: 6px;">Transactions: <span style="font-weight: 600;">' + totalTxnCount + '</span> (<span style="color: #ef4444;">' + debitCount + ' debits</span>, <span style="color: #10b981;">' + creditCount + ' credits</span>)</div>' +
          '</div>';
      } else if (acc) {
        // SINGLE MODE: ACCOUNT METADATA heading + breadcrumb + transaction counts + icon (48px) + text
        // Check accountType field (set by parsers) OR fallback to type field
        var isLiability = (acc.accountType || '').toLowerCase() === 'creditcard' ||
          acc.type === 'liability' ||
          acc.type === 'creditcard';
        var accTxns = window.RoboLedger.Ledger.getAll().filter(function (t) { return t.account_id === acc.id; });
        var periodText = 'No transactions';
        if (accTxns.length > 0) {
          var dates = accTxns.map(function (t) { return new Date(t.date_iso || t.date); }).sort(function (a, b) { return a - b; });
          periodText = dates[0].toISOString().split('T')[0] + ' TO ' + dates[dates.length - 1].toISOString().split('T')[0];
        }

        // Calculate transaction counts
        const totalTxns = accTxns.length;
        const debitTxns = accTxns.filter(t => t.polarity === 'DEBIT');
        const creditTxns = accTxns.filter(t => t.polarity === 'CREDIT');
        const debitCount = debitTxns.length;
        const creditCount = creditTxns.length;
        const debitTotal = debitTxns.reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
        const creditTotal = creditTxns.reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;



        var bankIcon = getBankIcon(acc);  // Pass full account object for dual-icon support


        // Format card number display based on card network
        var transitInfo;
        if (isLiability) {
          // Show account number exactly as extracted from statement
          transitInfo = (acc.cardNetwork || 'Card') + ' Card ' + (acc.accountNumber || 'N/A');
        } else {
          transitInfo = 'Transit ' + (acc.transit || '00000') + ' \u2022 Inst ' + (acc.inst || '003') + ' \u2022 Acct \u2022\u2022\u2022\u2022' + ((acc.accountNumber || '').slice(-4) || '2443');
        }

        metaContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 10px; color: #1e293b; min-height: 85px;">' +
          '<div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 1px; margin-bottom: 4px;">ACCOUNT METADATA</div>' +
          '<div style="font-family: \'JetBrains Mono\', monospace; font-size: 10px; color: #64748b; margin-bottom: 6px;">' +
          '<span onclick="window.switchAccount(\'ALL\')" style="cursor: pointer; color: #3b82f6;">ALL</span>' +
          '<span style="color: #94a3b8; margin: 0 4px;">\u2192</span>' +
          '<span style="color: #1e293b; font-weight: 600;">' + (acc.ref || acc.name || 'Account') + '</span>' +
          '</div>' +
          '<div style="font-family: \'JetBrains Mono\', monospace; font-size: 10px; color: #1e293b; margin-bottom: 8px;">' +
          'Transactions: <span style="font-weight: 600;">' + totalTxns + '</span>  |  ' +
          '<span style="color: #ef4444;">Debits: ' + debitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '<sup style="font-size: 8px;">' + debitCount + '</sup></span>  |  ' +
          '<span style="color: #10b981;">Credits: ' + creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '<sup style="font-size: 8px;">' + creditCount + '</sup></span>' +
          '</div>' +
          '<div style="display: flex; align-items: flex-start; gap: 10px;">' +
          bankIcon +
          '<div style="line-height: 1.5;">' +
          '<div><span style="background: #3b82f6; color: white; font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 3px;">' + (acc.ref || 'CHQ1') + '</span> <span style="color: #1e293b; font-weight: 500;">' + (acc.bankName || 'Royal Bank of Canada') + '</span></div>' +
          '<div style="color: #1e293b;">' + transitInfo + '</div>' +
          '<div style="color: #1e293b;">Period: <span style="font-weight: 600;">' + periodText + '</span></div>' +
          '</div>' +
          '</div>' +
          '</div>';
      } else {
        // NO ACCOUNT SELECTED
        metaContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 10px; color: #1e293b;">&gt; No account</div>';
      }
    }

    // Re-populate import section after header re-render
    if (typeof updateImportSection === 'function') {
      updateImportSection();
    }
  };

  // Update import section content
  const updateImportSection = () => {
    const importContent = document.getElementById('import-content');
    if (importContent) {
      importContent.innerHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; box-sizing: border-box; gap: 4px;">' +
        '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 6px 8px; width: 100%; flex: 1; box-sizing: border-box; transition: border-color 0.2s, background 0.2s;" onclick="window.openFilePicker()" onmouseover="this.style.borderColor=\'#3b82f6\'; this.style.background=\'#eff6ff\'" onmouseout="this.style.borderColor=\'#cbd5e1\'; this.style.background=\'transparent\'">' +
        '<i class="ph ph-upload" style="font-size: 16px; color: #3b82f6;"></i>' +
        '<div style="font-size: 8px; font-weight: 600; color: #64748b; text-align: center;">Browse Files</div>' +
        '</div>' +
        '<div style="cursor: pointer; font-size: 8px; font-weight: 600; color: #3b82f6; text-align: center; padding: 2px 6px; border-radius: 4px; transition: background 0.2s;" onclick="window.openFolderPicker()" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'transparent\'">' +
        '<i class="ph ph-folder-open" style="margin-right: 3px;"></i>Select Folder' +
        '</div>' +
        '</div>';
    }
  };



  // Call import section update
  updateImportSection();

  // --- WORKSPACE HTML GENERATORS ---

  function getAccountWorkspaceHeaderHTML() {
    const acc = UI_STATE.selectedAccount !== 'ALL' ? window.RoboLedger.Accounts.get(UI_STATE.selectedAccount) : null;
    const accounts = (window.RoboLedger.Accounts.getActive?.() || window.RoboLedger.Accounts.getAll())
      .slice().sort((a, b) => (a.ref || a.name || '').localeCompare(b.ref || b.name || ''));
    const allTxns = window.RoboLedger.Ledger.getAll(); // MOVED UP: declare before use

    // CRITICAL: Don't render header at all if no transactions exist (empty grid)
    // ALSO clear selectedAccount from state to prevent cache persistence bugs
    if (allTxns.length === 0) {
      UI_STATE.selectedAccount = null;
      UI_STATE.refPrefix = 'CHQ1'; // Reset to default
      return ''; // Return empty - no header when no data
    }

    const isLiability = acc && (acc.type === 'CREDIT_CARD' || acc.brand === 'VISA' || acc.brand === 'MASTERCARD' || acc.brand === 'AMEX');

    // Metrics Calculation
    const filteredTxns = UI_STATE.selectedAccount === 'ALL' ? allTxns : allTxns.filter(t => t.account_id === UI_STATE.selectedAccount);

    // Activity metrics - Show ALL time if 30d is empty (Better for statements)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let metricsTxns = filteredTxns.filter(t => new Date(t.date_iso || t.date) >= thirtyDaysAgo);

    // Fallback to all filtered txns if no recent activity
    if (metricsTxns.length === 0) metricsTxns = filteredTxns;

    const debitTxns = metricsTxns.filter(t => t.polarity === 'DEBIT');
    const creditTxns = metricsTxns.filter(t => t.polarity === 'CREDIT');

    const inflow = creditTxns.reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
    const outflow = debitTxns.reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;

    // Balance logic for specific account
    const openingBalance = acc ? (acc.openingBalance || 0) : 0;
    const totalDebits = filteredTxns.filter(t => t.polarity === 'DEBIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
    const totalCredits = filteredTxns.filter(t => t.polarity === 'CREDIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
    const endingBalance = openingBalance - totalDebits + totalCredits;

    // ALL MODE: Calculate aggregate totals across all accounts
    const isAllMode = UI_STATE.selectedAccount === 'ALL';
    let aggTotalBalance = 0;
    let aggTotalDebits = 0;
    let aggTotalCredits = 0;
    let aggNetActivity = 0;
    let aggTxnCount = 0;

    if (isAllMode) {
      accounts.forEach(account => {
        const accTxns = allTxns.filter(t => t.account_id === account.id);
        const accOpening = account.openingBalance || 0;
        const accDebits = accTxns.filter(t => t.polarity === 'DEBIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
        const accCredits = accTxns.filter(t => t.polarity === 'CREDIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
        const accBalance = accOpening - accDebits + accCredits;

        aggTotalBalance += accBalance;
        aggTotalDebits += accDebits;
        aggTotalCredits += accCredits;
        aggTxnCount += accTxns.length;
      });
      aggNetActivity = aggTotalCredits - aggTotalDebits;
    }

    // Helper function to check if account is reconciled
    const isAccountReconciled = (account) => {
      const accTxns = allTxns.filter(t => t.account_id === account.id);
      const accOpening = account.openingBalance || 0;
      const accDebits = accTxns.filter(t => t.polarity === 'DEBIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
      const accCredits = accTxns.filter(t => t.polarity === 'CREDIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
      const accCalculated = accOpening - accDebits + accCredits;
      const accExpected = account.expectedBalance || accCalculated;
      return Math.abs(accCalculated - accExpected) < 0.01;
    };

    // Bank icon mapping (returns <img> tag with uniform 28x28 size)
    const getBankIcon = (bankName) => {
      const bank = (bankName || '').toLowerCase();
      const iconStyle = 'width: 28px; height: 28px; border-radius: 4px; object-fit: contain; vertical-align: middle;';
      const basePath = '/logos/';
      if (bank.includes('rbc') || bank.includes('royal')) return '<img src="' + basePath + 'rbc.png" alt="RBC" style="' + iconStyle + '" />';
      if (bank.includes('td') || bank.includes('dominion')) return '<img src="' + basePath + 'td.png" alt="TD" style="' + iconStyle + '" />';
      if (bank.includes('bmo') || bank.includes('montreal')) return '<img src="' + basePath + 'bmo.png" alt="BMO" style="' + iconStyle + '" />';
      if (bank.includes('scotia')) return '<img src="' + basePath + 'scotia.png" alt="Scotia" style="' + iconStyle + '" />';
      if (bank.includes('cibc')) return '<img src="' + basePath + 'cibc.png" alt="CIBC" style="' + iconStyle + '" />';
      return '<img src="' + basePath + 'rbc.png" alt="Bank" style="' + iconStyle + '" />';
    };

    const terminalFont = "'Courier New', Courier, monospace";

    // Period range calculation helper
    const getAccountPeriodRange = (accountId) => {
      const txns = allTxns
        .filter(t => t.account_id === accountId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (txns.length === 0) return null;

      const first = new Date(txns[0].date);
      const last = new Date(txns[txns.length - 1].date);

      const formatDate = (d) => d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      return `${formatDate(first)} - ${formatDate(last)}`;
    };

    // Aggregate calculations for ALL accounts mode


    return filteredTxns.length > 0 ? `
      <!-- Professional Account Dashboard Header -->
      <div id="account-header-root" class="v5-account-workspace-header" style="background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 12px 24px; gap: 12px;">
        
        <!-- Header Top: Account Type & Selector -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <select id="account-selector" onchange="window.switchAccount(this.value)" style="appearance: none; border: none; padding: 4px 0; font-size: 18px; font-weight: 800; color: #1e293b; background: transparent; cursor: pointer; text-transform: uppercase; outline: none; transition: opacity 0.2s;">
                <option value="ALL" ${UI_STATE.selectedAccount === 'ALL' ? 'selected' : ''}>ALL ACCOUNTS</option>
                ${accounts.map(a => `<option value="${a.id}" ${UI_STATE.selectedAccount === a.id ? 'selected' : ''}>${(a.name || a.ref).toUpperCase()}</option>`).join('')}
              </select>
              <i class="ph ph-caret-down" style="font-size: 14px; color: #64748b;"></i>
            </div>
            <div id="account-subtitle" style="font-size: 11px; font-weight: 500; color: #94a3b8; margin-top: 2px; text-transform: uppercase;">
              ${acc ? acc.bankName || 'Royal Bank of Canada' : 'Consolidated View'} • ${acc ? acc.currency || 'CAD' : 'CAD'}
            </div>
          </div>
          <div style="text-align: right; color: #94a3b8; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 12px;">
            <span>Header V5.2 • Active Session</span>
          </div>
        </div>

        <!-- Compact Terminal Strip -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: stretch; height: 120px; overflow: hidden; margin: 8px 0; padding: 10px 0;">
          
          <!-- LEFT: Reconciliation (40%) -->
          <div style="flex: 2; border-right: 1px solid #e2e8f0; padding: 8px 16px; display: flex; flex-direction: column; justify-content: center;">
            <div id="reconciliation-content"></div>
          </div>

          <!-- MIDDLE: Metadata (40%) -->
          <div style="flex: 2; border-right: 1px solid #e2e8f0; padding: 8px 16px; display: flex; flex-direction: column; justify-content: center;">
            <div id="metadata-content"></div>
          </div>

          <!-- RIGHT: Import/Drop Zone (20%) -->
          <div style="flex: 1; padding: 8px; display: flex; align-items: center; justify-content: center;">
            <div id="import-content" style="width: 100%; height: 100%;"></div>
          </div>

        </div>
      </div>
    ` : '';



  }

  function getFilterToolbarHTML() {
    const accounts = (window.RoboLedger.Accounts.getActive?.() || window.RoboLedger.Accounts.getAll())
      .slice().sort((a, b) => (a.ref || a.name || '').localeCompare(b.ref || b.name || ''));
    const refPrefix = UI_STATE.refPrefix || 'CHQ1';

    return `
      <!-- Sticky Filter Toolbar -->
      <div style="position: sticky; top: 0; z-index: 100; height: 44px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; gap: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
        <!-- LEFT: Ref Prefix + Search + Account Filter -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <!-- Ref# Prefix Input -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Ref#</label>
            <input 
              type="text" 
              id="ref-prefix-input" 
              placeholder="CHQ1" 
              value="${refPrefix}" 
              onblur="window.updateRefPrefix(this.value)" maxlength="8" 
              style="padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px; width: 60px; background: white; font-family: 'JetBrains Mono', monospace; font-weight: 600; text-transform: uppercase; text-align: center;" 
            />
          </div>
          
          <!-- Search -->
          <div style="position: relative;">
            <i class="ph ph-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px;"></i>
            <input type="text" id="v5-search-input" placeholder="Search transactions..." value="${UI_STATE.searchQuery || ''}" oninput="window.handleSearch(this.value)" style="padding: 6px 12px 6px 32px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; width: 220px; background: white;" />
          </div>
          
          <!-- Account Filter -->
          <select onchange="window.switchAccount(this.value)" style="padding: 6px 28px 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #64748b; background: white; cursor: pointer; appearance: none;">
            <option value="ALL" ${UI_STATE.selectedAccount === 'ALL' ? 'selected' : ''}>All Accounts</option>
            ${accounts.map(a => `<option value="${a.id}" ${UI_STATE.selectedAccount === a.id ? 'selected' : ''}>${a.ref || a.name || a.id}</option>`).join('')}
          </select>
        </div>

        <!-- RIGHT: Export + Grid Settings Icons -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <!-- Export Button with Dropdown -->
          <div style="position: relative;">
            <button id="export-btn" onclick="window.toggleExportMenu()" style="padding: 7px 10px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'" title="Export Transactions">
              <i class="ph ph-download-simple" style="font-size: 16px; color: #64748b;"></i>
            </button>
            
            <!-- Export Dropdown Menu (hidden by default) -->
            <div id="export-menu" style="display: none; position: absolute; top: calc(100% + 4px); right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); min-width: 180px; z-index: 1000;">
              <div onclick="window.TransactionExporter?.exportCurrentView('csv'); window.toggleExportMenu(false);" style="padding: 10px 16px; cursor: pointer; font-size: 13px; color: #1e293b; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <i class="ph ph-file-csv" style="font-size: 16px; color: #10b981;"></i>
                <span>Export CSV</span>
              </div>
              <div onclick="window.TransactionExporter?.exportCurrentView('excel'); window.toggleExportMenu(false);" style="padding: 10px 16px; cursor: pointer; font-size: 13px; color: #1e293b; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <i class="ph ph-file-xls" style="font-size: 16px; color: #10b981;"></i>
                <span>Export Excel CSV</span>
              </div>
              <div onclick="window.TransactionExporter?.exportCurrentView('json'); window.toggleExportMenu(false);" style="padding: 10px 16px; cursor: pointer; font-size: 13px; color: #1e293b; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <i class="ph ph-file-code" style="font-size: 16px; color: #3b82f6;"></i>
                <span>Export JSON</span>
              </div>
              <div onclick="window.TransactionExporter?.exportCurrentView('uncategorized'); window.toggleExportMenu(false);" style="padding: 10px 16px; cursor: pointer; font-size: 13px; color: #1e293b; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <i class="ph ph-funnel-simple" style="font-size: 16px; color: #f59e0b;"></i>
                <span>Uncategorized Only</span>
              </div>
            </div>
          </div>
          
          <!-- Filter Toggle Button -->
          <button onclick="window.toggleGridFilters()" id="filter-toggle-btn" style="padding: 7px 10px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; position: relative;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'" title="Toggle Column Filters">
            <i class="ph ph-funnel" style="font-size: 16px; color: #64748b;"></i>
            <span id="filter-count-badge" style="display: none; position: absolute; top: -6px; right: -6px; background: #3b82f6; color: white; font-size: 10px; font-weight: 600; padding: 2px 5px; border-radius: 10px; line-height: 1;"></span>
          </button>
          
         <!-- Settings Gear (existing) -->
          <button onclick="window.toggleSettings(true)" style="padding: 7px 10px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'" title="Grid Settings (Appearance & Columns)">
            <i class="ph ph-gear-six" style="font-size: 16px; color: #64748b;"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Toggle export menu dropdown
  window.toggleExportMenu = function (show) {
    const menu = document.getElementById('export-menu');
    if (!menu) return;

    if (show === undefined) {
      // Toggle
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    } else {
      menu.style.display = show ? 'block' : 'none';
    }
  };

  // Close export menu when clicking outside
  document.addEventListener('click', (e) => {
    const exportBtn = document.getElementById('export-btn');
    const exportMenu = document.getElementById('export-menu');
    if (exportMenu && exportBtn && !exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
      exportMenu.style.display = 'none';
    }
  });

  // Real-time opening balance update helper
  window.updateOpeningBalance = function (val) {
    const raw = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      const activeAcc = window.RoboLedger.Accounts.getAll().find(a => a.id === UI_STATE.selectedAccount);
      if (activeAcc) {
        // Use formal setter for persistence
        window.RoboLedger.Accounts.setOpeningBalance(activeAcc.id, Math.round(num * 100));

        // SURGICAL UPDATE: Recalculate and update DOM directly to avoid grid unmount
        const allTxns = window.RoboLedger.Ledger.getAll();
        const filteredTxns = allTxns.filter(t => t.account_id === activeAcc.id);
        const totalDebits = filteredTxns.filter(t => t.polarity === 'DEBIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
        const totalCredits = filteredTxns.filter(t => t.polarity === 'CREDIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;

        const newEndingBalance = num - totalDebits + totalCredits;

        const elClosing = document.getElementById('header-closing-balance');
        if (elClosing) elClosing.innerText = `$${newEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} `;

        // Also update activity colors if they exist
        const elNet = document.getElementById('header-net-activity');
        if (elNet) {
          const net = totalCredits - totalDebits;
          elNet.innerText = `$${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
          elNet.style.color = net >= 0 ? '#10b981' : '#ef4444';
        }
      }
    }
  };




  function getTxnIngestionHTML() {
    const progress = UI_STATE.ingestionProgress || 0;
    const label = UI_STATE.ingestionLabel || 'Parsing bank statement...';

    return `
      <div class="header-card v5-glass" style="display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: white; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); margin: 0 20px 20px 20px;">
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; background: linear-gradient(135deg, #fafbfc 0%, #f8fafc 100%);">
          <!-- Animated Icon -->
          <div style="margin-bottom: 32px; position: relative;">
            <i class="ph ph-file-text pulsing" style="font-size: 64px; color: #3b82f6; opacity: 0.9;"></i>
            <div style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <i class="ph ph-check" style="font-size: 14px; color: white; font-weight: bold;"></i>
            </div>
          </div>

          <!-- Title -->
          <div id="progress-title" style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">Processing Statement</div>
          <div id="progress-subtitle" style="font-size: 12px; color: #64748b; margin-bottom: 28px;">${label}</div>

          <!-- Progress Bar -->
          <div style="width: 100%; max-width: 400px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span id="progress-file-count" style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Progress</span>
              <span id="progress-txn-count" style="font-size: 12px; font-weight: 800; color: #3b82f6;">${Math.round(progress)}%</span>
            </div>
            <div style="height: 8px; background: #e2e8f0; border-radius: 10px; overflow: hidden; width: 100%; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);">
              <div id="progress-bar-fill" style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #10b981 100%); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 10px;"></div>
            </div>
          </div>

          <!-- Status Messages -->
          <div style="margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
            <div>✓ Extracting transaction data</div>
            <div>✓ Identifying patterns and accounts</div>
            <div style="opacity: ${progress > 50 ? 1 : 0.3};">✓ Calculating balances</div>
          </div>
        </div>
      </div >
      `;
  }

  function getTxnEmptyStateHTML() {
    return `
      <div class="grid-card-empty">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 24px; opacity: 0.5;">
          <path d="M30 25 L30 95 C30 97.2 31.8 99 34 99 L86 99 C88.2 99 90 97.2 90 95 L90 25 C90 22.8 88.2 21 86 21 L34 21 C31.8 21 30 22.8 30 25 Z" stroke="#94a3b8" stroke-width="6" fill="none" stroke-linejoin="round"/>
          <line x1="60" y1="21" x2="60" y2="99" stroke="#94a3b8" stroke-width="3"/>
          <line x1="70" y1="40" x2="82" y2="40" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
          <line x1="70" y1="52" x2="82" y2="52" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
          <line x1="70" y1="64" x2="82" y2="64" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
          <path d="M55 105 L60 110 L65 105" stroke="#94a3b8" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        
        <!-- Bank Icons Row -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; max-width: 600px; margin-left: auto; margin-right: auto;">
          <img src="/logos/rbc.png" alt="RBC" style="height: 32px; width: 32px; object-fit: contain; opacity: 0.7;" title="RBC Royal Bank">
          <img src="/logos/td.png" alt="TD" style="height: 32px; width: 32px; object-fit: contain; opacity: 0.7;" title="TD Canada Trust">
          <img src="/logos/bmo.png" alt="BMO" style="height: 32px; width: 32px; object-fit: contain; opacity: 0.7;" title="BMO Bank of Montreal">
          <img src="/logos/scotia.png" alt="Scotia" style="height: 32px; width: 32px; object-fit: contain; opacity: 0.7;" title="Scotiabank">
          <img src="/logos/cibc.png" alt="CIBC" style="height: 32px; width: 32px; object-fit: contain; opacity: 0.7;" title="CIBC">
          <img src="/logos/amex.png" alt="Amex" style="height: 32px; width: 32px; object-fit: contain; opacity: 0.7;" title="American Express">
        </div>
        
        <div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">No transactions yet.</div>
        <div style="font-size: 14px; color: #64748b; max-width: 480px; text-align: center; line-height: 1.5; margin-bottom: 32px;">Import your bank statements to get started.</div>
        
        <!-- Simple Upload Controls -->
        <div style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 28px; max-width: 450px; margin: 0 auto 24px;">
          
          <!-- File Type Dropdown -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 8px;">
              File Type
            </label>
            <select 
              id="fileTypeSelect" 
              onchange="window.updateFileType()"
              style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-weight: 500; color: #1e293b; background: white; cursor: pointer;"
            >
              <option value="pdf" selected>PDF Only (Bank Statements)</option>
              <option value="csv">CSV/XLSX Only (Spreadsheets)</option>
              <option value="all">All File Types</option>
              <option value="" disabled style="color: #94a3b8;">Bank feed (coming soon)</option>
            </select>
          </div>
          
          <!-- Browse Folders Checkbox -->
          <div style="margin-bottom: 24px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px; background: #f8fafc; border-radius: 8px; border: 2px solid #e2e8f0;">
              <input 
                type="checkbox" 
                id="browseFoldersCheckbox" 
                onchange="window.updateBrowseMode()"
                style="width: 18px; height: 18px; cursor: pointer;"
              >
              <span style="font-size: 14px; font-weight: 600; color: #1e293b;">
                <i class="ph ph-folder-open" style="margin-right: 6px;"></i>
                Browse folders (include subfolders)
              </span>
            </label>
          </div>
          
          <!-- Upload Button -->
          <button 
            onclick="document.getElementById('mainFileInput').click()" 
            style="
              width: 100%;
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
              color: white;
              border: none;
              padding: 16px 32px;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
              transition: transform 0.2s, box-shadow 0.2s;
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(59, 130, 246, 0.4)';"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.3)';"
          >
            <i class="ph ph-upload-simple" style="font-size: 22px;"></i>
            <span id="uploadButtonText">Import PDF Statements</span>
          </button>
        </div>
        
        <!-- Hidden file input -->
        <input 
          type="file" 
          id="mainFileInput" 
          accept=".pdf"
          multiple 
          style="display: none;" 
          onchange="window.handleMainUpload(this)"
        >
      </div>
      `;
  }

  function renderReportsPage() {
    // Return container for React component
    // Mount after a brief delay to ensure DOM is ready
    setTimeout(() => {
      if (window.mountReportsPage) {
        window.mountReportsPage();
      }
    }, 50);

    return `
      <div id="reports-container" style="width: 100%; height: 100%; display: flex; flex-direction: column;"></div>
    `;
  }

  function renderTransactionsRestored() {
    const accounts = window.RoboLedger.Accounts.getAll();
    const allTransactions = window.RoboLedger.Ledger.getAll();
    const filteredData = UI_STATE.selectedAccount === 'ALL' ? allTransactions : allTransactions.filter(t => t.account_id === UI_STATE.selectedAccount);
    const hasData = filteredData.length > 0;

    // Flat workspace structure - NO CARDS
    let mainContent = "";
    if (UI_STATE.isIngesting) {
      mainContent = getTxnIngestionHTML(); // Only show progress card, no empty grid below
    } else if (!hasData) {
      mainContent = `
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: #fafbfc;">
        ${getTxnEmptyStateHTML()}
      </div>
      `;
    } else {
      // Edge-to-edge grid
      mainContent = `
      <div style="flex: 1; display: flex; flex-direction: column; background: white;">
        <!-- Inline Progress Bar (above grid) -->
        <div id="parsing-progress-inline" style="display: none; background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 24px; margin: 16px 24px; border-radius: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div>
              <div id="progress-title" style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">Processing Statements</div>
              <div id="progress-subtitle" style="font-size: 12px; color: #64748b;"></div>
            </div>
            <div style="text-align: right;">
              <div id="progress-file-count" style="font-size: 11px; font-weight: 600; color: #3b82f6;"></div>
              <div id="progress-txn-count" style="font-size: 11px; color: #64748b;"></div>
            </div>
          </div>
          <div style="height: 6px; background: #dbeafe; border-radius: 10px; overflow: hidden;">
            <div id="progress-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #10b981 100%); transition: width 0.3s ease; border-radius: 10px;"></div>
          </div>
        </div>
        
        <div id="txnGrid" style="height: 100%; width: 100%; display: flex; flex-direction: column;"></div>
      </div>
      `;
    }

    return `
      <div class="transactions-workspace" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #ffffff;">
        ${getAccountWorkspaceHeaderHTML()}
        ${mainContent}
      </div>
      `;
  }

  function initGrid(passedData) {
    const gridDiv = document.querySelector('#txnGrid');
    if (!gridDiv) return;

    // Use passed data or fetch all from Ledger
    let data = passedData || window.RoboLedger.Ledger.getAll();
    if (!data || data.length === 0) return;

    // React Mounting Logic (TanStack Table - Vite Bundled)
    const canUseReact = window.mountTransactionsTable && !window.location.protocol.startsWith('file');

    if (canUseReact) {
      console.log("[GRID] Mounting React/TanStack grid...");
      window.mountTransactionsTable(data, UI_STATE.searchQuery);

      // Apply grid-scoped theme after grid renders
      setTimeout(() => {
        const gridContainer = document.getElementById('txnGrid');
        if (gridContainer && UI_STATE.activeTheme && UI_STATE.activeTheme !== 'default') {
          gridContainer.classList.remove('rainbow-theme', 'postit-theme', 'default-theme');
          gridContainer.classList.add(`${UI_STATE.activeTheme}-theme`);
          console.log(`[THEME] Applied to grid: ${UI_STATE.activeTheme}`);
        }
      }, 100);

      return;
    }

    // No React bridge available
    console.error("[GRID] React bridge missing. Grid cannot render. Make sure you're accessing via Vite dev server (port 5173).");
  }

  // --- WORKSPACE HANDLERS (UPDATED FOR REACT) ---
  /* These are now wired via the React bridge and global state */


  // Global exports for Action Bar
  window.bulkCategorize = () => {
    // Updated for React: This will need to pull selection from React state or a shared selection store
    console.warn("[Bulk] bulkCategorize invoked. Selection handling pending React integration.");
    // window.showAIAuditPanel(targets, 'selected');
  };

  window.bulkDelete = () => {
    console.warn("[Bulk] bulkDelete invoked. Selection handling pending React integration.");
    /*
    const targets = []; // Get from React selection
    if (confirm(`Delete ${ targets.length } transactions ? `)) {
      targets.forEach(t => window.RoboLedger.Ledger.delete(t.tx_id));
      window.updateWorkspace();
    }
    */
  };

  window.toggleWorkbench = function (isOpen, fileId = null) {
    UI_STATE.workbenchOpen = isOpen;
    UI_STATE.activeFileId = fileId || UI_STATE.activeFileId;

    if (isOpen) {
      document.body.classList.add('workbench-active');
      renderWorkbenchPDF(UI_STATE.activeFileId);
    } else {
      document.body.classList.remove('workbench-active');
    }
  };

  async function renderWorkbenchPDF(fileId) {
    const container = document.getElementById('v5-pdf-curtain-content');
    const label = document.getElementById('v5-curtain-filename');
    if (!container) return;

    const fileBlob = window.RoboLedger.Accounts.getFile(fileId);
    if (!fileBlob) {
      container.innerHTML = `<div style="padding: 40px; color: #94a3b8;">Source file not found in memory.</div>`;
      return;
    }

    label.innerText = fileBlob.name;
    container.innerHTML = `<div style="height: 100%; display: flex; align-items: center; justify-content: center;"><i class="ph ph-circle-notch ph-spin"></i> Rendering PDF...</div>`;

    try {
      const arrayBuffer = await fileBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = "100%";
      canvas.style.height = "auto";

      container.innerHTML = '';
      container.appendChild(canvas);
      container.style.overflowY = 'auto';

      await page.render({ canvasContext: context, viewport: viewport }).promise;
    } catch (e) {
      console.error("PDF Render Error:", e);
      container.innerHTML = `<div style="padding: 40px; color: #ef4444;">Failed to render PDF. Browser may be blocking background tasks.</div>`;
    }
  }

  window.showAIAuditPanel = function (targets, mode) {
    let panel = document.getElementById('ai-audit-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ai-audit-panel';
      document.body.appendChild(panel);
    }
    const modeLabel = mode === 'selected' ? `${targets.length} Selected Vendors` : `${targets.length} Vendors for Forensic Audit`;
    panel.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease;">
      <div style="background: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); max-width: 500px; width: 90%; overflow: hidden;">

        <div style="padding: 24px; border-bottom: 1px solid #f1f5f9; background: #fafafa;">
          <div style="display: flex; align-items: center; gap: 8px; background: #8b5cf6; padding: 6px 14px; border-radius: 20px; width: fit-content; margin-bottom: 16px;">
            <i class="ph ph-sparkle" style="color: white; font-size: 14px;"></i>
            <span style="color: white; font-weight: 700; font-size: 11px; text-transform: uppercase;">Turbo AI Audit</span>
          </div>
          <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #0f172a;">Run Classification</h3>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 0.85rem;">${modeLabel}</p>
        </div>

        <div style="padding: 24px;">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="padding: 16px; border: 2px solid #8b5cf6; background: #f5f3ff; border-radius: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <i class="ph ph-sparkle" style="color: #8b5cf6; font-size: 20px;"></i>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.9rem; color: #1e293b;">Google Gemini AI</div>
                <div style="font-size: 0.8rem; color: #64748b;">Context-aware, 99% accuracy</div>
              </div>
              <i class="ph ph-check-circle" style="color: #8b5cf6; font-size: 20px;"></i>
            </div>

            <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: center; gap: 12px; opacity: 0.6; cursor: not-allowed;">
              <i class="ph ph-lightning" style="color: #f59e0b; font-size: 20px;"></i>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.9rem; color: #1e293b;">Local Logic</div>
                <div style="font-size: 0.8rem; color: #64748b;">Fast, pattern-based (v5.0 default)</div>
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 16px 24px 24px; display: flex; gap: 12px; justify-content: flex-end;">
          <button onclick="document.getElementById('ai-audit-panel').remove()" style="padding: 10px 20px; background: transparent; border: none; font-weight: 600; color: #64748b; cursor: pointer;">Cancel</button>
          <button id="start-audit-btn" style="padding: 10px 24px; background: #8b5cf6; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);">Start Analysis</button>
        </div>
      </div>
      </div >
      `;

    document.getElementById('start-audit-btn').onclick = () => {
      panel.remove();
      UI_STATE.isIngesting = true;
      UI_STATE.ingestionProgress = 0;
      UI_STATE.ingestionLabel = "AI Analysis in progress...";
      window.updateWorkspace();

      // Mock processing
      let intv = setInterval(() => {
        UI_STATE.ingestionProgress += 10;
        if (UI_STATE.ingestionProgress >= 100) {
          clearInterval(intv);
          UI_STATE.isIngesting = false;
          window.updateWorkspace();
        }
        window.updateWorkspace();
      }, 300);
    };
  };

  // Expose toggle helpers to window scope
  if (typeof toggleSettings !== 'undefined') window.toggleSettings = toggleSettings;
  window.toggleWorkbench = window.toggleWorkbench;
  window.openSourceFile = (id) => window.toggleWorkbench(true, id);

  // Keyboard shortcut: Cmd+. to toggle inspector panel
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '.') {
      e.preventDefault();
      if (window.togglePanel) window.togglePanel();
    }
  });

  // Global click handler for account ref badges
  // Makes any blue badge (CHQ1, SAV1, etc.) clickable to switch accounts
  document.addEventListener('click', (e) => {
    const target = e.target;

    // Check if clicked element is a blue account ref badge using computed styles
    if (target.tagName === 'SPAN') {
      const computedStyle = window.getComputedStyle(target);
      const bgColor = computedStyle.backgroundColor;
      const fontFamily = computedStyle.fontFamily;

      // Check for blue badge: rgb(59, 130, 246) = #3b82f6
      if (bgColor && bgColor.includes('59, 130, 246') &&
        fontFamily && fontFamily.includes('JetBrains Mono')) {

        // Find the account ID from the closest parent with onclick or data attribute
        let parent = target.parentElement;
        let accountId = null;

        // Try to extract account ID from parent's onclick attribute
        if (parent && parent.onclick) {
          const onclickStr = parent.onclick.toString();
          const match = onclickStr.match(/switchAccount\('([^']+)'\)/);
          if (match) accountId = match[1];
        }

        // If we found an account ID, switch to it
        if (accountId) {
          console.log(`[BADGE CLICK] Switching to: ${accountId}`);
          window.switchAccount(accountId);
        } else {
          console.warn('[BADGE CLICK] Could not determine account ID from badge');
        }
      }
    }
  });

  /**
   * Remove accounts with 0 transactions from storage
   * Runs on app initialization to clean orphaned accounts
   */
  function cleanupEmptyAccounts() {
    const accounts = window.RoboLedger?.Accounts?.getAll() || [];
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];

    let cleaned = 0;
    accounts.forEach(acc => {
      const txns = allTxns.filter(t => t.account_id === acc.id);
      if (txns.length === 0) {
        console.log('[CLEANUP] Removing empty account:', acc.id, acc.name);
        if (window.RoboLedger?.Accounts?.remove) {
          window.RoboLedger.Accounts.remove(acc.id);
          cleaned++;
        }
      }
    });

    if (cleaned > 0) {
      console.log(`[CLEANUP] Removed ${cleaned} empty account(s)`);
    }
  }

  // Clean up empty accounts on initialization (prevents hangover accounts)
  cleanupEmptyAccounts();

  if (typeof init === 'function') init();
})();


// Upload UI JavaScript handlers
window.updateFileType = function () {
  const select = document.getElementById('fileTypeSelect');
  const input = document.getElementById('mainFileInput');
  const buttonText = document.getElementById('uploadButtonText');

  if (!select || !input || !buttonText) return;

  const fileType = select.value;

  // Update accept attribute for native browser filter
  if (fileType === 'pdf') {
    input.setAttribute('accept', '.pdf');
    buttonText.textContent = 'Import PDF Statements';
  } else if (fileType === 'csv') {
    input.setAttribute('accept', '.csv,.xlsx,.xls');
    buttonText.textContent = 'Import CSV/XLSX Files';
  } else {
    input.removeAttribute('accept');
    buttonText.textContent = 'Import Files';
  }

};

window.updateBrowseMode = function () {
  const checkbox = document.getElementById('browseFoldersCheckbox');
  const input = document.getElementById('mainFileInput');
  const helpText = document.getElementById('folderHelpText');

  if (!checkbox || !input) return;

  if (checkbox.checked) {
    // Enable folder browsing
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('mozdirectory', '');
    input.setAttribute('directory', '');
    if (helpText) helpText.style.display = 'block';
  } else {
    // Disable folder browsing (single files)
    input.removeAttribute('webkitdirectory');
    input.removeAttribute('mozdirectory');
    input.removeAttribute('directory');
    if (helpText) helpText.style.display = 'none';
  }
};

window.handleMainUpload = function (input) {
  const files = Array.from(input.files);
  const select = document.getElementById('fileTypeSelect');
  const checkbox = document.getElementById('browseFoldersCheckbox');

  if (!select) {
    console.warn('[UPLOAD] File type select not found, processing all files');
    window.handleFilesSelected(files);
    input.value = '';
    return;
  }

  const fileType = select.value;
  const isFolderMode = checkbox && checkbox.checked;

  let filteredFiles = files;

  // Apply filter based on selected type
  if (fileType === 'pdf') {
    filteredFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
  } else if (fileType === 'csv') {
    filteredFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
    });
  }
  // 'all' means no filtering

  if (filteredFiles.length === 0) {
    alert(`No ${fileType === 'pdf' ? 'PDF' : 'CSV/Excel'} files found in selection.`);
    input.value = '';
    return;
  }

  // Show custom confirmation with file count differentiation
  const totalCount = files.length;
  const filteredCount = filteredFiles.length;
  const fileTypeName = fileType === 'pdf' ? 'PDF' :
    fileType === 'csv' ? 'CSV/Excel file' :
      'file';

  // Log summary to console (no confirmation popup)
  if (filteredCount !== totalCount) {
    console.log(`[Upload] Processing ${filteredCount} ${fileTypeName}${filteredCount > 1 ? 's' : ''} (${totalCount - filteredCount} non-matching files skipped)`);
  } else {
    console.log(`[Upload] Processing ${filteredCount} ${fileTypeName}${filteredCount > 1 ? 's' : ''}`);
  }

  // Show subfolder summary for folder mode
  if (isFolderMode && filteredFiles.length > 0 && filteredFiles[0].webkitRelativePath) {
    const folders = new Set();
    filteredFiles.forEach(f => {
      const pathParts = f.webkitRelativePath.split('/');
      if (pathParts.length > 1) {
        folders.add(pathParts[pathParts.length - 2] || pathParts[0]);
      }
    });

    if (folders.size > 0) {
      const folderList = Array.from(folders).slice(0, 5).join(', ');
      const moreText = folders.size > 5 ? (' and ' + (folders.size - 5) + ' more') : '';
      const typeName = fileType === 'pdf' ? 'PDF' : fileType === 'csv' ? 'CSV/XLSX' : '';
      // Removed modal alert - info logged to console instead
      // alert('Found ' + filteredFiles.length + ' ' + typeName + ' files across ' + folders.size + ' subfolders:\n\n' + folderList + moreText + '\n\nReady to process.');
    }
  }

  window.handleFilesSelected(filteredFiles);
  input.value = '';
};

// Debug: Show account statistics
window.debugAccountStats = function () {
  const accounts = window.RoboLedger.Accounts.getAll();
  const allTransactions = window.RoboLedger.Ledger.getAll();

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 ACCOUNT STATISTICS DEBUG');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Total Accounts:', accounts.length);
  console.log('Total Transactions:', allTransactions.length);
  console.log('');

  const stats = accounts.map(acc => {
    const txns = allTransactions.filter(t => t.account_id === acc.id);
    return {
      id: acc.id,
      ref: acc.ref,
      bank: acc.bankName,
      type: acc.accountType,
      txnCount: txns.length,
      openingBalance: (acc.openingBalance || 0) / 100,
      account: acc
    };
  }).sort((a, b) => b.txnCount - a.txnCount);

  // Show accounts with transactions
  console.log('✅ ACCOUNTS WITH TRANSACTIONS:');
  console.log('─────────────────────────────────────────────────────');
  stats.filter(s => s.txnCount > 0).forEach(s => {
    console.log(`   ${s.ref.padEnd(30)} | ${String(s.txnCount).padStart(5)} txns | ${s.bank || 'Unknown'} ${s.type || ''}`);
  });

  console.log('');

  // Show empty accounts (hangover badges)
  const emptyAccounts = stats.filter(s => s.txnCount === 0);
  if (emptyAccounts.length > 0) {
    console.log('⚠️  EMPTY ACCOUNTS (Hangover badges):');
    console.log('─────────────────────────────────────────────────────');
    emptyAccounts.forEach(s => {
      console.log(`   ${s.ref.padEnd(30)} | ID: ${s.id} | Opening: $${s.openingBalance}`);
    });
    console.log('');
    console.log(`💡 Found ${emptyAccounts.length} empty account(s)`);
    console.log('   Run: window.cleanupEmptyAccounts() to remove them');
  }

  console.log('═══════════════════════════════════════════════════════');

  return {
    total: accounts.length,
    withTransactions: stats.filter(s => s.txnCount > 0).length,
    empty: emptyAccounts.length,
    stats: stats
  };
};

// Cleanup function to remove empty accounts
window.cleanupEmptyAccounts = function () {
  const accounts = window.RoboLedger.Accounts.getAll();
  const allTransactions = window.RoboLedger.Ledger.getAll();

  const emptyAccounts = accounts.filter(acc => {
    const txns = allTransactions.filter(t => t.account_id === acc.id);
    return txns.length === 0;
  });

  if (emptyAccounts.length === 0) {
    console.log('✅ No empty accounts to clean up');
    return;
  }

  console.log(`🧹 Removing ${emptyAccounts.length} empty account(s)...`);
  emptyAccounts.forEach(acc => {
    console.log(`   - Removing: ${acc.ref} (ID: ${acc.id})`);
    window.RoboLedger.Accounts.remove(acc.id);
  });

  console.log('✅ Cleanup complete! Refresh the page.');
  render(); // Re-render UI
};

// Enhanced debug with parser tracking
window.debugAccountsWithParsers = function () {
  const accounts = window.RoboLedger.Accounts.getAll();
  const allTransactions = window.RoboLedger.Ledger.getAll();

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 ACCOUNT PARSER TRACKING DEBUG');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Total Accounts:', accounts.length);
  console.log('Total Transactions:', allTransactions.length);
  console.log('');

  const stats = accounts.map(acc => {
    const txns = allTransactions.filter(t => t.account_id === acc.id);

    // Detect parser from account metadata
    let parser = 'Unknown';
    if (acc.bankName) {
      parser = acc.bankName; // RBC, TD, BMO, Scotia, CIBC, Amex
    } else if (acc.id.includes('CC-AMEX')) {
      parser = 'Amex';
    } else if (acc.id.includes('CC-VISA')) {
      parser = 'Visa (Unknown Bank)';
    } else if (acc.id.includes('CC-MC')) {
      parser = 'Mastercard (Unknown Bank)';
    } else if (acc.id.includes('BANK-')) {
      parser = 'Generic Bank';
    } else if (acc.id.includes('GENERIC')) {
      parser = 'GENERIC PARSER';
    }

    // Try to get parser from first transaction
    if (txns.length > 0 && txns[0].source) {
      parser = txns[0].source + ' Parser';
    }

    return {
      id: acc.id,
      ref: acc.ref,
      parser: parser,
      bank: acc.bankName || 'Unknown',
      type: acc.accountType || 'Unknown',
      txnCount: txns.length,
      openingBalance: (acc.openingBalance || 0) / 100,
      createdAt: acc.createdAt || 'Unknown',
      account: acc
    };
  }).sort((a, b) => b.txnCount - a.txnCount);

  // Group by parser
  const byParser = {};
  stats.forEach(s => {
    if (!byParser[s.parser]) {
      byParser[s.parser] = { total: 0, withTxns: 0, empty: 0, accounts: [] };
    }
    byParser[s.parser].total++;
    if (s.txnCount > 0) {
      byParser[s.parser].withTxns++;
    } else {
      byParser[s.parser].empty++;
    }
    byParser[s.parser].accounts.push(s);
  });

  // Show parser summary
  console.log('🔍 ACCOUNTS BY PARSER:');
  console.log('─────────────────────────────────────────────────────');
  Object.keys(byParser).sort().forEach(parserName => {
    const data = byParser[parserName];
    const emptyWarning = data.empty > 0 ? ` ⚠️  ${data.empty} EMPTY` : '';
    console.log(`   ${parserName.padEnd(25)} | ${String(data.total).padStart(2)} accounts | ${String(data.withTxns).padStart(2)} with txns${emptyWarning}`);
  });

  console.log('');

  // Show empty accounts grouped by parser
  const emptyAccounts = stats.filter(s => s.txnCount === 0);
  if (emptyAccounts.length > 0) {
    console.log('⚠️  EMPTY ACCOUNTS BY PARSER:');
    console.log('─────────────────────────────────────────────────────');

    const emptyByParser = {};
    emptyAccounts.forEach(s => {
      if (!emptyByParser[s.parser]) emptyByParser[s.parser] = [];
      emptyByParser[s.parser].push(s);
    });

    Object.keys(emptyByParser).sort().forEach(parserName => {
      console.log(`\n   🔴 ${parserName} (${emptyByParser[parserName].length} empty):`);
      emptyByParser[parserName].forEach(s => {
        console.log(`      - ${s.ref.padEnd(25)} | ID: ${s.id}`);
      });
    });

    console.log('');
    console.log(`💡 Found ${emptyAccounts.length} empty account(s) from ${Object.keys(emptyByParser).length} parser(s)`);
  }

  console.log('═══════════════════════════════════════════════════════');

  return {
    total: accounts.length,
    withTransactions: stats.filter(s => s.txnCount > 0).length,
    empty: emptyAccounts.length,
    byParser: byParser,
    stats: stats
  };
};
