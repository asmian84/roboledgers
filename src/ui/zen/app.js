/**
 * RoboLedgers: Zen Mode Frontend Application
 * Consumes: ZenTransactionProjection Contract
 */

// Mock Projected Data (In a real app, this comes from the ProjectionService)
// This follows the ZenTransactionProjection interface exactly.
const mockProjectedData = [
    {
        id: 'tx_01',
        merchant_display: 'Starbucks',
        category_name: 'Dining',
        amount_display: '-$12.50 CAD',
        date: 'Today',
        status_badge: 'PREDICTED',
        confidence_label: 'HIGH'
    },
    {
        id: 'tx_02',
        merchant_display: 'Apple Store',
        category_name: 'Technology',
        amount_display: '-$1,299.00 CAD',
        date: 'Yesterday',
        status_badge: 'RECONCILED',
        confidence_label: 'HIGH'
    },
    {
        id: 'tx_03',
        merchant_display: 'Client Payment',
        category_name: 'Income',
        amount_display: '+$2,500.00 CAD',
        date: '2 days ago',
        status_badge: 'RECONCILED',
        confidence_label: 'HIGH'
    }
];

function renderStream(transactions) {
    const container = document.getElementById('transaction-stream');
    container.innerHTML = '';

    transactions.forEach(tx => {
        const item = document.createElement('div');
        item.className = 'transaction-item';

        // Truth badge mapping
        const badgeClass = tx.status_badge.toLowerCase();

        item.innerHTML = `
      <div class="tx-info">
        <span class="tx-merchant">${tx.merchant_display}</span>
        <div class="tx-meta">
          <span>${tx.date}</span>
          <span>•</span>
          <span>${tx.category_name}</span>
        </div>
      </div>
      <div class="tx-amount-area">
        <span class="tx-amount">${tx.amount_display}</span>
        <span class="badge ${badgeClass}">${tx.status_badge}</span>
      </div>
    `;

        item.addEventListener('click', () => {
            if (tx.status_badge === 'PREDICTED') {
                confirmCategory(tx);
            } else {
                renameMerchant(tx);
            }
        });

        container.appendChild(item);
    });
}

/**
 * INTENT: Confirm Category
 * Rules: Only if PREDICTED.
 */
function confirmCategory(tx) {
    console.log(`[INTENT] Confirming category for ${tx.id}`);
    tx.status_badge = 'RECONCILED'; // In reality, would wait for domain result
    renderStream(mockProjectedData);
}

/**
 * INTENT: Rename Merchant
 */
function renameMerchant(tx) {
    const newName = prompt(`Rename merchant "${tx.merchant_display}" to:`, tx.merchant_display);
    if (newName && newName !== tx.merchant_display) {
        console.log(`[INTENT] Renaming ${tx.merchant_display} to ${newName}`);
        tx.merchant_display = newName;
        renderStream(mockProjectedData);
    }
}

// Initial Render
renderStream(mockProjectedData);
