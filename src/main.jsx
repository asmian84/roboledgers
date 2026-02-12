import React from 'react';
import ReactDOM from 'react-dom/client';
import { TransactionsTable } from './TransactionsTable';
import { HomePage } from './components/HomePage';

/**
 * Global Bridge: Exposes the mounting function to the Vanilla JS shell (app.js)
 */
window.mountTransactionsTable = (data, filterQuery = '') => {
    const container = document.getElementById('txnGrid');
    if (!container) return;

    // If the old root's container was detached from the DOM (e.g. by render() replacing innerHTML),
    // we must create a fresh root on the new container node.
    if (window._txGridRoot && window._txGridRootContainer && !document.body.contains(window._txGridRootContainer)) {
        try { window._txGridRoot.unmount(); } catch (e) { /* ignore */ }
        window._txGridRoot = null;
        window._txGridRootContainer = null;
    }

    if (!window._txGridRoot) {
        window._txGridRoot = ReactDOM.createRoot(container);
        window._txGridRootContainer = container; // Track which DOM node the root is bound to
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
        // REF# is visual display counter (001, 002, 003...) that resets based on current filter
        // Prefix comes from UI_STATE.refPrefix (set by updateWorkspace based on selected account)
        ref: `${window.UI_STATE?.refPrefix || 'TXN'}-${String(idx + 1).padStart(3, '0')}`,
        status: tx.status || 'Imported',
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

/**
 * Mount HomePage component
 */
window.mountHomePage = () => {
    console.log('[HOMEPAGE] mountHomePage called');
    const container = document.getElementById('txnGrid');
    if (!container) {
        console.error('[HOMEPAGE] Container #txnGrid not found!');
        return;
    }
    console.log('[HOMEPAGE] Container found:', container);

    // Unmount existing root if needed
    if (window._txGridRoot && window._txGridRootContainer && !document.body.contains(window._txGridRootContainer)) {
        try { window._txGridRoot.unmount(); } catch (e) { /* ignore */ }
        window._txGridRoot = null;
        window._txGridRootContainer = null;
    }

    if (!window._txGridRoot) {
        console.log('[HOMEPAGE] Creating new React root');
        window._txGridRoot = ReactDOM.createRoot(container);
        window._txGridRootContainer = container;
    }

    console.log('[HOMEPAGE] Rendering HomePage component');
    window._txGridRoot.render(
        <React.StrictMode>
            <HomePage onNavigate={(route) => window.navigateTo(route)} />
        </React.StrictMode>
    );
    console.log('[HOMEPAGE] Render complete');
};

// Alias for backward compatibility
window.renderTransactionsGrid = window.mountTransactionsTable;

console.log('[VITE] React bridge established.');

