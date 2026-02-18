import React from 'react';

// ── Quick-action cards ──────────────────────────────────────────────────────
const QUICK_ACTIONS = [
    {
        icon: 'ph-upload-simple',
        label: 'Import Statements',
        desc: 'CSV or PDF — 20+ bank formats',
        color: 'blue',
        route: 'import',
    },
    {
        icon: 'ph-rows',
        label: 'Transactions',
        desc: 'Categorize, review, export',
        color: 'indigo',
        route: 'import',   // same tab — transactions live there
    },
    {
        icon: 'ph-chart-pie-slice',
        label: 'Reports',
        desc: 'TB, P&L, GST, Balance Sheet',
        color: 'green',
        route: 'reports',
    },
    {
        icon: 'ph-gear-six',
        label: 'Settings',
        desc: 'COA, rules, preferences',
        color: 'slate',
        route: 'settings',
    },
];

const COLOR = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',   hover: 'hover:border-blue-400 hover:bg-blue-100' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', hover: 'hover:border-indigo-400 hover:bg-indigo-100' },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'text-green-600',  hover: 'hover:border-green-400 hover:bg-green-100' },
    slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  icon: 'text-slate-500',  hover: 'hover:border-slate-400 hover:bg-slate-100' },
};

// ── Capability pills ────────────────────────────────────────────────────────
const PILLS = [
    { icon: 'ph-brain',        label: '100k+ vendor mappings' },
    { icon: 'ph-lock-simple',  label: 'Client-side privacy' },
    { icon: 'ph-arrows-clockwise', label: 'Adaptive learning' },
    { icon: 'ph-scales',       label: 'Double-entry GAAP' },
    { icon: 'ph-percent',      label: 'GST/HST reconciliation' },
    { icon: 'ph-file-pdf',     label: 'PDF audit trail' },
];

const HomePage = () => {
    const handleRoute = (route) => {
        // Delegate to the vanilla-JS router in app.js
        const navItem = document.querySelector(`[data-route="${route}"]`);
        if (navItem) navItem.click();
    };

    // Pull live stats from RoboLedger global
    const ledger      = window.RoboLedger?.Ledger;
    const allTxns     = ledger?.getAll?.() || [];
    const accounts    = window.RoboLedger?.Accounts?.getActive?.() || window.RoboLedger?.Accounts?.getAll?.() || [];
    const uncatCount  = allTxns.filter(t => !t.category || String(t.category) === '9970').length;
    const totalCount  = allTxns.length;
    const accountCount = accounts.length;

    return (
        <div className="min-h-screen bg-[#f8f9fb] p-8">
            <div className="max-w-4xl mx-auto">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                            <i className="ph ph-robot text-white text-xl"></i>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            RoboLedger<span className="text-blue-600 font-light">.ai</span>
                        </h1>
                    </div>
                    <p className="text-[13px] text-slate-500 ml-12">
                        Intelligent accounting automation — all processing happens in your browser.
                    </p>
                </div>

                {/* ── Live Stats ──────────────────────────────────────────── */}
                {totalCount > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <StatTile
                            value={totalCount.toLocaleString()}
                            label="Transactions"
                            icon="ph-receipt"
                            color="text-blue-600"
                        />
                        <StatTile
                            value={accountCount}
                            label="Accounts"
                            icon="ph-bank"
                            color="text-indigo-600"
                        />
                        <StatTile
                            value={uncatCount > 0 ? uncatCount.toLocaleString() : '✓ All done'}
                            label={uncatCount > 0 ? 'Need review' : 'Categorized'}
                            icon={uncatCount > 0 ? 'ph-warning-circle' : 'ph-check-circle'}
                            color={uncatCount > 0 ? 'text-amber-500' : 'text-green-600'}
                        />
                    </div>
                )}

                {/* ── Quick Actions ────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                    {QUICK_ACTIONS.map(({ icon, label, desc, color, route }) => {
                        const c = COLOR[color];
                        return (
                            <button
                                key={route + label}
                                onClick={() => handleRoute(route)}
                                className={`flex items-center gap-4 text-left px-5 py-4 rounded-xl border ${c.bg} ${c.border} ${c.hover} transition-all duration-150 group`}
                            >
                                <div className={`shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm border ${c.border}`}>
                                    <i className={`${icon} ${c.icon} text-xl`}></i>
                                </div>
                                <div>
                                    <div className="text-[13px] font-semibold text-slate-800 group-hover:text-slate-900">{label}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">{desc}</div>
                                </div>
                                <i className="ph ph-caret-right text-slate-300 group-hover:text-slate-400 ml-auto text-[13px]"></i>
                            </button>
                        );
                    })}
                </div>

                {/* ── Workflow ─────────────────────────────────────────────── */}
                <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 mb-6">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Workflow</p>
                    <div className="flex items-center gap-0">
                        {[
                            { icon: 'ph-file-arrow-up', label: 'Import',   color: 'text-blue-500'   },
                            { icon: 'ph-brain',          label: 'ML Match', color: 'text-purple-500' },
                            { icon: 'ph-check-square',   label: 'Review',   color: 'text-amber-500'  },
                            { icon: 'ph-scales',         label: 'Validate', color: 'text-green-500'  },
                            { icon: 'ph-chart-line-up',  label: 'Report',   color: 'text-teal-500'   },
                        ].map((step, i, arr) => (
                            <React.Fragment key={step.label}>
                                <div className="flex flex-col items-center gap-1.5 flex-1">
                                    <div className={`w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center ${step.color} text-lg`}>
                                        <i className={step.icon}></i>
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-medium">{step.label}</span>
                                </div>
                                {i < arr.length - 1 && (
                                    <i className="ph ph-caret-right text-slate-300 text-[11px] shrink-0 mb-4"></i>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* ── Capability Pills ─────────────────────────────────────── */}
                <div className="flex flex-wrap gap-2">
                    {PILLS.map(({ icon, label }) => (
                        <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] text-slate-500 font-medium">
                            <i className={`${icon} text-slate-400 text-[12px]`}></i>
                            {label}
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};

const StatTile = ({ value, label, icon, color }) => (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3">
        <i className={`${icon} ${color} text-2xl`}></i>
        <div>
            <div className={`text-xl font-bold ${color} leading-none`}>{value}</div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">{label}</div>
        </div>
    </div>
);

export default HomePage;
