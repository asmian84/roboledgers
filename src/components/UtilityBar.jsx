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

/** Shared row style for drillable stat rows */
const DRILL_ROW = "flex justify-between items-center cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-opacity-80 transition-colors group";

// ── Account type badge colours ─────────────────────────────────────────────
const ACCOUNT_TYPE_COLORS = {
    CHEQUING:   { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    SAVINGS:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    VISA:       { bg: '#faf5ff', border: '#e9d5ff', text: '#7c3aed' },
    MASTERCARD: { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' },
    AMEX:       { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    DEFAULT:    { bg: '#f8fafc', border: '#e2e8f0', text: '#475569' },
};

function accountTypeColor(account) {
    const t = (account?.accountType || account?.brand || account?.cardNetwork || '').toUpperCase();
    return ACCOUNT_TYPE_COLORS[t] || ACCOUNT_TYPE_COLORS.DEFAULT;
}

function accountTypeLabel(account) {
    if (account?.brand || account?.cardNetwork) {
        return (account.brand || account.cardNetwork).toUpperCase();
    }
    if (account?.accountType) return account.accountType;
    return 'ACCOUNT';
}

/** Masked last-4 of account number */
function maskNumber(num) {
    if (!num) return null;
    const s = String(num).replace(/\D/g, '');
    return s.length >= 4 ? '···· ' + s.slice(-4) : s;
}

/**
 * AccountCard — compact card showing current account metadata.
 * Click the chevron to expand and pick a different account.
 */
function AccountCard({ accounts = [], selectedAccount = 'ALL', onAccountChange }) {
    const [expanded, setExpanded] = React.useState(false);

    const current = selectedAccount === 'ALL'
        ? null
        : accounts.find(a => a.id === selectedAccount);

    const col = current ? accountTypeColor(current) : ACCOUNT_TYPE_COLORS.DEFAULT;

    return (
        <div className="bg-white border-b border-gray-200">
            {/* ── Current account summary row ── */}
            <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setExpanded(v => !v)}
            >
                {/* Bank icon / initial */}
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                    style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}
                >
                    {current
                        ? (current.ref || current.name || '?').slice(0, 3).toUpperCase()
                        : 'ALL'
                    }
                </div>

                {/* Name + sub-line */}
                <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
                        {current ? (current.name || current.ref || current.id) : 'All Accounts'}
                    </div>
                    <div className="text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
                        {current
                            ? [
                                accountTypeLabel(current),
                                current.bankName,
                                maskNumber(current.accountNumber),
                              ].filter(Boolean).join(' · ')
                            : `${accounts.length} accounts`
                        }
                    </div>
                </div>

                {/* Type badge */}
                {current && (
                    <span
                        className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}
                    >
                        {accountTypeLabel(current)}
                    </span>
                )}

                {/* Chevron */}
                <i className={`ph ph-caret-${expanded ? 'up' : 'down'} text-gray-400 text-[12px] flex-shrink-0`}></i>
            </button>

            {/* ── Expanded account switcher list ── */}
            {expanded && (
                <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
                    {/* All Accounts option */}
                    <button
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left ${selectedAccount === 'ALL' ? 'bg-indigo-50' : ''}`}
                        onClick={() => { onAccountChange?.('ALL'); setExpanded(false); }}
                    >
                        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-gray-100 border border-gray-200 flex-shrink-0">
                            <i className="ph ph-stack text-gray-500 text-[12px]"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-gray-800">All Accounts</div>
                            <div className="text-[10px] text-gray-400">{accounts.length} accounts · combined view</div>
                        </div>
                        {selectedAccount === 'ALL' && (
                            <i className="ph ph-check-circle text-indigo-500 text-[14px]"></i>
                        )}
                    </button>

                    {/* Individual accounts */}
                    {accounts.map(acct => {
                        const c   = accountTypeColor(acct);
                        const sel = selectedAccount === acct.id;
                        return (
                            <button
                                key={acct.id}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left ${sel ? 'bg-indigo-50' : ''}`}
                                onClick={() => { onAccountChange?.(acct.id); setExpanded(false); }}
                            >
                                <div
                                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-[9px] font-bold"
                                    style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                                >
                                    {(acct.ref || acct.name || '?').slice(0, 3).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-semibold text-gray-800 truncate">
                                        {acct.name || acct.ref || acct.id}
                                    </div>
                                    <div className="text-[10px] text-gray-400 truncate">
                                        {[accountTypeLabel(acct), acct.bankName, maskNumber(acct.accountNumber)]
                                            .filter(Boolean).join(' · ')}
                                    </div>
                                </div>
                                {acct.period && (
                                    <span className="text-[9px] text-gray-400 flex-shrink-0">{acct.period}</span>
                                )}
                                {sel && <i className="ph ph-check-circle text-indigo-500 text-[14px]"></i>}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Metadata strip (visible when a single account is selected) ── */}
            {current && !expanded && (
                <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                    {current.period && (
                        <span className="text-[10px] text-gray-400">
                            <span className="font-medium text-gray-600">Period</span> {current.period}
                        </span>
                    )}
                    {current.transit && (
                        <span className="text-[10px] text-gray-400">
                            <span className="font-medium text-gray-600">Transit</span> {current.transit}
                        </span>
                    )}
                    {current.inst && (
                        <span className="text-[10px] text-gray-400">
                            <span className="font-medium text-gray-600">Inst</span> {current.inst}
                        </span>
                    )}
                    {current.currency && (
                        <span className="text-[10px] text-gray-400">
                            <span className="font-medium text-gray-600">CCY</span> {current.currency}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * UtilityBar - Side panel showing reconciliation stats, metadata, and dashboard
 * Every stat row is drillable — clicking filters the main transaction grid.
 */
export function UtilityBar({
    transactions = [],
    onFilterTransactions,
    activeFilter,
    onClearFilter,
    accounts = [],
    selectedAccount = 'ALL',
    onAccountChange,
}) {
    // Calculate stats from transactions
    const stats = React.useMemo(() => {
        const categorized   = transactions.filter(t => t.category && t.category !== 'UNCAT');
        const uncategorized = transactions.filter(t => !t.category || t.category === 'UNCAT');
        const needsReview   = transactions.filter(t => t.confidence != null && t.confidence < 0.7);

        const totalDebit = transactions.reduce((sum, t) =>
            t.polarity === 'DEBIT'  ? sum + (t.amount_cents || 0) : sum, 0) / 100;
        const totalCredit = transactions.reduce((sum, t) =>
            t.polarity === 'CREDIT' ? sum + (t.amount_cents || 0) : sum, 0) / 100;

        // GST Calculations — only count gst_enabled transactions
        let gstCollected = 0;
        let gstPaid      = 0;
        let totalRevenue = 0;
        let totalExpense = 0;

        transactions.forEach(t => {
            const amtDollars = (t.amount_cents || 0) / 100;
            const coaAcct    = window.RoboLedger?.COA?.get(t.category);

            // Is this transaction from a credit card / liability account?
            // CC charges are NEVER revenue — the card owner is spending, not earning.
            const ledgerAcct = window.RoboLedger?.Accounts?.get(t.account_id);
            const isCCAcct   = !!(ledgerAcct?.brand || ledgerAcct?.cardNetwork ||
                                  (ledgerAcct?.accountType || '').toLowerCase() === 'creditcard');

            // Revenue / Expense totals (all transactions, not just GST-enabled)
            // Credit card transactions with a REVENUE category are misclassified — treat as expense
            if (coaAcct?.root === 'REVENUE' && !isCCAcct) {
                totalRevenue += amtDollars;
            } else if (coaAcct?.root === 'EXPENSE' || coaAcct?.class === 'COGS') {
                totalExpense += amtDollars;
            } else if (isCCAcct && coaAcct?.root === 'REVENUE') {
                // CC account with a revenue category = miscategorized charge → count as expense
                totalExpense += amtDollars;
            }

            if (!t.gst_enabled) return;
            const taxAmount = (t.tax_cents || 0) / 100;

            if (coaAcct?.root === 'REVENUE' && !isCCAcct) {
                // Revenue on a bank/chequing account = GST Collected
                gstCollected += taxAmount;
            } else if (coaAcct?.root === 'EXPENSE' || coaAcct?.class === 'COGS' || isCCAcct) {
                // Expenses, COGS, or ANY credit card transaction = GST ITC (paid to vendor)
                gstPaid += taxAmount;
            } else if (!coaAcct && !isCCAcct && t.polarity === 'CREDIT') {
                // Uncategorized bank CREDIT (deposit) — assume revenue/collected
                gstCollected += taxAmount;
                totalRevenue += amtDollars;
            } else if (!coaAcct) {
                // Everything else uncategorized = assume expense/ITC
                gstPaid += taxAmount;
            }
        });

        const netGST      = gstCollected - gstPaid;
        const netActivity = totalDebit - totalCredit;

        return {
            total:        transactions.length,
            categorized:  categorized.length,
            uncategorized: uncategorized.length,
            needsReview:  needsReview.length,
            totalDebit,
            totalCredit,
            netActivity,
            gstCollected,
            gstPaid,
            netGST,
            totalRevenue,
            totalExpense,
        };
    }, [transactions]);

    const categorizationProgress = stats.total > 0
        ? Math.round((stats.categorized / stats.total) * 100)
        : 0;

    const fmt = (n) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    /** Fire a filter event — every drillable row calls this */
    const drill = (label, filterFn) => onFilterTransactions?.({ label, filter: filterFn });

    return (
        <div className="h-full overflow-y-auto bg-gray-50">

            {/* ── ACCOUNT CARD + SWITCHER ──────────────────────────────────── */}
            <AccountCard
                accounts={accounts}
                selectedAccount={selectedAccount}
                onAccountChange={onAccountChange}
            />

            {/* ── OVERVIEW: 3-column count grid ───────────────────────────── */}
            <div className="p-3 bg-white border-b border-gray-200">
                <div className="bg-pink-50 border border-pink-200 rounded-md overflow-hidden">
                    <div className="grid grid-cols-3 divide-x divide-pink-200">

                        {/* Total — clears all filters */}
                        <div
                            className="p-3 text-center cursor-pointer hover:bg-pink-100 transition-colors"
                            onClick={() => onClearFilter?.()}
                        >
                            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                            <div className="text-xs text-gray-500 mt-1">Total</div>
                        </div>

                        {/* Categorized */}
                        <div
                            className="p-3 text-center cursor-pointer hover:bg-pink-100 transition-colors"
                            onClick={() => drill('Categorized',
                                t => !!(t.category && t.category !== 'UNCAT'))}
                        >
                            <div className="text-2xl font-bold text-blue-600">{stats.categorized}</div>
                            <div className="text-xs text-gray-500 mt-1">Categorized ({categorizationProgress}%)</div>
                        </div>

                        {/* Uncategorized */}
                        <div
                            className="p-3 text-center cursor-pointer hover:bg-pink-100 transition-colors"
                            onClick={() => drill('Uncategorized',
                                t => !t.category || t.category === 'UNCAT')}
                        >
                            <div className="text-2xl font-bold text-amber-600">{stats.uncategorized}</div>
                            <div className="text-xs text-gray-500 mt-1">Uncategorized</div>
                        </div>

                    </div>

                    {/* Needs Review — below the grid */}
                    {stats.needsReview > 0 && (
                        <div
                            className="border-t border-pink-200 px-3 py-2 flex justify-between items-center cursor-pointer hover:bg-pink-100 transition-colors"
                            onClick={() => drill('Needs Review',
                                t => t.confidence != null && t.confidence < 0.7)}
                        >
                            <span className="text-xs text-orange-700 font-medium">⚠ Needs Review</span>
                            <span className="text-xs font-bold text-orange-700">{stats.needsReview}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── GST SUMMARY ─────────────────────────────────────────────── */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">GST / HST Summary</h3>
                <div className="bg-green-50 border border-green-200 rounded-md p-3 space-y-1">

                    {/* GST Collected */}
                    <div
                        className={`${DRILL_ROW} hover:bg-green-100`}
                        onClick={() => drill('GST Collected (2160)',
                            tx => tx.gst_enabled && tx.tax_cents > 0 &&
                                  (tx.gst_type === 'collected' || tx.gst_account === '2160'))}
                    >
                        <span className="text-xs text-gray-600 group-hover:text-green-800">GST Collected</span>
                        <span className="text-sm font-bold font-mono text-green-700">{fmt(stats.gstCollected)}</span>
                    </div>

                    {/* GST ITC Paid */}
                    <div
                        className={`${DRILL_ROW} hover:bg-blue-50`}
                        onClick={() => drill('GST ITC / Paid (2150)',
                            tx => tx.gst_enabled && tx.tax_cents > 0 &&
                                  (tx.gst_type === 'itc' || tx.gst_account === '2150'))}
                    >
                        <span className="text-xs text-gray-600 group-hover:text-blue-800">GST ITC (Paid)</span>
                        <span className="text-sm font-bold font-mono text-blue-700">{fmt(stats.gstPaid)}</span>
                    </div>

                    {/* Total Revenue */}
                    <div
                        className={`${DRILL_ROW} hover:bg-green-100`}
                        onClick={() => drill('Revenue',
                            tx => {
                                const acct = window.RoboLedger?.COA?.get(tx.category);
                                return acct?.root === 'REVENUE';
                            })}
                    >
                        <span className="text-xs text-gray-600 group-hover:text-green-800">Total Revenue</span>
                        <span className="text-sm font-bold font-mono text-gray-700">{fmt(stats.totalRevenue)}</span>
                    </div>

                    {/* Total Expenses */}
                    <div
                        className={`${DRILL_ROW} hover:bg-amber-50`}
                        onClick={() => drill('Expenses',
                            tx => {
                                const acct = window.RoboLedger?.COA?.get(tx.category);
                                return acct?.root === 'EXPENSE' || acct?.class === 'COGS';
                            })}
                    >
                        <span className="text-xs text-gray-600 group-hover:text-amber-800">Total Expenses</span>
                        <span className="text-sm font-bold font-mono text-amber-700">{fmt(stats.totalExpense)}</span>
                    </div>

                    {/* Net GST Payable / Refund */}
                    <div
                        className={`pt-2 border-t border-green-300 ${DRILL_ROW} hover:bg-green-100`}
                        onClick={() => drill('All GST Transactions',
                            tx => tx.gst_enabled && tx.tax_cents > 0)}
                    >
                        <span className="text-xs font-semibold text-gray-700">
                            {stats.netGST < 0 ? 'GST Refund' : 'Net GST Payable'}
                        </span>
                        <span className={`text-sm font-bold font-mono ${stats.netGST < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fmt(Math.abs(stats.netGST))}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── RECONCILIATION ──────────────────────────────────────────── */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Reconciliation</h3>
                <div className="space-y-1">

                    {/* Total Debit (Money Out) */}
                    <div
                        className={`${DRILL_ROW} hover:bg-red-50`}
                        onClick={() => drill('Money Out (Debits)', t => t.polarity === 'DEBIT')}
                    >
                        <span className="text-xs text-gray-600 group-hover:text-red-800">Total Debit</span>
                        <span className="text-sm font-bold font-mono text-red-600">{fmt(stats.totalDebit)}</span>
                    </div>

                    {/* Total Credit (Money In) */}
                    <div
                        className={`${DRILL_ROW} hover:bg-green-50`}
                        onClick={() => drill('Money In (Credits)', t => t.polarity === 'CREDIT')}
                    >
                        <span className="text-xs text-gray-600 group-hover:text-green-800">Total Credit</span>
                        <span className="text-sm font-bold font-mono text-green-600">{fmt(stats.totalCredit)}</span>
                    </div>

                    {/* Net Activity */}
                    <div
                        className={`pt-2 border-t border-gray-200 ${DRILL_ROW} hover:bg-gray-100`}
                        onClick={() => {
                            // Net = debits - credits; if positive show debits, if negative show credits
                            if (stats.netActivity >= 0) {
                                drill('Net Activity (Debit-heavy)', t => t.polarity === 'DEBIT');
                            } else {
                                drill('Net Activity (Credit-heavy)', t => t.polarity === 'CREDIT');
                            }
                        }}
                    >
                        <span className="text-xs font-semibold text-gray-700">Net Activity</span>
                        <span className={`text-sm font-bold font-mono ${stats.netActivity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fmt(Math.abs(stats.netActivity))}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── CATEGORY DISTRIBUTION PIE CHART ────────────────────────── */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Category Distribution</h3>

                {/* Active Filter Breadcrumb — sits right above the pie */}
                {activeFilter ? (
                    <div className="flex items-center justify-between mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
                        <div className="flex items-center gap-1.5 text-xs text-amber-800 min-w-0">
                            <button
                                className="text-amber-600 hover:text-amber-900 font-medium shrink-0 underline underline-offset-2"
                                onClick={() => onClearFilter?.()}
                            >
                                All
                            </button>
                            <span className="text-amber-400">›</span>
                            <span className="font-semibold truncate">{activeFilter}</span>
                        </div>
                        <button
                            className="ml-2 shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-amber-200 hover:bg-amber-300 text-amber-700 transition-colors"
                            onClick={() => onClearFilter?.()}
                        >
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                        </button>
                    </div>
                ) : (
                    <p className="text-[10px] text-gray-400 mb-2">Click any slice or row to filter the grid</p>
                )}
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

            {/* ── TOP CATEGORIES ─────────────────────────────────────────── */}
            <div className="p-4 bg-white border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Top Categories</h3>
                <div className="space-y-1">
                    {getTopCategories(transactions).map((cat, idx) => (
                        <div
                            key={idx}
                            className={`${DRILL_ROW} hover:bg-indigo-50`}
                            onClick={() => drill(cat.name,
                                t => (t.category || 'Uncategorized') === cat.code)}
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                />
                                <span className="text-xs text-gray-700 truncate group-hover:text-indigo-900">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className="text-xs font-mono font-semibold text-gray-900">{fmt(cat.total)}</span>
                                <span className="text-[10px] text-gray-400">({cat.count})</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── METADATA ────────────────────────────────────────────────── */}
            <div className="p-4 bg-white">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Metadata</h3>
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Date Range</span>
                        <span className="text-gray-900 font-medium">
                            {transactions.length > 0 ? (
                                <>
                                    {new Date(Math.min(...transactions.map(t => new Date(t.date)))).toLocaleDateString('en-CA')}
                                    {' — '}
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

        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Category distribution for pie chart — by spend amount, not count */
function getCategoryDistribution(transactions) {
    const categoryTotals = {};

    transactions.forEach(tx => {
        const cat = tx.category || 'Uncategorized';
        if (!categoryTotals[cat]) categoryTotals[cat] = 0;
        categoryTotals[cat] += (tx.amount_cents || 0) / 100;
    });

    return Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([code, total]) => {
            const account = window.RoboLedger?.COA?.get(String(code));
            const label   = account?.name || (code === 'Uncategorized' ? 'Uncategorized' : code);
            return {
                label,
                value: Math.round(total),
                filterFn: (tx) => (tx.category || 'Uncategorized') === code,
            };
        });
}

/** Top 8 categories by spend total — each row is drillable */
function getTopCategories(transactions) {
    const catMap = {};

    transactions.forEach(tx => {
        const cat = tx.category || 'Uncategorized';
        if (!catMap[cat]) catMap[cat] = { count: 0, total: 0 };
        catMap[cat].count++;
        catMap[cat].total += (tx.amount_cents || 0) / 100;
    });

    return Object.entries(catMap)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8)
        .map(([code, data]) => {
            const account = window.RoboLedger?.COA?.get(String(code));
            return {
                code,
                name:  account?.name || (code === 'Uncategorized' ? 'Uncategorized' : code),
                count: data.count,
                total: data.total,
            };
        });
}

export default UtilityBar;
