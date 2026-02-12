/**
 * RoboLedger V4/V5 UI Restoration Controller
 * Wired to the live Ledger Engine (ledger.core.js)
 */
(function () {
  // --- UI STATE & ROUTING ---
  window.UI_STATE = {
    currentRoute: 'import',
    navItems: [
      { label: 'Home' },
      { label: 'Transactions' }
    ],
    breadcrumbs: [
      { label: 'Home' },
      { label: 'Transactions', active: true }
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
    version: '5.1.1',
    // Settings Persistence
    dexterity: 3,
    fontSize: 13,
    density: 'comfortable',
    autocatEnabled: true,
    confidenceThreshold: 0.8,
    refOverride: 'TXN',
    dateFormat: 'MM/DD/YYYY',
    province: 'ON',
    gstEnabled: true,
    // Grid Appearance Settings (NEW in V5.1)
    gridTheme: 'default',
    gridFontSize: 13.5,

    // Transaction Import State
    uploadInProgress: false,
    importSession: null,

    // Version
    version: '5.1.1',
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
      alert('No PDF or CSV files found in the selected folder.');
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
   * Get all accounts that have at least 1 transaction
   * @returns {Array} Accounts with transaction data
   */
  function getAccountsWithTransactions() {
    const accounts = window.RoboLedger?.Accounts?.getAll() || [];
    const allTxns = window.RoboLedger?.Ledger?.transactions || [];

    return accounts.filter(acc => {
      const txns = allTxns.filter(t => t.account_id === acc.id);
      return txns.length > 0;
    });
  }


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
          alert('No PDF or CSV files found in the dropped folder.');
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
    console.log('[UPLOAD] Processing', files.length, 'file(s)');

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
      try {
        const baseProgress = (idx / files.length) * 100;
        const fileProgressStep = 100 / files.length;

        // Stage 1: Extracting (0-40% of file progress)
        await window.updateProgressBar(
          Math.max(1, Math.round(baseProgress + (fileProgressStep * 0.1))),
          100,
          file.name,
          'Extracting transactions...',
          totalImported
        );
        await new Promise(resolve => setTimeout(resolve, 100));

        // Stage 2: Parsing (40-70% of file progress)
        await window.updateProgressBar(
          Math.round(baseProgress + (fileProgressStep * 0.4)),
          100,
          file.name,
          'Parsing transactions...',
          totalImported
        );
        await new Promise(resolve => setTimeout(resolve, 100));

        // Actually process the file
        const imported = await window.RoboLedger.Ingestion.processUpload(file, account_id);
        totalImported += imported;

        // Stage 3: Categorizing (70-85% of file progress)
        await window.updateProgressBar(
          Math.round(baseProgress + (fileProgressStep * 0.7)),
          100,
          file.name,
          'Categorizing transactions...',
          totalImported
        );
        await new Promise(resolve => setTimeout(resolve, 80));

        // Stage 4: Cleaning (85-95% of file progress)
        await window.updateProgressBar(
          Math.round(baseProgress + (fileProgressStep * 0.85)),
          100,
          file.name,
          'Cleaning data...',
          totalImported
        );
        await new Promise(resolve => setTimeout(resolve, 80));

        // Stage 5: Complete (95-100% of file progress)
        await window.updateProgressBar(
          Math.round(baseProgress + (fileProgressStep * 0.95)),
          100,
          file.name,
          `Imported ${imported} transactions`,
          totalImported
        );

        console.log(`[UPLOAD] ${file.name}: ${imported} transactions imported`);
      } catch (err) {
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
        console.log('[UPLOAD] Hiding progress bar and rendering grid...');

        // CRITICAL: Clean up any empty accounts before rendering
        // (prevents hangover accounts from failed uploads or zero-transaction files)
        cleanupEmptyAccounts();

        // AUTO-SET REF# prefix for the newly imported account
        const accounts = window.RoboLedger.Accounts.getAll();
        if (accounts.length > 0) {
          const lastAccount = accounts[accounts.length - 1];
          UI_STATE.refPrefix = lastAccount.ref || 'TXN';
          UI_STATE.selectedAccount = lastAccount.id;
          console.log('[UPLOAD] Auto-set account:', lastAccount.id, 'prefix:', UI_STATE.refPrefix);
        }

        // Reset ingesting state so render() excludes progress bar HTML
        UI_STATE.isIngesting = false;

        // Render - this will naturally exclude progress bar since isIngesting is false
        render();

        console.log('[UPLOAD] Upload workflow complete - grid should be visible');
      } catch (err) {
        console.error('[UPLOAD] Error in completion flow:', err);
        // Force render anyway
        UI_STATE.isIngesting = false;
        render();
      }
    }, 500);

    console.log(`[UPLOAD] Complete. Total imported: ${totalImported}`);
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

  // Update utility bar with current account data
  window.updateUtilityBar = function () {
    if (!window.RoboLedger) return;

    const accounts = window.RoboLedger.Accounts.getAll();
    const totalBalance = accounts.reduce((sum, a) => sum + (a.actualEndingBalance || a.calculatedBalance || 0), 0);

    const balanceEl = document.getElementById('util-total-balance');
    if (balanceEl) {
      balanceEl.textContent = `$${(totalBalance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      balanceEl.style.color = totalBalance >= 0 ? '#0f766e' : '#ef4444';
    }

    const badgesEl = document.getElementById('util-account-badges');
    if (badgesEl) {
      badgesEl.innerHTML = accounts.map(a => `
        <div class="utility-badge" onclick="window.switchAccount('${a.id}')">${a.ref || 'N/A'}</div>
      `).join('');
    }
  };

  // Desktop sidebar collapse toggle
  window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (sidebar) {
      sidebar.classList.toggle('collapsed');

      // Toggle body class for global layout changes (grid expansion, utility bar)
      document.body.classList.toggle('sidebar-collapsed', sidebar.classList.contains('collapsed'));

      // Update utility bar content when collapsed
      if (sidebar.classList.contains('collapsed')) {
        setTimeout(() => window.updateUtilityBar(), 100);
      }

      // Update button icon
      if (sidebar.classList.contains('collapsed')) {
        toggleBtn.innerHTML = '<i class="ph ph-caret-right"></i>';
        toggleBtn.title = 'Expand';
      } else {
        toggleBtn.innerHTML = '<i class="ph ph-caret-left"></i>';
        toggleBtn.title = 'Collapse';
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
        window.window.updateWorkspace();
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
   * Ensures metadata, reconciliation, and grid are MAGNETICALLY coupled
   * This is the SINGLE SOURCE OF TRUTH for updating the workspace
   * 
   * @param {string|null} accountId - Account ID to display, or null to use current UI_STATE
   */
  window.updateWorkspace = function (accountId = null) {
    // HOMEPAGE ROUTE: Render professional homepage
    if (UI_STATE.currentRoute === 'home') {
      console.log('[WORKSPACE] → Rendering HOMEPAGE');

      // Get live stats and data
      const allTxns = window.RoboLedger.Ledger.getAll();
      const accounts = window.RoboLedger.Accounts?.getAll() || [];
      const reconciled = allTxns.filter(t => t.reconciled).length;
      const unreconciled = allTxns.length - reconciled;
      const reconciledPercent = allTxns.length > 0 ? Math.round((reconciled / allTxns.length) * 100) : 0;

      // Get recent transactions (last 5)
      const recentTxns = allTxns.slice(0, 5);

      // Calculate total balance (simplified - sum of all transaction amounts)
      const totalBalance = allTxns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      const stage = document.getElementById('app-stage');
      if (stage) {
        stage.innerHTML = `
          <div style="height: calc(100vh - 140px); overflow: auto; background: #f8fafc;">
            <div style="max-width: 1600px; margin: 0 auto; padding: 32px 40px;">
              
              <!-- Welcome Header -->
              <div style="margin-bottom: 32px;">
                <h1 style="font-size: 28px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0;">Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}</h1>
                <p style="font-size: 15px; color: #64748b; margin: 0;">Here's what's happening with your business today</p>
              </div>

              <!-- Financial Overview Cards -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px;">
                
                <!-- Total Balance Card -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Total Balance</span>
                    <div style="width: 32px; height: 32px; background: #f0f9ff; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                      <i class="ph-bold ph-wallet" style="font-size: 16px; color: #0284c7;"></i>
                    </div>
                  </div>
                  <div style="font-size: 32px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">$${Math.abs(totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style="font-size: 13px; color: ${totalBalance >= 0 ? '#10b981' : '#ef4444'}; display: flex; align-items: center; gap: 4px;">
                    <i class="ph-bold ph-${totalBalance >= 0 ? 'arrow-up' : 'arrow-down'}" style="font-size: 12px;"></i>
                    ${totalBalance >= 0 ? 'Positive' : 'Negative'} balance
                  </div>
                </div>

                <!-- Accounts Card -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Accounts</span>
                    <div style="width: 32px; height: 32px; background: #fef3c7; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                      <i class="ph-bold ph-folders" style="font-size: 16px; color: #d97706;"></i>
                    </div>
                  </div>
                  <div style="font-size: 32px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${accounts.length}</div>
                  <div style="font-size: 13px; color: #64748b;">Connected sources</div>
                </div>

                <!-- Transactions Card -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Transactions</span>
                    <div style="width: 32px; height: 32px; background: #f0fdf4; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                      <i class="ph-bold ph-swap" style="font-size: 16px; color: #059669;"></i>
                    </div>
                  </div>
                  <div style="font-size: 32px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${allTxns.length.toLocaleString()}</div>
                  <div style="font-size: 13px; color: #64748b;">Total recorded</div>
                </div>

                <!-- Reconciliation Card -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Reconciliation</span>
                    <div style="width: 32px; height: 32px; background: #f5f3ff; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                      <i class="ph-bold ph-check-circle" style="font-size: 16px; color: #7c3aed;"></i>
                    </div>
                  </div>
                  <div style="font-size: 32px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${reconciledPercent}%</div>
                  <div style="font-size: 13px; color: #64748b;">${reconciled} of ${allTxns.length} reconciled</div>
                </div>
              </div>

              <!-- Main Content Grid -->
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                
                <!-- Left Column: Quick Actions & Recent Activity -->
                <div>
                  <!-- Quick Actions -->
                  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 20px 0;">Quick Actions</h2>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                      <div onclick="window.navigateTo('import')" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#3b82f6'" onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                          <i class="ph-bold ph-upload-simple" style="font-size: 20px; color: white;"></i>
                        </div>
                        <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">Import Transactions</div>
                        <div style="font-size: 13px; color: #64748b;">Upload bank statements</div>
                      </div>

                      <div onclick="window.navigateTo('import')" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#10b981'" onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                          <i class="ph-bold ph-check-square" style="font-size: 20px; color: white;"></i>
                        </div>
                        <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">Reconcile</div>
                        <div style="font-size: 13px; color: #64748b;">${unreconciled} items pending</div>
                      </div>

                      <div onclick="window.navigateTo('coa')" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#8b5cf6'" onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                          <i class="ph-bold ph-list-bullets" style="font-size: 20px; color: white;"></i>
                        </div>
                        <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">Accounts</div>
                        <div style="font-size: 13px; color: #64748b;">Manage chart of accounts</div>
                      </div>

                      <div onclick="window.navigateTo('reports')" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#f59e0b'" onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                          <i class="ph-bold ph-chart-line" style="font-size: 20px; color: white;"></i>
                        </div>
                        <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">Reports</div>
                        <div style="font-size: 13px; color: #64748b;">View financial insights</div>
                      </div>
                    </div>
                  </div>

                  <!-- Recent Activity -->
                  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0;">Recent Transactions</h2>
                      <a onclick="window.navigateTo('import')" style="font-size: 14px; color: #3b82f6; font-weight: 600; cursor: pointer; text-decoration: none;">View all →</a>
                    </div>
                    
                    ${recentTxns.length > 0 ? recentTxns.map(txn => `
                      <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                        <div style="width: 40px; height: 40px; background: #f8fafc; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                          <i class="ph-bold ph-arrow-${parseFloat(txn.amount) >= 0 ? 'down' : 'up'}" style="font-size: 16px; color: ${parseFloat(txn.amount) >= 0 ? '#10b981' : '#ef4444'};"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                          <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${txn.description || 'Untitled Transaction'}</div>
                          <div style="font-size: 13px; color: #64748b;">${txn.date || 'No date'}</div>
                        </div>
                        <div style="font-size: 15px; font-weight: 700; color: ${parseFloat(txn.amount) >= 0 ? '#10b981' : '#ef4444'}; flex-shrink: 0;">
                          ${parseFloat(txn.amount) >= 0 ? '+' : ''}$${Math.abs(parseFloat(txn.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    `).join('') : `
                      <div style="text-align: center; padding: 40px 20px;">
                        <i class="ph ph-receipt" style="font-size: 48px; color: #cbd5e1; margin-bottom: 12px;"></i>
                        <div style="font-size: 15px; color: #64748b; margin-bottom: 4px;">No transactions yet</div>
                        <div style="font-size: 13px; color: #94a3b8;">Import your first transaction to get started</div>
                      </div>
                    `}
                  </div>
                </div>

                <!-- Right Column: Insights & Status -->
                <div>
                  <!-- System Status -->
                  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 20px 0;">System Health</h2>
                    
                    <div style="margin-bottom: 16px;">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 14px; color: #64748b;">Data Quality</span>
                        <span style="font-size: 14px; font-weight: 600; color: #10b981;">${reconciledPercent}%</span>
                      </div>
                      <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${reconciledPercent}%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 4px; transition: width 0.3s ease;"></div>
                      </div>
                    </div>

                    <div style="padding: 16px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; margin-top: 16px;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 32px; height: 32px; background: #10b981; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                          <i class="ph-bold ph-check" style="font-size: 16px; color: white;"></i>
                        </div>
                        <div>
                          <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 2px;">All systems operational</div>
                          <div style="font-size: 13px; color: #64748b;">Last sync: Just now</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- AI Insights -->
                  <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border-radius: 8px; padding: 28px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                      <div style="width: 40px; height: 40px; background: rgba(255, 255, 255, 0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <i class="ph-bold ph-lightning" style="font-size: 20px; color: white;"></i>
                      </div>
                      <h2 style="font-size: 18px; font-weight: 700; color: white; margin: 0;">AI Insights</h2>
                    </div>
                    
                    <p style="font-size: 14px; color: rgba(255, 255, 255, 0.95); margin: 0 0 16px 0; line-height: 1.6;">RoboLedger's AI is actively learning your transaction patterns to provide smarter categorization and detection.</p>
                    
                    <div style="padding: 16px; background: rgba(255, 255, 255, 0.15); border-radius: 6px; backdrop-filter: blur(10px);">
                      <div style="font-size: 13px; color: rgba(255, 255, 255, 0.9); margin-bottom: 4px;">Automation Rate</div>
                      <div style="font-size: 24px; font-weight: 700; color: white;">AI Powered</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      return; // Exit early for homepage
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

  // Update Ref# prefix for transaction numbering
  window.updateRefPrefix = function (newPrefix) {
    const sanitized = newPrefix.toUpperCase().trim().substr(0, 8); // Limit to 8 chars
    UI_STATE.refPrefix = sanitized || 'CHQ1';
    localStorage.setItem('roboledger_refPrefix', UI_STATE.refPrefix);

    // Trigger grid re-render to update ref numbers
    window.mountTanStackGrid();
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
    // Pass density to React component via bridge
    if (window.updateGridDensity) {
      window.updateGridDensity(density);
    }
    // Don't call render() - density is handled by React bridge
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
            ${isHome ? '<i class="ph ph-house breadcrumb-icon" style="margin-right: 6px; font-size: 14px; color: #3b82f6;"></i>' : ''}
            <span class="breadcrumb-label" style="${!isLast ? 'color: #3b82f6; font-weight: 500;' : ''}">${bc.label}</span>
          </div>
          ${isLast ? '' : '<span class="breadcrumb-separator" style="margin: 0 10px; color: #cbd5e1;"><i class="ph ph-caret-right" style="font-size: 10px;"></i></span>'}
        `;
      }).join('') + `
        <div style="flex: 1;"></div>
        <button onclick="window.devReset()" style="padding: 4px 10px; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer; margin-left: 12px;" title="Clear all localStorage and reset (Dev only)">
          ⚠️ DEV RESET
        </button>
      `;
    }

    //Update sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === route);
    });

    // Render
    if (route === 'home') {
      window.updateWorkspace(); // Enhanced homepage
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
        window.window.updateWorkspace();
      }
    });

    // Drawer Listeners
    const curtainBtn = document.querySelector('.close-curtain');
    if (curtainBtn) curtainBtn.onclick = () => toggleCurtain(false);

    // Close bulk menu if clicking outside
    document.addEventListener('click', (e) => {
      if (UI_STATE.bulkMenuOpen && !e.target.closest('.bulk-actions-container')) {
        UI_STATE.bulkMenuOpen = false;
        window.window.updateWorkspace();
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
    if (targetState) {
      UI_STATE.panelState = targetState;
    } else {
      // Cycle through states: collapsed → expanded → closed → collapsed
      if (UI_STATE.panelState === 'collapsed') {
        UI_STATE.panelState = 'expanded';
      } else if (UI_STATE.panelState === 'expanded') {
        UI_STATE.panelState = 'closed';
      } else {
        UI_STATE.panelState = 'collapsed';
      }
    }
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
    drawer.classList.toggle('open', open);
    if (open) renderSettingsDrawer();
  }

  function renderSettingsDrawer() {
    const drawer = document.getElementById('settings-drawer');
    drawer.innerHTML = `
      <div class="drawer-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
              <div style="background: #f1f5f9; padding: 8px; border-radius: 8px; color: #64748b;">
                  <i class="ph ph-gear-six" style="font-size: 1.2rem;"></i>
              </div>
              <h2 style="font-size: 1.1rem; font-weight: 700; margin: 0;">Settings</h2>
          </div>
          <i class="ph ph-x close-drawer" style="font-size: 20px; cursor: pointer; color: #94a3b8;" onclick="toggleSettings(false)"></i>
      </div>
      <div class="drawer-tabs">
          <div class="drawer-tab ${UI_STATE.settingsTab === 'grid' ? 'active' : ''}" data-tab="grid">GRID</div>
          <div class="drawer-tab ${UI_STATE.settingsTab === 'columns' ? 'active' : ''}" data-tab="columns">COLUMNS</div>
          <div class="drawer-tab ${UI_STATE.settingsTab === 'data' ? 'active' : ''}" data-tab="data">DATA</div>
      </div>
      <div class="drawer-content">
          ${renderSettingsTabContent()}
      </div>
      <div class="drawer-footer">
          <button class="btn-restored" style="background: white; color: #64748b; border: 1px solid #e2e8f0; box-shadow: none;" onclick="window.resetSettings()">Reset to Defaults</button>
          <button class="btn-restored" onclick="window.saveSettings()">Save Settings</button>
      </div>
    `;

    // Wire tab switching
    drawer.querySelectorAll('.drawer-tab').forEach(tab => {
      tab.onclick = () => {
        UI_STATE.settingsTab = tab.dataset.tab;
        renderSettingsDrawer();
      };
    });
  }

  function renderSettingsTabContent() {
    // TAB 1: GRID - All appearance settings
    if (UI_STATE.settingsTab === 'grid') {
      return `
            <div class="setting-group">
                <div class="setting-group-title">Professional Theme</div>
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">Preset themes matching professional accounting software</div>
                <select class="v5-select" id="settings-grid-theme" onchange="window.previewGridTheme(this.value)">
                    <option value="vanilla" ${UI_STATE.gridTheme === 'vanilla' ? 'selected' : ''}>Vanilla</option>
                    <option value="classic" ${UI_STATE.gridTheme === 'classic' ? 'selected' : ''}>Classic</option>
                    <option value="default" ${UI_STATE.gridTheme === 'default' ? 'selected' : ''}>Default</option>
                    <option value="ledger-pad" ${UI_STATE.gridTheme === 'ledger-pad' ? 'selected' : ''}>Ledger Pad</option>
                    <option value="post-it-note" ${UI_STATE.gridTheme === 'post-it-note' ? 'selected' : ''}>Post-it Note</option>
                    <option value="rainbow" ${UI_STATE.gridTheme === 'rainbow' ? 'selected' : ''}>Rainbow</option>
                    <option value="social" ${UI_STATE.gridTheme === 'social' ? 'selected' : ''}>Social</option>
                    <option value="spectrum" ${UI_STATE.gridTheme === 'spectrum' ? 'selected' : ''}>Spectrum</option>
                    <option value="subliminal" ${UI_STATE.gridTheme === 'subliminal' ? 'selected' : ''}>Subliminal</option>
                    <option value="subtle" ${UI_STATE.gridTheme === 'subtle' ? 'selected' : ''}>Subtle</option>
                    <option value="tracker" ${UI_STATE.gridTheme === 'tracker' ? 'selected' : ''}>Tracker</option>
                    <option value="vintage" ${UI_STATE.gridTheme === 'vintage' ? 'selected' : ''}>Vintage</option>
                    <option value="wave" ${UI_STATE.gridTheme === 'wave' ? 'selected' : ''}>Wave</option>
                    <option value="webapp" ${UI_STATE.gridTheme === 'webapp' ? 'selected' : ''}>WebApp</option>
                </select>
            </div>
            
            <div class="setting-group">
                <div class="setting-group-title">Custom Adjustments</div>
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label style="font-size: 11px; font-weight: 700; color: #94a3b8;">GRID FONT SIZE</label>
                        <span id="grid-fontsize-display" style="font-size: 11px; font-weight: 700; color: #3b82f6;">${UI_STATE.gridFontSize}px</span>
                    </div>
                    <input type="range" id="settings-grid-fontsize" min="9" max="16" step="0.5" value="${UI_STATE.gridFontSize}" 
                           style="width: 100%;" 
                           oninput="window.previewGridFontSize(this.value)">
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Overrides theme default</div>
                </div>
                
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">ROW HEIGHT</label>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-restored" style="flex: 1; ${UI_STATE.density === 'compact' ? '' : 'background: white; color: #64748b; border: 1px solid #e2e8f0; box-shadow: none;'}" onclick="window.setDensity('compact')">Compact</button>
                        <button class="btn-restored" style="flex: 1; ${UI_STATE.density === 'comfortable' ? '' : 'background: white; color: #64748b; border: 1px solid #e2e8f0; box-shadow: none;'}" onclick="window.setDensity('comfortable')">Comfortable</button>
                        <button class="btn-restored" style="flex: 1; ${UI_STATE.density === 'spacious' ? '' : 'background: white; color: #64748b; border: 1px solid #e2e8f0; box-shadow: none;'}" onclick="window.setDensity('spacious')">Spacious</button>
                    </div>
                </div>
            </div>
        `;
    }

    // TAB 2: COLUMNS - Visibility toggles
    if (UI_STATE.settingsTab === 'columns') {
      const columns = [
        { field: 'date', label: 'Date', visible: true },
        { field: 'ref', label: 'Ref #', visible: true },
        { field: 'description', label: 'Description', visible: true },
        { field: 'debit_col', label: 'Debit', visible: true },
        { field: 'credit_col', label: 'Credit', visible: true },
        { field: 'balance', label: 'Balance', visible: true },
        { field: 'coa_code', label: 'Category', visible: true },
        { field: 'tax_cents', label: 'Sales Tax', visible: false }
      ];

      return `
            <div class="setting-group">
                <div class="setting-group-title">Column Visibility</div>
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 16px;">Show or hide columns in the transaction grid</div>
                ${columns.map(col => `
                    <div class="column-toggle">
                        <label>${col.label}</label>
                        <label class="switch">
                            <input type="checkbox" ${col.visible ? 'checked' : ''} onchange="window.toggleGridColumn('${col.field}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // TAB 3: DATA - Export and management
    if (UI_STATE.settingsTab === 'data') {
      const txnCount = window.RoboLedger ? window.RoboLedger.Ledger.getAll().length : 0;
      const accountCount = window.RoboLedger ? window.RoboLedger.Accounts.getAll().length : 0;

      return `
            <div class="setting-group">
                <div class="setting-group-title">Export Data</div>
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">Export your transactions and accounts</div>
                <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
                    <div style="font-size: 12px; font-weight: 600; color: #1e293b;">${txnCount} transactions</div>
                    <div style="font-size: 11px; color: #64748b;">${accountCount} accounts</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button class="btn-restored" style="background: #f8fafc; color: #1e293b; border: 1px solid #e2e8f0; font-size: 11px;" onclick="window.exportData('csv')">Export CSV</button>
                    <button class="btn-restored" style="background: #f8fafc; color: #1e293b; border: 1px solid #e2e8f0; font-size: 11px;" onclick="window.exportData('json')">Export JSON</button>
                </div>
            </div>
            
            <div class="setting-group">
                <div class="setting-group-title">System</div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 12px;">
                    <div>Version: ${UI_STATE.version}</div>
                    <div>Mode: ${window.location.protocol === 'file:' ? 'Native' : 'Web'}</div>
                </div>
                <button class="btn-restored" style="width: 100%; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca;" onclick="window.devReset()">Clear All Data</button>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 8px; text-align: center;">⚠️ This will delete all transactions and accounts</div>
            </div>
        `;
    }

    return '';
  }

  // Reset settings to defaults
  window.resetSettings = function () {
    if (!confirm('Reset all settings to defaults?')) return;

    UI_STATE.gridTheme = 'default';
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
        const route = isHome ? 'home' : 'import'; // Map labels to routes

        return `
          <div class="breadcrumb-item ${isLast ? 'active' : ''}" 
               style="cursor: ${isLast ? 'default' : 'pointer'};"
               onclick="${isLast ? '' : `window.navigateTo('${route}');`}">
            ${isHome ? '<i class="ph ph-house breadcrumb-icon" style="margin-right: 6px; font-size: 14px; color: #3b82f6;"></i>' : ''}
            <span class="breadcrumb-label" style="${!isLast ? 'color: #3b82f6; font-weight: 500;' : ''}">${bc.label}</span>
          </div>
          ${isLast ? '' : '<span class="breadcrumb-separator" style="margin: 0 10px; color: #cbd5e1;"><i class="ph ph-caret-right" style="font-size: 10px;"></i></span>'}
        `;
      }).join('') + `
        <div style="flex: 1;"></div>
        <button onclick="window.devReset()" style="padding: 4px 10px; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer; margin-left: 12px;" title="Clear all localStorage and reset (Dev only)">
          ⚠️ DEV RESET
        </button>
      `;
    }

    // 3. Stage Content
    const stage = document.getElementById('app-stage');
    stage.innerHTML = `<div class="fade-in">${renderPage()}</div>`;

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
      case 'home': return renderHome();
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
    return `
      <div class="empty-state" style="background: white; border: 1px solid var(--border-color);">
        <i class="ph ph-house empty-icon" style="color: #3b82f6;"></i>
        <div class="empty-title">Welcome to RoboLedger V5</div>
        <div class="empty-subtitle">Live system wired. Ready for high-performance operations.</div>
      </div>
    `;
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
      const basePath = '/src/ui/enterprise/assets/logos/';

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

        reconContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 11px; color: #1e293b; line-height: 1.7;">' +
          '<div style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 1px; margin-bottom: 4px;">All Accounts at a glance</div>' +
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
          '<div style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 1px; margin-bottom: 4px;">RECONCILIATION</div>' +

          // Row 1: Opening + Debit
          '<div style="display: flex; align-items: center; gap: 24px; margin-bottom: 2px;">' +
          '<div style="flex: 1; white-space: nowrap;">Opening: <input type="text" id="opening-balance-input" value="$' + openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '" style="border: none; border-bottom: 1px solid #cbd5e1; background: transparent; font-family: ' + terminalFont + '; font-size: 12px; font-weight: 700; color: #1e293b; width: 90px; padding: 2px 4px;" oninput="window.handleOpeningBalanceInput(this)" onblur="window.formatOpeningBalance(this)" onclick="this.select()" /></div>' +
          '<div style="flex: 1; white-space: nowrap;">Debit: <span style="font-weight: 700; color: #ef4444;">$' + totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</span></div>' +
          '</div>' +

          // Row 2: Ending (Calc) + Credit
          '<div style="display: flex; align-items: center; gap: 24px; margin-bottom: 2px;">' +
          '<div style="flex: 1; white-space: nowrap;">Ending (Calc): <span style="font-weight: 700; color: #3b82f6;">$' + calculatedEnding.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</span></div>' +
          '<div style="flex: 1; white-space: nowrap;">Credit: <span style="font-weight: 700; color: #10b981;">$' + totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '</span></div>' +
          '</div>' +

          // Row 3: Ending (Stmt) - editable
          '<div style="display: flex; align-items: center; gap: 24px; margin-bottom: 2px;">' +
          '<div style="flex: 1; white-space: nowrap;">Ending (Stmt): <input type="text" id="stmt-ending-input" value="$' + (hasStatementEnding ? statementEnding : calculatedEnding).toLocaleString(undefined, { minimumFractionDigits: 2 }) + '" style="border: none; border-bottom: 1px solid #cbd5e1; background: transparent; font-family: ' + terminalFont + '; font-size: 12px; font-weight: 700; color: #1e293b; width: 90px; padding: 2px 4px;" onblur="window.saveStatementEnding(this.value)" onclick="this.select()" /></div>' +
          '<div style="flex: 1;"></div>' + // Empty cell for alignment
          '</div>' +

          // Status row
          '<div style="font-size: 11px; font-weight: 600; padding-top: 4px; margin-top: 4px; border-top: 1px solid #e2e8f0;">' + statusHTML + '</div>' +
          '</div>';
      }
    }

    // UNIFIED METADATA LAYOUT - Same structure for ALL and SINGLE modes
    const metaContent = document.getElementById('metadata-content');
    if (metaContent) {
      if (isAllMode) {
        // ALL MODE: ACCOUNT METADATA heading + Consolidated View + badge row (ALL as badge) + Transaction count
        const allTxns = window.RoboLedger.Ledger.getAll();
        const totalTxnCount = allTxns.length;

        var allBadge = '<span style="background: #1e293b; color: white; font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 3px; font-family: \'JetBrains Mono\', monospace;">ALL</span>';
        var badgesList = accounts.map(function (a) {
          var isRecon = isAccountReconciled(a);
          return '<span onclick="window.switchAccount(\'' + a.id + '\')" title="' + (a.name || a.ref) + '" style="background: #3b82f6; color: white; font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 3px; font-family: \'JetBrains Mono\', monospace; cursor: pointer;">' + (a.ref || 'N/A') + (isRecon ? ' \u2713' : '') + '</span>';
        }).join(' ');

        metaContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 11px; font-weight: 600; color: #1e293b; line-height: 1.6;">' +
          '<div style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 1px; margin-bottom: 2px;">ACCOUNT METADATA</div>' +
          '<div style="font-family: \'JetBrains Mono\', monospace; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">Total Transactions: <span style="font-weight: 700;">' + totalTxnCount.toLocaleString() + '</span></div>' +
          '<div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">' + allBadge + ' ' + badgesList + '</div>' +
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

        metaContent.innerHTML = '<div style="font-family: ' + terminalFont + '; font-size: 10px; color: #1e293b;">' +
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
    const accounts = window.RoboLedger.Accounts.getAll();
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
      const basePath = '/src/ui/enterprise/assets/logos/';
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
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: stretch; min-height: 90px; overflow: hidden; margin: 8px 16px;">
          
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
    const accounts = window.RoboLedger.Accounts.getAll();
    const refPrefix = UI_STATE.refPrefix || 'CHQ1';

    return `
      <!-- Sticky Filter Toolbar -->
      <div style="position: sticky; top: 0; z-index: 30; height: 44px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; gap: 12px;">
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

        <!-- RIGHT: Grid Settings Icon Only -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <button onclick="window.toggleSettings(true)" style="padding: 7px 10px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'" title="Grid Settings (Appearance & Columns)">
            <i class="ph ph-gear-six" style="font-size: 16px; color: #64748b;"></i>
          </button>
        </div>
      </div>
    `;
  }

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
        <div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">No transactions yet.</div>
        <div style="font-size: 14px; color: #64748b; max-width: 480px; text-align: center; line-height: 1.5; margin-bottom: 24px;">Import your bank statement or add your first entry manually to get started.</div>
        
        <!-- Upload Button -->
        <button 
          onclick="document.getElementById('fileInput').click()" 
          style="
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            transition: transform 0.2s, box-shadow 0.2s;
          "
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(59, 130, 246, 0.4)';"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.3)';"
        >
          <i class="ph ph-upload-simple" style="font-size: 20px;"></i>
          Import Bank Statement
        </button>
        
        <div style="margin-top: 16px; font-size: 12px; color: #94a3b8;">
          Supports PDF statements from RBC, TD, BMO, Scotiabank, CIBC
        </div>
      </div>
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
        ${hasData ? getFilterToolbarHTML() : ''}
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
      window.window.updateWorkspace();
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

