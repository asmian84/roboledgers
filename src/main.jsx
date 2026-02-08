import React from 'react';
import ReactDOM from 'react-dom/client';
import { TransactionsTable } from './TransactionsTable';

/**
 * Global Bridge: Exposes the mounting function to the Vanilla JS shell (app.js)
 */
window.mountTransactionsTable = (data, filterQuery = '') => {
    const container = document.getElementById('txnGrid');
    if (!container) return;

    if (!window._txGridRoot) {
        window._txGridRoot = ReactDOM.createRoot(container);
    }

    // Filter out opening balance rows (reference points, not transactions)
    const transactionsOnly = data.filter(tx => {
        const desc = (tx.description || tx.raw_description || '').toLowerCase();
        return !desc.includes('opening balance');
    });

    // Mock status for better demo feel (keeping parity with index.html version)
    const statuses = ['Matched', 'Pending', 'Flagged', 'Imported'];

    // Get current ref prefix from UI state (default CHQ1)
    const refPrefix = (window.UI_STATE && window.UI_STATE.refPrefix) || 'CHQ1';

    const canonicalData = transactionsOnly.map((tx, idx) => ({
        ...tx,
        ref: tx.ref || `${refPrefix}-${String(idx + 1).padStart(3, '0')}`, // Simple sequential: CHQ1-001, CHQ1-002, CHQ1-003
        status: tx.status || statuses[idx % 4],
        payee: tx.description || tx.raw_description || 'Unknown',
        debit: tx.polarity === 'DEBIT' ? tx.amount_cents / 100 : null,
        credit: tx.polarity === 'CREDIT' ? tx.amount_cents / 100 : null,
        balance: tx.balance_cents / 100 || 0,
        category: tx.category_code || tx.category || ''
    }));

    window._txGridRoot.render(
        <React.StrictMode>
            <TransactionsTable data={canonicalData} globalFilter={filterQuery} />
        </React.StrictMode>
    );
};

// Alias for backward compatibility
window.renderTransactionsGrid = window.mountTransactionsTable;

console.log('[VITE] React bridge established.');
