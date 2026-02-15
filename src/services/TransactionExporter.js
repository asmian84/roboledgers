/**
 * Transaction Export Utility
 * Exports grid data in multiple formats: CSV, Excel-compatible CSV, JSON
 */

class TransactionExporter {
    /**
     * Export transactions to CSV format
     */
    static exportCSV(transactions, filename = 'transactions.csv') {
        if (!transactions || transactions.length === 0) {
            alert('No transactions to export');
            return;
        }

        // CSV headers
        const headers = ['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance', 'Account (COA)', 'Category', 'Status'];

        // Build CSV rows - use amount_cents + polarity
        const rows = transactions.map(tx => {
            const amount = (tx.amount_cents || 0) / 100;
            const debit = tx.polarity === 'DEBIT' ? amount.toFixed(2) : '';
            const credit = tx.polarity === 'CREDIT' ? amount.toFixed(2) : '';

            return [
                tx.date || '',
                tx.ref || tx.tx_id || '',
                `"${(tx.description || '').replace(/"/g, '""')}"`, // Escape quotes
                debit,
                credit,
                tx.balance_cents ? (tx.balance_cents / 100).toFixed(2) : '',
                tx.coa_code || tx.account_code || tx.category || '',
                `"${(tx.category || '').replace(/"/g, '""')}"`,
                tx.status || 'Imported'
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');

        this.downloadFile(csv, filename, 'text/csv');
        console.log(`[EXPORT] Exported ${transactions.length} transactions to CSV`);
    }

    /**
     * Export transactions to Excel-compatible CSV (UTF-8 with BOM)
     */
    static exportExcel(transactions, filename = 'transactions_excel.csv') {
        if (!transactions || transactions.length === 0) {
            alert('No transactions to export');
            return;
        }

        // Same as CSV but with UTF-8 BOM for Excel compatibility
        const headers = ['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance', 'Account (COA)', 'Category', 'Status'];

        const rows = transactions.map(tx => {
            const amount = (tx.amount_cents || 0) / 100;
            const debit = tx.polarity === 'DEBIT' ? amount.toFixed(2) : '';
            const credit = tx.polarity === 'CREDIT' ? amount.toFixed(2) : '';

            return [
                tx.date || '',
                tx.ref || tx.tx_id || '',
                `"${(tx.description || '').replace(/"/g, '""')}"`,
                debit,
                credit,
                tx.balance_cents ? (tx.balance_cents / 100).toFixed(2) : '',
                tx.coa_code || tx.account_code || tx.category || '',
                `"${(tx.category || '').replace(/"/g, '""')}"`,
                tx.status || 'Imported'
            ].join(',');
        });

        const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // UTF-8 BOM

        this.downloadFile(csv, filename, 'text/csv;charset=utf-8');
        console.log(`[EXPORT] Exported ${transactions.length} transactions to Excel CSV`);
    }

    /**
     * Export transactions to JSON format
     */
    static exportJSON(transactions, filename = 'transactions.json') {
        if (!transactions || transactions.length === 0) {
            alert('No transactions to export');
            return;
        }

        const json = JSON.stringify(transactions, null, 2);

        this.downloadFile(json, filename, 'application/json');
        console.log(`[EXPORT] Exported ${transactions.length} transactions to JSON`);
    }

    /**
     * Export UNCATEGORIZED transactions only (for AI pattern analysis)
     */
    static exportUncategorized(transactions, filename = 'uncategorized.csv') {
        const uncategorized = transactions.filter(tx =>
            !tx.coa_code && !tx.account_code && !tx.category
        );

        if (uncategorized.length === 0) {
            alert('No uncategorized transactions found!');
            return;
        }

        console.log(`[EXPORT] Found ${uncategorized.length} uncategorized transactions out of ${transactions.length} total`);
        this.exportCSV(uncategorized, filename);
    }

    /**
     * Helper: Trigger file download
     */
    static downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Export current grid state (respects filters and sorting)
     */
    static exportCurrentView(format = 'csv') {
        // Get transactions from the Ledger
        const gridData = window.RoboLedger?.Ledger?.getAll() || [];

        if (gridData.length === 0) {
            alert('No transactions in current view');
            return;
        }

        console.log(`[EXPORT] Exporting ${gridData.length} transactions in format: ${format}`);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const accountRef = window.UI_STATE?.refPrefix || 'TXN';

        switch (format.toLowerCase()) {
            case 'csv':
                this.exportCSV(gridData, `${accountRef}_${timestamp}.csv`);
                break;
            case 'excel':
                this.exportExcel(gridData, `${accountRef}_${timestamp}_excel.csv`);
                break;
            case 'json':
                this.exportJSON(gridData, `${accountRef}_${timestamp}.json`);
                break;
            case 'uncategorized':
                this.exportUncategorized(gridData, `${accountRef}_uncategorized_${timestamp}.csv`);
                break;
            default:
                console.error('[EXPORT] Unknown format:', format);
        }
    }
}

// Export to global scope
window.TransactionExporter = TransactionExporter;
