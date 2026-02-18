/**
 * Transaction Export Utility
 * Exports grid data in multiple formats: CSV, real XLSX (SheetJS), JSON
 */
import * as XLSX from 'xlsx';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Resolve COA account name from category code */
function resolveCOAName(categoryCode) {
    if (!categoryCode) return '';
    const COA = window.RoboLedger?.COA;
    if (!COA) return categoryCode;
    const account = COA.get(String(categoryCode)) || COA.get(parseInt(categoryCode));
    if (account?.name) return account.name;
    if (String(categoryCode) === '9970') return 'Uncategorized';
    return `Account ${categoryCode}`;
}

/** Build the standard row array for a single transaction */
function buildRow(tx) {
    const amount = (tx.amount_cents || 0) / 100;
    return [
        tx.date || '',
        tx.ref || tx.tx_id || '',
        tx.description || '',
        tx.polarity === 'DEBIT'   ? amount : '',
        tx.polarity === 'CREDIT'  ? amount : '',
        tx.balance_cents ? (tx.balance_cents / 100) : '',
        tx.category || '',
        resolveCOAName(tx.category),
        tx.status || 'Imported',
    ];
}

const TX_HEADERS = ['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance', 'COA Code', 'COA Name', 'Status'];

/** Apply basic header styling to a worksheet */
function styleHeaderRow(ws) {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = {
            font: { bold: true, color: { rgb: '1E293B' } },
            fill: { fgColor: { rgb: 'F1F5F9' } },
            alignment: { vertical: 'center' },
        };
    }
    // Set column widths
    ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 10 }, // Ref
        { wch: 45 }, // Description
        { wch: 12 }, // Debit
        { wch: 12 }, // Credit
        { wch: 12 }, // Balance
        { wch: 10 }, // COA Code
        { wch: 32 }, // COA Name
        { wch: 14 }, // Status
    ];
}

