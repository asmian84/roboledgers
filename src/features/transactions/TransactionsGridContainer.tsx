import React from 'react';
import { createRoot } from 'react-dom/client';
import { TransactionsTable } from './TransactionsTable';
import { CanonicalTransaction } from '../../types/CanonicalTransaction';

// This is the bridge between Vanilla JS and React
window.renderTransactionsGrid = (data: CanonicalTransaction[]) => {
    const container = document.getElementById('txnGrid');
    if (!container) {
        console.error('[React Bridge] Mounting point #txnGrid not found');
        return;
    }

    // Use a stable root if possible to avoid re-mounting on every refresh
    // In a real environment, we'd store the root on the window or a global state
    if (!(window as any)._txGridRoot) {
        (window as any)._txGridRoot = createRoot(container);
    }

    (window as any)._txGridRoot.render(
        <React.StrictMode>
            <TransactionsTable data={data} />
        </React.StrictMode>
    );
};
