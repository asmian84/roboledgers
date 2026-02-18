import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * BalanceSheetReport - Assets = Liabilities + Equity
 */
export function BalanceSheetReport() {
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [loading, setLoading] = useState(false);

    const generateReport = (range) => {
        if (!range?.end) return;
        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );
            const data = generator.generateBalanceSheet(range.end);
            setReportData(data);
            setDateRange(range);
        } catch (error) {
            console.error('[BALANCE_SHEET] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amount) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);

    const renderSection = (title, items, total, color) => (
        <div className="mb-6">
            <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${color}`}>{title}</h3>
            {items.length > 0 ? (
                <table className="w-full text-sm mb-2">
                    <tbody className="divide-y divide-gray-100">
                        {items.map(item => (
                            <tr key={item.code} className="hover:bg-gray-50">
                                <td className="py-2 font-mono text-gray-500 text-xs w-16">{item.code}</td>
                                <td className="py-2 text-gray-900">{item.name}</td>
                                <td className="py-2 text-right tabular-nums font-mono text-gray-900">{fmt(item.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p className="text-sm text-gray-400 italic mb-2">No entries</p>
            )}
            <div className="flex justify-between border-t-2 border-gray-300 pt-2">
                <span className="font-bold text-sm text-gray-700">Total {title}</span>
                <span className="font-bold font-mono tabular-nums">{fmt(total)}</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => window.__reportsGoBack?.()} className="text-gray-600 hover:text-gray-900 mr-2">
                        <i className="ph ph-arrow-left text-2xl"></i>
                    </button>
                    <i className="ph ph-stack text-3xl text-cyan-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">Balance Sheet</h1>
                </div>
                <p className="text-gray-600">Assets, liabilities, and equity as of a specific date</p>
            </div>

            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-cyan-600 mb-4"></i>
                    <p className="text-gray-600">Generating report...</p>
                </div>
            )}

            {!loading && !reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-16 text-center">
                    <i className="ph ph-upload-simple text-6xl text-gray-200 mb-5 block"></i>
                    <p className="text-lg font-semibold text-gray-500 mb-1">Upload statements to get started</p>
                    <p className="text-sm text-gray-400 mb-6">Import your bank statements to generate this report</p>
                    <button
                        onClick={() => window.__reportsGoBack?.()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        <i className="ph ph-arrow-left text-base"></i>
                        Back to Reports
                    </button>
                </div>
            )}

            {!loading && reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-8">
                    <div className="border-b border-gray-200 pb-4 mb-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Balance Sheet</h2>
                            <p className="text-sm text-gray-600">As of {reportData.asOfDate}</p>
                        </div>
                        <div className={`px-4 py-2 rounded-lg ${reportData.isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <span className={`font-bold ${reportData.isBalanced ? 'text-green-900' : 'text-red-900'}`}>
                                {reportData.isBalanced ? '✓ Balanced' : '⚠ Out of Balance'}
                            </span>
                        </div>
                    </div>

                    {renderSection('Assets', reportData.assets, reportData.totals.assets, 'text-blue-600')}
                    {renderSection('Liabilities', reportData.liabilities, reportData.totals.liabilities, 'text-red-600')}
                    {renderSection('Equity', reportData.equity, reportData.totals.equity, 'text-purple-600')}

                    <div className="border-t-2 border-gray-800 pt-4 mt-4 flex justify-between">
                        <span className="font-bold text-gray-900">Liabilities + Equity</span>
                        <span className="font-bold font-mono tabular-nums text-gray-900">
                            {fmt(reportData.totals.liabilities + reportData.totals.equity)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BalanceSheetReport;
