import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';

/**
 * ReportsPage - Financial Reports Hub
 * Main navigation page for all accounting reports
 */
export function ReportsPage() {
    const [selectedReport, setSelectedReport] = useState(null);

    const reports = [
        {
            id: 'trial-balance',
            icon: 'ph-scales',
            title: 'Trial Balance',
            description: 'Verify debits equal credits',
            color: 'blue'
        },
        {
            id: 'general-journal',
            icon: 'ph-book',
            title: 'General Journal',
            description: 'Complete transaction log',
            color: 'purple'
        },
        {
            id: 'general-ledger',
            icon: 'ph-list-bullets',
            title: 'General Ledger',
            description: 'Account-specific history',
            color: 'indigo'
        },
        {
            id: 'income-statement',
            icon: 'ph-chart-line-up',
            title: 'Income Statement',
            description: 'Revenue, expenses, profit',
            color: 'green'
        },
        {
            id: 'balance-sheet',
            icon: 'ph-stack',
            title: 'Balance Sheet',
            description: 'Assets, liabilities, equity',
            color: 'cyan'
        },
        {
            id: 'cash-flow',
            icon: 'ph-currency-circle-dollar',
            title: 'Cash Flow Statement',
            description: 'Operating, investing, financing',
            color: 'teal'
        },
        {
            id: 'coa-summary',
            icon: 'ph-chart-bar',
            title: 'COA Summary',
            description: 'Category breakdown',
            color: 'orange'
        },
        {
            id: 'gst-report',
            icon: 'ph-percent',
            title: 'GST/HST Report',
            description: 'Tax collected vs paid',
            color: 'red'
        }
    ];

    const colorMap = {
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', hover: 'hover:bg-blue-100' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', hover: 'hover:bg-purple-100' },
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', hover: 'hover:bg-indigo-100' },
        green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', hover: 'hover:bg-green-100' },
        cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'text-cyan-600', hover: 'hover:bg-cyan-100' },
        teal: { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-600', hover: 'hover:bg-teal-100' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', hover: 'hover:bg-orange-100' },
        red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', hover: 'hover:bg-red-100' }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Page Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <i className="ph ph-chart-pie-slice text-3xl text-blue-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
                </div>
                <p className="text-gray-600">
                    Generate insights from your accounting data with comprehensive financial reports
                </p>
            </div>

            {/* Reports Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reports.map(report => {
                    const colors = colorMap[report.color];
                    return (
                        <button
                            key={report.id}
                            onClick={() => setSelectedReport(report.id)}
                            className={`${colors.bg} ${colors.border} ${colors.hover} border-2 rounded-lg p-6 text-left transition-all duration-200 hover:shadow-lg hover:scale-105`}
                        >
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

            {/* Coming Soon: Report Detail Views */}
            {selectedReport && (
                <div className="max-w-7xl mx-auto mt-8 bg-white rounded-lg shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {reports.find(r => r.id === selectedReport)?.title}
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
                        <p className="text-gray-500 text-lg">
                            Report component in progress...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReportsPage;
