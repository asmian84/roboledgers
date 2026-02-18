import React from 'react';
import ReactDOM from 'react-dom/client';
import { TransactionsTable } from './TransactionsTable2.jsx';  // TESTING EXPERIMENTAL VERSION
import { ReportsPage } from './reports/ReportsPage';
import HomePage from './ui/pages/HomePage.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
// Import TransactionExporter so it bundles with xlsx and registers window.TransactionExporter
import './services/TransactionExporter.js';


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

    // Get density setting
    const density = window.UI_STATE?.density || 'comfortable';

    // Load saved column preferences from localStorage (with corruption recovery)
    let savedPrefs = {};
    try {
        const stored = localStorage.getItem('roboledger_column_prefs');
        if (stored) savedPrefs = JSON.parse(stored);
    } catch (e) {
        localStorage.removeItem('roboledger_column_prefs');
    }
    const columnVisibility = {
        // TanStack Grid uses INVERTED logic in state: false = visible, true = hidden
        // If user enabled tax (savedPrefs.tax_cents === true), pass false to TanStack (visible)
        // If user disabled tax (savedPrefs.tax_cents === false/undefined), pass true to TanStack (hidden)
        tax_cents: savedPrefs.tax_cents !== true
    };
    // Restore any active drill-down filter from UI_STATE so it survives re-renders
    const activeDrillFilter = window.UI_STATE?.activeCategoryFilter || null;

    // Create props object and save for updateGridDensity
    const gridProps = {
        data: pureTransactions,
        globalFilter: filterQuery,
        gridTheme: theme,
        gridFontSize: fontSize,
        gridDensity: density,
        columnVisibility: columnVisibility,
        initialCategoryFilter: activeDrillFilter,   // Persists drill-down across re-renders
    };
    window._txGridProps = gridProps;
    // Always update the "source of truth" for predicate filters so they operate on fresh data
    window._txGridAllData = pureTransactions;

    // Render with error boundary to prevent white screen crashes
    window._txGridRoot.render(
        <React.StrictMode>
            <ErrorBoundary fallbackMessage="Failed to render transactions grid">
                <TransactionsTable {...gridProps} />
            </ErrorBoundary>
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

    window._txGridProps.gridDensity = newDensity;

    window._txGridRoot.render(
        <React.StrictMode>
            <ErrorBoundary fallbackMessage="Failed to render transactions grid">
                <TransactionsTable
                    {...window._txGridProps}
                />
            </ErrorBoundary>
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
    }
};

/**
 * Global Bridge: Set grid filter (called from utility bar category chart and drill-down)
 *
 * Accepts:
 *   - string/number: passed as globalFilter (TanStack column filter — searches all columns)
 *   - function (tx) => bool: applied as a pre-filter on the data array before rendering
 *   - null/undefined: clears all filters and restores full dataset
 */
window.setTxGridFilter = (filterValue) => {
    // Always resolve full dataset first
    const allData = window._txGridAllData
        || window._txGridProps?.data
        || window.RoboLedger?.Ledger?.getAll()
        || [];
    if (!window._txGridAllData && allData.length) window._txGridAllData = allData;

    let filteredData, newGlobalFilter = '';

    if (typeof filterValue === 'function') {
        window._txGridFilterPredicate = filterValue;
        filteredData = allData.filter(filterValue);
        console.log(`[setTxGridFilter] predicate → ${filteredData.length} / ${allData.length} rows`);
    } else if (filterValue === null || filterValue === undefined) {
        window._txGridFilterPredicate = null;
        filteredData = allData;
        console.log(`[setTxGridFilter] cleared → ${allData.length} rows`);
    } else {
        window._txGridFilterPredicate = null;
        filteredData = allData;
        newGlobalFilter = String(filterValue);
        console.log(`[setTxGridFilter] globalFilter → "${newGlobalFilter}"`);
    }

    // Preferred: direct React state bridge (never goes stale)
    if (window.__txGridSetData) {
        if (window._txGridProps) {
            window._txGridProps.data = filteredData;
            window._txGridProps.globalFilter = newGlobalFilter;
        }
        window.__txGridSetData(filteredData);
        return;
    }

    // Fallback: re-render via root (may be stale if DOM was replaced)
    if (!window._txGridRoot || !window._txGridProps) {
        console.warn('[setTxGridFilter] ❌ No bridge and no root available');
        return;
    }
    console.log('[setTxGridFilter] → fallback root.render()');
    window._txGridProps.data = filteredData;
    window._txGridProps.globalFilter = newGlobalFilter;
    window._txGridRoot.render(
        <React.StrictMode>
            <ErrorBoundary fallbackMessage="Failed to render transactions grid">
                <TransactionsTable {...window._txGridProps} />
            </ErrorBoundary>
        </React.StrictMode>
    );
};


/**
 * Mount ReportsPage React component
 */
window.mountReportsPage = () => {
    const container = document.getElementById('reports-container');
    if (!container) {
        console.error('[MAIN.JSX] Reports container not found');
        return;
    }

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
            <ErrorBoundary fallbackMessage="Failed to render reports">
                <ReportsPage />
            </ErrorBoundary>
        </React.StrictMode>
    );
};

window.unmountReportsPage = () => {
    if (window._reportsRoot) {
        try {
            window._reportsRoot.unmount();
        } catch (e) {
            console.warn('[MAIN.JSX] ⚠ Reports unmount error:', e);
        }
        window._reportsRoot = null;
        window._reportsRootContainer = null;
    }
};

/**
 * Mount HomePage component for feature showcase landing
 */
window.mountHomePage = () => {
    const container = document.getElementById('home-container');
    if (!container) {
        console.error('[MAIN.JSX] Home container not found');
        return;
    }


    if (window._homeRoot && window._homeRootContainer && !document.body.contains(window._homeRootContainer)) {
        try { window._homeRoot.unmount(); } catch (e) { /* ignore */ }
        window._homeRoot = null;
        window._homeRootContainer = null;
    }

    if (!window._homeRoot) {
        window._homeRoot = ReactDOM.createRoot(container);
        window._homeRootContainer = container;
    }

    window._homeRoot.render(
        <React.StrictMode>
            <HomePage />
        </React.StrictMode>
    );
};

window.unmountHomePage = () => {
    if (window._homeRoot) {
        try {
            window._homeRoot.unmount();
        } catch (e) {
            console.warn('[MAIN.JSX] ⚠ Home unmount error:', e);
        }
        window._homeRoot = null;
        window._homeRootContainer = null;
    }
};

