import React, { useState, useMemo } from 'react';

// ─── Colour palette ────────────────────────────────────────────────────────────
const COLORS = [
    '#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6',
    '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#f43f5e',
];

// ─── Formatting helpers ────────────────────────────────────────────────────────
const fmt = (n) =>
    new Intl.NumberFormat('en-CA', {
        style: 'currency', currency: 'CAD',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n);

const fmt2 = (n) =>
    new Intl.NumberFormat('en-CA', {
        style: 'currency', currency: 'CAD',
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n);

// ─── COA name resolver ────────────────────────────────────────────────────────
function coaName(code) {
    if (!code || code === 'Uncategorized') return 'Uncategorized';
    const a = window.RoboLedger?.COA?.get(String(code)) ||
              window.RoboLedger?.COA?.get(parseInt(code));
    return a?.name || code;
}

// ─── SVG Pie Chart ────────────────────────────────────────────────────────────
function PieChart({ data, onSliceClick, size = 180 }) {
    const [hovered, setHovered] = useState(null);

    if (!data?.length) {
        return (
            <div className="flex items-center justify-center h-32 text-gray-400 text-xs">
                No category data
            </div>
        );
    }

    const total = data.reduce((s, d) => s + d.value, 0);
    let angle = -90;

    const slices = data.map((item, i) => {
        const pct  = item.value / total;
        const deg  = pct * 360;
        const s    = angle, e = angle + deg;
        angle      = e;
        const sr   = (s * Math.PI) / 180, er = (e * Math.PI) / 180;
        const r    = size / 2 - 12, cx = size / 2, cy = size / 2;
        const x1   = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
        const x2   = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
        return {
            d:          `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${deg > 180 ? 1 : 0} 1 ${x2},${y2} Z`,
            color:      COLORS[i % COLORS.length],
            label:      item.label,
            value:      item.value,
            amount:     item.amount || 0,
            pct:        (pct * 100).toFixed(1),
            filterFn:   item.filterFn,
        };
    });

    return (
        <div>
            <svg
                width={size} height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="mx-auto block"
            >
                {slices.map((s, i) => (
                    <path
                        key={i}
                        d={s.d}
                        fill={s.color}
                        stroke="white"
                        strokeWidth={hovered === i ? 3 : 1.5}
                        opacity={hovered === null || hovered === i ? 1 : 0.6}
                        style={{ cursor: 'pointer', transition: 'opacity 0.15s, stroke-width 0.15s' }}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => onSliceClick?.(s)}
                        title={`${s.label}: ${s.pct}%`}
                    />
                ))}
                {/* Centre label on hover */}
                {hovered !== null && (
                    <>
                        <text x={size/2} y={size/2 - 6} textAnchor="middle" fontSize="10" fill="#1e293b" fontWeight="600">
                            {slices[hovered]?.pct}%
                        </text>
                        <text x={size/2} y={size/2 + 8} textAnchor="middle" fontSize="8" fill="#64748b">
                            {fmt(slices[hovered]?.amount)}
                        </text>
                    </>
                )}
            </svg>

            {/* Legend — each row drillable */}
            <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto pr-1">
                {slices.map((s, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between text-[11px] px-1.5 py-1 rounded cursor-pointer transition-colors"
                        style={{
                            background: hovered === i ? `${s.color}15` : 'transparent',
                        }}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => onSliceClick?.(s)}
                        title={`Filter to ${s.label}`}
                    >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                            <span className="text-gray-700 truncate">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2 font-mono">
                            <span className="text-gray-400">{s.pct}%</span>
                            <span className="text-gray-800 font-semibold">{fmt(s.amount)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Drillable stat row ────────────────────────────────────────────────────────
function DrillRow({ label, value, color = '#1e293b', accent, onClick, subtitle }) {
    return (
        <div
            className="flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all"
            style={{ '--accent': accent || '#3b82f6' }}
            onMouseEnter={e => { if (onClick) e.currentTarget.style.background = `${accent || '#3b82f6'}12`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            onClick={onClick}
            title={onClick ? `Click to filter: ${label}` : undefined}
        >
            <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                {accent && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, display:'inline-block', flexShrink: 0 }} />}
                {label}
                {subtitle && <span className="text-[9px] text-gray-400 font-mono ml-1">{subtitle}</span>}
            </span>
            <span className="text-[12px] font-semibold font-mono" style={{ color }}>{value}</span>
        </div>
    );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ children, badge }) {
    return (
        <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{children}</span>
            {badge && <span className="text-[9px] font-mono text-gray-400">{badge}</span>}
        </div>
    );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
    return <div className="border-t border-gray-100 my-0.5" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function UtilityBar({ transactions = [], onFilterTransactions }) {
    const [activeDrill, setActiveDrill] = useState(null); // label of active filter

    // ── drill helper ──────────────────────────────────────────────────────────
    const drill = (label, filterFn) => {
        if (activeDrill === label) {
            // Toggle off
            setActiveDrill(null);
            onFilterTransactions?.(null);
        } else {
            setActiveDrill(label);
            onFilterTransactions?.({ type: label, label, filter: filterFn });
        }
    };

    // ── Stats ─────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total        = transactions.length;
        const categorized  = transactions.filter(t => t.category && !['9970','UNCAT'].includes(String(t.category))).length;
        const uncategorized = total - categorized;
        const needsReview  = transactions.filter(t => t.status === 'needs_review' || (t.confidence != null && t.confidence < 0.7)).length;

        let totalDebit = 0, totalCredit = 0, revenue = 0, expenses = 0;
        let gstCollected = 0, gstITC = 0;

        const dates = [];

        transactions.forEach(t => {
            const amt = Math.abs((t.amount_cents || 0) / 100);
            if (t.polarity === 'DEBIT')  totalDebit  += amt;
            if (t.polarity === 'CREDIT') totalCredit += amt;

            const root = (() => {
                const a = window.RoboLedger?.COA?.get(String(t.category));
                return a?.root || null;
            })();
            if (root === 'REVENUE') revenue  += amt;
            if (root === 'EXPENSE') expenses += amt;

            if (t.gst_enabled && t.tax_cents > 0) {
                const tax = Math.abs(t.tax_cents) / 100;
                if (t.gst_type === 'collected' || t.gst_account === '2160') gstCollected += tax;
                else gstITC += tax;
            }

            if (t.date) dates.push(new Date(t.date));
        });

        const minDate = dates.length ? new Date(Math.min(...dates)) : null;
        const maxDate = dates.length ? new Date(Math.max(...dates)) : null;

        return {
            total, categorized, uncategorized, needsReview,
            totalDebit, totalCredit, netPosition: totalCredit - totalDebit,
            revenue, expenses, netIncome: revenue - expenses,
            gstCollected, gstITC, gstNet: gstCollected - gstITC,
            hasGST: gstCollected + gstITC > 0,
            minDate, maxDate,
        };
    }, [transactions]);

    // ── Pie chart data (by amount, COA-named) ─────────────────────────────────
    const pieData = useMemo(() => {
        const buckets = {};
        transactions.forEach(t => {
            const code = String(t.category || 'Uncategorized');
            if (!buckets[code]) buckets[code] = { amount: 0, count: 0 };
            buckets[code].amount += Math.abs((t.amount_cents || 0) / 100);
            buckets[code].count++;
        });

        return Object.entries(buckets)
            .sort((a, b) => b[1].amount - a[1].amount)
            .slice(0, 10)
            .map(([code, { amount, count }]) => ({
                label:    coaName(code),
                value:    count,
                amount,
                filterFn: t => String(t.category || 'Uncategorized') === code,
            }));
    }, [transactions]);

    // ── Account breakdown ─────────────────────────────────────────────────────
    const accountBreakdown = useMemo(() => {
        const accs = window.RoboLedger?.Accounts?.getAll() || [];
        return accs.map(acc => {
            const txns  = transactions.filter(t => t.account_id === acc.id);
            const debit = txns.reduce((s, t) => t.polarity === 'DEBIT'  ? s + Math.abs((t.amount_cents||0)/100) : s, 0);
            const credit= txns.reduce((s, t) => t.polarity === 'CREDIT' ? s + Math.abs((t.amount_cents||0)/100) : s, 0);
            return { acc, txns, debit, credit, count: txns.length };
        }).filter(a => a.count > 0);
    }, [transactions]);

    const province = window.UI_STATE?.province || 'AB';
    const PROV_LABELS = {
        'ON':'13% HST','BC':'12%','AB':'5% GST','QC':'14.975%',
        'NS':'15% HST','NB':'15% HST','MB':'12%','SK':'11%',
        'PE':'15% HST','NL':'15% HST','YT':'5%','NT':'5%','NU':'5%',
    };

    const catProgress = stats.total > 0 ? Math.round((stats.categorized / stats.total) * 100) : 0;

    return (
        <div className="h-full overflow-y-auto text-[11px]" style={{ background: '#f8fafc' }}>

            {/* ── Active drill banner ── */}
            {activeDrill && (
                <div
                    className="sticky top-0 z-20 flex items-center justify-between px-3 py-2 text-[11px] font-semibold cursor-pointer"
                    style={{ background: '#3b82f6', color: '#fff' }}
                    onClick={() => { setActiveDrill(null); onFilterTransactions?.(null); }}
                    title="Click to clear filter"
                >
                    <span><i className="ph ph-funnel mr-1" />Filtered: {activeDrill}</span>
                    <span style={{ opacity: 0.8 }}>✕ Clear</span>
                </div>
            )}

            {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
            <div className="p-3 bg-white border-b border-gray-100">
                <SectionHeader badge={`${stats.total} txns`}>Overview</SectionHeader>

                <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {[
                        { label: 'Total',        val: stats.total,         color: '#1e293b', fn: null },
                        { label: 'Categorized',  val: stats.categorized,   color: '#3b82f6',
                          fn: t => t.category && !['9970','UNCAT'].includes(String(t.category)) },
                        { label: 'Uncategorized',val: stats.uncategorized, color: '#ef4444',
                          fn: t => !t.category || ['9970','UNCAT'].includes(String(t.category)) },
                    ].map(({ label, val, color, fn }) => (
                        <div
                            key={label}
                            className="rounded-lg p-2 text-center transition-all"
                            style={{
                                background: fn ? `${color}10` : '#f1f5f9',
                                border: `1px solid ${fn ? color + '30' : '#e2e8f0'}`,
                                cursor: fn ? 'pointer' : 'default',
                                outline: activeDrill === label ? `2px solid ${color}` : 'none',
                            }}
                            onClick={() => fn && drill(label, fn)}
                            title={fn ? `Filter to ${label}` : undefined}
                        >
                            <div className="font-bold text-base" style={{ color }}>{val}</div>
                            <div className="text-[9px] text-gray-500 mt-0.5">{label}</div>
                        </div>
                    ))}
                </div>

                {/* Needs review */}
                {stats.needsReview > 0 && (
                    <DrillRow
                        label="Needs Review"
                        value={stats.needsReview}
                        color="#f59e0b"
                        accent="#f59e0b"
                        onClick={() => drill('Needs Review', t => t.status === 'needs_review' || (t.confidence != null && t.confidence < 0.7))}
                    />
                )}

                {/* Categorization progress bar */}
                <div className="mt-2">
                    <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                        <span>Categorization</span><span>{catProgress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: '#e2e8f0' }}>
                        <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${catProgress}%`, background: catProgress === 100 ? '#10b981' : '#3b82f6' }}
                        />
                    </div>
                </div>

                {stats.minDate && (
                    <div className="mt-1.5 text-[9px] text-gray-400 text-center">
                        {stats.minDate.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}
                        {' – '}
                        {stats.maxDate.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}
                    </div>
                )}
            </div>

            {/* ══ CASH FLOW ═════════════════════════════════════════════════════ */}
            <div className="p-3 bg-white border-b border-gray-100">
                <SectionHeader>Cash Flow</SectionHeader>
                <DrillRow label="Money In"  value={fmt(stats.totalCredit)} color="#10b981" accent="#10b981"
                    onClick={() => drill('Money In',  t => t.polarity === 'CREDIT')} />
                <DrillRow label="Money Out" value={fmt(stats.totalDebit)}  color="#ef4444" accent="#ef4444"
                    onClick={() => drill('Money Out', t => t.polarity === 'DEBIT')} />
                <Divider />
                <DrillRow
                    label="Net Position"
                    value={fmt2(stats.netPosition)}
                    color={stats.netPosition >= 0 ? '#10b981' : '#ef4444'}
                    onClick={() => drill('All Transactions', () => true)}
                />
            </div>

            {/* ══ P&L ══════════════════════════════════════════════════════════ */}
            <div className="p-3 bg-white border-b border-gray-100">
                <SectionHeader>P&amp;L Summary</SectionHeader>
                <DrillRow label="Revenue"  value={fmt(stats.revenue)}  color="#059669" accent="#059669"
                    onClick={() => drill('Revenue', t => {
                        const r = window.RoboLedger?.COA?.get(String(t.category))?.root;
                        return r === 'REVENUE';
                    })} />
                <DrillRow label="Expenses" value={fmt(stats.expenses)} color="#d97706" accent="#d97706"
                    onClick={() => drill('Expenses', t => {
                        const r = window.RoboLedger?.COA?.get(String(t.category))?.root;
                        return r === 'EXPENSE';
                    })} />
                <Divider />
                <DrillRow
                    label="Net Income"
                    value={fmt2(stats.netIncome)}
                    color={stats.netIncome >= 0 ? '#10b981' : '#ef4444'}
                />
            </div>

            {/* ══ GST / ITC ════════════════════════════════════════════════════ */}
            {stats.hasGST && (
                <div className="p-3 bg-white border-b border-gray-100">
                    <SectionHeader badge={PROV_LABELS[province] || province}>GST / ITC</SectionHeader>
                    <DrillRow
                        label="Collected (2160)" value={fmt2(stats.gstCollected)} color="#059669" accent="#059669"
                        onClick={() => drill('GST Collected',
                            t => t.gst_enabled && t.tax_cents > 0 &&
                                (t.gst_type === 'collected' || t.gst_account === '2160')
                        )}
                    />
                    <DrillRow
                        label="ITC Paid (2150)" value={fmt2(stats.gstITC)} color="#3b82f6" accent="#3b82f6"
                        onClick={() => drill('ITC Paid',
                            t => t.gst_enabled && t.tax_cents > 0 &&
                                (t.gst_type === 'itc' || t.gst_account === '2150')
                        )}
                    />
                    <Divider />
                    <DrillRow
                        label={stats.gstNet <= 0 ? 'GST Refund' : 'Net Payable'}
                        value={fmt2(Math.abs(stats.gstNet))}
                        color={stats.gstNet <= 0 ? '#10b981' : '#ef4444'}
                        onClick={() => drill('All GST/HST', t => t.gst_enabled && t.tax_cents > 0)}
                    />
                </div>
            )}

            {/* ══ ACCOUNTS ════════════════════════════════════════════════════ */}
            {accountBreakdown.length > 0 && (
                <div className="p-3 bg-white border-b border-gray-100">
                    <SectionHeader badge={`${accountBreakdown.length} accts`}>Accounts</SectionHeader>
                    {accountBreakdown.map(({ acc, txns, debit, credit, count }, i) => {
                        const label  = acc.ref || acc.id;
                        const color  = COLORS[i % COLORS.length];
                        const isCC   = (acc.accountType || acc.type || '').toLowerCase().includes('credit');
                        return (
                            <div
                                key={acc.id}
                                className="rounded-md px-2 py-1.5 mb-1 cursor-pointer transition-all"
                                style={{
                                    background: activeDrill === `Account: ${label}` ? `${color}15` : '#f8fafc',
                                    border: `1px solid ${color}30`,
                                    outline: activeDrill === `Account: ${label}` ? `2px solid ${color}` : 'none',
                                }}
                                onClick={() => drill(`Account: ${label}`, t => t.account_id === acc.id)}
                                title={`${label} · ${count} transactions — click to filter`}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1.5">
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                        <span className="font-semibold text-gray-800">{label}</span>
                                        {isCC && <span className="text-[8px] px-1 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>CC</span>}
                                    </div>
                                    <span className="text-[9px] text-gray-400 font-mono">{count} txns</span>
                                </div>
                                <div className="flex justify-between mt-1 text-[10px] font-mono">
                                    <span style={{ color: isCC ? '#10b981' : '#ef4444' }}>↓ {fmt(debit)}</span>
                                    <span style={{ color: isCC ? '#ef4444' : '#10b981' }}>↑ {fmt(credit)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ══ CATEGORY PIE ════════════════════════════════════════════════ */}
            <div className="p-3 bg-white border-b border-gray-100">
                <SectionHeader>Category Distribution</SectionHeader>
                <p className="text-[9px] text-gray-400 mb-2">Click slice or row to filter</p>
                <PieChart
                    data={pieData}
                    size={180}
                    onSliceClick={(s) => drill(s.label, s.filterFn)}
                />
            </div>
        </div>
    );
}

export default UtilityBar;
