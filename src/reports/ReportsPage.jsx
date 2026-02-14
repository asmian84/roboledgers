import React from 'react';
import { TrialBalanceReport } from './TrialBalanceReport.jsx';
import { GSTReport } from './GSTReport.jsx';
import { IncomeStatementReport } from './IncomeStatementReport.jsx';

/**
 * ReportsPage - Financial Reports Hub
 * Routes to actual report components for production-ready reports
 */
export function ReportsPage() {
    const [selectedReport, setSelectedReport] = React.useState(null);

    const reports = [
        {
            id: 'trial-balance',
            icon: 'ph-scales',
            title: 'Trial Balance',
            description: 'Verify debits equal credits',
            color: 'blue',
            ready: true,
            component: TrialBalanceReport
        },
        {
            id: 'income-statement',
            icon: 'ph-chart-line-up',
            title: 'Income Statement',
            description: 'Revenue, expenses, profit',
            color: 'green',
            ready: true,
            component: IncomeStatementReport
        },
        {
            id: 'gst-report',
            icon: 'ph-percent',
            title: 'GST/HST Report',
            description: 'Tax collected vs paid',
            color: 'red',
            ready: true,
            component: GSTReport
        },
        {
            id: 'balance-sheet',
            icon: 'ph-stack',
            title: 'Balance Sheet',
            description: 'Assets, liabilities, equity',
            color: 'cyan',
            ready: false
        },
        {
            id: 'cash-flow',
            icon: 'ph-currency-circle-dollar',
            title: 'Cash Flow',
            description: 'Operating, investing, financing',
            color: 'teal',
            ready: false
        },
        {
            id: 'general-ledger',
            icon: 'ph-list-bullets',
            title: 'General Ledger',
            description: 'Account-specific history',
            color: 'indigo',
            ready: false
        },
        {
            id: 'general-journal',
            icon: 'ph-book',
            title: 'General Journal',
            description: 'Transaction log',
            color: 'purple',
            ready: false
        },
        {
            id: 'coa-summary',
            icon: 'ph-chart-bar',
            title: 'COA Summary',
            description: 'Category breakdown',
            color: 'orange',
            ready: false
        },
        {
            id: 'financial-ratios',
            icon: 'ph-chart-line',
            title: 'Financial Ratios',
            description: 'Key metrics',
            color: 'violet',
            ready: false
        }
    ];

    const colorMap = {
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', hover: 'hover:bg-blue-100', badge: 'bg-blue-600' },
        green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', hover: 'hover:bg-green-100', badge: 'bg-green-600' },
        red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', hover: 'hover:bg-red-100', badge: 'bg-red-600' },
        cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'text-cyan-600', hover: 'hover:bg-cyan-100', badge: 'bg-cyan-600' },
        teal: { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-600', hover: 'hover:bg-teal-100', badge: 'bg-teal-600' },
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', hover: 'hover:bg-indigo-100', badge: 'bg-indigo-600' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', hover: 'hover:bg-purple-100', badge: 'bg-purple-600' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', hover: 'hover:bg-orange-100', badge: 'bg-orange-600' },
        violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', hover: 'hover:bg-violet-100', badge: 'bg-violet-600' }
    };

    // Render selected report component
    const selectedReportData = reports.find(r => r.id === selectedReport);
    if (selectedReportData?.ready && selectedReportData.component) {
        const ReportComponent = selectedReportData.component;
        return <ReportComponent />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <i className="ph ph-chart-pie-slice text-3xl text-blue-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
                </div>
                <p className="text-gray-600">
                    Professional accounting reports matching Caseware standards
                </p>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map(report => {
                    const colors = colorMap[report.color];
                    return (
                        <button
                            key={report.id}
                            onClick={() => report.ready ? setSelectedReport(report.id) : null}
                            className={`${colors.bg} ${colors.border} ${report.ready ? colors.hover + ' cursor-pointer' : 'cursor-not-allowed opacity-60'} border-2 rounded-lg p-6 text-left transition-all duration-200 ${report.ready ? 'hover:shadow-lg hover:scale-105' : ''} relative`}
                        >
                            {report.ready ? (
                                <div className={`absolute top-3 right-3 ${colors.badge} text-white text-xs font-bold px-2 py-1 rounded`}>
                                    READY
                                </div>
                            ) : (
                                <div className="absolute top-3 right-3 bg-gray-400 text-white text-xs font-bold px-2 py-1 rounded">
                                    SOON
                                </div>
                            )}

                            <div className="flex flex-col gap-4">
                                <div className={`${colors.icon} text-4xl`}>
                                    <i className={report.icon}></i>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                                        {report.title}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {report.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {selectedReport && !selectedReportData?.ready && (
                <div className="max-w-7xl mx-auto mt-8 bg-white rounded-lg shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {selectedReportData?.title}
                        </h2>
                        <button
                            onClick={() => setSelectedReport(null)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <i className="ph ph-x text-2xl"></i>
                        </button>
                    </div>

                    <div className="text-center py-12">
                        <i className="ph ph-wrench text-6xl text-gray-300 mb-4"></i>
                        <p className="text-gray-500 text-lg mb-2">
                            Coming soon...
                        </p>
                        <p className="text-sm text-gray-400">
                            Backend ready. UI implementation in progress.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReportsPage;
