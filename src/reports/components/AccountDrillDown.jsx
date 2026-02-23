import React, { useState, useEffect } from 'react';

/**
 * AccountDrillDown — Expandable transaction detail for any account row.
 * Used across Trial Balance, Income Statement, Balance Sheet, Comparative TB, GST Report.
 *
 * Props:
 *   coaCode      — COA code (e.g. '6100', '1000')
 *   accountName  — Display name for header
 *   startDate    — Period start (YYYY-MM-DD)
 *   endDate      — Period end (YYYY-MM-DD)
 *   onClose      — Callback to collapse the drill-down
 *   accentColor  — Tailwind colour for header ('green' | 'blue' | 'indigo' | 'emerald')
 */
export function AccountDrillDown({ coaCode, accountName, startDate, endDate, onClose, accentColor = 'indigo' }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState('date');
    const [sortDir, setSortDir] = useState('asc');

    useEffect(() => {
        setLoading(true);
        try {
            const ledger = window.RoboLedger?.Ledger;
            const coa = window.RoboLedger?.COA;
            if (!ledger) { setLoading(false); return; }

            // Get all transactions
            const allTxns = ledger.getTransactionsByDateRange?.(startDate, endDate) ||
                ledger.getAllTransactions?.() || [];

            // For bank/CC COA codes, also match by source account_id
            const coaEntry = coa?.get?.(coaCode);
            const sourceAccountId = coaEntry?.sourceAccountId || null;

            // Filter transactions for this COA code
            const filtered = allTxns.filter(tx => {
                // Direct category match (expense/revenue accounts)
                if (tx.category === coaCode || tx.category_code === coaCode || tx.gl_account_code === coaCode) return true;
                // Source account match (bank/CC accounts)
                if (sourceAccountId && tx.account_id === sourceAccountId) return true;
                return false;
            });

            setTransactions(filtered);
        } catch (err) {
            console.error('[DrillDown] Error loading transactions:', err);
        } finally {
            setLoading(false);
        }
    }, [coaCode, startDate, endDate]);

    const fmt = (amount) => {
        if (amount == null || isNaN(amount)) return '$0.00';
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
    };

    const fmtDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // Sort transactions
    const sorted = [...transactions].sort((a, b) => {
        let aVal, bVal;
        if (sortField === 'date') {
            aVal = a.date || ''; bVal = b.date || '';
        } else if (sortField === 'description') {
            aVal = (a.description || a.raw_description || '').toLowerCase();
            bVal = (b.description || b.raw_description || '').toLowerCase();
        } else if (sortField === 'amount') {
            aVal = (a.amount_cents || 0); bVal = (b.amount_cents || 0);
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const totalDebit = transactions.reduce((sum, tx) => {
        const amt = (tx.amount_cents || 0) / 100;
        return tx.polarity === 'DEBIT' ? sum + amt : sum;
    }, 0);
    const totalCredit = transactions.reduce((sum, tx) => {
        const amt = (tx.amount_cents || 0) / 100;
        return tx.polarity === 'CREDIT' ? sum + amt : sum;
    }, 0);

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <i className="ph ph-caret-up-down text-gray-300 text-[10px] ml-1"></i>;
        return sortDir === 'asc'
            ? <i className="ph ph-caret-up text-gray-600 text-[10px] ml-1"></i>
            : <i className="ph ph-caret-down text-gray-600 text-[10px] ml-1"></i>;
    };

    const accentStyles = {
        indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
        green: 'bg-green-50 border-green-200 text-green-800',
        blue: 'bg-blue-50 border-blue-200 text-blue-800',
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    };
    const headerStyle = accentStyles[accentColor] || accentStyles.indigo;

    return (
        <tr>
            <td colSpan="100%" className="p-0">
                <div className={`border-t-2 border-b-2 ${headerStyle.split(' ')[1]} bg-white`}>
                    {/* Header */}
                    <div className={`flex items-center justify-between px-4 py-2 ${headerStyle}`}>
                        <div className="flex items-center gap-2">
                            <i className="ph ph-list-magnifying-glass text-lg"></i>
                            <span className="font-semibold text-sm">{coaCode} — {accountName}</span>
                            <span className="text-xs opacity-70">({transactions.length} transactions)</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
                            title="Close drill-down"
                        >
                            <i className="ph ph-x text-sm"></i>
                        </button>
                    </div>

                    {/* Transaction Table */}
                    {loading ? (
                        <div className="p-8 text-center">
                            <i className="ph ph-spinner-gap animate-spin text-2xl text-gray-400"></i>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm">
                            <i className="ph ph-empty text-2xl mb-2 block"></i>
                            No transactions found for this account in the selected period.
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th
                                            className="px-3 py-2 text-left text-[11px] font-bold text-gray-600 uppercase cursor-pointer hover:text-gray-900 select-none"
                                            onClick={() => toggleSort('date')}
                                        >
                                            Date <SortIcon field="date" />
                                        </th>
                                        <th
                                            className="px-3 py-2 text-left text-[11px] font-bold text-gray-600 uppercase cursor-pointer hover:text-gray-900 select-none"
                                            onClick={() => toggleSort('description')}
                                        >
                                            Description <SortIcon field="description" />
                                        </th>
                                        <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-600 uppercase">
                                            Source
                                        </th>
                                        <th className="px-3 py-2 text-right text-[11px] font-bold text-gray-600 uppercase">
                                            Debit
                                        </th>
                                        <th className="px-3 py-2 text-right text-[11px] font-bold text-gray-600 uppercase">
                                            Credit
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sorted.map((tx, i) => {
                                        const amt = (tx.amount_cents || 0) / 100;
                                        const isDebit = tx.polarity === 'DEBIT';
                                        // Get clean description (handle multiline parser format)
                                        const desc = (tx.description || tx.raw_description || '').split('\n')[0];
                                        // Try to identify source account
                                        const sourceAcc = window.RoboLedger?.Accounts?.get?.(tx.account_id);
                                        const sourceName = sourceAcc?.name || sourceAcc?.ref || tx.account_id || '';

                                        return (
                                            <tr key={tx.tx_id || i} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-[12px] text-gray-500">
                                                    {fmtDate(tx.date)}
                                                </td>
                                                <td className="px-3 py-1.5 text-[12px] text-gray-800 max-w-[300px] truncate" title={desc}>
                                                    {desc}
                                                </td>
                                                <td className="px-3 py-1.5 text-[11px] text-gray-400 max-w-[120px] truncate" title={sourceName}>
                                                    {sourceName}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums text-gray-800">
                                                    {isDebit ? fmt(amt) : ''}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums text-red-600">
                                                    {!isDebit ? fmt(amt) : ''}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                    <tr className="font-semibold">
                                        <td className="px-3 py-2 text-[11px] text-gray-600 uppercase" colSpan="3">
                                            Total ({transactions.length} items)
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-[12px] text-gray-800">
                                            {fmt(totalDebit)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-[12px] text-red-600">
                                            {fmt(totalCredit)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}

export default AccountDrillDown;
