import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * TrialBalanceReport - Multiple view modes inspired by Caseware Working Papers
 *
 * Views:
 *   1. Leadsheet   — Grouped by Caseware leadsheet (L/S) codes with subtotals
 *   2. Account      — Flat list sorted by account number (classic TB)
 *   3. Type         — Grouped by account type (Asset, Liability, Equity, Revenue, Expense)
 */
export function TrialBalanceReport() {
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('leadsheet'); // 'leadsheet' | 'account' | 'type'
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());

    const generateReport = (range) => {
        if (!range?.start || !range?.end) return;
        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );
            const data = generator.generateTrialBalance(range.start, range.end);
            setReportData(data);
            setDateRange(range);
            setCollapsedGroups(new Set());
        } catch (error) {
            console.error('[TRIAL_BALANCE] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amount) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);

    // ─── Grouping Logic ───────────────────────────────────────────────
    const getGroupedAccounts = () => {
        if (!reportData?.accounts) return [];
        const COA = window.RoboLedger?.COA;

        if (viewMode === 'account') {
            // Flat — single group, sorted by code
            const sorted = [...reportData.accounts].sort((a, b) => String(a.code).localeCompare(String(b.code)));
            return [{ code: 'ALL', name: 'All Accounts', accounts: sorted, totalDebit: reportData.totals.debit, totalCredit: reportData.totals.credit }];
        }

        if (viewMode === 'type') {
            // Group by root type (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
            const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
            const typeNames = { ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', REVENUE: 'Revenue', EXPENSE: 'Expenses' };
            const groups = {};
            reportData.accounts.forEach(acc => {
                const root = acc.root || COA?.inferRoot?.(acc.code) || 'EXPENSE';
                if (!groups[root]) groups[root] = { code: root, name: typeNames[root] || root, accounts: [], totalDebit: 0, totalCredit: 0 };
                groups[root].accounts.push(acc);
                groups[root].totalDebit += acc.debit;
                groups[root].totalCredit += acc.credit;
            });
            return typeOrder.filter(t => groups[t]).map(t => {
                groups[t].accounts.sort((a, b) => String(a.code).localeCompare(String(b.code)));
                return groups[t];
            });
        }

        // Default: leadsheet
        const lsOrder = COA?.getLeadsheetOrder?.() || [];
        const groups = {};
        reportData.accounts.forEach(acc => {
            const ls = acc.leadsheet || COA?.getLeadsheet?.(acc.code) || '40';
            if (!groups[ls]) groups[ls] = { code: ls, name: COA?.getLeadsheetName?.(ls) || ls, accounts: [], totalDebit: 0, totalCredit: 0 };
            groups[ls].accounts.push(acc);
            groups[ls].totalDebit += acc.debit;
            groups[ls].totalCredit += acc.credit;
        });
        const ordered = [];
        lsOrder.forEach(ls => { if (groups[ls]) { groups[ls].accounts.sort((a, b) => String(a.code).localeCompare(String(b.code))); ordered.push(groups[ls]); } });
        Object.keys(groups).forEach(ls => { if (!lsOrder.includes(ls)) { groups[ls].accounts.sort((a, b) => String(a.code).localeCompare(String(b.code))); ordered.push(groups[ls]); } });
        return ordered;
    };

    const isBalanceSheet = (lsCode) => !['20', '30', '40', '70', '80'].includes(lsCode);

    const toggleGroup = (code) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            next.has(code) ? next.delete(code) : next.add(code);
            return next;
        });
    };

    const collapseAll = () => {
        const groups = getGroupedAccounts();
        setCollapsedGroups(new Set(groups.map(g => g.code)));
    };

    const expandAll = () => setCollapsedGroups(new Set());

    // ─── Group Color Logic ────────────────────────────────────────────
    const getGroupColors = (code) => {
        if (viewMode === 'type') {
            const map = {
                ASSET: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600', sub: 'bg-blue-50/50 border-blue-100' },
                LIABILITY: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-600', sub: 'bg-red-50/50 border-red-100' },
                EQUITY: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-600', sub: 'bg-purple-50/50 border-purple-100' },
                REVENUE: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-600', sub: 'bg-emerald-50/50 border-emerald-100' },
                EXPENSE: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-600', sub: 'bg-amber-50/50 border-amber-100' },
            };
            return map[code] || map.EXPENSE;
        }
        if (viewMode === 'account') {
            return { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-600', sub: 'bg-gray-50/50 border-gray-100' };
        }
        // Leadsheet: blue for BS, green for IS
        return isBalanceSheet(code)
            ? { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-600', sub: 'bg-blue-50/50 border-blue-100' }
            : { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-600', sub: 'bg-emerald-50/50 border-emerald-100' };
    };

    // ─── CSV Export ───────────────────────────────────────────────────
    const exportCSV = () => {
        if (!reportData) return;
        const groups = getGroupedAccounts();
        const rows = [['Group', 'Account Code', 'Account Name', 'Debit', 'Credit', 'Balance']];
        groups.forEach(group => {
            if (viewMode !== 'account') rows.push([`[${group.code}] ${group.name}`, '', '', '', '', '']);
            group.accounts.forEach(acc => rows.push([viewMode === 'account' ? '' : '', acc.code, acc.name, acc.debit.toFixed(2), acc.credit.toFixed(2), acc.balance.toFixed(2)]));
            if (viewMode !== 'account') rows.push(['', '', `Subtotal: ${group.name}`, group.totalDebit.toFixed(2), group.totalCredit.toFixed(2), (group.totalDebit - group.totalCredit).toFixed(2)]);
        });
        rows.push(['', '', 'GRAND TOTAL', reportData.totals.debit.toFixed(2), reportData.totals.credit.toFixed(2), reportData.totals.balance.toFixed(2)]);
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trial-balance-${viewMode}-${dateRange.start}-to-${dateRange.end}.csv`;
        a.click();
    };

    const groups = reportData ? getGroupedAccounts() : [];

    // ─── View Mode Labels ─────────────────────────────────────────────
    const viewModes = [
        { id: 'leadsheet', label: 'L/S', title: 'Grouped by Leadsheet', icon: 'ph-folders' },
        { id: 'account', label: 'Acct', title: 'Flat by Account #', icon: 'ph-list-numbers' },
        { id: 'type', label: 'Type', title: 'Grouped by Account Type', icon: 'ph-stack' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => window.location.hash = '#/reports'} className="text-gray-600 hover:text-gray-900 mr-2">
                        <i className="ph ph-arrow-left text-2xl"></i>
                    </button>
                    <i className="ph ph-scales text-3xl text-blue-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">Trial Balance</h1>
                </div>
                <p className="text-gray-600">Verify debits equal credits — multiple view modes</p>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {/* Loading */}
            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-blue-600 mb-4"></i>
                    <p className="text-gray-600">Generating report...</p>
                </div>
            )}

            {/* Report */}
            {!loading && reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow">
                    {/* Report Header + View Tabs */}
                    <div className="border-b border-gray-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Trial Balance Report</h2>
                                <p className="text-[12px] text-gray-500 mt-0.5">
                                    Period: {dateRange.start} to {dateRange.end} — {reportData.accounts.length} accounts
                                    {viewMode !== 'account' && ` across ${groups.length} groups`}
                                </p>
                            </div>
                            {/* Balance badge */}
                            <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-[13px] ${reportData.isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                <i className={`ph ${reportData.isBalanced ? 'ph-check-circle text-green-600' : 'ph-warning-circle text-red-600'} text-lg`}></i>
                                <span className={`font-bold ${reportData.isBalanced ? 'text-green-800' : 'text-red-800'}`}>
                                    {reportData.isBalanced ? 'Balanced' : `Out of Balance: ${fmt(reportData.difference)}`}
                                </span>
                            </div>
                        </div>

                        {/* View mode tabs + collapse controls */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                                {viewModes.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => { setViewMode(v.id); setCollapsedGroups(new Set()); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all ${viewMode === v.id
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                        title={v.title}
                                    >
                                        <i className={`ph ${v.icon} text-[13px]`}></i>
                                        <span>{v.label}</span>
                                    </button>
                                ))}
                            </div>
                            {viewMode !== 'account' && (
                                <div className="flex items-center gap-2">
                                    <button onClick={expandAll} className="text-[11px] text-gray-500 hover:text-blue-600 font-medium">Expand All</button>
                                    <span className="text-gray-300">|</span>
                                    <button onClick={collapseAll} className="text-[11px] text-gray-500 hover:text-blue-600 font-medium">Collapse All</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {viewMode === 'leadsheet' && (
                                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[54px]">L/S</th>
                                    )}
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[80px]">Code</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Account Name</th>
                                    {viewMode === 'type' && (
                                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[80px]">Type</th>
                                    )}
                                    <th className="px-8 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[160px]">Debit</th>
                                    <th className="px-8 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[160px]">Credit</th>
                                    <th className="px-8 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[160px]">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map(group => {
                                    const colors = getGroupColors(group.code);
                                    const isCollapsed = collapsedGroups.has(group.code);
                                    const colCount = viewMode === 'leadsheet' ? 7 : viewMode === 'type' ? 7 : 6;

                                    return (
                                        <React.Fragment key={group.code}>
                                            {/* Group Header */}
                                            {viewMode !== 'account' && (
                                                <tr
                                                    className={`${colors.bg} border-t-2 ${colors.border} cursor-pointer select-none`}
                                                    onClick={() => toggleGroup(group.code)}
                                                >
                                                    <td className="px-4 py-2" colSpan={colCount}>
                                                        <div className="flex items-center gap-2.5">
                                                            <i className={`ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'} text-[11px] text-gray-500`}></i>
                                                            <span className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide text-white ${colors.badge}`}>
                                                                {group.code}
                                                            </span>
                                                            <span className="text-[12px] font-semibold text-gray-800">{group.name}</span>
                                                            <span className="text-[10px] text-gray-400 ml-1">({group.accounts.length})</span>
                                                            {isCollapsed && (
                                                                <span className="ml-auto flex items-center gap-4 text-[11px] font-mono tabular-nums text-gray-600">
                                                                    <span>Dr {fmt(group.totalDebit)}</span>
                                                                    <span>Cr {fmt(group.totalCredit)}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Account Rows */}
                                            {!isCollapsed && group.accounts.map(acc => (
                                                <tr key={`${group.code}-${acc.code}`} className="hover:bg-gray-50/80 border-b border-gray-100">
                                                    {viewMode === 'leadsheet' && (
                                                        <td className="px-4 py-2 text-[10px] text-gray-300 font-mono"></td>
                                                    )}
                                                    <td className="px-4 py-2 text-[12px] font-mono text-gray-600 font-medium">{acc.code}</td>
                                                    <td className="px-4 py-2 text-[12px] text-gray-800">{acc.name}</td>
                                                    {viewMode === 'type' && (
                                                        <td className="px-4 py-2 text-[10px] text-gray-400 uppercase font-medium">{(acc.root || '').slice(0, 5)}</td>
                                                    )}
                                                    <td className="px-8 py-2.5 text-[12px] text-right tabular-nums font-mono text-gray-700">
                                                        {acc.debit > 0 ? fmt(acc.debit) : ''}
                                                    </td>
                                                    <td className="px-8 py-2.5 text-[12px] text-right tabular-nums font-mono text-gray-700">
                                                        {acc.credit > 0 ? fmt(acc.credit) : ''}
                                                    </td>
                                                    <td className={`px-8 py-2.5 text-[12px] text-right tabular-nums font-mono font-semibold ${acc.balance > 0 ? 'text-blue-700' : acc.balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {acc.balance !== 0 ? fmt(acc.balance) : '—'}
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Subtotal Row */}
                                            {viewMode !== 'account' && !isCollapsed && (
                                                <tr className={`${colors.sub} border-b-2`}>
                                                    <td className="px-4 py-1.5" colSpan={viewMode === 'leadsheet' ? 4 : viewMode === 'type' ? 4 : 3}>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                                                            Subtotal — {group.code}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-2 text-[12px] text-right tabular-nums font-mono font-bold text-gray-800">
                                                        {group.totalDebit > 0 ? fmt(group.totalDebit) : ''}
                                                    </td>
                                                    <td className="px-8 py-2 text-[12px] text-right tabular-nums font-mono font-bold text-gray-800">
                                                        {group.totalCredit > 0 ? fmt(group.totalCredit) : ''}
                                                    </td>
                                                    <td className={`px-8 py-2 text-[12px] text-right tabular-nums font-mono font-bold ${(group.totalDebit - group.totalCredit) > 0 ? 'text-blue-700' : (group.totalDebit - group.totalCredit) < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                        {fmt(group.totalDebit - group.totalCredit)}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-800 text-white">
                                <tr>
                                    <td colSpan={viewMode === 'leadsheet' ? 4 : viewMode === 'type' ? 4 : 3} className="px-4 py-3.5 text-[12px] font-bold uppercase tracking-wide">
                                        Grand Total
                                    </td>
                                    <td className="px-8 py-3.5 text-[12px] text-right tabular-nums font-mono font-bold">{fmt(reportData.totals.debit)}</td>
                                    <td className="px-8 py-3.5 text-[12px] text-right tabular-nums font-mono font-bold">{fmt(reportData.totals.credit)}</td>
                                    <td className={`px-8 py-3.5 text-[12px] text-right tabular-nums font-mono font-bold ${reportData.isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                                        {fmt(reportData.totals.balance)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Export Actions */}
                    <div className="border-t border-gray-200 p-5 flex items-center justify-between">
                        <div className="text-[11px] text-gray-400">
                            View: {viewModes.find(v => v.id === viewMode)?.title} — {reportData.accounts.length} accounts
                        </div>
                        <div className="flex gap-2">
                            <button onClick={exportCSV} className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-1.5 text-[12px]">
                                <i className="ph ph-download-simple text-[13px]"></i>Export CSV
                            </button>
                            <button onClick={() => window.print()} className="px-3.5 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold flex items-center gap-1.5 text-[12px]">
                                <i className="ph ph-printer text-[13px]"></i>Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TrialBalanceReport;
