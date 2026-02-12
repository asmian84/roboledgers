import React from 'react';
import ReactDOM from 'react-dom/client';
import { TransactionsTable } from './TransactionsTable';

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

// Alias for backward compatibility
window.renderTransactionsGrid = window.mountTransactionsTable;

/**
 * Global Bridge: Mount PDFSnippet component for reconciliation source modals
 */
import { PDFSnippet } from './components/PDFSnippet';

window.mountPDFSnippet = (containerId, pdfUrl, page, linePosition) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[PDF SNIPPET] Container #${containerId} not found`);
        return;
    }

    // Create a fresh root for this snippet
    const root = ReactDOM.createRoot(container);

    root.render(
        <React.StrictMode>
            <PDFSnippet
                pdfUrl={pdfUrl}
                page={page}
                linePosition={linePosition}
            />
        </React.StrictMode>
    );

    console.log(`[PDF SNIPPET] Mounted in #${containerId}`);

    // Store root for cleanup
    container._pdfSnippetRoot = root;
};

/**
 * Cleanup function to unmount PDF snippet
 */
window.unmountPDFSnippet = (containerId) => {
    const container = document.getElementById(containerId);
    if (container && container._pdfSnippetRoot) {
        container._pdfSnippetRoot.unmount();
        delete container._pdfSnippetRoot;
        console.log(`[PDF SNIPPET] Unmounted from #${containerId}`);
    }
};

console.log('[VITE] React bridge established.');
