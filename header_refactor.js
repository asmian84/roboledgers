// REFACTORED HEADER - STATIC CONTAINERS + DATA UPDATES
// This file contains the new approach: static HTML structure with separate data population

// Static HTML structure (rendered once)
function getAccountWorkspaceHeaderHTML_NEW() {
    const accounts = window.RoboLedger.Accounts.getAll();
    const acc = accounts.find(a => a.id === UI_STATE.selectedAccount);
    const filteredTxns = UI_STATE.selectedAccount === 'ALL'
        ? window.RoboLedger.Ledger.getAll()
        : window.RoboLedger.Ledger.getAll().filter(t => t.account_id === UI_STATE.selectedAccount);

    return `
    <!-- Professional Account Dashboard Header (STATIC STRUCTURE) -->
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
          <button onclick="window.devReset()" style="padding: 4px 8px; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 4px; font-size: 10px; font-weight: 600; cursor: pointer;" title="Clear all localStorage and reset (Dev only)">
            ⚠️ DEV RESET
          </button>
          <span>Header V6.0 • Static Containers</span>
        </div>
      </div>

      ${filteredTxns.length > 0 ? `
      <!-- Professional Account Context Strip (STATIC STRUCTURE - Never re-renders) -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; align-items: stretch; min-height: 64px; overflow: hidden; margin: 8px 16px; border: 1px solid transparent; background-image: linear-gradient(white, white), linear-gradient(135deg, #e2e8f0, #cbd5e1); background-origin: padding-box, border-box; background-clip: padding-box, border-box;">
        
        <!-- LEFT: Reconciliation Status (STATIC CONTAINER) -->
        <div style="flex: 2; border-right: 1px solid #e2e8f0; padding: 6px 24px; display: flex; flex-direction: column; justify-content: center; gap: 2px;">
          <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Reconciliation</div>
          <div id="reconciliation-content"></div>
        </div>

        <!-- RIGHT: Identity & Actions (STATIC CONTAINER) -->
        <div style="flex: 1.5; padding: 6px 24px; display: flex; align-items: center; justify-content: space-between;">
          <div id="metadata-content" style="flex: 1; display: flex; align-items: center; justify-content: space-between;"></div>
        </div>

      </div>
      ` : ''}
    </div>
  `;
}

// Data update function (called on account switch - NO re-rendering)
window.updateHeaderData = function () {
    const accounts = window.RoboLedger.Accounts.getAll();
    const acc = accounts.find(a => a.id === UI_STATE.selectedAccount);
    const isAllMode = UI_STATE.selectedAccount === 'ALL';
    const terminalFont = "'JetBrains Mono', 'SF Mono', 'Courier New', monospace";

    console.log('[Header Data Update] Mode:', isAllMode ? 'ALL' : 'SINGLE', 'Account:', acc?.ref || 'None');

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
            // Calculate aggregates
            const allTxns = window.RoboLedger.Ledger.getAll();
            const aggTotalCredits = allTxns.filter(t => t.credit).reduce((sum, t) => sum + t.credit, 0);
            const aggTotalDebits = allTxns.filter(t => t.debit).reduce((sum, t) => sum + t.debit, 0);
            const aggNetActivity = aggTotalCredits - aggTotalDebits;
            const aggTotalBalance = accounts.reduce((sum, a) => {
                const txns = allTxns.filter(t => t.account_id === a.id);
                const credits = txns.filter(t => t.credit).reduce((s, t) => s + t.credit, 0);
                const debits = txns.filter(t => t.debit).reduce((s, t) => s + t.debit, 0);
                return sum + (credits - debits);
            }, 0);

            reconContent.innerHTML = `
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
      `;
        } else if (!acc) {
            reconContent.innerHTML = `<div style="font-family: ${terminalFont}; font-size: 13px; color: #db2777; opacity: 0.6;">&gt; Select an account to reconcile...</div>`;
        } else {
            // Single account reconciliation
            const txns = window.RoboLedger.Ledger.getAll().filter(t => t.account_id === acc.id);
            const inflow = txns.filter(t => t.credit).reduce((sum, t) => sum + t.credit, 0);
            const outflow = txns.filter(t => t.debit).reduce((sum, t) => sum + t.debit, 0);
            const openingBalance = acc.openingBalance || 0;
            const endingBalance = openingBalance + outflow - inflow;

            reconContent.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; color: #1e293b;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 11px; color: #64748b; font-weight: 500;">Opening</span>
            <input 
              type="text" 
              id="header-opening-input"
              value="$${openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}" 
              style="border: none; background: transparent; font-size: 14px; font-weight: 700; color: #1e293b; width: 90px; font-family: 'JetBrains Mono', monospace; outline: none; padding: 0; cursor: text;" 
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
            <span style="color: #1e293b; font-weight: 800; font-family: 'JetBrains Mono', monospace;">$${endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      `;
        }
    }

    // Update metadata content
    const metaContent = document.getElementById('metadata-content');
    if (metaContent) {
        if (isAllMode) {
            // ALL MODE: Account badges + Synced/Import
            const isAccountReconciled = (a) => {
                const txns = window.RoboLedger.Ledger.getAll().filter(t => t.account_id === a.id);
                return txns.length > 0 && txns.every(t => t.reconciled);
            };

            metaContent.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%; gap: 3px;">
          <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Account Identity</div>
          <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            ${accounts.map(a => {
                const isReconciled = isAccountReconciled(a);
                return `
                <span 
                  onclick="window.switchAccount('${a.id}')" 
                  title="${a.name || a.ref}"
                  style="background: #3b82f6; color: white; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 3px;"
                  onmouseover="this.style.background='#2563eb'"
                  onmouseout="this.style.background='#3b82f6'">
                  ${a.ref || 'N/A'}
                  ${isReconciled ? '<i class="ph ph-check-circle" style="font-size: 10px; color: #10b981;"></i>' : ''}
                </span>
              `;
            }).join('')}
          </div>
        </div>
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
      `;
        } else if (acc) {
            // SINGLE MODE: Metadata + Synced/Import
            const isLiability = acc.type === 'liability' || acc.type === 'creditcard';
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

            const getBankIcon = (bankName) => {
                const bank = (bankName || '').toLowerCase();
                if (bank.includes('rbc') || bank.includes('royal')) return '🏦';
                if (bank.includes('td')) return '💚';
                if (bank.includes('bmo') || bank.includes('montreal')) return '🔵';
                if (bank.includes('scotia')) return '🏴';
                if (bank.includes('cibc')) return '🟥';
                return '🏦';
            };

            metaContent.innerHTML = `
        <div style="display: flex; align-items: stretch; gap: 0; width: 100%;">
          <div style="display: flex; align-items: center; justify-content: center; padding: 6px 24px; border-right: 1px solid #e2e8f0; font-size: 36px;">
            ${getBankIcon(acc.bankName)}
          </div>
          <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px; flex: 1; padding: 6px 24px; font-family: ${terminalFont};">
            <div style="font-size: 12px; font-weight: 700; color: #1e293b; letter-spacing: 0.02em;">
              ${(acc.bankName || 'ROYAL BANK OF CANADA').toUpperCase()} - ${isLiability ? 'CREDIT CARD' : 'CHEQUING'}
            </div>
            <div style="font-size: 11px; font-weight: 500; color: #64748b;">
              ${isLiability ?
                    `Card: •••• ${acc.accountNumber ? acc.accountNumber.slice(-4) : 'XXXX'}${acc.inst ? ' • IIN: ' + acc.inst : ''}` :
                    `Transit: ${acc.transit || '00000'} • Institution: ${acc.inst || '003'} • Account: ••••${(acc.accountNumber || '').slice(-4) || '2443'}`
                }
            </div>
            <div style="font-size: 10px; font-weight: 500; color: #94a3b8;">
              ${getAccountPeriodRange(acc.id) ? `Period: ${getAccountPeriodRange(acc.id)}` : 'Period: No transactions'}
            </div>
          </div>
        </div>
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
      `;
        } else {
            // NO ACCOUNT SELECTED
            metaContent.innerHTML = `
        <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 12px;">
          <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Account Metadata</div>
          <div style="font-family: ${terminalFont}; font-size: 12px; color: #64748b; opacity: 0.6;">&gt; No account selected</div>
        </div>
      `;
        }
    }
};
