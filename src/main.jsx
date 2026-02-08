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

    const canonicalData = transactionsOnly.map((tx, idx) => ({
        ...tx,
        ref: tx.ref || `${tx.account_id || 'CHQ1'}-${String(idx + 1).padStart(3, '0')}`, // Generate ref if missing
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
