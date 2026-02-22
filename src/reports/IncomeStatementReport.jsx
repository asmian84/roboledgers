import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';
import ReportHeader from './components/ReportHeader.jsx';
import ReportTable from './components/ReportTable.jsx';
import { ReportControlsBar, FONTS } from './components/ReportControlsBar.jsx';

/**
 * IncomeStatementReport - Professional income statement
 * Statement of Income and Retained Earnings — single Amount column, flowing format
 */
export function IncomeStatementReport() {
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [loading, setLoading] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [textSize, setTextSize] = useState(13);
    const [fontFamily, setFontFamily] = useState('caseware');
    const fontStack = FONTS[fontFamily]?.stack || FONTS.system.stack;

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

    // Build table rows — single Amount column, flowing format
    const buildTableRows = () => {
        if (!reportData) return [];

        const rows = [];

        // REVENUES section header
        rows.push({ type: 'section', description: 'REVENUES', values: [''] });

        // Revenue line items
        if (reportData.revenue && reportData.revenue.length > 0) {
            reportData.revenue.forEach(item => {
                rows.push({ description: item.name, values: [item.amount], indent: 1, coaCode: item.code });
            });
        }

        // Total revenue
        rows.push({ type: 'subtotal', description: 'Total Revenue', values: [reportData.totals.revenue] });

        // Blank line
        rows.push({ description: '', values: [''] });

        // COST OF SALES
        rows.push({ type: 'section', description: 'COST OF SALES', values: [''] });

        if (reportData.cogs && reportData.cogs.length > 0) {
            reportData.cogs.forEach(item => {
                rows.push({ description: item.name, values: [item.amount], indent: 1, coaCode: item.code });
            });
        }

        rows.push({ type: 'subtotal', description: 'Total Cost of Sales', values: [reportData.totals.cogs] });

        // GROSS PROFIT
        rows.push({ type: 'subtotal', description: 'GROSS PROFIT', values: [reportData.totals.grossProfit] });

        // Blank line
        rows.push({ description: '', values: [''] });

        // EXPENSES
        rows.push({ type: 'section', description: 'EXPENSES', values: [''] });

        if (reportData.expenses && reportData.expenses.length > 0) {
            reportData.expenses.forEach(exp => {
                rows.push({ description: exp.name, values: [exp.amount], indent: 1, coaCode: exp.code });
            });
        }

        rows.push({ type: 'subtotal', description: 'Total Expenses', values: [reportData.totals.expenses] });

        // Blank line
        rows.push({ description: '', values: [''] });

        // NET INCOME
        rows.push({ type: 'total', description: 'NET INCOME', values: [reportData.totals.netIncome] });

        return rows;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Top Section: Filters */}
            <div className="max-w-5xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => window.__reportsGoBack?.()}
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
                <div className="max-w-5xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-green-600 mb-4"></i>
                    <p className="text-gray-600">Generating report...</p>
                </div>
            )}

            {/* Empty state */}
            {!loading && !reportData && (
                <div className="max-w-5xl mx-auto bg-white rounded-lg shadow p-16 text-center">
                    <i className="ph ph-upload-simple text-6xl text-gray-200 mb-5 block"></i>
                    <p className="text-lg font-semibold text-gray-500 mb-1">Upload statements to get started</p>
                    <p className="text-sm text-gray-400 mb-6">Import your bank statements to generate this report</p>
                    <button
                        onClick={() => window.__reportsGoBack?.()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        <i className="ph ph-arrow-left text-base"></i>
                        Back to Reports
                    </button>
                </div>
            )}

            {/* Report Content */}
            {!loading && reportData && (
                <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Shared Report Controls Bar */}
                    <ReportControlsBar
                        zoom={zoom} setZoom={setZoom}
                        textSize={textSize} setTextSize={setTextSize}
                        fontFamily={fontFamily} setFontFamily={setFontFamily}
                        accentColor="green"
                    />

                    <div className="p-8" style={{ fontSize: `${(textSize * zoom) / 100}px`, fontFamily: fontStack }}>
                    {/* Professional Header */}
                    <ReportHeader
                        companyName={window.UI_STATE?.activeClientName || 'Your Company Name'}
                        reportTitle="Statement of Income and Retained Earnings"
                        period={`Year Ended ${dateRange.end}`}
                    />

                    {/* Report Table */}
                    <ReportTable
                        columns={[
                            { label: '', width: '65%', align: 'left' },
                            { label: 'Amount', width: '35%', align: 'right', bold: true }
                        ]}
                        rows={buildTableRows()}
                        className="mt-4"
                        dateRange={dateRange}
                        accentColor="green"
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

                    </div>{/* end font/zoom wrapper */}
                </div>
            )}
        </div>
    );
}

export default IncomeStatementReport;
