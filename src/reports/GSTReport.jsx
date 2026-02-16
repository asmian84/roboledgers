import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * GSTReport - GST/HST Tax Report
 * Calculate GST collected, ITCs, and net GST payable
 */
export function GSTReport() {
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [taxRate, setTaxRate] = useState(0.05); // 5% GST default
    const [loading, setLoading] = useState(false);

    const generateReport = (range) => {
        if (!range?.start || !range?.end) return;

        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );

            const data = generator.generateGSTReport(range.start, range.end, taxRate);
            setReportData(data);
            setDateRange(range);
        } catch (error) {
            console.error('[GST_REPORT] Generation failed:', error);
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
            ['GST/HST Report'],
            ['Period', `${dateRange.start} to ${dateRange.end}`],
            ['Tax Rate', `${(taxRate * 100).toFixed(1)}%`],
            [''],
            ['Summary'],
            ['GST Collected', reportData.gstCollected.toFixed(2)],
            ['GST Paid (ITC)', reportData.gstPaid.toFixed(2)],
            ['Net GST Payable', reportData.netGSTPayable.toFixed(2)],
            [''],
            ['Revenue Transactions'],
            ['Date', 'Description', 'Amount', 'GST'],
            ...reportData.details.revenueTransactions.map(tx => [
                tx.date, tx.description, tx.amount.toFixed(2), tx.gst.toFixed(2)
            ]),
            [''],
            ['Expense Transactions'],
            ['Date', 'Description', 'Amount', 'GST (ITC)'],
            ...reportData.details.expenseTransactions.map(tx => [
                tx.date, tx.description, tx.amount.toFixed(2), tx.gst.toFixed(2)
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gst-report-${dateRange.start}-to-${dateRange.end}.csv`;
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
                    <i className="ph ph-percent text-3xl text-red-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">GST/HST Report</h1>
                </div>
                <p className="text-gray-600">
                    Calculate GST collected, Input Tax Credits (ITC), and net GST payable
                </p>
            </div>

            {/* Tax Rate Selector */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                        Tax Rate
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                        <button
                            onClick={() => setTaxRate(0.05)}
                            className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${taxRate === 0.05
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            5% GST
                        </button>
                        <button
                            onClick={() => setTaxRate(0.13)}
                            className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${taxRate === 0.13
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            13% HST (ON)
                        </button>
                        <button
                            onClick={() => setTaxRate(0.15)}
                            className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${taxRate === 0.15
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            15% HST (NS/NB/NL)
                        </button>
                        <button
                            onClick={() => setTaxRate(0.12)}
                            className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${taxRate === 0.12
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            12% HST (BC)
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {/* Loading State */}
            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-red-600 mb-4"></i>
                    <p className="text-gray-600">Calculating GST...</p>
                </div>
            )}

            {/* Report Content */}
            {!loading && reportData && (
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-6">
                        {/* GST Collected */}
                        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <i className="ph ph-arrow-down text-2xl text-green-600"></i>
                                <h3 className="text-sm font-bold text-green-900 uppercase">GST Collected</h3>
                            </div>
                            <p className="text-3xl font-bold text-green-700 mb-1">
                                {formatCurrency(reportData.gstCollected)}
                            </p>
                            <p className="text-xs text-green-600">
                                {reportData.summary.revenueCount} revenue transactions
                            </p>
                        </div>

                        {/* GST Paid (ITC) */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <i className="ph ph-arrow-up text-2xl text-blue-600"></i>
                                <h3 className="text-sm font-bold text-blue-900 uppercase">GST Paid (ITC)</h3>
                            </div>
                            <p className="text-3xl font-bold text-blue-700 mb-1">
                                {formatCurrency(reportData.gstPaid)}
                            </p>
                            <p className="text-xs text-blue-600">
                                {reportData.summary.expenseCount} expense transactions
                            </p>
                        </div>

                        {/* Net GST Payable */}
                        <div className={`bg-gradient-to-br ${reportData.netGSTPayable > 0
                            ? 'from-red-50 to-red-100 border-red-200'
                            : 'from-purple-50 to-purple-100 border-purple-200'
                            } border-2 rounded-lg p-6`}>
                            <div className="flex items-center gap-3 mb-2">
                                <i className={`ph ph-coins text-2xl ${reportData.netGSTPayable > 0 ? 'text-red-600' : 'text-purple-600'}`}></i>
                                <h3 className={`text-sm font-bold uppercase ${reportData.netGSTPayable > 0 ? 'text-red-900' : 'text-purple-900'}`}>
                                    Net GST {reportData.netGSTPayable > 0 ? 'Payable' : 'Refund'}
                                </h3>
                            </div>
                            <p className={`text-3xl font-bold mb-1 ${reportData.netGSTPayable > 0 ? 'text-red-700' : 'text-purple-700'}`}>
                                {formatCurrency(Math.abs(reportData.netGSTPayable))}
                            </p>
                            <p className={`text-xs ${reportData.netGSTPayable > 0 ? 'text-red-600' : 'text-purple-600'}`}>
                                {reportData.netGSTPayable > 0 ? 'Amount owing to CRA' : 'Amount CRA owes you'}
                            </p>
                        </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="border-b border-gray-200 p-6">
                            <h2 className="text-xl font-bold text-gray-900">Transaction Details</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Period: {dateRange.start} to {dateRange.end} • Tax Rate: {(taxRate * 100).toFixed(1)}%
                            </p>
                        </div>

                        {/* Revenue Transactions */}
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <i className="ph ph-arrow-down text-green-600"></i>
                                Revenue Transactions ({reportData.summary.revenueCount})
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Date</th>
                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Description</th>
                                            <th className="px-4 py-2 text-right font-semibold text-gray-700">Amount</th>
                                            <th className="px-4 py-2 text-right font-semibold text-gray-700">GST</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {reportData.details.revenueTransactions.slice(0, 10).map((tx, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-gray-900 font-mono">{tx.date}</td>
                                                <td className="px-4 py-2 text-gray-900">{tx.description}</td>
                                                <td className="px-4 py-2 text-right font-mono text-gray-900">{formatCurrency(tx.amount)}</td>
                                                <td className="px-4 py-2 text-right font-mono font-semibold text-green-600">{formatCurrency(tx.gst)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {reportData.details.revenueTransactions.length > 10 && (
                                    <p className="text-sm text-gray-500 text-center py-3">
                                        + {reportData.details.revenueTransactions.length - 10} more transactions
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Expense Transactions */}
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <i className="ph ph-arrow-up text-blue-600"></i>
                                Expense Transactions ({reportData.summary.expenseCount})
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Date</th>
                                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Description</th>
                                            <th className="px-4 py-2 text-right font-semibold text-gray-700">Amount</th>
                                            <th className="px-4 py-2 text-right font-semibold text-gray-700">GST (ITC)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {reportData.details.expenseTransactions.slice(0, 10).map((tx, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-gray-900 font-mono">{tx.date}</td>
                                                <td className="px-4 py-2 text-gray-900">{tx.description}</td>
                                                <td className="px-4 py-2 text-right font-mono text-gray-900">{formatCurrency(tx.amount)}</td>
                                                <td className="px-4 py-2 text-right font-mono font-semibold text-blue-600">{formatCurrency(tx.gst)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {reportData.details.expenseTransactions.length > 10 && (
                                    <p className="text-sm text-gray-500 text-center py-3">
                                        + {reportData.details.expenseTransactions.length - 10} more transactions
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Export Actions */}
                        <div className="border-t border-gray-200 p-6 flex justify-end gap-3">
                            <button
                                onClick={exportCSV}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center gap-2"
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
                </div>
            )}
        </div>
    );
}

export default GSTReport;
