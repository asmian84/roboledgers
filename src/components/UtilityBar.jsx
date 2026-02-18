import React from 'react';

// Vibrant color palette for pie chart
const CHART_COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
    '#84cc16', // lime
    '#06b6d4', // cyan
    '#f43f5e', // rose
];

/**
 * Simple SVG Pie Chart
 */
function PieChart({ data, size = 200, onSliceClick }) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                No data to display
            </div>
        );
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90; // Start at top

    const slices = data.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const angle = (item.value / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;

        currentAngle = endAngle;

        // Calculate slice path
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const radius = size / 2 - 10;
        const centerX = size / 2;
        const centerY = size / 2;

        const x1 = centerX + radius * Math.cos(startRad);
        const y1 = centerY + radius * Math.sin(startRad);
        const x2 = centerX + radius * Math.cos(endRad);
        const y2 = centerY + radius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');

        return {
            path: pathData,
            color: CHART_COLORS[index % CHART_COLORS.length],
            label: item.label,
            value: item.value,
            filterFn: item.filterFn,
            percentage: percentage.toFixed(1)
        };
    });

    return (
        <div className="space-y-3">
            {/* SVG Pie Chart — each slice is clickable */}
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
                {slices.map((slice, index) => (
                    <path
                        key={index}
                        d={slice.path}
                        fill={slice.color}
                        stroke="white"
                        strokeWidth="2"
                        className="transition-opacity hover:opacity-80 cursor-pointer"
                        title={`${slice.label} — click to filter`}
                        onClick={() => onSliceClick?.(slice)}
                    />
                ))}
            </svg>

            {/* Legend — each row is clickable */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {slices.map((slice, index) => (
                    <div
                        key={index}
                        className="flex items-center justify-between text-xs cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100 transition-colors"
                        title={`Filter to: ${slice.label}`}
                        onClick={() => onSliceClick?.(slice)}
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div
                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: slice.color }}
                            />
                            <span className="text-gray-700 truncate">{slice.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="font-semibold text-gray-900">{slice.value}</span>
                            <span className="text-gray-500 w-10 text-right">{slice.percentage}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * UtilityBar - Side panel showing reconciliation stats, metadata, and dashboard
 * Replaces the old overlay utility bar with integrated split-pane design
 */
export function UtilityBar({ transactions = [], onFilterTransactions }) {
    // Calculate stats from transactions
    const stats = React.useMemo(() => {
        const categorized = transactions.filter(t => t.category && t.category !== 'UNCAT');
        const uncategorized = transactions.filter(t => !t.category || t.category === 'UNCAT');

        const totalDebit = transactions.reduce((sum, t) => {
            return t.polarity === 'DEBIT' ? sum + (t.amount_cents || 0) : sum;
        }, 0) / 100;

        const totalCredit = transactions.reduce((sum, t) => {
            return t.polarity === 'CREDIT' ? sum + (t.amount_cents || 0) : sum;
        }, 0) / 100;

        // GST Calculations
        let gstCollected = 0;
        let gstPaid = 0;
        let totalRevenue = 0;

        transactions.forEach(t => {
            // Only include if GST checkbox is checked
            if (!t.gst_enabled) return;

            const taxAmount = (t.tax_cents || 0) / 100;

            // USE ACCOUNT TYPE: Revenue accounts = GST Collected, Expense accounts = GST Paid/ITC
            const account = window.RoboLedger?.COA?.get(t.category);

            if (account?.root === 'REVENUE') {
                // Revenue account = GST Collected (regardless of polarity)
                gstCollected += taxAmount;
                totalRevenue += (t.amount_cents || 0) / 100;
            } else if (account?.root === 'EXPENSE' || account?.class === 'COGS') {
                // Expense account = GST Paid/ITC
                gstPaid += taxAmount;
            } else if (!account && t.polarity === 'CREDIT') {
                // Fallback: Uncategorized credits default to GST Collected
                gstCollected += taxAmount;
                totalRevenue += (t.amount_cents || 0) / 100;
            } else if (!account && t.polarity === 'DEBIT') {
                // Fallback: Uncategorized debits default to GST Paid
                gstPaid += taxAmount;
            }
        });

        const netGST = gstCollected - gstPaid;

        return {
            total: transactions.length,
            categorized: categorized.length,
            uncategorized: uncategorized.length,
            totalDebit,
            totalCredit,
            netActivity: totalDebit - totalCredit,
            gstCollected,
            gstPaid,
            netGST,
            totalRevenue
        };
    }, [transactions]);

    const categorizationProgress = stats.total > 0
        ? Math.round((stats.categorized / stats.total) * 100)
        : 0;

    return (
        <div className="h-full overflow-y-auto bg-gray-50">
            {/* Dashboard Section - 3 Column Stats */}
            <div className="p-3 bg-white border-b border-gray-200">
                <div className="bg-pink-50 border border-pink-200 rounded-md overflow-hidden">
                    <div className="grid grid-cols-3 divide-x divide-pink-200">

                        {/* Column 1: Total */}
                        <div className="p-3 text-center">
                            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                            <div className="text-xs text-gray-600 mt-1">Total</div>
                        </div>

                        {/* Column 2: Categorized */}
                        <div className="p-3 text-center">
                            <div className="text-2xl font-bold text-blue-600">
                                {stats.categorized}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                                Categorized ({categorizationProgress}%)
                            </div>
                        </div>

                        {/* Column 3: Uncategorized */}
                        <div className="p-3 text-center">
                            <div className="text-2xl font-bold text-amber-600">
                                {stats.uncategorized}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">Uncategorized</div>
                        </div>

                    </div>
                </div>
            </div>

            {/* GST Summary */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">GST Summary</h3>
                <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-2">
                    <div
                        className="flex justify-between items-center cursor-pointer hover:bg-green-100 p-2 -m-2 rounded transition-colors"
                        onClick={() => onFilterTransactions?.({
                            type: 'gst_collected',
                            label: 'GST Collected',
                            filter: tx => tx.gst_enabled && tx.polarity === 'CREDIT' && tx.tax_cents > 0
                        })}
                        title="Click to filter GST Collected transactions"
                    >
                        <span className="text-xs text-gray-600">GST Collected</span>
                        <span className="text-sm font-bold font-mono text-green-700">
                            ${stats.gstCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div
                        className="flex justify-between items-center cursor-pointer hover:bg-green-100 p-2 -m-2 rounded transition-colors"
                        onClick={() => onFilterTransactions?.({
                            type: 'gst_paid',
                            label: 'GST ITC (Paid)',
                            filter: tx => tx.gst_enabled && tx.polarity === 'DEBIT' && tx.tax_cents > 0
                        })}
                        title="Click to filter GST ITC/Paid transactions"
                    >
                        <span className="text-xs text-gray-600">GST ITC (Paid)</span>
                        <span className="text-sm font-bold font-mono text-blue-700">
                            ${stats.gstPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div
                        className="flex justify-between items-center cursor-pointer hover:bg-green-100 p-2 -m-2 rounded transition-colors"
                        onClick={() => onFilterTransactions?.({
                            type: 'revenue',
                            label: 'Total Revenue',
                            filter: tx => tx.polarity === 'CREDIT' && tx.gst_enabled
                        })}
                        title="Click to filter Revenue transactions"
                    >
                        <span className="text-xs text-gray-600">Total Revenue</span>
                        <span className="text-sm font-bold font-mono text-gray-700">
                            ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="pt-2 border-t border-green-300 flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-700">
                            {stats.netGST < 0 ? 'GST Refund' : 'GST Payable'}
                        </span>
                        <span className={`text-sm font-bold font-mono ${stats.netGST < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${Math.abs(stats.netGST).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Account Reconciliation */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Reconciliation</h3>

                {/* Account Balances */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Total Debit</span>
                        <span className="text-sm font-bold font-mono text-red-600">
                            ${stats.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Total Credit</span>
                        <span className="text-sm font-bold font-mono text-green-600">
                            ${stats.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-700">Net Activity</span>
                        <span className={`text-sm font-bold font-mono ${stats.netActivity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${Math.abs(stats.netActivity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Category Distribution Pie Chart */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Category Distribution</h3>
                <p className="text-[10px] text-gray-400 mb-2">Click a slice or row to filter the grid</p>
                <PieChart
                    data={getCategoryDistribution(transactions)}
                    size={180}
                    onSliceClick={(slice) => {
                        if (typeof slice.filterFn === 'function') {
                            onFilterTransactions?.({ label: slice.label, filter: slice.filterFn });
                        }
                    }}
                />
            </div>

            {/* Metadata */}
            <div className="p-4 bg-white">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Metadata</h3>

                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Date Range</span>
                        <span className="text-gray-900 font-medium">
                            {transactions.length > 0 ? (
                                <>
                                    {new Date(Math.min(...transactions.map(t => new Date(t.date)))).toLocaleDateString('en-CA')}
                                    {' - '}
                                    {new Date(Math.max(...transactions.map(t => new Date(t.date)))).toLocaleDateString('en-CA')}
                                </>
                            ) : '—'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Import Status</span>
                        <span className="text-green-600 font-semibold">✓ Complete</span>
                    </div>
                </div>
            </div>

            {/* Top Categories */}
            <div className="p-4 bg-white border-t border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Top Categories</h3>

                <div className="space-y-2">
                    {getTopCategories(transactions).map((cat, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-gray-700 truncate">{cat.name}</span>
                            <span className="font-mono font-semibold text-gray-900">{cat.count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Helper to get category distribution for pie chart
function getCategoryDistribution(transactions) {
    const categoryCounts = {};

    transactions.forEach(tx => {
        const cat = tx.category || 'Uncategorized';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    return Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => {
            // Try to get friendly name from COA
            const account = window.RoboLedger?.COA?.get(String(code));
            const label = account?.name || (code === 'Uncategorized' ? 'Uncategorized' : code);
            return {
                label,
                value: count,
                // filterFn used by PieChart onSliceClick to filter the grid
                filterFn: (tx) => (tx.category || 'Uncategorized') === code,
            };
        });
}

// Helper to get top 5 categories by transaction count
function getTopCategories(transactions) {
    const categoryCounts = {};

    transactions.forEach(tx => {
        const cat = tx.category || 'Uncategorized';
        if (cat === 'UNCAT') return; // Skip uncategorized
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    return Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, count]) => {
            // Try to get friendly name from COA (code is the account code like "2710")
            const account = window.RoboLedger?.COA?.get(String(code));
            return {
                name: code === 'Uncategorized' ? 'Uncategorized' : (account?.name || code),
                count
            };
        });
}

export default UtilityBar;
