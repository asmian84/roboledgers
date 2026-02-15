import React from 'react';

/**
 * UtilityBar - Side panel showing reconciliation stats, metadata, and dashboard
 * Replaces the old overlay utility bar with integrated split-pane design
 */
export function UtilityBar({ transactions = [] }) {
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

        return {
            total: transactions.length,
            categorized: categorized.length,
            uncategorized: uncategorized.length,
            totalDebit,
            totalCredit,
            netActivity: totalDebit - totalCredit
        };
    }, [transactions]);

    const categorizationProgress = stats.total > 0
        ? Math.round((stats.categorized / stats.total) * 100)
        : 0;

    return (
        <div className="h-full overflow-y-auto bg-gray-50">
            {/* Dashboard Section */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Dashboard</h3>

                {/* Transaction Count */}
                <div className="mb-4">
                    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                    <div className="text-xs text-gray-500">Transactions</div>
                </div>

                {/* Categorization Progress */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700">Categorized</span>
                        <span className="text-xs font-bold text-blue-600">{categorizationProgress}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${categorizationProgress}%` }}
                        />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                        {stats.categorized} of {stats.total}
                    </div>
                </div>

                {/* Needs Review */}
                {stats.uncategorized > 0 && (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                        <div className="flex items-center gap-2">
                            <i className="ph ph-warning text-amber-600"></i>
                            <div className="flex-1">
                                <div className="text-xs font-semibold text-amber-900">Needs Review</div>
                                <div className="text-xs text-amber-700">{stats.uncategorized} uncategorized</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Account Reconciliation */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Reconciliation</h3>

                {/* Account Balances */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Total Debit</span>
                        <span className="text-sm font-bold font-mono text-red-600">
                            ${stats.totalDebit.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Total Credit</span>
                        <span className="text-sm font-bold font-mono text-green-600">
                            ${stats.totalCredit.toFixed(2)}
                        </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-700">Net Activity</span>
                        <span className={`text-sm font-bold font-mono ${stats.netActivity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${stats.netActivity.toFixed(2)}
                        </span>
                    </div>
                </div>
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
        .map(([name, count]) => {
            // Try to get friendly name from COA
            const account = window.RoboLedger?.COA?.get(String(name));
            return {
                name: account?.name || name,
                count
            };
        });
}

export default UtilityBar;
