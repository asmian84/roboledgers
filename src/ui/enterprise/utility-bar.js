/**
 * updateUtilityBar - Populate mini dashboard in collapsed sidebar mode
 * Shows transaction stats, pending work, P&L, category breakdown, and accounts
 */
window.updateUtilityBar = function () {
    const allTxns = window.RoboLedger?.Ledger?.getAll() || [];
    const accounts = window.RoboLedger?.Accounts?.getAll() || [];

    if (allTxns.length === 0) return; // No data to display

    // --- Transaction Stats ---
    document.getElementById('util-total-txns').textContent = allTxns.length.toLocaleString();

    // Date range
    const dates = allTxns.map(t => new Date(t.date)).filter(d => !isNaN(d));
    if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        document.getElementById('util-date-range').textContent =
            `${minDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${maxDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }

    // --- Pending Work ---
    const uncategorized = allTxns.filter(t => !t.category || t.category === 'Uncategorized').length;
    const needsReview = allTxns.filter(t => t.confidence && t.confidence < 0.7).length;

    document.getElementById('util-uncategorized').textContent = uncategorized;
    document.getElementById('util-needs-review').textContent = needsReview;

    // --- Net Position (In/Out/Balance) ---
    let totalIn = 0;
    let totalOut = 0;

    allTxns.forEach(t => {
        const amount = parseFloat(t.debit_cents || t.credit_cents || t.amount || 0) / 100;
        if (t.debit_cents || amount > 0) {
            totalIn += Math.abs(amount);
        } else {
            totalOut += Math.abs(amount);
        }
    });

    const netPosition = totalIn - totalOut;

    document.getElementById('util-total-balance').textContent =
        new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(netPosition);
    document.getElementById('util-total-in').textContent =
        new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(totalIn);
    document.getElementById('util-total-out').textContent =
        new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(totalOut);

    // --- Quick P&L ---
    let revenue = 0;
    let expenses = 0;

    allTxns.forEach(t => {
        const amount = parseFloat(t.debit_cents || t.credit_cents || t.amount || 0) / 100;
        const category = t.category || 'Uncategorized';

        // Simple heuristic: positive amounts in revenue categories = revenue
        if (category.toLowerCase().includes('revenue') || category.toLowerCase().includes('income') || category.toLowerCase().includes('sales')) {
            revenue += Math.abs(amount);
        } else if (amount < 0 || category.toLowerCase().includes('expense') || category.toLowerCase().includes('cost')) {
            expenses += Math.abs(amount);
        }
    });

    const netIncome = revenue - expenses;

    document.getElementById('util-revenue').textContent =
        new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(revenue);
    document.getElementById('util-expenses').textContent =
        new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(expenses);
    document.getElementById('util-net-income').textContent =
        new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(netIncome);
    document.getElementById('util-net-income').style.color = netIncome >= 0 ? '#10b981' : '#ef4444';

    // --- Category Allocation (Top 5 with interactive chart) ---
    const categoryTotals = {};
    allTxns.forEach(t => {
        const category = t.category || 'Uncategorized';
        const amount = Math.abs(parseFloat(t.debit_cents || t.credit_cents || t.amount || 0) / 100);
        categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    });

    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const total = topCategories.reduce((sum, [_, amount]) => sum + amount, 0);

    const chartContainer = document.getElementById('util-category-chart');
    if (topCategories.length > 0) {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

        chartContainer.innerHTML = topCategories.map(([category, amount], idx) => {
            const percent = ((amount / total) * 100).toFixed(1);
            return `
          <div 
            style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s; margin-bottom: 4px;"
            onmouseover="this.style.backgroundColor='#f1f5f9'"
            onmouseout="this.style.backgroundColor='transparent'"
            onclick="window.filterByCategory('${category}')"
          >
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${colors[idx]};"></div>
              <span style="font-size: 11px; color: #1e293b; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${category}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace;">${percent}%</span>
              <span style="font-size: 11px; font-weight: 600; color: #1e293b; font-family: 'JetBrains Mono', monospace;">
                ${new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(amount)}
              </span>
            </div>
          </div>
        `;
        }).join('');
    }

    // --- Active Accounts ---
    const badgesContainer = document.getElementById('util-account-badges');
    if (accounts.length > 0) {
        const accountColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

        badgesContainer.innerHTML = accounts.slice(0, 5).map((acc, idx) => `
        <div 
          class="utility-badge" 
          style="background: ${accountColors[idx % accountColors.length]};"
          onclick="window.updateWorkspace('${acc.id}')"
        >
          ${acc.name || acc.id}
        </div>
      `).join('');
    } else {
        badgesContainer.innerHTML = '<div style="text-align: center; padding: 12px; color: #94a3b8; font-size: 11px;">No accounts loaded</div>';
    }
};

/**
 * filterByCategory - Click handler for category chart
 * Filters the main transaction grid by selected category
 */
window.filterByCategory = function (category) {
    console.log('[UTILITY BAR] Filtering by category:', category);

    // Update the global filter in main.jsx
    window.setTxGridFilter(category);
    console.log('[UTILITY BAR] Grid filter set to:', category);
};
