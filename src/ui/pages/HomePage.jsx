import React, { useState, useEffect } from 'react';

const HomePage = () => {
    const [stats, setStats] = useState({
        txns: 0, accounts: 0, uncategorized: 0, categorized: 0,
        totalDebits: 0, totalCredits: 0,
        revenue: 0, expenses: 0,
        topExpenses: [], accountSummaries: [], recentTxns: [],
        monthlyData: [],
    });

    useEffect(() => {
        const compute = () => {
            const ledger = window.RoboLedger?.Ledger;
            const allTxns = ledger?.getAll?.() || [];
            const accounts = window.RoboLedger?.Accounts?.getActive?.() || window.RoboLedger?.Accounts?.getAll?.() || [];
            const coa = window.RoboLedger?.COA || {};

            const uncategorized = allTxns.filter(t => !t.category || String(t.category) === '9970' || t.category_name === 'UNCATEGORIZED').length;
            const categorized = allTxns.length - uncategorized;
            const totalDebits  = allTxns.reduce((s, t) => s + (parseFloat(t.debit)  || 0), 0);
            const totalCredits = allTxns.reduce((s, t) => s + (parseFloat(t.credit) || 0), 0);

            // Revenue & Expenses from COA codes
            let revenue = 0, expenses = 0;
            const expenseByCategory = {};
            allTxns.forEach(t => {
                const code = parseInt(t.category) || 0;
                const debit  = parseFloat(t.debit)  || 0;
                const credit = parseFloat(t.credit) || 0;
                if (code >= 4000 && code < 5000) revenue  += credit - debit;
                if (code >= 5000 && code < 9970) {
                    const amt = debit - credit;
                    expenses += amt;
                    const catName = t.category_name || coa[code]?.name || `Code ${code}`;
                    expenseByCategory[catName] = (expenseByCategory[catName] || 0) + amt;
                }
            });

            // Top 5 expense categories
            const topExpenses = Object.entries(expenseByCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, amount]) => ({ name, amount }));

            // Per-account summaries
            const accountSummaries = accounts.map(acc => {
                const accTxns = allTxns.filter(t => t.account_id === acc.id);
                const totalDebit  = accTxns.reduce((s, t) => s + (parseFloat(t.debit)  || 0), 0);
                const totalCredit = accTxns.reduce((s, t) => s + (parseFloat(t.credit) || 0), 0);
                const balance = totalCredit - totalDebit;
                // Find last import date
                const dates = accTxns.map(t => t.date).filter(Boolean).sort();
                const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
                return {
                    id: acc.id,
                    name: acc.name || acc.id,
                    bankName: acc.bankName || '',
                    txCount: accTxns.length,
                    balance,
                    lastDate,
                };
            });

            // Recent 8 transactions
            const recentTxns = [...allTxns]
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                .slice(0, 8);

            // Monthly inflow/outflow (last 6 months)
            const monthMap = {};
            allTxns.forEach(t => {
                if (!t.date) return;
                const monthKey = t.date.substring(0, 7); // "2024-01"
                if (!monthMap[monthKey]) monthMap[monthKey] = { inflow: 0, outflow: 0 };
                const debit  = parseFloat(t.debit)  || 0;
                const credit = parseFloat(t.credit) || 0;
                monthMap[monthKey].inflow  += credit;
                monthMap[monthKey].outflow += debit;
            });
            const monthlyData = Object.entries(monthMap)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .slice(-6)
                .map(([month, data]) => ({ month, ...data }));

            setStats({
                txns: allTxns.length, accounts: accounts.length, uncategorized, categorized,
                totalDebits, totalCredits, revenue, expenses,
                topExpenses, accountSummaries, recentTxns, monthlyData,
            });
        };
        compute();
        const id = setInterval(compute, 2000);
        return () => clearInterval(id);
    }, []);

    const goto = (route) => {
        const el = document.querySelector(`[data-route="${route}"]`);
        if (el) el.click();
    };

    const hasData = stats.txns > 0;
    const catPct  = stats.txns > 0 ? Math.round((stats.categorized / stats.txns) * 100) : 0;
    const fmt = (n) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
    const fmtFull = (n) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
    const netIncome = stats.revenue - stats.expenses;
    const clientName = window.UI_STATE?.activeClientName || 'Client';

    // Month label helper
    const monthLabel = (m) => {
        const [y, mo] = m.split('-');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
    };

    return (
        <div className="min-h-screen bg-[#f4f6f8]">

            {/* ── Compact Header ────────────────────────────────────────── */}
            <div className="bg-[#1e293b] text-white px-8 py-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                                <i className="ph ph-buildings text-white text-lg"></i>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">{clientName}</h1>
                                <p className="text-slate-400 text-[11px]">
                                    {stats.accounts} accounts · {stats.txns.toLocaleString()} transactions
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => goto('reports')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-[12px] rounded-lg transition-colors">
                            <i className="ph ph-chart-pie-slice text-sm"></i> Reports
                        </button>
                        <button onClick={() => goto('import')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold text-[12px] rounded-lg transition-colors">
                            <i className="ph ph-upload-simple text-sm"></i> Import
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">

                {/* ── Financial KPI Cards ────────────────────────────────── */}
                {hasData && (
                    <div className="grid grid-cols-5 gap-3">
                        <KpiCard icon="ph-trend-up" label="Revenue" value={fmt(stats.revenue)}
                            color="green" sub="4000-series" />
                        <KpiCard icon="ph-trend-down" label="Expenses" value={fmt(stats.expenses)}
                            color="red" sub="5000-9000 series" />
                        <KpiCard icon="ph-scales" label="Net Income"
                            value={fmt(netIncome)}
                            color={netIncome >= 0 ? 'blue' : 'red'}
                            sub={netIncome >= 0 ? 'Profit' : 'Loss'} />
                        <KpiCard icon="ph-receipt" label="Transactions" value={stats.txns.toLocaleString()}
                            color="indigo" sub={`${stats.accounts} accounts`} />
                        <KpiCard icon="ph-check-circle" label="Categorized" value={`${catPct}%`}
                            color={catPct >= 90 ? 'green' : catPct >= 60 ? 'amber' : 'red'}
                            sub={stats.uncategorized > 0 ? `${stats.uncategorized} remaining` : 'All done ✓'} />
                    </div>
                )}

                {/* ── Categorization Progress + Debit/Credit ─────────────── */}
                {hasData && (
                    <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <i className="ph ph-chart-bar text-slate-500 text-sm"></i>
                                <span className="text-[11px] font-semibold text-slate-700">Categorization Progress</span>
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
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                                style={{ width: `${catPct}%` }}></div>
                        </div>
                    </div>
                )}

                {/* ── Two Column Layout ──────────────────────────────────── */}
                {hasData && (
                    <div className="grid grid-cols-5 gap-5">

                        {/* Left Column: 3/5 */}
                        <div className="col-span-3 space-y-5">

                            {/* Monthly Cash Flow */}
                            {stats.monthlyData.length > 1 && (
                                <div className="bg-white border border-slate-200 rounded-xl p-5">
                                    <SectionLabel>Monthly Cash Flow</SectionLabel>
                                    <div className="flex items-end gap-2" style={{ height: 140 }}>
                                        {stats.monthlyData.map(m => {
                                            const maxVal = Math.max(...stats.monthlyData.map(d => Math.max(d.inflow, d.outflow)), 1);
                                            const inflowH = Math.round((m.inflow / maxVal) * 120);
                                            const outflowH = Math.round((m.outflow / maxVal) * 120);
                                            return (
                                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                                    <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: 120 }}>
                                                        <div className="bg-green-400 rounded-t-sm" style={{ width: '40%', height: Math.max(inflowH, 2) }}
                                                            title={`In: ${fmt(m.inflow)}`}></div>
                                                        <div className="bg-red-400 rounded-t-sm" style={{ width: '40%', height: Math.max(outflowH, 2) }}
                                                            title={`Out: ${fmt(m.outflow)}`}></div>
                                                    </div>
                                                    <span className="text-[9px] text-slate-400 font-medium">{monthLabel(m.month)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center gap-5 mt-3 pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-sm bg-green-400"></span>
                                            <span className="text-[10px] text-slate-500">Inflow (Credits)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-sm bg-red-400"></span>
                                            <span className="text-[10px] text-slate-500">Outflow (Debits)</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recent Transactions */}
                            <div className="bg-white border border-slate-200 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <SectionLabel>Recent Transactions</SectionLabel>
                                    <button onClick={() => goto('import')}
                                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                        View All <i className="ph ph-arrow-right text-[9px]"></i>
                                    </button>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {stats.recentTxns.map((tx, i) => {
                                        const debit  = parseFloat(tx.debit)  || 0;
                                        const credit = parseFloat(tx.credit) || 0;
                                        const isDebit = debit > 0;
                                        const amount = isDebit ? debit : credit;
                                        const isCategorized = tx.category && String(tx.category) !== '9970';
                                        return (
                                            <div key={tx.tx_id || i} className="flex items-center gap-3 py-2.5">
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCategorized ? 'bg-green-400' : 'bg-amber-400'}`}></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[12px] font-semibold text-slate-800 truncate">
                                                        {tx.payee || tx.description || 'No Description'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">{tx.date || '—'}</div>
                                                </div>
                                                <div className={`text-[12px] font-mono font-semibold tabular-nums ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                                                    {isDebit ? '-' : '+'}{fmtFull(amount)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {stats.recentTxns.length === 0 && (
                                        <div className="py-6 text-center text-[11px] text-slate-400">No transactions yet</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: 2/5 */}
                        <div className="col-span-2 space-y-5">

                            {/* Top Expense Categories */}
                            {stats.topExpenses.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-xl p-5">
                                    <SectionLabel>Top Expense Categories</SectionLabel>
                                    <div className="space-y-3">
                                        {stats.topExpenses.map((cat, i) => {
                                            const maxAmt = stats.topExpenses[0]?.amount || 1;
                                            const pct = Math.round((cat.amount / maxAmt) * 100);
                                            const colors = ['bg-blue-500','bg-indigo-500','bg-purple-500','bg-pink-500','bg-slate-400'];
                                            return (
                                                <div key={cat.name}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px] font-medium text-slate-700 truncate max-w-[60%]">{cat.name}</span>
                                                        <span className="text-[11px] font-mono font-semibold text-slate-600">{fmt(cat.amount)}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${colors[i] || colors[4]} rounded-full`} style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Account Summaries */}
                            {stats.accountSummaries.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-xl p-5">
                                    <SectionLabel>Account Balances</SectionLabel>
                                    <div className="space-y-2.5">
                                        {stats.accountSummaries.map(acc => (
                                            <div key={acc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                                    <i className="ph ph-bank text-indigo-600 text-sm"></i>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-semibold text-slate-800 truncate">{acc.name}</div>
                                                    <div className="text-[9px] text-slate-400">
                                                        {acc.txCount} txns{acc.lastDate ? ` · Last: ${acc.lastDate}` : ''}
                                                    </div>
                                                </div>
                                                <div className={`text-[12px] font-mono font-bold tabular-nums ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {fmtFull(Math.abs(acc.balance))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="bg-white border border-slate-200 rounded-xl p-5">
                                <SectionLabel>Quick Actions</SectionLabel>
                                <div className="grid grid-cols-2 gap-2">
                                    <ActionCard icon="ph-upload-simple" label="Import" color="blue" onClick={() => goto('import')} />
                                    <ActionCard icon="ph-rows" label="Transactions" color="indigo" onClick={() => goto('import')} />
                                    <ActionCard icon="ph-chart-pie-slice" label="Reports" color="green" onClick={() => goto('reports')} />
                                    <ActionCard icon="ph-gear-six" label="Settings" color="slate" onClick={() => goto('settings')} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Empty State (no data yet) ─────────────────────────── */}
                {!hasData && (
                    <div className="space-y-6">
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                                <i className="ph ph-upload-simple text-blue-500 text-3xl"></i>
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2">Import Your First Statement</h2>
                            <p className="text-[13px] text-slate-500 max-w-md mx-auto mb-5">
                                Drag in a CSV or PDF bank statement to get started. RoboLedger auto-detects 20+ Canadian bank formats.
                            </p>
                            <button onClick={() => goto('import')}
                                className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-semibold text-[13px] rounded-lg transition-colors inline-flex items-center gap-2">
                                <i className="ph ph-upload-simple text-base"></i> Import Statements
                            </button>
                        </div>

                        {/* Quick Actions for empty state */}
                        <div className="grid grid-cols-4 gap-3">
                            <ActionCard icon="ph-upload-simple" label="Import" color="blue" onClick={() => goto('import')} desc="CSV, PDF, OFX" />
                            <ActionCard icon="ph-chart-pie-slice" label="Reports" color="green" onClick={() => goto('reports')} desc="TB, P&L, BS" />
                            <ActionCard icon="ph-tree-structure" label="Chart of Accounts" color="indigo" onClick={() => goto('coa')} desc="GIFI-coded COA" />
                            <ActionCard icon="ph-gear-six" label="Settings" color="slate" onClick={() => goto('settings')} desc="Province, tax" />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{children}</p>
);

const KPI_COLORS = {
    green:  { bg: 'bg-green-50',  icon: 'text-green-500',  val: 'text-green-700'  },
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    val: 'text-red-600'    },
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   val: 'text-blue-700'   },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-500', val: 'text-indigo-700' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-500',  val: 'text-amber-700'  },
};

const KpiCard = ({ icon, label, value, color, sub }) => {
    const c = KPI_COLORS[color] || KPI_COLORS.blue;
    return (
        <div className={`${c.bg} border border-slate-200 rounded-xl px-4 py-3.5`}>
            <div className="flex items-center gap-1.5 mb-1">
                <i className={`${icon} ${c.icon} text-base`}></i>
                <span className="text-[10px] text-slate-500 font-medium uppercase">{label}</span>
            </div>
            <div className={`text-xl font-bold ${c.val} tabular-nums`}>{value}</div>
            {sub && <div className="text-[9px] text-slate-400 mt-0.5">{sub}</div>}
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
            className={`flex flex-col items-center text-center gap-1.5 px-3 py-3 rounded-xl border ${c.bg} ${c.border} ${c.hover} transition-all duration-150 group w-full`}>
            <div className={`w-8 h-8 rounded-lg bg-white shadow-sm border ${c.border} flex items-center justify-center`}>
                <i className={`${icon} ${c.icon} text-base`}></i>
            </div>
            <div className="text-[11px] font-semibold text-slate-700">{label}</div>
            {desc && <div className="text-[9px] text-slate-400">{desc}</div>}
        </button>
    );
};

export default HomePage;
