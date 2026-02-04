/**
 * RoboLedger V4/V5 UI Restoration Controller
 * Wired to the live Ledger Engine (ledger.core.js)
 */
(function () {
  const UI_STATE = window.UI_STATE = {
    currentRoute: 'import',
    breadcrumbs: [
      { label: 'Home', icon: 'ph-house' },
      { label: 'Transactions' }
    ],
    selectedAccount: 'ACC-001',
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
    version: '5.1.1'
  };

  function init() {
    setupNav();
    setupActions();
    render();
  }

  function setupNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = (e) => {
        const route = e.currentTarget.dataset.route;
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

    stage.addEventListener('click', (e) => {
      if (e.target.closest('.btn-add-row')) {
        const accId = UI_STATE.selectedAccount === 'ALL' ? 'ACC-001' : UI_STATE.selectedAccount;
        window.RoboLedger.Ledger.createManual(accId);
        render();
      }
    });

    // Delegated actions (Upload Zone & Browse Button)
    stage.addEventListener('click', (e) => {
      const zone = e.target.closest('.upload-zone');
      const isSettings = e.target.closest('.btn-icon-v5');

      if (zone && !isSettings) {
        if (UI_STATE.isIngesting) return;

        // Trigger file input
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.pdf,.csv';
        input.onchange = (event) => handleBatch(event.target.files);
        input.click();
      }
    });

    // Drawer Listeners
    const curtainBtn = document.querySelector('.close-curtain');
    if (curtainBtn) curtainBtn.onclick = () => toggleCurtain(false);

    // Close bulk menu if clicking outside
    document.addEventListener('click', (e) => {
      if (UI_STATE.bulkMenuOpen && !e.target.closest('.bulk-actions-container')) {
        UI_STATE.bulkMenuOpen = false;
        render();
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

  window.handleRefUpdate = (newRef) => {
    const activeAcc = window.RoboLedger.Accounts.get(UI_STATE.selectedAccount);
    if (!activeAcc) return;

    if (newRef.trim() === '') {
      UI_STATE.refError = "Ref# cannot be empty.";
      render();
      return;
    }

    const result = window.RoboLedger.Accounts.setRef(activeAcc.id, newRef.trim());
    if (result.success) {
      UI_STATE.refError = null;
      render(); // Refresh pills and action bar
      if (window.txnTable) {
        // Force grid refresh to update Source column badges
        window.txnTable.setData(dataAdjustedForAccount());
      }
    } else {
      UI_STATE.refError = result.error;
      render();
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
          <button class="btn-restored" onclick="window.toggleSettings(false)">Save Settings</button>
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
                    <button class="btn-restored" style="flex: 1; background: white; color: #64748b; border: 1px solid #e2e8f0; font-size: 11px; padding: 6px; box-shadow: none;">Compact</button>
                    <button class="btn-restored" style="flex: 1; font-size: 11px; padding: 6px;">Comfortable</button>
                    <button class="btn-restored" style="flex: 1; background: white; color: #64748b; border: 1px solid #e2e8f0; font-size: 11px; padding: 6px; box-shadow: none;">Spacious</button>
                </div>
            </div>
        `;
    }

    if (UI_STATE.settingsTab === 'columns') {
      const columns = [
        { id: 'date', label: 'Date' },
        { id: 'desc', label: 'Description' },
        { id: 'debit', label: 'Debit' },
        { id: 'credit', label: 'Credit' },
        { id: 'balance', label: 'Balance' },
        { id: 'account', label: 'Account' },
        { id: 'ref', label: 'Ref#' }
      ];

      return `
            <div class="setting-group">
                <div class="setting-group-title">Column Visibility</div>
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 16px;">Show or hide columns in the transaction grid.</div>
                ${columns.map(col => `
                    <div class="column-toggle">
                        <label>${col.label}</label>
                        <label class="switch">
                            <input type="checkbox" checked onchange="window.toggleGridColumn('${col.id}', this.checked)">
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

  window.toggleGridColumn = (colId, visible) => {
    if (!window.txnTable) return;
    // Map simplified IDs to Tabulator fields
    const fieldMap = {
      'date': 'date',
      'desc': 'raw_description',
      'debit': 'Debit', // This is a bit tricky as Debit/Credit are formatters
      'credit': 'Credit',
      'balance': 'balance_cents',
      'account': 'account',
      'ref': 'ref'
    };

    console.log(`[V5 GRID CONTROL] Toggling ${colId} to ${visible}`);
    // Optional: window.txnTable.toggleColumn(fieldMap[colId]);
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

    // Phase 1: BATCH FORENSIC SCAN
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      UI_STATE.ingestionProgress = (i / totalFiles) * 30;
      UI_STATE.ingestionLabel = `[Phase 1/3] Forensic Scan: ${file.name}`;
      updateProgressUI();
      await new Promise(r => setTimeout(r, 100));
    }

    // Phase 2: BATCH TRUTH RECONSTRUCTION
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      UI_STATE.ingestionProgress = 30 + ((i / totalFiles) * 40);
      UI_STATE.ingestionLabel = `[Phase 2/3] Reconstructing Truth: ${file.name}`;
      updateProgressUI();
      await new Promise(r => setTimeout(r, 150));
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

    // 2. Breadcrumbs
    const bcContainer = document.getElementById('breadcrumb');
    bcContainer.innerHTML = UI_STATE.breadcrumbs.map((bc, i) => {
      const isLast = i === UI_STATE.breadcrumbs.length - 1;
      return `
        <div class="breadcrumb-item ${isLast ? 'active' : ''}">
          <span class="breadcrumb-label">${bc.label}</span>
        </div>
        ${isLast ? '' : '<span class="breadcrumb-separator">›</span>'}
      `;
    }).join('');

    // 3. Stage Content
    const stage = document.getElementById('app-stage');
    stage.innerHTML = `<div class="fade-in">${renderPage()}</div>`;

    // 4. Grid Init
    if (UI_STATE.currentRoute === 'import' && !UI_STATE.isIngesting) {
      const gridDiv = document.querySelector('#txnGrid');
      if (gridDiv) setTimeout(initGrid, 50);
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

  function renderTransactionsRestored() {
    const data = window.RoboLedger.Ledger.getAll();
    const accounts = window.RoboLedger.Accounts.getAll();
    const activeAcc = window.RoboLedger.Accounts.get(UI_STATE.selectedAccount) || accounts[0];
    const hasData = data.length > 0;
    const coa = window.RoboLedger.COA.getAll();

    return `
      <div style="display: flex; flex-direction: column; gap: 0; flex: 1;">
        
        <!-- HEADER LOGIC -->
        <div class="v5-main-header fade-in">
          <div class="header-card" style="padding: 24px;">
             <div class="header-info-group">
               <!-- Fixed Icon -->
               <div class="header-icon-box" style="background: linear-gradient(135deg, #3b82f6, #2563eb); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: white;">
                  <i class="ph ph-receipt" style="font-size: 24px;"></i>
               </div>
               
               <div class="header-text" style="display: flex; flex-direction: column; gap: 4px;">
                  <!-- Fixed Title -->
                  <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0;">Transactions</h1>
                  
                  <!-- DYNAMIC SUBTITLE AREA -->
                  ${!hasData ? `
                      <!-- STATE 1: WAITING FOR DATA -->
                      <div style="font-size: 14px; color: #64748b; display: flex; align-items: center; gap: 6px;">
                          <span>Waiting for bank statement</span>
                          <div class="typing-dots">
                              <span>.</span><span>.</span><span>.</span>
                          </div>
                      </div>
                  ` : `
                      <!-- STATE 2: DATA LOADED (Breadcrumbs + Metadata) -->
                      <div class="v5-breadcrumb-container">
                          <!-- Breadcrumbs Line -->
                          <div class="v5-breadcrumb-nav" style="margin-bottom: 2px;">
                              <button class="v5-crumb-btn" onclick="toggleDropdown('bankDropdown')" style="padding-left: 0;">
                                  <i class="ph ph-bank v5-crumb-icon" style="color: #64748b; font-size: 16px;"></i>
                                  <span style="font-size: 14px;">${activeAcc.bankName || 'Unknown Bank'}</span>
                                  <i class="ph ph-caret-down v5-crumb-caret"></i>
                                  <!-- Dropdown -->
                                  <div id="bankDropdown" class="v5-dropdown-menu">
                                      <div class="v5-dropdown-header">Select Institution</div>
                                      <div class="v5-dropdown-item"><i class="ph ph-bank"></i> RBC Royal Bank</div>
                                      <div class="v5-dropdown-item"><i class="ph ph-bank"></i> TD Canada Trust</div>
                                      <div class="v5-dropdown-item"><i class="ph ph-bank"></i> BMO Bank of Montreal</div>
                                  </div>
                              </button>

                              <div class="v5-crumb-sep" style="font-size: 14px;">/</div>

                              <button class="v5-crumb-btn" onclick="toggleDropdown('accDropdown')">
                                  <i class="ph ph-check-circle v5-crumb-icon" style="color: #10b981; font-size: 16px;"></i>
                                  <span style="font-size: 14px;">${activeAcc.accountType || 'CHECKING'}</span>
                                  <i class="ph ph-caret-down v5-crumb-caret"></i>
                                  <!-- Dropdown -->
                                  <div id="accDropdown" class="v5-dropdown-menu">
                                      <div class="v5-dropdown-header">Account Tag</div>
                                      <div class="v5-dropdown-item"><i class="ph ph-check-circle"></i> Checking</div>
                                      <div class="v5-dropdown-item"><i class="ph ph-piggy-bank"></i> Savings</div>
                                      <div class="v5-dropdown-item"><i class="ph ph-credit-card"></i> Visa</div>
                                  </div>
                              </button>
                          </div>
                          
                          <!-- Metadata Line -->
                          <div class="v5-ati-line" style="padding-left: 0;">
                              <span class="ati-label">INST:</span> <span class="ati-val">${activeAcc.institution || '---'}</span>
                              <span style="color: #e2e8f0; margin: 0 8px;">|</span>
                              <span class="ati-label">TRANSIT:</span> <span class="ati-val">${activeAcc.transit || '---'}</span>
                              <span style="color: #e2e8f0; margin: 0 8px;">|</span>
                              <span class="ati-label">ACCOUNT:</span> <span class="ati-val">${activeAcc.accountNumber || '---'}</span>
                          </div>
                      </div>
                  `}
               </div>
             </div>
             
             <!-- Right Side Actions (Fixed) -->
             <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
                  ${hasData ? `
                       <button class="btn-restored" style="background: white; color: #64748b; border: 1px solid #e2e8f0;" onclick="UI_STATE.selectedAccount=null; UI_STATE.ingestionProgress=0; render();">
                           <i class="ph ph-arrow-counter-clockwise"></i> START OVER
                       </button>
                  ` : ''}
                  
                   <div class="upload-zone" onclick="document.getElementById('fileInput').click()" style="padding: 12px 20px; border: 2px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#3b82f6'; this.style.background='#eff6ff'" onmouseout="this.style.borderColor='#cbd5e1'; this.style.background='transparent'">
                        <i class="ph ph-cloud-arrow-up" style="color: #3b82f6; font-size: 24px;"></i>
                        <div style="text-align: left;">
                           <div style="font-size: 13px; font-weight: 600; color: #334155;">Drag and drop files here</div>
                           <div style="font-size: 11px; color: #64748b;">CSV, XLSX, PDF • Max 200MB</div>
                        </div>
                   </div>
                   <input type="file" id="fileInput" multiple accept=".csv,.xlsx,.xls,.pdf" style="display: none" onchange="handleFiles(this.files)">
             </div>
          </div>

          ${!hasData && !UI_STATE.isIngesting ? `
              <!-- Empty State Body -->
               <div class="v5-waiting-container" style="flex: 1; background: transparent; border: none;">
                  <div style="opacity: 0.2; margin-bottom: 24px;">
                    <i class="ph ph-files" style="font-size: 80px; color: #64748b;"></i>
                  </div>
                  <div class="v5-waiting-title" style="color: #94a3b8;">Ready for Data</div>
                  <div class="v5-waiting-subtitle" style="color: #cbd5e1;">
                    <div class="v5-progress-track">
                        <div class="v5-progress-fill" style="width: ${UI_STATE.ingestionProgress}%"></div>
                    </div>
                </div>
            </div>
        ` : ''}
        </div> <!-- End v5-main-header -->

        ${hasData && !UI_STATE.isIngesting ? `
        <!-- V5 CLOUDY CARD HEADER (Wall-to-Wall) -->
        <div class="v5-cloudy-header">
            <div class="cloudy-left-group">
                <!-- Ref Prefix Input -->
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 10px; font-weight: 700; color: #94a3b8;">REF</span>
                    <input type="text" class="cloudy-ref-input" 
                           value="${activeAcc.ref || ''}" 
                           placeholder="AUTO"
                           onblur="window.handleRefUpdate(this.value)"
                           onkeydown="if(event.key === 'Enter') this.blur()">
                </div>

                <div style="width: 1px; height: 16px; background: #e2e8f0; margin: 0 4px;"></div>

                <!-- Integrated Account Switcher (Compact) -->
                <!-- Account Switcher Pills -->
                <button class="cloudy-btn active" 
                        style="color: #3b82f6; background: #eff6ff; width: auto; padding: 0 8px;"
                        onclick="UI_STATE.selectedAccount = null; render();">
                    <span style="font-weight: 600; font-size: 11px;">ALL</span>
                </button>
                ${accounts.map(acc => `
                    <button class="cloudy-btn ${UI_STATE.selectedAccount === acc.id ? 'active' : ''}" 
                            style="${UI_STATE.selectedAccount === acc.id ? 'color: #3b82f6; background: #eff6ff; width: auto; padding: 0 8px;' : 'width: auto; padding: 0 8px;'}"
                            onclick="UI_STATE.selectedAccount = '${acc.id}'; render();">
                        <span style="font-weight: 600; font-size: 11px;">${acc.ref || acc.name.split(' ')[0]}</span>
                    </button>
                `).join('')}}

                <!-- Integrated Bulk Actions (Initially Hidden) -->
                <div id="v5BulkBar">
                    <span class="count-badge" id="bulkCount">0</span>
                    <span style="font-size: 11px; font-weight: 700; color: #92400e;">SELECTED</span>
                    <div class="divider"></div>
                    <button><i class="ph ph-tag"></i> Categorize</button>
                    <button><i class="ph ph-pencil-simple"></i> Rename</button>
                    <div class="divider"></div>
                    <button style="color: #dc2626;"><i class="ph ph-trash"></i> Delete</button>
                </div>
            </div>

            <div class="cloudy-right-group">
                 <!-- Live Metrics -->
                 <div class="cloudy-metric">
                    <i class="ph ph-receipt" style="color: #94a3b8;"></i>
                    <span class="metric-value">${data.length}</span>
                 </div>
                 <div class="cloudy-metric">
                    <i class="ph ph-coins" style="color: #10b981;"></i>
                    <span class="metric-value">$${(data.reduce((sum, t) => sum + (t.polarity === 'DEBIT' ? -t.amount_cents : t.amount_cents), 0) / 100).toLocaleString('en-US')}</span>
                 </div>

                 <div style="width: 1px; height: 16px; background: #e2e8f0; margin: 0 4px;"></div>

                 <button class="cloudy-btn" title="Search"><i class="ph ph-magnifying-glass"></i></button>
                 <button class="cloudy-btn" title="Grid Settings" onclick="window.toggleSettings(true)"><i class="ph ph-sliders-horizontal"></i></button>
            </div>
        </div>

        <!-- WALL-TO-WALL GRID CONTAINER -->
        <div class="grid-container-wall">
            <div id="txnGrid" style="height: 100%; width: 100%;"></div>
        </div>
        ` : ''}
      </div>
    `;
  }

  window.txnTable = null;

  function initGrid() {
    const gridDiv = document.querySelector('#txnGrid');
    if (!gridDiv) return;

    // Clear existing
    if (window.txnTable) {
      window.txnTable.destroy();
      window.txnTable = null;
    }

    // Get actual transaction data from the ledger
    let data = window.RoboLedger.Ledger.getAll();

    console.log("[GRID] Raw data from Ledger:", data.length, "transactions");
    console.log("[GRID DEBUG] First transaction:", data[0]);
    console.log("[GRID DEBUG] Date field:", data[0]?.date_iso || data[0]?.date);
    console.log("[GRID DEBUG] Account field:", data[0]?.account_id);

    // Calculate running balance and populate source_ref
    let runningBalance = 0; // Starting balance in cents
    data.forEach((txn, index) => {
      // Calculate balance based on polarity
      if (txn.polarity === 'CREDIT') {
        runningBalance += txn.amount_cents || 0;
      } else if (txn.polarity === 'DEBIT') {
        runningBalance -= txn.amount_cents || 0;
      }

      // Set balance (already in cents)
      txn.balance = runningBalance;

      // Sync source_ref with ref field (if ref exists, use it; otherwise generate)
      if (txn.ref) {
        txn.source_ref = txn.ref;
      } else if (!txn.source_ref) {
        const prefix = "CHQ1"; // Can be dynamic based on account
        txn.source_ref = `${prefix}-${String(index + 1).padStart(3, '0')}`;
      }
    });

    console.log("[GRID] Initializing Tabulator v5.5 on", gridDiv);

    // Dynamic Ref# Generator
    const getRefPrefix = () => {
      const input = document.querySelector('.cloudy-ref-input');
      return input ? input.value || "TXN" : "TXN";
    };

    window.txnTable = new Tabulator(gridDiv, {
      data: data,
      height: "100%", // Wall-to-Wall height
      layout: "fitColumns",
      reactiveData: true, // Data sync
      index: "id", // Stable ID
      rowHeight: 34, // Snug density
      headerFilterLiveFilterDelay: 600,
      selectable: false, // Disabled - no checkbox column
      headerSort: true, // Enable column sorting
      headerSortTristate: true, // Allow asc, desc, none

      // Column Definitions
      columns: [
        // 1. Ref# (Dynamic)
        {
          title: "Ref#",
          field: "ref",
          width: 100,
          headerSort: true,
          formatter: (cell) => {
            // If explicitly set, use it. Else calc dynamic.
            const val = cell.getValue();
            if (val) return `<span style="color: #64748b;">${val}</span>`;

            const rowIndex = cell.getRow().getPosition(true) + 1; // 1-based index
            const prefix = getRefPrefix();
            const code = `${prefix}-${String(rowIndex).padStart(3, '0')}`;
            return `<span style="color: #94a3b8;">${code}</span>`;
          }
        },

        // 2. Source (Prefix Only - e.g., "CHQ1")
        {
          title: "Source",
          field: "source_ref",
          width: 80,
          headerSort: true,
          formatter: (cell) => {
            const rowData = cell.getRow().getData();
            const ref = rowData.ref || '';

            // Extract just the prefix (everything before the dash)
            let prefix = 'N/A';
            if (ref) {
              const parts = ref.split('-');
              prefix = parts[0] || 'N/A';
            } else {
              // Use the dynamic prefix from the input
              prefix = getRefPrefix();
            }

            return `<span style="color: #64748b; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500;">${prefix}</span>`;
          }
        },

        // 3. Date
        {
          title: "Date",
          field: "date",
          width: 110,
          sorter: "date",
          editor: "date",
          formatter: (cell) => {
            const dateValue = cell.getValue();
            if (!dateValue) return '<span style="color: #cbd5e1;">(No Date)</span>';

            // Date is already formatted (e.g., "01 Apr 2026")
            // Just display it directly
            return `<span style="color: #0f172a;">${dateValue}</span>`;
          }
        },

        // 4. Payee / Description (Main) - 2-Line UPPERCASE
        {
          title: "Payee / Description",
          field: "description",
          widthGrow: 3,
          editor: "input",
          formatter: (cell) => {
            const rowData = cell.getRow().getData();
            let cleanName = rowData.description || "Unknown";
            const rawTrace = rowData.raw_description || "";

            // Extract the bank context (what was removed) for the sub-line
            let bankContext = "";
            const prefixPatterns = [
              /^e-Transfer\s*(?:sent|received|to|from)?\s*-?\s*Autodeposit/i,
              /^e-Transfer\s*(?:sent|received)/i,
              /^Online\s*Banking\s*transfer/i,
              /^Pay\s+Employee-Vendor/i,
              /^MISCELLANEOUS\s*PAYMENT/i,
              /^PRE-AUTHORIZED\s*DEBIT/i
            ];

            for (const pattern of prefixPatterns) {
              const match = rawTrace.match(pattern);
              if (match) {
                bankContext = match[0];
                break;
              }
            }

            const hasContext = bankContext.length > 0;

            return `
                  <div style="display: flex; flex-direction: column; justify-content: center; height: 100%; line-height: 1.2;">
                    <span style="font-weight: 600; text-transform: uppercase; color: #0f172a; font-size: 13px;">${cleanName}</span>
                    ${hasContext ? `<span style="font-size: 10px; color: #64748b; margin-top: 1px;">${bankContext}</span>` : ''}
                  </div>
                `;
          }
        },

        // 5. Debit (Split Accounting)
        {
          title: "Debit",
          field: "debit_col", // Virtual field
          width: 120,
          hozAlign: "right",
          editor: "number",
          editorParams: { min: 0, step: 0.01 },
          formatter: (cell) => {
            const row = cell.getRow().getData();
            if (row.polarity === 'DEBIT' && row.amount_cents > 0) {
              return (row.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            }
            return `<span style="color: #e2e8f0;">-</span>`;
          },
          cellEdited: (cell) => {
            const val = parseFloat(cell.getValue());
            const row = cell.getRow();
            if (!isNaN(val) && val > 0) {
              // SET DEBIT
              row.update({
                polarity: 'DEBIT',
                amount_cents: Math.round(val * 100)
              });
            } else {
              // CLEAR (If user deleted val)
              // If it was debit, clear it.
              const curr = row.getData();
              if (curr.polarity === 'DEBIT') row.update({ amount_cents: 0 });
            }
          },
          cssClass: "amount-negative" // Dark gray
        },

        // 6. Credit (Split Accounting)
        {
          title: "Credit",
          field: "credit_col", // Virtual field
          width: 120,
          hozAlign: "right",
          editor: "number",
          editorParams: { min: 0, step: 0.01 },
          formatter: (cell) => {
            const row = cell.getRow().getData();
            if (row.polarity === 'CREDIT' && row.amount_cents > 0) {
              const val = (row.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
              return `<span style="color: #10b981;">${val}</span>`;
            }
            return `<span style="color: #e2e8f0;">-</span>`;
          },
          cellEdited: (cell) => {
            const val = parseFloat(cell.getValue());
            const row = cell.getRow();
            if (!isNaN(val) && val > 0) {
              // SET CREDIT (Mutually exclusive)
              row.update({
                polarity: 'CREDIT',
                amount_cents: Math.round(val * 100)
              });
            } else {
              const curr = row.getData();
              if (curr.polarity === 'CREDIT') row.update({ amount_cents: 0 });
            }
          }
        },

        // 7. Balance (Running Total)
        {
          title: "Balance",
          field: "balance",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => {
            const balance = cell.getValue() || 0;
            const formatted = (balance / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            const color = balance >= 0 ? '#059669' : '#dc2626';
            return `<span style="color: ${color};">${formatted}</span>`;
          }
        },

        // 8. Account (5-Category COA)
        {
          title: "Account",
          field: "coa_code",
          width: 220,
          editor: "list",
          editorParams: {
            values: function (cell) {
              // Build categorized COA list
              const coa = window.RoboLedger.COA.getAll();
              const opts = {};

              // Group by category
              const categories = {
                'Assets': { icon: '💰', accounts: [], roots: ['ASSET', 'ASSETS'] },
                'Liabilities': { icon: '💳', accounts: [], roots: ['LIABILITY', 'LIABILITIES'] },
                'Income': { icon: '💵', accounts: [], roots: ['INCOME', 'REVENUE'] },
                'Expenses': { icon: '📊', accounts: [], roots: ['EXPENSE', 'EXPENSES'] },
                'Equity': { icon: '👤', accounts: [], roots: ['EQUITY'] }
              };

              coa.forEach(account => {
                // Map root field to category
                const root = (account.root || '').toUpperCase();
                let matchedCategory = null;

                for (const [catName, catData] of Object.entries(categories)) {
                  if (catData.roots.includes(root)) {
                    matchedCategory = catName;
                    break;
                  }
                }

                if (matchedCategory) {
                  categories[matchedCategory].accounts.push(account);
                } else {
                  // Default to Expenses if no match
                  categories['Expenses'].accounts.push(account);
                }
              });

              // Build grouped options using CODE as the value
              Object.keys(categories).forEach(catName => {
                const cat = categories[catName];
                if (cat.accounts.length > 0) {
                  opts[`--- ${cat.icon} ${catName} ---`] = null; // Category header (disabled)
                  cat.accounts.forEach(acc => {
                    opts[acc.code] = `  ${acc.name}`; // Use CODE as key
                  });
                }
              });

              return opts;
            },
            autocomplete: true,
            clearable: true,
            listItemFormatter: function (value, title) {
              // Disable category headers
              if (title && title.startsWith('---')) {
                return `<div style="font-weight: 700; color: #64748b; padding: 4px 0; pointer-events: none;">${title}</div>`;
              }
              return title;
            }
          },
          formatter: (cell) => {
            const val = cell.getValue();
            const coa = window.RoboLedger.COA.getAll();
            const account = coa.find(a => a.code === val); // Match by CODE

            if (account) {
              // Map root to category for icon display
              const root = (account.root || '').toUpperCase();
              const rootToCategory = {
                'ASSET': 'Assets',
                'ASSETS': 'Assets',
                'LIABILITY': 'Liabilities',
                'LIABILITIES': 'Liabilities',
                'INCOME': 'Income',
                'REVENUE': 'Income',
                'EXPENSE': 'Expenses',
                'EXPENSES': 'Expenses',
                'EQUITY': 'Equity'
              };

              const category = rootToCategory[root] || 'Expenses';

              // Determine category icon
              const categoryIcons = {
                'Assets': '💰',
                'Liabilities': '💳',
                'Income': '💵',
                'Expenses': '📊',
                'Equity': '👤'
              };
              const icon = categoryIcons[category] || '📊';

              return `
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 14px;">${icon}</span>
                  <span style="color: #0f172a; font-weight: 500; font-size: 12px;">${account.name}</span>
                </div>
              `;
            }
            return `<span style="color: #94a3b8; font-style: italic; font-size: 11px;">Uncategorized</span>`;
          }
        }
      ]
    }); // End new Tabulator({...})

    // Attach Event Listeners to the NEW instance
    window.txnTable.on("rowSelectionChanged", function (data, rows) {
      const bar = document.getElementById('v5BulkBar');
      const count = document.getElementById('bulkCount');
      if (bar && count) {
        count.innerText = rows.length;
        if (rows.length > 0) {
          bar.classList.add('visible');
        } else {
          bar.classList.remove('visible');
        }
      }
    });

    window.txnTable.on("rowClick", function (e, row) {
      // Prevent Workbench open if clicking action buttons or editors
      if (e.target.closest('.action-btn') || e.target.closest('.tabulator-editable')) return;

      const data = row.getData();
      if (data.sourceFileId) {
        window.toggleWorkbench(true, data.sourceFileId);
      }
    });

    // Event Hook for Ref updates (External input changes)
    window.handleRefUpdate = (val) => {
      // Force redraw of Ref column to pick up new prefix
      if (window.txnTable) window.txnTable.redraw(true);
    };
  }

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
      </div>
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
  window.toggleSettings = toggleSettings;
  window.toggleWorkbench = window.toggleWorkbench;
  window.openSourceFile = (id) => window.toggleWorkbench(true, id);

  init();
})();
