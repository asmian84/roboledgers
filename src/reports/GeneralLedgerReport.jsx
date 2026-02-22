import React, { useState, useEffect } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * GeneralLedgerReport - Detailed transaction history per COA account
 */
export function GeneralLedgerReport() {
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedCode, setSelectedCode] = useState('');
    const [coaAccounts, setCoaAccounts] = useState([]);

    useEffect(() => {
        const accounts = window.RoboLedger?.COA?.getAll() || [];
        setCoaAccounts(accounts.sort((a, b) => parseInt(a.code) - parseInt(b.code)));
    }, []);

    const generateReport = (range) => {
        if (!range?.start || !range?.end || !selectedCode) return;
        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );
            const data = generator.generateGeneralLedger(range.start, range.end, selectedCode);
            setReportData(data);
            setDateRange(range);
        } catch (error) {
            console.error('[GENERAL_LEDGER] Generation failed:', error);
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
                    <i className="ph ph-list-bullets text-3xl text-indigo-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">General Ledger</h1>
                </div>
                <p className="text-gray-600">Detailed transaction history for a specific account</p>
            </div>

            {/* COA Account Selector */}
            <div className="max-w-7xl mx-auto bg-white border border-gray-200 rounded-lg p-6 mb-4">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Select Account</h3>
                <select
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="">-- Select a COA Account --</option>
                    {coaAccounts.map(acc => (
                        <option key={acc.code} value={acc.code}>
                            {acc.code} — {acc.name} ({acc.root})
                        </option>
                    ))}
                </select>
            </div>

            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {!selectedCode && coaAccounts.length === 0 && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-16 text-center">
                    <i className="ph ph-upload-simple text-6xl text-gray-200 mb-5 block"></i>
                    <p className="text-lg font-semibold text-gray-500 mb-1">Upload statements to get started</p>
                    <p className="text-sm text-gray-400 mb-6">Import your bank statements to generate this report</p>
                    <button
                        onClick={() => window.__reportsGoBack?.()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        <i className="ph ph-arrow-left text-base"></i>
                        Back to Reports
                    </button>
                </div>
            )}

            {!selectedCode && coaAccounts.length > 0 && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-list-bullets text-6xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">Select an account above to view its ledger</p>
                </div>
            )}

            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-indigo-600 mb-4"></i>
                    <p className="text-gray-600">Generating report...</p>
                </div>
            )}

            {!loading && reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow">
                    <div className="border-b border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-900">
                            {reportData.account.code} — {reportData.account.name}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Type: {reportData.account.type} · {reportData.transactions.length} transactions · Period: {dateRange.start} to {dateRange.end}
                        </p>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-4 p-6 border-b border-gray-200 bg-gray-50">
                        <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Net Activity</p>
                            <p className={`text-lg font-bold font-mono ${reportData.totals.net < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(reportData.totals.net)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Closing Balance</p>
                            <p className="text-lg font-bold font-mono">{fmt(reportData.closingBalance)}</p>
                        </div>
                    </div>

                    {/* Transaction Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {reportData.transactions.map((tx, i) => {
                                    const amount = (tx.amount_cents || 0) / 100;
                                    const isCredit = (tx.effPolarity || tx.polarity) === 'CREDIT';
                                    const net = isCredit ? -amount : amount;
                                    return (
                                        <tr key={tx.tx_id || i} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">{tx.date}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{tx.description || tx.raw_description}</td>
                                            <td className={`px-4 py-3 text-right text-sm tabular-nums font-mono ${isCredit ? 'text-red-600' : 'text-gray-900'}`}>
                                                {fmt(net)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm tabular-nums font-mono font-semibold">
                                                {fmt(tx.balance)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GeneralLedgerReport;
