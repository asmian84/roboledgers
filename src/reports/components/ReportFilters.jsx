import React, { useState, useEffect } from 'react';

/**
 * ReportFilters - Date range and period selection for reports
 * Features:
 * - Auto-detect periods from uploaded statements
 * - Fiscal year-end cutoff support
 * - Custom date range selection
 */
export function ReportFilters({ onFilterChange }) {
    const [periodMode, setPeriodMode] = useState('auto'); // 'auto', 'fiscal', 'custom'
    const [fiscalYearEnd, setFiscalYearEnd] = useState('12-31'); // MM-DD format
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [detectedPeriod, setDetectedPeriod] = useState(null);

    // Auto-detect period from transaction dates
    useEffect(() => {
        if (window.RoboLedger?.Ledger) {
            const transactions = window.RoboLedger.Ledger.getAllTransactions();

            if (transactions.length > 0) {
                const dates = transactions.map(tx => new Date(tx.date)).sort((a, b) => a - b);
                const earliest = dates[0];
                const latest = dates[dates.length - 1];

                setDetectedPeriod({
                    start: earliest.toISOString().split('T')[0],
                    end: latest.toISOString().split('T')[0],
                    transactionCount: transactions.length
                });

                // Initialize custom dates with detected range
                if (!customStart) setCustomStart(earliest.toISOString().split('T')[0]);
                if (!customEnd) setCustomEnd(latest.toISOString().split('T')[0]);
            }
        }
    }, []);

    // Calculate fiscal year range based on year-end
    const getFiscalYearRange = (yearEndMMDD) => {
        if (!detectedPeriod) return null;

        const [month, day] = yearEndMMDD.split('-').map(Number);
        const latestDate = new Date(detectedPeriod.end);
        const currentYear = latestDate.getFullYear();

        // Determine fiscal year end
        let fiscalYearEndDate = new Date(currentYear, month - 1, day);

        // If we're before the fiscal year end, use previous year
        if (latestDate < fiscalYearEndDate) {
            fiscalYearEndDate = new Date(currentYear - 1, month - 1, day);
        }

        // Fiscal year starts day after previous year's end
        const fiscalYearStart = new Date(fiscalYearEndDate);
        fiscalYearStart.setFullYear(fiscalYearStart.getFullYear() - 1);
        fiscalYearStart.setDate(fiscalYearStart.getDate() + 1);

        return {
            start: fiscalYearStart.toISOString().split('T')[0],
            end: fiscalYearEndDate.toISOString().split('T')[0]
        };
    };

    // Calculate current date range based on mode
    const getCurrentRange = () => {
        if (periodMode === 'auto' && detectedPeriod) {
            return { start: detectedPeriod.start, end: detectedPeriod.end };
        } else if (periodMode === 'fiscal') {
            return getFiscalYearRange(fiscalYearEnd);
        } else {
            return { start: customStart, end: customEnd };
        }
    };

    // Notify parent of filter changes
    useEffect(() => {
        const range = getCurrentRange();
        if (range?.start && range?.end && onFilterChange) {
            onFilterChange(range);
        }
    }, [periodMode, fiscalYearEnd, customStart, customEnd, detectedPeriod]);

    const fiscalRange = getFiscalYearRange(fiscalYearEnd);

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
                Report Period
            </h3>

            {/* Period Mode Selection */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                    onClick={() => setPeriodMode('auto')}
                    className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${periodMode === 'auto'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <i className="ph ph-calendar-check"></i>
                        <span>Auto-Detect</span>
                    </div>
                </button>

                <button
                    onClick={() => setPeriodMode('fiscal')}
                    className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${periodMode === 'fiscal'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <i className="ph ph-calendar-blank"></i>
                        <span>Fiscal Year</span>
                    </div>
                </button>

                <button
                    onClick={() => setPeriodMode('custom')}
                    className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${periodMode === 'custom'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <i className="ph ph-calendar-dots"></i>
                        <span>Custom Range</span>
                    </div>
                </button>
            </div>

            {/* Auto-Detect Info */}
            {periodMode === 'auto' && detectedPeriod && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <i className="ph ph-info text-blue-600 text-xl mt-0.5"></i>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-900 mb-1">
                                Period detected from uploaded statements
                            </p>
                            <div className="flex items-center gap-4 text-sm text-blue-700">
                                <span className="font-mono">{detectedPeriod.start}</span>
                                <span>→</span>
                                <span className="font-mono">{detectedPeriod.end}</span>
                                <span className="text-blue-500">
                                    ({detectedPeriod.transactionCount} transactions)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fiscal Year Options */}
            {periodMode === 'fiscal' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fiscal Year End Date
                        </label>
                        <select
                            value={fiscalYearEnd}
                            onChange={(e) => setFiscalYearEnd(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="12-31">December 31 (Calendar Year)</option>
                            <option value="01-31">January 31</option>
                            <option value="02-28">February 28/29</option>
                            <option value="03-31">March 31</option>
                            <option value="04-30">April 30</option>
                            <option value="05-31">May 31</option>
                            <option value="06-30">June 30</option>
                            <option value="07-31">July 31</option>
                            <option value="08-31">August 31</option>
                            <option value="09-30">September 30</option>
                            <option value="10-31">October 31</option>
                            <option value="11-30">November 30</option>
                        </select>
                    </div>

                    {fiscalRange && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-purple-900 mb-2">
                                Fiscal Year Period
                            </p>
                            <div className="flex items-center gap-4 text-sm text-purple-700">
                                <span className="font-mono">{fiscalRange.start}</span>
                                <span>→</span>
                                <span className="font-mono">{fiscalRange.end}</span>
                            </div>
                            <p className="text-xs text-purple-600 mt-2">
                                Transactions outside this period will be excluded from reports
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Custom Range Inputs */}
            {periodMode === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReportFilters;