/** Trigger a browser download of a Blob */
function downloadBlob(content, filename, mimeType) {
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

// =============================================================================
// TransactionExporter
// =============================================================================

class TransactionExporter {

    // ─── CSV ──────────────────────────────────────────────────────────────────

    static exportCSV(transactions, filename = 'transactions.csv') {
        if (!transactions?.length) { alert('No transactions to export'); return; }

        const rows = transactions.map(tx => {
            const amount = (tx.amount_cents || 0) / 100;
            const debit  = tx.polarity === 'DEBIT'  ? amount.toFixed(2) : '';
            const credit = tx.polarity === 'CREDIT' ? amount.toFixed(2) : '';
            return [
                tx.date || '',
                tx.ref || tx.tx_id || '',
                `"${(tx.description || '').replace(/"/g, '""')}"`,
                debit,
                credit,
                tx.balance_cents ? (tx.balance_cents / 100).toFixed(2) : '',
                tx.category || '',
                `"${resolveCOAName(tx.category).replace(/"/g, '""')}"`,
                tx.status || 'Imported',
            ].join(',');
        });

        const csv = [TX_HEADERS.join(','), ...rows].join('\n');
        downloadBlob(csv, filename, 'text/csv');
        console.log(`[EXPORT] Exported ${transactions.length} transactions to CSV`);
    }

    // ─── XLSX (current account / view) ───────────────────────────────────────

    static exportExcel(transactions, filename = 'transactions.xlsx') {
        if (!transactions?.length) { alert('No transactions to export'); return; }

        const rows = transactions.map(buildRow);
        const ws = XLSX.utils.aoa_to_sheet([TX_HEADERS, ...rows]);
        styleHeaderRow(ws);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        XLSX.writeFile(wb, filename);
        console.log(`[EXPORT] Exported ${transactions.length} transactions to XLSX`);
    }

    // ─── XLSX (all accounts — one sheet per account + summary) ───────────────

    static exportAllAccountsXLSX(filename = 'RoboLedger_all.xlsx') {
        const allTxns    = window.RoboLedger?.Ledger?.getAll()    || [];
        const allAccounts = window.RoboLedger?.Accounts?.getAll() || [];

        if (!allTxns.length) { alert('No transactions to export'); return; }

        const wb = XLSX.utils.book_new();

        // ── Summary sheet ──
        const summaryRows = [
            ['Account', 'Ref', 'Type', 'Transactions', 'Total Debits', 'Total Credits', 'Net'],
        ];

        for (const account of allAccounts) {
            const txns = allTxns.filter(t => t.account_id === account.id);
            if (!txns.length) continue;

            // Per-account sheet
            const rows = txns.map(buildRow);
            const ws = XLSX.utils.aoa_to_sheet([TX_HEADERS, ...rows]);
            styleHeaderRow(ws);

            // Sheet name: sanitize (Excel limits: 31 chars, no special chars)
            const sheetName = (account.ref || account.id || 'Account')
                .replace(/[:\\\/\?\*\[\]]/g, '-')
                .substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // Add to summary
            const totalDebit  = txns.filter(t => t.polarity === 'DEBIT').reduce((s, t) => s + (t.amount_cents || 0), 0) / 100;
            const totalCredit = txns.filter(t => t.polarity === 'CREDIT').reduce((s, t) => s + (t.amount_cents || 0), 0) / 100;
            summaryRows.push([
                account.name || account.id,
                account.ref  || '',
                account.type || '',
                txns.length,
                totalDebit,
                totalCredit,
                totalCredit - totalDebit,
            ]);
        }

        // Summary totals row
        const totalAllDebit  = allTxns.filter(t => t.polarity === 'DEBIT').reduce((s, t)  => s + (t.amount_cents || 0), 0) / 100;
        const totalAllCredit = allTxns.filter(t => t.polarity === 'CREDIT').reduce((s, t) => s + (t.amount_cents || 0), 0) / 100;
        summaryRows.push(['', '', '', allTxns.length, totalAllDebit, totalAllCredit, totalAllCredit - totalAllDebit]);

        const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
        summaryWs['!cols'] = [
            { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
            { wch: 14 }, { wch: 14 }, { wch: 14 },
        ];
        styleHeaderRow(summaryWs);

        // Insert summary as the FIRST sheet
        wb.SheetNames.unshift('Summary');
        wb.Sheets['Summary'] = summaryWs;

        XLSX.writeFile(wb, filename);
        console.log(`[EXPORT] Exported ${allTxns.length} transactions across ${allAccounts.length} accounts to XLSX`);
    }

    // ─── Caseware ZIP: one XLSX per account, all zipped ─────────────────────
    // Each file is named {AccountRef}_{Period}.xlsx for direct Caseware import.
    // Requires the fflate library (loaded from CDN or bundled).

    static async exportCasewareZip(zipFilename = null) {
        const allTxns    = window.RoboLedger?.Ledger?.getAll()    || [];
        const allAccounts = window.RoboLedger?.Accounts?.getAll() || [];

        if (!allTxns.length) { alert('No transactions to export'); return; }

        const timestamp = new Date().toISOString().split('T')[0];
        zipFilename = zipFilename || `RoboLedger_Caseware_${timestamp}.zip`;

        // Build in-memory ZIP using fflate (or fallback to individual downloads)
        const fflate = window.fflate;
        if (!fflate) {
            // No ZIP library — download files individually
            console.warn('[EXPORT] fflate not available — downloading files individually');
            return this._exportCasewareIndividual(allTxns, allAccounts, timestamp);
        }

        const zipFiles = {};
        const summaryRows = [['Account', 'Ref', 'Period', 'Type', 'Transactions', 'Total Debits', 'Total Credits', 'Net']];

        for (const account of allAccounts) {
            const txns = allTxns.filter(t => t.account_id === account.id);
            if (!txns.length) continue;

            // Determine period from transaction date range
            const dates = txns.map(t => t.date).filter(Boolean).sort();
            const startDate = dates[0]?.substring(0, 7).replace('-', '') || timestamp.replace(/-/g, '');
            const endDate   = dates[dates.length - 1]?.substring(0, 7).replace('-', '') || startDate;
            const period    = startDate === endDate ? startDate : `${startDate}-${endDate}`;

            // Build workbook
            const wb = XLSX.utils.book_new();

            // Account info sheet (Caseware import metadata)
            const infoRows = [
                ['Field', 'Value'],
                ['Account Ref', account.ref || account.id],
                ['Account Name', account.name || ''],
                ['Account Type', account.type || account.accountType || ''],
                ['Statement Period', period],
                ['Total Transactions', txns.length],
                ['Export Date', timestamp],
                ['Exported By', 'RoboLedger v5'],
            ];
            const infoWs = XLSX.utils.aoa_to_sheet(infoRows);
            infoWs['!cols'] = [{ wch: 20 }, { wch: 32 }];
            XLSX.utils.book_append_sheet(wb, infoWs, 'Account Info');

            // Transactions sheet
            const rows = txns.map(buildRow);
            const ws = XLSX.utils.aoa_to_sheet([TX_HEADERS, ...rows]);
            styleHeaderRow(ws);
            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

            // Convert to Uint8Array
            const xlsxData = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const safeRef = (account.ref || account.id || 'Account').replace(/[\\/:*?"<>|]/g, '-');
            const filename = `${safeRef}_${period}.xlsx`;
            zipFiles[filename] = new Uint8Array(xlsxData);

            // Add to summary
            const totalDebit  = txns.filter(t => t.polarity === 'DEBIT').reduce((s, t) => s + (t.amount_cents || 0), 0) / 100;
            const totalCredit = txns.filter(t => t.polarity === 'CREDIT').reduce((s, t) => s + (t.amount_cents || 0), 0) / 100;
            summaryRows.push([account.name || account.id, account.ref || '', period, account.type || '', txns.length, totalDebit, totalCredit, totalCredit - totalDebit]);
        }

        // Add manifest/summary XLSX
        const summaryWb = XLSX.utils.book_new();
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
        summaryWs['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        styleHeaderRow(summaryWs);
        XLSX.utils.book_append_sheet(summaryWb, summaryWs, 'Summary');
        const summaryData = XLSX.write(summaryWb, { type: 'array', bookType: 'xlsx' });
        zipFiles[`_Summary_${timestamp}.xlsx`] = new Uint8Array(summaryData);

        // Compress and download
        return new Promise((resolve, reject) => {
            fflate.zip(zipFiles, { level: 6 }, (err, data) => {
                if (err) { console.error('[EXPORT] ZIP error:', err); reject(err); return; }
                const blob = new Blob([data], { type: 'application/zip' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = zipFilename;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log(`[EXPORT] Caseware ZIP: ${Object.keys(zipFiles).length} files, ${(data.length / 1024).toFixed(0)} KB`);
                resolve();
            });
        });
    }

    // Fallback: download each account file individually (no ZIP library)
    static _exportCasewareIndividual(allTxns, allAccounts, timestamp) {
        let count = 0;
        for (const account of allAccounts) {
            const txns = allTxns.filter(t => t.account_id === account.id);
            if (!txns.length) continue;
            const safeRef = (account.ref || account.id || 'Account').replace(/[\\/:*?"<>|]/g, '-');
            const filename = `${safeRef}_${timestamp}.xlsx`;
            const rows = txns.map(buildRow);
            const ws = XLSX.utils.aoa_to_sheet([TX_HEADERS, ...rows]);
            styleHeaderRow(ws);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
            XLSX.writeFile(wb, filename);
            count++;
        }
        console.log(`[EXPORT] Downloaded ${count} individual account files`);
    }

    // ─── JSON ─────────────────────────────────────────────────────────────────

    static exportJSON(transactions, filename = 'transactions.json') {
        if (!transactions?.length) { alert('No transactions to export'); return; }
        const json = JSON.stringify(transactions, null, 2);
        downloadBlob(json, filename, 'application/json');
        console.log(`[EXPORT] Exported ${transactions.length} transactions to JSON`);
    }

    // ─── Uncategorized only ───────────────────────────────────────────────────

    static exportUncategorized(transactions, filename = 'uncategorized.csv') {
        const uncategorized = transactions.filter(tx =>
            !tx.coa_code && !tx.account_code && (!tx.category || tx.category === '9970')
        );
        if (!uncategorized.length) { alert('No uncategorized transactions found!'); return; }
        console.log(`[EXPORT] Found ${uncategorized.length} uncategorized transactions out of ${transactions.length} total`);
        this.exportCSV(uncategorized, filename);
    }

    // ─── Current view dispatcher ──────────────────────────────────────────────

    static exportCurrentView(format = 'csv') {
        const gridData = window.RoboLedger?.Ledger?.getAll() || [];
        if (!gridData.length) { alert('No transactions in current view'); return; }

        console.log(`[EXPORT] Exporting ${gridData.length} transactions in format: ${format}`);

        const timestamp  = new Date().toISOString().split('T')[0];
        const accountRef = window.UI_STATE?.refPrefix || 'TXN';

        switch (format.toLowerCase()) {
            case 'csv':
                this.exportCSV(gridData, `${accountRef}_${timestamp}.csv`);
                break;
            case 'excel':
            case 'xlsx':
                this.exportExcel(gridData, `${accountRef}_${timestamp}.xlsx`);
                break;
            case 'xlsx-all':
                this.exportAllAccountsXLSX(`RoboLedger_${timestamp}.xlsx`);
                break;
            case 'xlsx-caseware':
                this.exportCasewareZip(`RoboLedger_Caseware_${timestamp}.zip`).catch(e => {
                    console.error('[EXPORT] Caseware ZIP failed:', e);
                    alert('ZIP export failed — check console for details.');
                });
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

// Expose to global scope (used by vanilla JS toolbar)
window.TransactionExporter = TransactionExporter;

export default TransactionExporter;
