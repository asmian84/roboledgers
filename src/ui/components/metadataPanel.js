/**
 * Metadata Panel System
 * Displays account context: Institution, Transit, Account#, Type
 * Updates on account switch or row focus
 */

const MetadataPanel = (() => {
  const PANEL_ID = 'v5-metadata-panel';

  function getAccountTypeIcon(accountType) {
    const type = (accountType || '').toLowerCase();
    if (type.includes('credit')) return 'ph-credit-card';
    if (type.includes('savings')) return 'ph-piggy-bank';
    if (type.includes('checking') || type.includes('chequing')) return 'ph-bank';
    if (type.includes('investment')) return 'ph-chart-line';
    if (type.includes('money') || type.includes('market')) return 'ph-currency-circle-dollar';
    return 'ph-bank';
  }

  function createPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = `
      padding: 12px 16px;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #cbd5e1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      letter-spacing: 0.05em;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
      display: flex;
      align-items: center;
      gap: 24px;
      min-height: 50px;
      transition: all 0.3s ease;
    `;

    return panel;
  }

  function findPanelContainer() {
    // Look for v5-main-header or create insertion point after action bar
    const actionBar = document.querySelector('.v5-action-bar');
    if (!actionBar) return null;

    let container = actionBar.nextElementSibling;
    if (!container || container.id !== PANEL_ID) {
      container = createPanel();
      actionBar.parentNode.insertBefore(container, actionBar.nextSibling);
    }
    return container;
  }

  function render(account) {
    const container = findPanelContainer();
    if (!container) return;

    if (!account) {
      container.innerHTML = '<span style="color: #475569;">No account selected</span>';
      return;
    }

    const typeIcon = getAccountTypeIcon(account.type);
    const accType = account.accountType || account.type || 'ACCOUNT';
    const bankName = account.name || account.brand || account.bank || 'Unknown Bank';

    const fields = [
      {
        label: 'BANK',
        value: bankName,
        icon: 'ph-bank',
        prominent: true
      },
      {
        label: 'INSTITUTION',
        value: account.inst || account.institutionCode || '---',
        icon: 'ph-buildings'
      },
      {
        label: 'TRANSIT',
        value: account.transit || '---',
        icon: 'ph-hash'
      },
      {
        label: 'ACCOUNT',
        value: account.accountNumber || '---',
        icon: 'ph-credit-card'
      },
      {
        label: 'TYPE',
        value: accType.toUpperCase(),
        icon: typeIcon
      }
    ];

    container.innerHTML = fields.map(field => `
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="ph ${field.icon}" style="font-size: 14px; color: ${field.prominent ? '#3b82f6' : '#64748b'}; opacity: 0.8;"></i>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 0.1em;">${field.label}</span>
          <span style="font-size: ${field.prominent ? '14px' : '13px'}; font-weight: ${field.prominent ? '700' : '600'}; color: ${field.prominent ? '#3b82f6' : '#e2e8f0'};">${field.value}</span>
        </div>
      </div>
    `).join('');
  }

  function clear() {
    const container = document.getElementById(PANEL_ID);
    if (container) {
      container.innerHTML = '<span style="color: #475569;">No account selected</span>';
    }
  }

  return {
    render,
    clear,
    createPanel,
    getAccountTypeIcon
  };
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetadataPanel;
}
window.MetadataPanel = MetadataPanel;
