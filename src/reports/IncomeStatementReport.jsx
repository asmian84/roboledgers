import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';
import ReportHeader from './components/ReportHeader.jsx';
import ReportFooter from './components/ReportFooter.jsx';
import ReportTable from './components/ReportTable.jsx';

/**
 * IncomeStatementReport - Professional income statement matching Jazzit template
 * Statement of Income and Retained Earnings format
 */
export function IncomeStatementReport() {
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

            const data = generator.generateIncomeStatement(range.start, range.end);
            setReportData(data);
            setDateRange(range);
        } catch (error) {
            console.error('[INCOME_STATEMENT] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        if (!reportData) return;

        const csv = [
            ['Income Statement'],
            ['Period', `${dateRange.start} to ${dateRange.end}`],
            [''],
            ['REVENUES', reportData.totals.revenue.toFixed(2)],
            [''],
            ['EXPENSES'],
            ...reportData.expenses.map(exp => [exp.name, exp.amount.toFixed(2)]),
            ['Total Expenses', reportData.totals.expenses.toFixed(2)],
            [''],
            ['NET INCOME', reportData.totals.netIncome.toFixed(2)]
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `income-statement-${dateRange.start}-to-${dateRange.end}.csv`;
        a.click();
    };

    // Build table rows from report data
    const buildTableRows = () => {
        if (!reportData) return [];

        const rows = [];

        // REVENUES section header
        rows.push({
            type: 'section',
            description: 'REVENUES',
            values: ['', '']
        });

        // Revenue line items
        if (reportData.revenue && reportData.revenue.length > 0) {
            reportData.revenue.forEach(item => {
                rows.push({
                    description: item.name,
                    values: [item.amount, 0],
                    indent: 1
                });
            });
        }

        // Total revenue
        rows.push({
            type: 'subtotal',
            description: 'Total Revenue',
            values: [reportData.totals.revenue, 0]
        });

        // Blank line
        rows.push({ description: '', values: ['', ''] });

        // COST OF SALES header
        rows.push({
            type: 'section',
            description: 'COST OF SALES',
            values: ['', '']
        });

        // Cost of sales line items
        if (reportData.cogs && reportData.cogs.length > 0) {
            reportData.cogs.forEach(item => {
                rows.push({
                    description: item.name,
                    values: [item.amount, 0],
                    indent: 1
                });
            });
        }

        // Cost of sales subtotal
        rows.push({
            type: 'subtotal',
            description: 'Total COGS',
            values: [reportData.totals.cogs, 0]
        });

        // GROSS PROFIT
        rows.push({
            type: 'subtotal',
            description: 'GROSS PROFIT',
            values: [reportData.totals.grossProfit, 0]
        });

        // Blank line
        rows.push({ description: '', values: ['', ''] });

        // EXPENSES
        rows.push({
            type: 'section',
            description: 'EXPENSES',
            values: ['', '']
        });

        // Expense line items
        if (reportData.expenses && reportData.expenses.length > 0) {
            reportData.expenses.forEach(exp => {
                rows.push({
                    description: exp.name,
                    values: [exp.amount, 0],
                    indent: 1
                });
            });
        }

        // Total expenses
        rows.push({
            type: 'subtotal',
            description: 'Total Expenses',
            values: [reportData.totals.expenses, 0]
        });

        // NET INCOME
        rows.push({
            type: 'total',
            description: 'NET INCOME',
            values: [reportData.totals.netIncome, 0]
        });

        return rows;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Top Section: Filters */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => window.location.hash = '#/reports'}
                        className="text-gray-600 hover:text-gray-900 mr-2"
                    >
                        <i className="ph ph-arrow-left text-2xl"></i>
                    </button>
                    <i className="ph ph-chart-line-up text-3xl text-green-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">Income Statement</h1>
                </div>
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {/* Loading State */}
            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-green-600 mb-4"></i>
                    <p className="text-gray-600">Generating report...</p>
                </div>
            )}

            {/* Report Content */}
            {!loading && reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-lg p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {/* Professional Header */}
                    <ReportHeader
                        companyName={window.RoboLedger?.companyName || 'Your Company Name'}
                        reportTitle="Statement of Income and Retained Earnings"
                        period={`Year Ended ${dateRange.end}`}
                    />

                    {/* Report Table */}
                    <ReportTable
                        columns={[
                            { label: '', width: '65%', align: 'left' },
                            { label: new Date(dateRange.end).getFullYear().toString(), width: '17%', align: 'right', bold: true },
                            { label: (new Date(dateRange.end).getFullYear() - 1).toString(), width: '17%', align: 'right' }
                        ]}
                        rows={buildTableRows()}
                        className="mt-6"
                    />

                    {/* Export Actions */}
                    <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3">
                        <button
                            onClick={exportCSV}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
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

                    {/* Professional Footer */}
                    <ReportFooter showApproval={true} showPageNumber={true} pageNumber={1} />
                </div>
            )}
        </div>
    );
}

export default IncomeStatementReport;
