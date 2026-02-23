import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * COASummaryReport - Category breakdown across all accounts
 */
export function COASummaryReport() {
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
            const data = generator.generateCOASummary(range.start, range.end);
            setReportData(data);
            setDateRange(range);
        } catch (error) {
            console.error('[COA_SUMMARY] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amount) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => window.__reportsGoBack?.()} className="text-gray-600 hover:text-gray-900 mr-2">
                        <i className="ph ph-arrow-left text-2xl"></i>
                    </button>
                    <i className="ph ph-chart-bar text-3xl text-orange-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">COA Summary</h1>
                </div>
                <p className="text-gray-600">Chart of Accounts category breakdown</p>
            </div>

            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-orange-600 mb-4"></i>
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
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        <i className="ph ph-arrow-left text-base"></i>
                        Back to Reports
                    </button>
                </div>
            )}

            {!loading && reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow">
                    <div className="border-b border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-900">COA Summary</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {reportData.categories.length} categories · {reportData.totalTransactions} transactions · {dateRange.start} to {dateRange.end}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Account Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Type</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">Count</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">Debit</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">Credit</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">Net</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {reportData.categories.map(cat => (
                                    <tr key={cat.code} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 text-sm font-mono text-gray-600">{cat.code}</td>
                                        <td className="px-6 py-3 text-sm text-gray-900">{cat.name}</td>
                                        <td className="px-6 py-3 text-sm">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cat.type === 'REVENUE' ? 'bg-green-100 text-green-700' :
                                                cat.type === 'EXPENSE' ? 'bg-orange-100 text-orange-700' :
                                                    cat.type === 'ASSET' ? 'bg-blue-100 text-blue-700' :
                                                        cat.type === 'LIABILITY' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                }`}>
                                                {cat.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right text-sm tabular-nums">{cat.count}</td>
                                        <td className="px-6 py-3 text-right text-sm tabular-nums font-mono">{fmt(cat.debit)}</td>
                                        <td className="px-6 py-3 text-right text-sm tabular-nums font-mono">{fmt(cat.credit)}</td>
                                        <td className={`px-6 py-3 text-right text-sm tabular-nums font-mono font-semibold ${cat.net > 0 ? 'text-green-600' : cat.net < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                            {fmt(cat.net)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default COASummaryReport;
