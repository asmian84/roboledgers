import React, { useState, useEffect, useMemo } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';

/**
 * LiveReportPanel - Real-time updating report panel for split-pane view
 * Displays financial reports alongside transaction grid with live updates
 */
export function LiveReportPanel({ reportType = 'trial-balance', transactions }) {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Regenerate report when transactions change
    useEffect(() => {
        if (!transactions || transactions.length === 0) {
            setReportData(null);
            return;
        }

        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );

            // Get date range from transactions
            const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a - b);
            const startDate = dates[0].toISOString().split('T')[0];
            const endDate = dates[dates.length - 1].toISOString().split('T')[0];

            let data;
            switch (reportType) {
                case 'trial-balance':
                    data = generator.generateTrialBalance(startDate, endDate);
                    break;
                case 'income-statement':
                    data = generator.generateIncomeStatement(startDate, endDate);
                    break;
                case 'gst-report':
                    data = generator.generateGSTReport(startDate, endDate);
                    break;
                default:
                    data = generator.generateTrialBalance(startDate, endDate);
            }

            setReportData(data);
        } catch (error) {
            console.error('[LIVE_REPORT] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    }, [transactions, reportType]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD'
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="live-report-panel bg-white border-l border-gray-200 p-6 overflow-auto">
                <div className="flex items-center justify-center h-full">
                    <i className="ph ph-spinner-gap animate-spin text-3xl text-blue-600"></i>
                </div>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="live-report-panel bg-white border-l border-gray-200 p-6 overflow-auto">
                <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                        <i className="ph ph-chart-bar text-6xl mb-3"></i>
                        <p>No data to display</p>
                    </div>
                </div>
            </div>
        );
    }

    // Render Trial Balance
    if (reportType === 'trial-balance') {
        return (
            <div className="live-report-panel bg-white border-l border-gray-200 overflow-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-gray-900">Trial Balance</h3>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${reportData.isBalanced
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                            {reportData.isBalanced ? '✓ Balanced' : '⚠ Out of Balance'}
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        {reportData.accounts.length} accounts · Live updates
                    </p>
                </div>

                {/* Table */}
                <div className="p-4">
                    <table className="w-full text-xs">
                        <thead className="border-b border-gray-200">
                            <tr>
                                <th className="text-left pb-2 font-bold text-gray-700">Code</th>
                                <th className="text-left pb-2 font-bold text-gray-700">Account</th>
                                <th className="text-right pb-2 font-bold text-gray-700">Debit</th>
                                <th className="text-right pb-2 font-bold text-gray-700">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reportData.accounts.map(account => (
                                <tr key={account.code} className="hover:bg-gray-50">
                                    <td className="py-2 font-mono text-gray-600">{account.code}</td>
                                    <td className="py-2 text-gray-900">{account.name}</td>
                                    <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                                        {account.debit > 0 ? formatCurrency(account.debit) : '—'}
                                    </td>
                                    <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                                        {account.credit > 0 ? formatCurrency(account.credit) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                            <tr>
                                <td colSpan="2" className="py-3 font-bold uppercase text-xs">Totals</td>
                                <td className="py-3 text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(reportData.totals.debit)}
                                </td>
                                <td className="py-3 text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(reportData.totals.credit)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    }

    // Placeholder for other report types
    return (
        <div className="live-report-panel bg-white border-l border-gray-200 p-6">
            <p className="text-gray-500">Report type: {reportType}</p>
        </div>
    );
}

export default LiveReportPanel;
