import React from 'react';
import ReactDOM from 'react-dom/client';
import { TransactionsTable } from './TransactionsTable';
import { ReportsPage } from './reports/ReportsPage';

/**
 * Global Bridge: Exposes the mounting function to the Vanilla JS shell (app.js)
 */
window.mountTransactionsTable = (data, filterQuery = '') => {
    const container = document.getElementById('txnGrid');
    if (!container) return;

    // Use theme+fontSize as React key to force component remount when they change
    // This ensures GRID_TOKENS (calculated at module level) gets fresh values
    const theme = window.UI_STATE?.gridTheme || 'default';
    const fontSize = window.UI_STATE?.gridFontSize || 13.5;
    const uniqueKey = `table-${theme}-${fontSize}`;

    console.log('[MAIN.JSX] Mounting grid with key:', uniqueKey);
    console.log('[MAIN.JSX] Theme from UI_STATE:', theme);
    console.log('[MAIN.JSX] FontSize from UI_STATE:', fontSize);

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

    // Filter out opening balance rows (reference points, not transactions)
    const pureTransactions = canonicalData.filter(tx => tx.ref && !tx.ref.includes('opening-balance'));

    console.log(`[MAIN.JSX] Canonical data count:`, pureTransactions.length);

    // Get density setting
    const density = window.UI_STATE?.density || 'comfortable';
    console.log(`[MAIN.JSX] Grid density:`, density);

    // Load saved column preferences from localStorage
    const savedPrefs = JSON.parse(localStorage.getItem('roboledger_column_prefs') || '{}');
    const columnVisibility = {
        // TanStack Grid uses INVERTED logic in state: false = visible, true = hidden
        // If user enabled tax (savedPrefs.tax_cents === true), pass false to TanStack (visible)
        // If user disabled tax (savedPrefs.tax_cents === false/undefined), pass true to TanStack (hidden)
        tax_cents: savedPrefs.tax_cents !== true
    };
    console.log('[MAIN.JSX] Initial column visibility from localStorage:', columnVisibility);

    // Create props object and save for updateGridDensity
    const gridProps = {
        data: pureTransactions,
        globalFilter: filterQuery,
        gridTheme: theme,
        gridFontSize: fontSize,
        gridDensity: density,
        columnVisibility: columnVisibility
    };
    window._txGridProps = gridProps;

    // Render
    window._txGridRoot.render(
        <React.StrictMode>
            <TransactionsTable {...gridProps} />
        </React.StrictMode>
    );
};

// Alias for backward compatibility
window.renderTransactionsGrid = window.mountTransactionsTable;

/**
 * Global Bridge: Updates the grid density without remounting the entire component.
 */
window.updateGridDensity = (newDensity) => {
    if (!window._txGridRoot || !window._txGridProps) {
        console.warn('[MAIN.JSX] Grid not mounted, cannot update density.');
        return;
    }

    console.log(`[MAIN.JSX] Updating grid density to: ${newDensity}`);
    window._txGridProps.gridDensity = newDensity;

    window._txGridRoot.render(
        <React.StrictMode>
            <TransactionsTable
                {...window._txGridProps}
            />
        </React.StrictMode>
    );
};

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

/**
 * Global Bridge: Mount DocumentViewer for balance source viewing
 */
import { DocumentViewer } from './components/DocumentViewer';

window.mountDocumentViewer = (containerId, document) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[DOC VIEWER] Container #${containerId} not found`);
        return;
    }

    // Create a fresh root for this viewer
    const root = ReactDOM.createRoot(container);

    root.render(
        <React.StrictMode>
            <DocumentViewer
                document={document}
                onBack={() => window.closeBalanceViewer?.()}
            />
        </React.StrictMode>
    );

    console.log(`[DOC VIEWER] Mounted in #${containerId}`);

    // Store root for cleanup
    container._documentViewerRoot = root;
};

/**
 * Cleanup function to unmount DocumentViewer
 */
window.unmountDocumentViewer = (containerId) => {
    const container = document.getElementById(containerId);
    if (container && container._documentViewerRoot) {
        container._documentViewerRoot.unmount();
        delete container._documentViewerRoot;
        console.log(`[DOC VIEWER] Unmounted from #${containerId}`);
    }
};

/**
 * Global Bridge: Set grid filter (called from utility bar category chart)
 */
window.setTxGridFilter = (filterValue) => {
    if (!window._txGridRoot || !window._txGridProps) {
        console.warn('[MAIN.JSX] Grid not mounted, cannot set filter.');
        return;
    }

    console.log(`[MAIN.JSX] Setting grid filter to: ${filterValue}`);
    window._txGridProps.globalFilter = filterValue;

    window._txGridRoot.render(
        <React.StrictMode>
            <TransactionsTable {...window._txGridProps} />
        </React.StrictMode>
    );
};

console.log('[VITE] React bridge established.');

/**
 * Mount ReportsPage React component
 */
window.mountReportsPage = () => {
    const container = document.getElementById('reports-container');
    if (!container) {
        console.error('[MAIN.JSX] Reports container not found');
        return;
    }

    console.log('[MAIN.JSX] Mounting ReportsPage');

    if (window._reportsRoot && window._reportsRootContainer && !document.body.contains(window._reportsRootContainer)) {
        try { window._reportsRoot.unmount(); } catch (e) { /* ignore */ }
        window._reportsRoot = null;
        window._reportsRootContainer = null;
    }

    if (!window._reportsRoot) {
        window._reportsRoot = ReactDOM.createRoot(container);
        window._reportsRootContainer = container;
    }

    window._reportsRoot.render(
        <React.StrictMode>
            <ReportsPage />
        </React.StrictMode>
    );
};

window.unmountReportsPage = () => {
    if (window._reportsRoot) {
        try {
            window._reportsRoot.unmount();
            console.log('[MAIN.JSX] ✓ Reports unmounted');
        } catch (e) {
            console.warn('[MAIN.JSX] ⚠ Reports unmount error:', e);
        }
        window._reportsRoot = null;
        window._reportsRootContainer = null;
    }
};
