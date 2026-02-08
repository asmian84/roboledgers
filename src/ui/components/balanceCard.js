// Financial Balance Card Component
window.getReconciliationCardHTML = function () {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const allTxns = window.RoboLedger.Ledger.getAll();
  const recentTxns = allTxns.filter(t => {
    const txDate = t.date_iso ? new Date(t.date_iso) : new Date(t.date);
    return txDate >= thirtyDaysAgo;
  });

  const totalDebits = recentTxns.filter(t => t.polarity === 'DEBIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;
  const totalCredits = recentTxns.filter(t => t.polarity === 'CREDIT').reduce((sum, t) => sum + (t.amount_cents || 0), 0) / 100;

  // Get opening balance from primary account or legacy balance
  const activeAcc = window.RoboLedger.Accounts.getAll().find(a => a.id === window.UI_STATE.selectedAccount) || window.RoboLedger.Accounts.getAll()[0];
  const latestTxn = allTxns[allTxns.length - 1];

  // Ledger stores balance in CENTS, convert to DOLLARS for UI
  let openingBalance = 0;
  if (latestTxn && latestTxn.balance != null) {
    openingBalance = latestTxn.balance / 100;
  } else if (activeAcc) {
    openingBalance = activeAcc.openingBalance || 0;
  }

  const endingBalance = openingBalance - totalDebits + totalCredits;

  return `
    <!-- Financial Balance Card (Horizontal Snug Version) -->
    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; margin: 8px 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 32px;">
        
        <!-- Opening Balance -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Opening Balance</label>
          <div style="position: relative; width: 140px;">
            <input 
              type="text" 
              id="openingBalance" 
              value="$${openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}" 
              style="padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; font-weight: 700; color: #1e293b; background: #f8fafc; width: 100%; font-family: monospace;" 
            />
          </div>
        </div>

        <!-- Divider -->
        <div style="width: 1px; height: 32px; background: #e2e8f0;"></div>
        
        <!-- Debits (Outflow) -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">
            Debits <sup style="font-size: 8px; color: #94a3b8;">$${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</sup>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: #ef4444; font-family: monospace;">
            −$${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <!-- Credits (Inflow) -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">
            Credits <sup style="font-size: 8px; color: #94a3b8;">$${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</sup>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: #10b981; font-family: monospace;">
            +$${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <!-- Divider -->
        <div style="width: 1px; height: 32px; background: #e2e8f0;"></div>
        
        <!-- Ending Balance -->
        <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 16px;">
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Ending Balance</div>
            <div style="font-size: 9px; color: #94a3b8; font-weight: 400;">Opening − Debits + Credits</div>
          </div>
          <div style="font-size: 24px; font-weight: 900; color: ${endingBalance >= 0 ? '#10b981' : '#ef4444'}; font-family: monospace; min-width: 160px; text-align: right;">
            ${endingBalance >= 0 ? '+' : ''}$${endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        
      </div>
    </div>
  `;
};

console.log('[BALANCE CARD] Comprehensive financial balance calculator loaded');
