import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * GeneralJournalReport - Complete chronological transaction log
 */
export function GeneralJournalReport() {
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
            const data = generator.generateGeneralJournal(range.start, range.end);
            setReportData(data);
            setDateRange(range);
        } catch (error) {
            console.error('[GENERAL_JOURNAL] Generation failed:', error);
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
                    <i className="ph ph-book text-3xl text-purple-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">General Journal</h1>
                </div>
                <p className="text-gray-600">Complete chronological transaction log</p>
            </div>

            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-purple-600 mb-4"></i>
                    <p className="text-gray-600">Generating report...</p>
                </div>
            )}

            {!loading && reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow">
                    <div className="border-b border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-900">General Journal</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {reportData.count} transactions · {dateRange.start} to {dateRange.end}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Source</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Account</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Debit</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {reportData.transactions.map((tx, i) => {
                                    const amount = (tx.amount_cents || 0) / 100;
                                    return (
                                        <tr key={tx.tx_id || i} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">{tx.date}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 max-w-[100px] truncate">{tx.source_account}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className="font-mono text-gray-400 text-xs">{tx.account_code}</span>
                                                <span className="ml-1.5 text-gray-900">{tx.account_name}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{tx.description || tx.raw_description}</td>
                                            <td className="px-4 py-3 text-right text-sm tabular-nums font-mono">
                                                {tx.polarity === 'DEBIT' ? fmt(amount) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm tabular-nums font-mono">
                                                {tx.polarity === 'CREDIT' ? fmt(amount) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-gray-200 p-6 flex justify-end">
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center gap-2"
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

export default GeneralJournalReport;
