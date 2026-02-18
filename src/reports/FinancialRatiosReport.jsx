import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportFilters from './components/ReportFilters.jsx';

/**
 * FinancialRatiosReport - Key financial metrics dashboard
 */
export function FinancialRatiosReport() {
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
            const data = generator.generateFinancialRatios(range.start, range.end);
            setReportData(data);
            setDateRange(range);
        } catch (error) {
            console.error('[FINANCIAL_RATIOS] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amount) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
    const pct = (value) => `${value.toFixed(1)}%`;
    const ratio = (value) => value.toFixed(2);

    const MetricCard = ({ title, value, subtitle, color = 'gray' }) => (
        <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
            <p className={`text-xs font-semibold text-${color}-600 uppercase tracking-wide mb-1`}>{title}</p>
            <p className="text-2xl font-bold text-gray-900 font-mono">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => window.__reportsGoBack?.()} className="text-gray-600 hover:text-gray-900 mr-2">
                        <i className="ph ph-arrow-left text-2xl"></i>
                    </button>
                    <i className="ph ph-chart-line text-3xl text-violet-600"></i>
                    <h1 className="text-3xl font-bold text-gray-900">Financial Ratios</h1>
                </div>
                <p className="text-gray-600">Key financial metrics and performance indicators</p>
            </div>

            <div className="max-w-7xl mx-auto">
                <ReportFilters onFilterChange={generateReport} />
            </div>

            {loading && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-12 text-center">
                    <i className="ph ph-spinner-gap animate-spin text-4xl text-violet-600 mb-4"></i>
                    <p className="text-gray-600">Calculating ratios...</p>
                </div>
            )}

            {!loading && !reportData && (
                <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-16 text-center">
                    <i className="ph ph-upload-simple text-6xl text-gray-200 mb-5 block"></i>
                    <p className="text-lg font-semibold text-gray-500 mb-1">Upload statements to get started</p>
                    <p className="text-sm text-gray-400 mb-6">Import your bank statements to generate this report</p>
                    <button
                        onClick={() => window.__reportsGoBack?.()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        <i className="ph ph-arrow-left text-base"></i>
                        Back to Reports
                    </button>
                </div>
            )}

            {!loading && reportData && (
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Base Metrics */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Base Metrics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-green-600 uppercase">Revenue</p>
                                <p className="text-xl font-bold font-mono">{fmt(reportData.metrics.revenue)}</p>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-orange-600 uppercase">Expenses</p>
                                <p className="text-xl font-bold font-mono">{fmt(reportData.metrics.expenses)}</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-blue-600 uppercase">Net Income</p>
                                <p className={`text-xl font-bold font-mono ${reportData.metrics.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {fmt(reportData.metrics.netIncome)}
                                </p>
                            </div>
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-purple-600 uppercase">Gross Profit</p>
                                <p className="text-xl font-bold font-mono">{fmt(reportData.metrics.grossProfit)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Profitability */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Profitability Ratios</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Gross Margin</p>
                                <p className="text-2xl font-bold font-mono">{pct(reportData.profitability.grossMargin)}</p>
                            </div>
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Net Margin</p>
                                <p className="text-2xl font-bold font-mono">{pct(reportData.profitability.netMargin)}</p>
                            </div>
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Return on Assets</p>
                                <p className="text-2xl font-bold font-mono">{pct(reportData.profitability.roa)}</p>
                            </div>
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Return on Equity</p>
                                <p className="text-2xl font-bold font-mono">{pct(reportData.profitability.roe)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Liquidity */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Liquidity Ratios</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Current Ratio</p>
                                <p className="text-2xl font-bold font-mono">{ratio(reportData.liquidity.currentRatio)}</p>
                                <p className="text-xs text-gray-400 mt-1">Target: &gt; 1.0</p>
                            </div>
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Working Capital</p>
                                <p className="text-2xl font-bold font-mono">{fmt(reportData.liquidity.workingCapital)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Leverage */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Leverage Ratios</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Debt to Equity</p>
                                <p className="text-2xl font-bold font-mono">{ratio(reportData.leverage.debtToEquity)}</p>
                            </div>
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Debt to Assets</p>
                                <p className="text-2xl font-bold font-mono">{pct(reportData.leverage.debtToAssets)}</p>
                            </div>
                            <div className="border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Equity Ratio</p>
                                <p className="text-2xl font-bold font-mono">{pct(reportData.leverage.equityRatio)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FinancialRatiosReport;
