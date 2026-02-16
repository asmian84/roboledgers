import React, { useState, useEffect } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * TrialBalanceReport - Verify debits = credits
 */
export function TrialBalanceReport() {
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [loading, setLoading] = useState(false);

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
        } catch (error) {
            console.error('[TRIAL_BALANCE] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD'
        }).format(amount);
    };

    const exportCSV = () => {
        if (!reportData) return;

        const csv = [
            ['Account Code', 'Account Name', 'Debit', 'Credit', 'Balance'],
            ...reportData.accounts.map(acc => [
                acc.code,
                acc.name,
                acc.debit.toFixed(2),
                acc.credit.toFixed(2),
                acc.balance.toFixed(2)
            ]),
            ['', 'TOTALS', reportData.totals.debit.toFixed(2), reportData.totals.credit.toFixed(2), reportData.totals.balance.toFixed(2)]
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trial-balance-${dateRange.start}-to-${dateRange.end}.csv`;
        a.click();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <button
                        onClick={() => window.location.hash = '#/reports'}
                        className="text-gray-600 hover:text-gray-900 mr-2"
                    >
                        <i className="ph ph-arrow-left text-2xl"></i>
                    </button>
                    <i className="ph ph-scales text-3xl text-blue-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">Trial Balance</h1>
                </div>
                <p className="text-gray-600">
                    Verify that total debits equal total credits across all accounts
                </p>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {/* Report Content */}
            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-blue-600 mb-4"></i>
                    <p className="text-gray-600">Generating report...</p>
                </div>
            )}

            {!loading && reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow">
                    {/* Report Header */}
                    <div className="border-b border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Trial Balance Report</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Period: {dateRange.start} to {dateRange.end}
                                </p>
                            </div>

                            {/* Balance Status */}
                            <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${reportData.isBalanced
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-red-50 border border-red-200'
                                }`}>
                                <i className={`ph ${reportData.isBalanced ? 'ph-check-circle' : 'ph-warning-circle'} text-xl ${reportData.isBalanced ? 'text-green-600' : 'text-red-600'
                                    }`}></i>
                                <span className={`font-bold ${reportData.isBalanced ? 'text-green-900' : 'text-red-900'}`}>
                                    {reportData.isBalanced ? 'Balanced ✓' : `Out of Balance: ${formatCurrency(reportData.difference)}`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Report Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Account Name
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Debit
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Credit
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Balance
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reportData.accounts.map(account => (
                                    <tr key={account.code} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                            {account.code}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {account.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums font-mono text-gray-900">
                                            {account.debit > 0 ? formatCurrency(account.debit) : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums font-mono text-gray-900">
                                            {account.credit > 0 ? formatCurrency(account.credit) : '—'}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums font-mono font-semibold ${account.balance > 0 ? 'text-green-600' : account.balance < 0 ? 'text-red-600' : 'text-gray-500'
                                            }`}>
                                            {formatCurrency(account.balance)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                                <tr>
                                    <td colSpan="2" className="px-6 py-4 text-sm font-bold text-gray-900 uppercase">
                                        Totals
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums font-mono font-bold text-gray-900">
                                        {formatCurrency(reportData.totals.debit)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums font-mono font-bold text-gray-900">
                                        {formatCurrency(reportData.totals.credit)}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right tabular-nums font-mono font-bold ${reportData.isBalanced ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {formatCurrency(reportData.totals.balance)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Export Actions */}
                    <div className="border-t border-gray-200 p-6 flex justify-end gap-3">
                        <button
                            onClick={exportCSV}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
                        >
                            <i className="ph ph-download-simple"></i>
                            <span>Export CSV</span>
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold flex items-center gap-2"
                        >
                            <i className="ph ph-printer"></i>
                            <span>Print</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TrialBalanceReport;
