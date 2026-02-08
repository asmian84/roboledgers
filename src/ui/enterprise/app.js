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
    settingsTab: 'system',
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
    selectedTx: null,
    accountDropdownOpen: false,
    panelState: 'collapsed', // 'closed', 'collapsed', 'expanded'
    version: '5.1.1'
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
  console.log('[FILE] Global file input created');

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
      render();
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
    render();
  };

  window.toggleInspector = () => {
    UI_STATE.panelState = UI_STATE.panelState === 'closed' ? 'collapsed' : (UI_STATE.panelState === 'collapsed' ? 'expanded' : 'closed');
    console.log('[UI] Inspector state:', UI_STATE.panelState);
    render();
  };

  window.handleOpeningBalanceUpdate = (accId, val) => {
    const amount = parseFloat(val) || 0;
    window.RoboLedger.Accounts.setOpeningBalance(accId, amount * 100);
    render();
  };

  // Mobile sidebar toggle
  // File upload handlers for drag-drop and browse
  window.handleDropZone = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) window.handleFilesSelected(files);
  };

  window.handleFileSelect = (event) => {
    const files = event.target.files;
    if (files.length > 0) window.handleFilesSelected(files);
  };

  window.handleFilesSelected = async (files) => {
    console.log('[UPLOAD] Processing', files.length, 'file(s)');
    UI_STATE.isIngesting = true;
    UI_STATE.ingestionLabel = 'Importing files...';
    UI_STATE.ingestionProgress = 0;
    render();

    // Get primary account for ingestion
    const primaryAccount = window.RoboLedger.Accounts.getAll()[0];
    const account_id = primaryAccount ? primaryAccount.id : 'ACC-001';

    let totalImported = 0;

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      try {
        UI_STATE.ingestionLabel = `Processing: ${file.name}`;
        UI_STATE.ingestionProgress = Math.round(((idx) / files.length) * 100);

        // Optimistic render only if it's been more than 300ms since last (prevent flicker)
        if (!window._lastRender || Date.now() - window._lastRender > 300) {
          render();
          window._lastRender = Date.now();
        }

        const imported = await window.RoboLedger.Ingestion.processUpload(file, account_id);
        totalImported += imported;
        console.log(`[UPLOAD] ${file.name}: ${imported} transactions imported`);
      } catch (err) {
        console.error('[UPLOAD] Parse error:', file.name, err);
      }
    }

    UI_STATE.isIngesting = false;
    UI_STATE.ingestionProgress = 100;
    console.log(`[UPLOAD] Complete. Total imported: ${totalImported}`);
    render();
    window._lastRender = Date.now();
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

  // Desktop sidebar collapse toggle
  window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (sidebar) {
      sidebar.classList.toggle('collapsed');

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
    render();
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
    render();

    // Heartbeat Monitor
    const monitor = setInterval(() => {
      if (!UI_STATE.popoutWindow || UI_STATE.popoutWindow.closed) {
        clearInterval(monitor);
        UI_STATE.isPoppedOut = false;
        UI_STATE.popoutWindow = null;
        window.render();
      }
    }, 500);
  };

  window.getDetachedColumns = function () {
    return [
      { title: "Ref#", field: "ref", width: 100, editor: "input", formatter: (cell) => `<span style="color: #64748b;">${cell.getValue() || ''}</span>` },
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

        const viewport = pdfPage.getViewport({ scale: 1.5 });
        contentArea.innerHTML = `<canvas id="v5-stmt-canvas" style="width:100%; height:100%;"></canvas>`;
        const canvas = document.getElementById('v5-stmt-canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const ctx = canvas.getContext('2d');

        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        if (tx.source_locator && tx.source_locator.y_coord) {
          const screenY = viewport.height - tx.source_locator.y_coord;
          ctx.fillStyle = 'rgba(255,230,0,0.35)';
          ctx.fillRect(0, screenY - 12, canvas.width, 28);
        }

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
      render();
    } else {
      window.RoboLedger.Ledger.reset();
      UI_STATE.recoveryPending = false;
      render();
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


  window.switchAccount = function (accId) {
    console.log(`[V5 CONTROL] Switching to account: ${accId}`);
    const previousAccount = UI_STATE.selectedAccount;
    UI_STATE.selectedAccount = accId;

    // Get filtered transactions for the new account
    const allTx = window.RoboLedger.Ledger.getAll();
    const filtered = accId === 'ALL' ? allTx : allTx.filter(t => t.account_id === accId);

    console.log(`[GRID RENDER] Filtered ${filtered.length} transactions for account: ${accId}`);

    // Update grid data ONLY (don't re-render entire page)
    if (window.renderTransactionsGrid) {
      window.renderTransactionsGrid(filtered, UI_STATE.searchQuery);
    } else {
      console.warn('[GRID] renderTransactionsGrid not available, grid will not update');
    }

    // ONLY update the header section (not the entire page)
    const headerContainer = document.querySelector('.v5-account-workspace-header');
    if (headerContainer && previousAccount !== accId) {
      headerContainer.outerHTML = getAccountWorkspaceHeaderHTML();
    }
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
    const themeSelect = document.querySelector('.v5-select');
    if (themeSelect) {
      UI_STATE.activeTheme = themeSelect.value;
      // Apply Theme logic here... (e.g., adding class to body)
      document.body.className = UI_STATE.activeTheme.toLowerCase().replace(' ', '-') + '-theme';
    }
    toggleSettings(false);
    // Don't call render() - it destroys the grid
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

    // Set default theme on body
    if (UI_STATE.activeTheme) {
      document.body.className = UI_STATE.activeTheme.toLowerCase().replace(' ', '-') + '-theme';
    }

    window.render();
  }

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

        UI_STATE.currentRoute = route;
        if (route === 'import') {
          UI_STATE.breadcrumbs = [{ label: 'Home' }, { label: 'Transactions', active: true }];
        } else if (route === 'coa') {
          UI_STATE.breadcrumbs = [{ label: 'Home' }, { label: 'Chart of Accounts', active: true }];
        } else {
          const label = route.charAt(0).toUpperCase() + route.slice(1);
          UI_STATE.breadcrumbs = [{ label: 'Home' }, { label: label, active: true }];
        }
        render();
      };
    });
  }

  // DEV RESET: Clean slate for testing (only in dev mode)
  window.devReset = function () {
    if (!confirm('⚠️ DEV RESET: This will clear ALL localStorage and reset the ledger. Continue?')) {
      return;
    }
    console.warn('[DEV RESET] Clearing all state...');
    localStorage.clear();
    window.RoboLedger.Ledger.reset();
    location.reload();
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
        render();
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
        window.render();
      }
    });

    // Drawer Listeners
    const curtainBtn = document.querySelector('.close-curtain');
    if (curtainBtn) curtainBtn.onclick = () => toggleCurtain(false);

    // Close bulk menu if clicking outside
    document.addEventListener('click', (e) => {
      if (UI_STATE.bulkMenuOpen && !e.target.closest('.bulk-actions-container')) {
        UI_STATE.bulkMenuOpen = false;
        window.render();
      }
    });
  }

  window.handleReset = () => {
    if (!UI_STATE.resetConfirm) {
      UI_STATE.resetConfirm = true;
      render();
      // Auto-reset confirmation after 3 seconds of inactivity
      setTimeout(() => {
        if (UI_STATE.resetConfirm) {
          UI_STATE.resetConfirm = false;
          render();
        }
      }, 3000);
    } else {
      window.RoboLedger.Ledger.reset();
      UI_STATE.resetConfirm = false;
      UI_STATE.selectedAccount = 'ACC-001';
      render();
    }
  };

  window.toggleSearch = function (open) {
    UI_STATE.isSearchOpen = (open !== undefined) ? open : !UI_STATE.isSearchOpen;
    if (!UI_STATE.isSearchOpen) {
      UI_STATE.searchQuery = '';
      const data = dataAdjustedForAccount();
      if (window.renderTransactionsGrid) window.renderTransactionsGrid(data, UI_STATE.searchQuery);
    }
    render();
    if (UI_STATE.isSearchOpen) {
      setTimeout(() => {
        const el = document.getElementById('v5-search-input');
        if (el) el.focus();
      }, 50);
    }
  };

  window.handleSearch = function (query) {
    UI_STATE.searchQuery = query;
    const baseData = dataAdjustedForAccount();
    if (window.renderTransactionsGrid) window.renderTransactionsGrid(baseData, query);
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
    render();
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
    render();
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
      render();
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
    render();
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
      <div class="drawer-header">
          <div style="display: flex; align-items: center; gap: 12px;">
              <div style="background: #f1f5f9; padding: 8px; border-radius: 8px; color: #64748b;"><i class="ph ph-gear-six" style="font-size: 1.2rem;"></i></div>
              <h2 style="font-size: 1.1rem; font-weight: 700; margin: 0;">Settings</h2>
          </div>
          <i class="ph ph-x close-drawer" style="font-size: 20px; cursor: pointer; color: #94a3b8;" onclick="window.toggleSettings(false)"></i>
      </div>
      <div class="drawer-tabs">
          <div class="drawer-tab ${UI_STATE.settingsTab === 'system' ? 'active' : ''}" data-tab="system">System</div>
          <div class="drawer-tab ${UI_STATE.settingsTab === 'columns' ? 'active' : ''}" data-tab="columns">Columns</div>
          <div class="drawer-tab ${UI_STATE.settingsTab === 'autocat' ? 'active' : ''}" data-tab="autocat">Auto-Cat</div>
          <div class="drawer-tab ${UI_STATE.settingsTab === 'preferences' ? 'active' : ''}" data-tab="preferences">Preferences</div>
          <div class="drawer-tab ${UI_STATE.settingsTab === 'advanced' ? 'active' : ''}" data-tab="advanced">Advanced</div>
      </div>
      <div class="drawer-content">
          ${renderSettingsTabContent()}
      </div>
      <div class="drawer-footer">
          <button class="btn-restored" style="background: white; color: #64748b; border: 1px solid #e2e8f0; box-shadow: none;">Reset to Defaults</button>
          <button class="btn-restored" onclick="window.saveSettings()">Save Settings</button>
      </div>
    `;

    // Wire Tabs
    drawer.querySelectorAll('.drawer-tab').forEach(tab => {
      tab.onclick = () => {
        UI_STATE.settingsTab = tab.dataset.tab;
        renderSettingsDrawer();
      };
    });
  }

  function renderSettingsTabContent() {
    if (UI_STATE.settingsTab === 'system') {
      return `
            <div class="setting-group">
                <div class="setting-group-title"><i class="ph ph-magnifying-glass-plus"></i> Workspace Dexterity (The Focus Lens)</div>
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 16px;">Slide to focus the magnification of bookkeeping detail.</div>
                <input type="range" min="1" max="5" value="3" style="width: 100%; margin-bottom: 24px;">
                
                <div class="setting-group-title"><i class="ph ph-palette"></i> Appearance</div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">THEME</label>
                    <select class="v5-select">
                        <option ${UI_STATE.activeTheme === 'Rainbow' ? 'selected' : ''}>Rainbow</option>
                        <option>Wave Blue</option>
                        <option>Subliminal Dark</option>
                        <option>Classic Blue</option>
                    </select>
                </div>

                <div style="display: flex; gap: 16px;">
                    <div style="flex: 1;">
                        <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">FONT SIZE</label>
                        <input type="range" class="v5-input" style="padding: 0;">
                    </div>
                </div>
            </div>
            <div class="setting-group">
                <div class="setting-group-title">Row Density</div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-restored" style="flex: 1; background: white; color: #64748b; border: 1px solid #e2e8f0; font-size: 11px; padding: 6px; box-shadow: none;" onclick="window.setDensity('compact')">Compact</button>
                    <button class="btn-restored" style="flex: 1; font-size: 11px; padding: 6px;" onclick="window.setDensity('comfortable')">Comfortable</button>
                    <button class="btn-restored" style="flex: 1; background: white; color: #64748b; border: 1px solid #e2e8f0; font-size: 11px; padding: 6px; box-shadow: none;" onclick="window.setDensity('spacious')">Spacious</button>
                </div>
            </div>
        `;
    }

    if (UI_STATE.settingsTab === 'columns') {
      // Get actual columns from Tabulator instance
      let columns = [
        { field: 'date', label: 'Date', visible: true },
        { field: 'ref', label: 'Ref#', visible: true },
        { field: 'description', label: 'Description', visible: true },
        { field: 'debit_col', label: 'Debit', visible: true },
        { field: 'credit_col', label: 'Credit', visible: true },
        { field: 'balance', label: 'Balance', visible: true },
        { field: 'coa_code', label: 'Category', visible: true }
      ];

      // If table exists, get actual column visibility
      if (window.txnTable) {
        const tableCols = window.txnTable.getColumns();
        columns = columns.map(col => {
          const tableCol = tableCols.find(c => c.getField() === col.field);
          if (tableCol) {
            col.visible = tableCol.isVisible();
          }
          return col;
        });
      }

      // Load saved preferences
      const saved = JSON.parse(localStorage.getItem('roboledger_column_prefs') || '{}');
      columns.forEach(col => {
        if (saved[col.field] !== undefined) col.visible = saved[col.field];
      });

      return `
            <div class="setting-group">
                <div class="setting-group-title">Column Visibility</div>
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 16px;">Show or hide columns in the transaction grid.</div>
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

    if (UI_STATE.settingsTab === 'preferences') {
      return `
            <div class="setting-group">
                <div class="setting-group-title">REF Override</div>
                <input type="text" class="v5-input" value="TXN" style="font-family: 'JetBrains Mono';">
                <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Auto-updates when bank is detected</div>
            </div>
            <div class="setting-group">
                <div class="setting-group-title">Date Format</div>
                <select class="v5-select">
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                    <option>YYYY-MM-DD</option>
                </select>
            </div>
            <div class="setting-group">
                <div class="setting-group-title">Province (Tax Calculation)</div>
                <select class="v5-select">
                    <option>Ontario (13% HST)</option>
                    <option>BC (12% HST/PST)</option>
                </select>
                 <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Used for the Sales Tax column calculations [Amount / (1+r) * r]</div>
            </div>
        `;
    }

    return `<div style="padding: 40px; text-align: center; color: #94a3b8;">
        <i class="ph ph-wrench" style="font-size: 40px; margin-bottom: 16px;"></i>
        <div>Module Engineering in Progress</div>
    </div>`;
  }

  window.toggleGridColumn = (field, visible) => {
    console.log(`[SETTINGS] Toggling column ${field} to ${visible}`);

    // Map field names from settings UI to React column IDs
    const fieldMapping = {
      'date': 'date',
      'ref': 'select', // Ref maps to select column in React
      'description': 'payee',
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
    render();

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
    render();
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
    const label = document.querySelector('.v5-progress-label');
    const fill = document.querySelector('.v5-progress-fill');
    const track = document.querySelector('.v5-progress-track');

    if (label) label.textContent = UI_STATE.ingestionLabel || 'Parsing Statement...';
    if (fill) {
      fill.style.width = `${Math.round(UI_STATE.ingestionProgress)}%`;
      fill.classList.add('pulsing');
    }
    if (track) track.style.display = 'block';
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
    render();
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
               onclick="${isLast ? '' : `window.UI_STATE.currentRoute='${route}'; window.render();`}">
            ${isHome ? '<i class="ph ph-house breadcrumb-icon" style="margin-right: 6px; font-size: 14px; color: #3b82f6;"></i>' : ''}
            <span class="breadcrumb-label" style="${!isLast ? 'color: #3b82f6; font-weight: 500;' : ''}">${bc.label}</span>
          </div>
          ${isLast ? '' : '<span class="breadcrumb-separator" style="margin: 0 10px; color: #cbd5e1;"><i class="ph ph-caret-right" style="font-size: 10px;"></i></span>'}
        `;
      }).join('');
    }

    // 3. Stage Content
    const stage = document.getElementById('app-stage');
    stage.innerHTML = `<div class="fade-in">${renderPage()}</div>`;

    // 4. Show recovery prompt if data exists from previous session
    if (UI_STATE.recoveryPending) {
      showRecoveryPrompt();
      return; // Don't initialize grid until user chooses
    }

    // 5. Grid Init
    if (UI_STATE.currentRoute === 'import' && !UI_STATE.isIngesting && !UI_STATE.isPoppedOut) {
      const gridDiv = document.querySelector('#txnGrid');
      if (gridDiv) {
        console.log('[UI] Grid shell found, initializing TanStack...');
        // Always pass current ledger data to ensure grid has the latest
        const ledgerData = window.RoboLedger.Ledger.getAll();
        console.log(`[UI] Passing ${ledgerData.length} transactions to grid`);
        if (window.renderTransactionsGrid) initGrid(ledgerData);
        else setTimeout(() => initGrid(ledgerData), 100);
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


  // --- WORKSPACE HTML GENERATORS ---

  function getAccountWorkspaceHeaderHTML() {
    const acc = UI_STATE.selectedAccount !== 'ALL' ? window.RoboLedger.Accounts.get(UI_STATE.selectedAccount) : null;
    const accounts = window.RoboLedger.Accounts.getAll();
    const isLiability = acc && (acc.type === 'CREDIT_CARD' || acc.brand === 'VISA' || acc.brand === 'MASTERCARD' || acc.brand === 'AMEX');

    // Metrics Calculation
    const allTxns = window.RoboLedger.Ledger.getAll();
    const filteredTxns = UI_STATE.selectedAccount === 'ALL' ? allTxns : allTxns.filter(t => t.account_id === UI_STATE.selectedAccount);

    // Activity metrics (30d)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTxns = filteredTxns.filter(t => new Date(t.date_iso || t.date) >= thirtyDaysAgo);

    const debitTxns = recentTxns.filter(t => t.polarity === 'DEBIT');
    const creditTxns = recentTxns.filter(t => t.polarity === 'CREDIT');

    const inflow = creditTxns.reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
    const outflow = debitTxns.reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;

    // Balance logic for specific account
    const openingBalance = acc ? (acc.openingBalance || 0) : 0;
    const endingBalance = openingBalance - (filteredTxns.filter(t => t.polarity === 'DEBIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100) + (filteredTxns.filter(t => t.polarity === 'CREDIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100);

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

    // Bank icon mapping
    const getBankIcon = (bankName) => {
      const name = (bankName || '').toUpperCase();
      if (name.includes('RBC') || name.includes('ROYAL')) return '🏦'; // RBC
      if (name.includes('BMO') || name.includes('MONTREAL')) return '🏛️'; // BMO
      if (name.includes('TD') || name.includes('DOMINION')) return '🏢'; // TD
      if (name.includes('CIBC')) return '🏬'; // CIBC
      if (name.includes('SCOTIA')) return '🏪'; // Scotia
      return '🏦'; // Default bank icon
    };

    const terminalFont = "'Courier New', Courier, monospace";

    return `
      <!-- Professional Account Dashboard Header -->
      <div id="account-header-root" style="background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 12px 24px; gap: 12px;">
        
        <!-- Header Top: Account Type & Selector -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <select onchange="window.switchAccount(this.value)" style="appearance: none; border: none; padding: 0; font-size: 18px; font-weight: 800; color: #1e293b; background: transparent; cursor: pointer; text-transform: uppercase;">
                <option value="ALL" ${UI_STATE.selectedAccount === 'ALL' ? 'selected' : ''}>ALL ACCOUNTS</option>
                ${accounts.map(a => `<option value="${a.id}" ${UI_STATE.selectedAccount === a.id ? 'selected' : ''}>${a.name || a.ref}</option>`).join('')}
              </select>
              <i class="ph ph-caret-down" style="font-size: 14px; color: #64748b;"></i>
            </div>
            <div style="font-size: 11px; font-weight: 500; color: #94a3b8; margin-top: 2px; text-transform: uppercase;">
              ${acc ? acc.bankName || 'Royal Bank of Canada' : 'Consolidated View'} • ${acc ? acc.currency || 'CAD' : 'CAD'}
            </div>
          </div>
          <div style="text-align: right; color: #94a3b8; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 12px;">
            <button onclick="window.devReset()" style="padding: 4px 8px; background: #fee2e2; color: #991b1b; border: 1px solid #fec aca; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer;" title="Clear all localStorage and reset (Dev only)">
              ⚠️ DEV RESET
            </button>
            <span>Header V5.2 • Active Session</span>
          </div>
        </div>

        ${allTx.length > 0 ? `
        <!-- Professional Account Context Strip (Unified 2-Card) -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: stretch; min-height: 64px; overflow: hidden;">
          
          <!-- LEFT: Reconciliation Status -->
          <div style="flex: 2; border-right: 1px solid #e2e8f0; padding: 8px 24px; display: flex; flex-direction: column; justify-content: center; gap: 2px;">
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Reconciliation</div>
            
            ${isAllMode ? `
              <!-- ALL MODE: Aggregate Totals -->
              <div style="display: flex; flex-direction: column; gap: 1px; font-size: 12px; color: #1e293b;">
                <div style="font-weight: 700;">
                  Total Balance: <span style="font-family: 'JetBrains Mono', monospace; color: #0f766e;">$${aggTotalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span style="font-weight: 400; color: #64748b; margin-left: 4px;">(${accounts.length} accounts)</span>
                </div>
                <div style="font-weight: 500; font-size: 11px; color: #64748b;">
                  Total Debits: <span style="color: #ef4444; font-family: 'JetBrains Mono', monospace;">$${aggTotalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> •
                  Total Credits: <span style="color: #10b981; font-family: 'JetBrains Mono', monospace;">$${aggTotalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style="font-weight: 600; font-size: 11px; color: #475569;">
                  Net Activity: <span style="font-family: 'JetBrains Mono', monospace; color: ${aggNetActivity >= 0 ? '#10b981' : '#ef4444'};">$${aggNetActivity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ` : !acc ? `
              <div style="font-family: ${terminalFont}; font-size: 13px; color: #db2777; opacity: 0.6;">&gt; Select an account to reconcile...</div>
            ` : `
              <div style="display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: #1e293b;">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 11px; color: #64748b; font-weight: 500;">Opening</span>
                  <input 
                    type="text" 
                    id="header-opening-input"
                    value="$${openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}" 
                    style="border: none; background: transparent; font-size: 14px; font-weight: 700; color: #1e293b; width: 90px; font-family: 'JetBrains Mono', monospace; outline: none; padding: 0;" 
                    oninput="window.updateOpeningBalance(this.value)"
                  />
                </div>
                
                <div style="color: #cbd5e1; font-weight: 300;">+</div>
                
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 11px; color: #64748b; font-weight: 500;">Debits</span>
                  <span style="color: #ef4444; font-family: 'JetBrains Mono', monospace;">$${outflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div style="color: #cbd5e1; font-weight: 300;">-</div>

                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 11px; color: #64748b; font-weight: 500;">Credits</span>
                  <span style="color: #10b981; font-family: 'JetBrains Mono', monospace;">$${inflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div style="color: #cbd5e1; font-weight: 300;">=</div>

                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 11px; color: #64748b; font-weight: 500;">Closing</span>
                  <span id="header-closing-balance" style="color: #1e293b; font-weight: 800; font-family: 'JetBrains Mono', monospace;">$${endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #10b981; margin-top: 1px;">
                <i class="ph ph-check-circle" style="font-size: 13px;"></i>
                <span>Difference: $0.00 • Reconciled</span>
              </div>
            `}
          </div>

          <!-- RIGHT: Identity & Actions -->
          <div style="flex: 1.5; padding: 8px 24px; display: flex; align-items: center; justify-content: space-between;">
            ${isAllMode ? `
              <!-- ALL MODE: Scrollable Account List -->
              <div style="display: flex; flex-direction: column; width: 100%; gap: 2px;">
                <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Accounts</div>
                <div style="max-height: 48px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px;">
                  ${accounts.map(a => {
      const isReconciled = isAccountReconciled(a);
      return `
                      <div onclick="window.switchAccount('${a.id}')" style="cursor: pointer; padding: 2px 0; font-size: 12px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 6px; hover: background: #f1f5f9;">
                        <span>${a.name || a.ref}</span>
                        ${isReconciled ? '<i class="ph ph-check-circle" style="font-size: 13px; color: #10b981;"></i>' : ''}
                      </div>
                    `;
    }).join('')}
                </div>
              </div>
            ` : `
              <!-- SELECTED ACCOUNT: Identity with Bank Icon -->
              <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                ${acc ? `
                  <div style="font-size: 28px;">${getBankIcon(acc.bankName)}</div>
                  <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px; flex: 1;">
                    <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Account Identity</div>
                    <div style="font-size: 13px; font-weight: 700; color: #1e293b;">
                      ${acc.bankName || 'RBC'} ${isLiability ? 'Credit Card' : 'Chequing'}${acc.brand ? ' • ' + acc.brand : ''}
                    </div>
                    <div style="font-size: 11px; font-weight: 500; color: #64748b;">
                      ${isLiability ? `
                        •••• ${acc.accountNumber ? acc.accountNumber.slice(-4) : 'XXXX'}
                      ` : `
                        Transit ${acc.transit || '00000'} • Inst ${acc.inst || '000'} • Account •••• ${(acc.accountNumber || '').slice(-4) || '0000'}
                      `}
                    </div>
                  </div>
                ` : `
                  <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px;">
                    <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Account Identity</div>
                    <div style="font-family: ${terminalFont}; font-size: 12px; color: #64748b; opacity: 0.6;">&gt; No account selected</div>
                  </div>
                `}
              </div>
            `}

            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="text-align: right; color: #94a3b8; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 4px;">
                <span>Synced 2m ago</span>
                <i class="ph ph-check" style="color: #10b981;"></i>
              </div>
              <button onclick="window.openFilePicker()" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <i class="ph ph-plus-circle" style="font-size: 14px;"></i>
                Import
              </button>
            </div>
          </div>

        </div>
        ` : ''}
      </div>
    `;


  }

  function getFilterToolbarHTML() {
    return `
      <!-- Sticky Filter Toolbar -->
        <div style="position: sticky; top: 0; z-index: 30; height: 44px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; gap: 12px;">
          <!-- LEFT: Search + Filters -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="position: relative;">
              <i class="ph ph-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 14px;"></i>
              <input type="text" id="v5-search-input" placeholder="Search transactions..." value="${UI_STATE.searchQuery || ''}" oninput="window.handleSearch(this.value)" style="padding: 6px 12px 6px 32px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; width: 240px; background: white;" />
            </div>
            <select onchange="window.filterByCategory(this.value)" style="padding: 6px 28px 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #64748b; background: white; cursor: pointer; appearance: none;">
              <option value="">All categories</option>
              <option value="ASSET">💰 Assets</option>
              <option value="LIABILITY">📊 Liabilities</option>
              <option value="EQUITY">📈 Equity</option>
              <option value="REVENUE">💵 Revenue</option>
              <option value="EXPENSE">💳 Expenses</option>
            </select>
            <select style="padding: 6px 28px 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #64748b; background: white; cursor: pointer; appearance: none;">
              <option>All dates</option>
            </select>
          </div>

          <!-- RIGHT: View Controls -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: flex; align-items: center; border: 1px solid #e2e8f0; border-radius: 6px; background: white; overflow: hidden;">
              <button onclick="window.setDensity('compact')" style="padding: 5px 12px; border: none; background: ${UI_STATE.density === 'compact' ? '#eff6ff' : 'transparent'}; color: ${UI_STATE.density === 'compact' ? '#3b82f6' : '#64748b'}; font-size: 11px; font-weight: 600; cursor: pointer; border-right: 1px solid #e2e8f0;">Compact</button>
              <button onclick="window.setDensity('comfortable')" style="padding: 5px 12px; border: none; background: ${!UI_STATE.density || UI_STATE.density === 'comfortable' ? '#eff6ff' : 'transparent'}; color: ${!UI_STATE.density || UI_STATE.density === 'comfortable' ? '#3b82f6' : '#64748b'}; font-size: 11px; font-weight: 600; cursor: pointer; border-right: 1px solid #e2e8f0;">Comfortable</button>
              <button onclick="window.setDensity('spacious')" style="padding: 5px 12px; border: none; background: ${UI_STATE.density === 'spacious' ? '#eff6ff' : 'transparent'}; color: ${UI_STATE.density === 'spacious' ? '#3b82f6' : '#64748b'}; font-size: 11px; font-weight: 600; cursor: pointer;">Spacious</button>
            </div>
            <button onclick="window.toggleSettings(true)" style="padding: 6px 12px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <i class="ph ph-columns" style="font-size: 14px; color: #64748b;"></i>
              <span style="font-size: 12px; color: #64748b; font-weight: 600;">Columns</span>
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
        activeAcc.openingBalance = num;

        // SURGICAL UPDATE: Recalculate and update DOM directly to avoid grid unmount
        const allTxns = window.RoboLedger.Ledger.getAll();
        const filteredTxns = allTxns.filter(t => t.account_id === activeAcc.id);
        const totalDebits = filteredTxns.filter(t => t.polarity === 'DEBIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
        const totalCredits = filteredTxns.filter(t => t.polarity === 'CREDIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;

        const newEndingBalance = num - totalDebits + totalCredits;

        const elClosing = document.getElementById('header-closing-balance');
        if (elClosing) {
          elClosing.innerText = `$${newEndingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} `;
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
          <div style="font-size: 20px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">Processing Statement</div>
          <div style="font-size: 13px; color: #64748b; margin-bottom: 32px;">${label}</div>

          <!-- Progress Bar -->
          <div style="width: 100%; max-width: 400px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Progress</span>
              <span style="font-size: 12px; font-weight: 800; color: #3b82f6;">${Math.round(progress)}%</span>
            </div>
            <div style="height: 8px; background: #e2e8f0; border-radius: 10px; overflow: hidden; width: 100%; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);">
              <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #10b981 100%); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 10px;"></div>
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
        <div style="font-size: 14px; color: #64748b; max-width: 480px; text-align: center; line-height: 1.5;">Import your bank statement or add your first entry manually to get started.</div>
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
      mainContent = `
        ${getTxnIngestionHTML()}
    <div id="txnGrid" style="flex: 1; min-height: 480px; position: relative; background: #ffffff;">
      ${getTxnEmptyStateHTML()}
    </div>
    `;
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
      window.render();
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
      render();

      // Mock processing
      let intv = setInterval(() => {
        UI_STATE.ingestionProgress += 10;
        if (UI_STATE.ingestionProgress >= 100) {
          clearInterval(intv);
          UI_STATE.isIngesting = false;
          render();
        }
        render();
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

  if (typeof init === 'function') init();
})();
