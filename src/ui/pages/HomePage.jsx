import React, { useState, useEffect } from 'react';

const HomePage = () => {
    const [stats, setStats] = useState({ txns: 0, accounts: 0, uncategorized: 0, categorized: 0, totalDebits: 0, totalCredits: 0 });

    useEffect(() => {
        const compute = () => {
            const ledger = window.RoboLedger?.Ledger;
            const allTxns = ledger?.getAll?.() || [];
            const accounts = window.RoboLedger?.Accounts?.getActive?.() || window.RoboLedger?.Accounts?.getAll?.() || [];
            const uncategorized = allTxns.filter(t => !t.category || String(t.category) === '9970' || t.category_name === 'UNCATEGORIZED').length;
            const categorized = allTxns.length - uncategorized;
            const totalDebits  = allTxns.reduce((s, t) => s + (parseFloat(t.debit)  || 0), 0);
            const totalCredits = allTxns.reduce((s, t) => s + (parseFloat(t.credit) || 0), 0);
            setStats({ txns: allTxns.length, accounts: accounts.length, uncategorized, categorized, totalDebits, totalCredits });
        };
        compute();
        const id = setInterval(compute, 1200);
        return () => clearInterval(id);
    }, []);

    const goto = (route) => {
        const el = document.querySelector(`[data-route="${route}"]`);
        if (el) el.click();
    };

    const hasData = stats.txns > 0;
    const catPct  = stats.txns > 0 ? Math.round((stats.categorized / stats.txns) * 100) : 0;
    const fmt = (n) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

    return (
        <div className="min-h-screen bg-[#f4f6f8]">

            {/* ── Top Hero Banner ─────────────────────────────────────────── */}
            <div className="bg-[#1e293b] text-white px-8 py-7">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                                <i className="ph ph-robot text-white text-xl"></i>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight">
                                RoboLedger<span className="text-blue-400 font-light">.com</span>
                            </h1>
                        </div>
                        <p className="text-slate-400 text-[13px] ml-12 leading-relaxed max-w-xl">
                            Intelligent bookkeeping automation — ML-powered categorization, double-entry accounting, GST/HST reconciliation, and professional reporting. Everything runs client-side in your browser.
                        </p>
                    </div>
                    <button onClick={() => goto('import')}
                        className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold text-[13px] rounded-lg transition-colors">
                        <i className="ph ph-upload-simple text-base"></i>
                        Import Statements
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-8 py-7 space-y-6">

                {/* ── Live Stats (only when data exists) ──────────────────── */}
                {hasData && (
                    <div className="grid grid-cols-4 gap-4">
                        <StatCard icon="ph-receipt" color="blue"
                            value={stats.txns.toLocaleString()} label="Transactions" />
                        <StatCard icon="ph-bank" color="indigo"
                            value={stats.accounts} label="Accounts" />
                        <StatCard icon="ph-check-circle" color="green"
                            value={`${catPct}%`} label="Categorized"
                            sub={`${stats.categorized.toLocaleString()} of ${stats.txns.toLocaleString()}`} />
                        <StatCard icon="ph-warning-circle" color={stats.uncategorized > 0 ? 'amber' : 'green'}
                            value={stats.uncategorized > 0 ? stats.uncategorized.toLocaleString() : '✓'}
                            label={stats.uncategorized > 0 ? 'Need Review' : 'All Reviewed'} />
                    </div>
                )}

                {/* ── Categorization Progress Bar ──────────────────────────── */}
                {hasData && (
                    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <i className="ph ph-chart-bar text-slate-500 text-base"></i>
                                <span className="text-[12px] font-semibold text-slate-700">Categorization Progress</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[11px] text-slate-400">
                                    Debits: <strong className="text-red-500">{fmt(stats.totalDebits)}</strong>
                                </span>
                                <span className="text-[11px] text-slate-400">
                                    Credits: <strong className="text-green-600">{fmt(stats.totalCredits)}</strong>
                                </span>
                                {stats.uncategorized > 0 && (
                                    <button onClick={() => goto('import')}
                                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                        Review <i className="ph ph-arrow-right text-xs"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                                style={{ width: `${catPct}%` }}></div>
                        </div>
                        <div className="flex justify-between mt-1.5">
                            <span className="text-[10px] text-slate-400">{stats.categorized.toLocaleString()} categorized</span>
                            <span className="text-[10px] text-slate-400">{stats.uncategorized.toLocaleString()} remaining</span>
                        </div>
                    </div>
                )}

                {/* ── Quick Actions ────────────────────────────────────────── */}
                <div>
                    <SectionLabel>Quick Actions</SectionLabel>
                    <div className="grid grid-cols-4 gap-3">
                        <ActionCard icon="ph-upload-simple" label="Import" desc="CSV, PDF, OFX — 20+ bank formats" color="blue" onClick={() => goto('import')} />
                        <ActionCard icon="ph-rows" label="Transactions" desc="Categorize, search, bulk edit" color="indigo" onClick={() => goto('import')} />
                        <ActionCard icon="ph-chart-pie-slice" label="Reports" desc="TB, P&L, Balance Sheet, GST" color="green" onClick={() => goto('reports')} />
                        <ActionCard icon="ph-gear-six" label="Settings" desc="COA, themes, tax, columns" color="slate" onClick={() => goto('settings')} />
                    </div>
                </div>

                {/* ── Two columns: Workflow + Capabilities ─────────────────── */}
                <div className="grid grid-cols-2 gap-4">

                    {/* Workflow Steps */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                        <SectionLabel>How It Works</SectionLabel>
                        <div className="space-y-0">
                            {[
                                { n:'1', icon:'ph-file-arrow-up',   color:'bg-blue-100 text-blue-600',   title:'Import Bank Statements',    desc:'Drag in CSV or PDF — RoboLedger auto-detects 20+ Canadian bank formats including TD, RBC, BMO, CIBC, Scotia.' },
                                { n:'2', icon:'ph-brain',            color:'bg-purple-100 text-purple-600', title:'ML Categorization',          desc:'3-tier engine: exact rules → 100k+ vendor dictionary → fuzzy ML matching. Confidence-scored suggestions on every transaction.' },
                                { n:'3', icon:'ph-check-square',     color:'bg-amber-100 text-amber-600',   title:'Review & Correct',           desc:'Bulk categorize, rename, split transactions. Every correction trains the model — accuracy improves with each session.' },
                                { n:'4', icon:'ph-scales',           color:'bg-green-100 text-green-600',   title:'Double-Entry Validation',    desc:'Automatic debit/credit balancing with GAAP-compliant journal entries. GST/HST extracted per provincial rate.' },
                                { n:'5', icon:'ph-chart-line-up',    color:'bg-teal-100 text-teal-600',     title:'Generate Reports',           desc:'Trial Balance, Profit & Loss, Balance Sheet, and GST returns — exportable to CSV with prior-year comparatives.' },
                            ].map((step, i) => (
                                <div key={i} className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
                                    <div className={`shrink-0 w-8 h-8 rounded-lg ${step.color} flex items-center justify-center`}>
                                        <i className={`${step.icon} text-base`}></i>
                                    </div>
                                    <div>
                                        <div className="text-[12px] font-semibold text-slate-800 mb-0.5">{step.title}</div>
                                        <div className="text-[11px] text-slate-500 leading-relaxed">{step.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right column: Capabilities + Supported Banks */}
                    <div className="space-y-4">

                        {/* ML Engine */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5">
                            <SectionLabel>ML Engine</SectionLabel>
                            <div className="space-y-2.5">
                                {[
                                    { icon:'ph-brain',           color:'text-purple-500', label:'100k+ vendor mappings',         desc:'Pre-trained on Canadian transaction data' },
                                    { icon:'ph-arrows-clockwise',color:'text-blue-500',   label:'Adaptive learning',             desc:'Corrections boost confidence logarithmically' },
                                    { icon:'ph-lightbulb',       color:'text-amber-500',  label:'Explainable suggestions',       desc:'See confidence score + match reason per row' },
                                    { icon:'ph-tree-structure',  color:'text-green-500',  label:'3-tier matching pipeline',      desc:'Rules → Dictionary → Fuzzy ML fallback' },
                                    { icon:'ph-lock-simple',     color:'text-slate-500',  label:'100% client-side privacy',      desc:'Zero uploads — all data stays in your browser' },
                                ].map(({ icon, color, label, desc }) => (
                                    <div key={label} className="flex items-start gap-3">
                                        <i className={`${icon} ${color} text-base shrink-0 mt-0.5`}></i>
                                        <div>
                                            <div className="text-[12px] font-semibold text-slate-700">{label}</div>
                                            <div className="text-[11px] text-slate-400">{desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Supported Banks */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5">
                            <SectionLabel>Supported Banks & Formats</SectionLabel>
                            <div className="flex flex-wrap gap-1.5">
                                {['TD Bank','RBC','BMO','CIBC','Scotiabank','Tangerine','EQ Bank','Simplii','ATB','Coast Capital','Desjardins','HSBC Canada','National Bank','Laurentian','QuickBooks CSV','Caseware TB','OFX / QFX','MT940','Generic CSV'].map(b => (
                                    <span key={b} className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-medium rounded-md">{b}</span>
                                ))}
                            </div>
                        </div>

                        {/* GST / Tax */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5">
                            <SectionLabel>Tax & Compliance</SectionLabel>
                            <div className="space-y-2">
                                {[
                                    { icon:'ph-percent',      color:'text-green-600',  label:'GST / HST / QST / PST auto-extraction' },
                                    { icon:'ph-map-pin',      color:'text-blue-500',   label:'All 13 Canadian provinces & territories' },
                                    { icon:'ph-receipt',      color:'text-amber-500',  label:'Input tax credit (ITC) identification' },
                                    { icon:'ph-file-text',    color:'text-purple-500', label:'SR&ED expense flagging & documentation' },
                                    { icon:'ph-scales',       color:'text-teal-500',   label:'CRA-ready chart of accounts (GIFI codes)' },
                                ].map(({ icon, color, label }) => (
                                    <div key={label} className="flex items-center gap-2.5">
                                        <i className={`${icon} ${color} text-sm shrink-0`}></i>
                                        <span className="text-[11px] text-slate-600">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── Reports Overview ─────────────────────────────────────── */}
                <div>
                    <SectionLabel>Available Reports</SectionLabel>
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { icon:'ph-table',          color:'bg-blue-50 border-blue-200 text-blue-600',    title:'Trial Balance',       desc:'Debit/Credit/Balance by COA code with prior-year comparative column' },
                            { icon:'ph-trend-up',        color:'bg-green-50 border-green-200 text-green-600', title:'Profit & Loss',       desc:'Revenue vs Expenses by period with net income and drill-down' },
                            { icon:'ph-scales',          color:'bg-purple-50 border-purple-200 text-purple-600', title:'Balance Sheet',    desc:'Assets, Liabilities & Equity snapshot with GAAP grouping' },
                            { icon:'ph-percent',         color:'bg-amber-50 border-amber-200 text-amber-600',  title:'GST / HST Return',   desc:'Collected vs Input Tax Credits with line-by-line audit trail' },
                        ].map(({ icon, color, title, desc }) => (
                            <button key={title} onClick={() => goto('reports')}
                                className={`text-left p-4 rounded-xl border ${color.split(' ').slice(0,2).join(' ')} bg-white hover:shadow-sm transition-all group`}>
                                <div className={`w-9 h-9 rounded-lg ${color.split(' ').slice(0,2).join(' ')} flex items-center justify-center mb-3`}>
                                    <i className={`${icon} ${color.split(' ')[3]} text-lg`}></i>
                                </div>
                                <div className="text-[12px] font-semibold text-slate-800 mb-1">{title}</div>
                                <div className="text-[11px] text-slate-500 leading-relaxed">{desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Footer Stats ─────────────────────────────────────────── */}
                <div className="grid grid-cols-4 gap-3 pb-4">
                    {[
                        { value:'100k+',  label:'Vendor Mappings',   icon:'ph-brain',          color:'text-purple-500' },
                        { value:'33MB',   label:'Training Dataset',  icon:'ph-database',        color:'text-blue-500' },
                        { value:'20+',    label:'Bank Parsers',      icon:'ph-bank',            color:'text-green-500' },
                        { value:'3-Tier', label:'ML Architecture',   icon:'ph-tree-structure',  color:'text-amber-500' },
                    ].map(({ value, label, icon, color }) => (
                        <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                            <i className={`${icon} ${color} text-2xl`}></i>
                            <div>
                                <div className={`text-lg font-bold ${color}`}>{value}</div>
                                <div className="text-[10px] text-slate-400 font-medium">{label}</div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{children}</p>
);

const STAT_COLORS = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   val: 'text-blue-700'   },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-500', val: 'text-indigo-700' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  val: 'text-green-700'  },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-500',  val: 'text-amber-700'  },
};

const StatCard = ({ icon, color, value, label, sub }) => {
    const c = STAT_COLORS[color] || STAT_COLORS.blue;
    return (
        <div className={`${c.bg} border border-slate-200 rounded-xl px-5 py-4`}>
            <div className="flex items-center gap-2 mb-1">
                <i className={`${icon} ${c.icon} text-xl`}></i>
                <span className="text-[11px] text-slate-500 font-medium">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${c.val}`}>{value}</div>
            {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
        </div>
    );
};

const ACTION_COLORS = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',   hover: 'hover:border-blue-400 hover:bg-blue-100/60' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', hover: 'hover:border-indigo-400 hover:bg-indigo-100/60' },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'text-green-600',  hover: 'hover:border-green-400 hover:bg-green-100/60' },
    slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  icon: 'text-slate-500',  hover: 'hover:border-slate-400 hover:bg-slate-100/60' },
};

const ActionCard = ({ icon, label, desc, color, onClick }) => {
    const c = ACTION_COLORS[color] || ACTION_COLORS.slate;
    return (
        <button onClick={onClick}
            className={`flex flex-col items-start text-left gap-2 px-4 py-4 rounded-xl border ${c.bg} ${c.border} ${c.hover} transition-all duration-150 group w-full`}>
            <div className={`w-9 h-9 rounded-lg bg-white shadow-sm border ${c.border} flex items-center justify-center`}>
                <i className={`${icon} ${c.icon} text-lg`}></i>
            </div>
            <div>
                <div className="text-[12px] font-semibold text-slate-800">{label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</div>
            </div>
        </button>
    );
};

export default HomePage;
