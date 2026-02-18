import React, { useState, useEffect, useMemo } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n ?? 0);
const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return new Date(+y, +m - 1, +d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const TAX_RATES = [
    { label: '5% GST',          value: 0.05 },
    { label: '13% HST (ON)',     value: 0.13 },
    { label: '15% HST (NS/NB/NL)', value: 0.15 },
    { label: '12% HST (BC)',     value: 0.12 },
];

// ─── Slim controls bar ────────────────────────────────────────────────────────
function ReportControls({ taxRate, setTaxRate, periodMode, setPeriodMode,
                           customStart, setCustomStart, customEnd, setCustomEnd,
                           detectedPeriod, onGenerate }) {

    const PERIODS = [
        { id: 'all',    label: 'All' },
        { id: 'ytd',    label: 'YTD' },
        { id: 'q1',     label: 'Q1' },
        { id: 'q2',     label: 'Q2' },
        { id: 'q3',     label: 'Q3' },
        { id: 'q4',     label: 'Q4' },
        { id: 'custom', label: 'Custom' },
    ];

    return (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 sticky top-0 z-10">

            {/* Tax rate dropdown */}
            <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Rate</span>
                <select
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value))}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                >
                    {TAX_RATES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                    <option value="custom">Custom…</option>
                </select>
            </div>

            <div className="w-px h-4 bg-gray-200" />

            {/* Period pills */}
            <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap mr-1">Period</span>
                {PERIODS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setPeriodMode(p.id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap
                            ${periodMode === p.id
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Custom date inputs — only show when custom selected */}
            {periodMode === 'custom' && (
                <>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                        <input
                            type="date"
                            value={customStart}
                            onChange={e => setCustomStart(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="text-gray-300 text-xs">→</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={e => setCustomEnd(e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                    </div>
                </>
            )}

            {/* Detected period badge */}
            {detectedPeriod && periodMode !== 'custom' && (
                <span className="text-[10px] text-gray-400 font-mono ml-1">
                    {fmtDate(detectedPeriod.start)} – {fmtDate(detectedPeriod.end)}
                </span>
            )}

            <div className="ml-auto flex items-center gap-2">
                <button
                    onClick={onGenerate}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors"
                >
                    <i className="ph ph-arrow-clockwise text-sm"></i>
                    Run
                </button>
            </div>
        </div>
    );
}

// ─── Transaction table ────────────────────────────────────────────────────────
function TxTable({ rows, gstColor, gstLabel, accentClass }) {
    const [showAll, setShowAll] = useState(false);
    const visible = showAll ? rows : rows.slice(0, 15);

    if (rows.length === 0) {
        return (
            <div className="py-8 text-center text-sm text-gray-400">
                No transactions in this period
            </div>
        );
    }

    const totalAmt = rows.reduce((s, r) => s + r.amount, 0);
    const totalGst = rows.reduce((s, r) => s + r.gst, 0);

    return (
        <div>
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 font-semibold text-gray-500 w-24">Date</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-500">Description</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-500 w-28">Account</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-500 w-28">Amount</th>
                        <th className={`text-right py-2 px-3 font-semibold w-24 ${gstColor}`}>{gstLabel}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {visible.map((tx, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="py-1.5 px-3 font-mono text-gray-500">{tx.date}</td>
                            <td className="py-1.5 px-3 text-gray-800 truncate max-w-xs">{tx.description}</td>
                            <td className="py-1.5 px-3 text-gray-500 truncate">{tx.accountName || tx.ref || '—'}</td>
                            <td className="py-1.5 px-3 text-right font-mono text-gray-700">{fmt(tx.amount)}</td>
                            <td className={`py-1.5 px-3 text-right font-mono font-semibold ${gstColor}`}>{fmt(tx.gst)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className={`border-t-2 ${accentClass}`}>
                        <td colSpan={3} className="py-2 px-3 text-xs font-bold text-gray-600">{rows.length} transactions</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-800">{fmt(totalAmt)}</td>
                        <td className={`py-2 px-3 text-right font-mono font-bold ${gstColor}`}>{fmt(totalGst)}</td>
                    </tr>
                </tfoot>
            </table>

            {rows.length > 15 && !showAll && (
                <button
                    onClick={() => setShowAll(true)}
                    className="w-full py-2 text-xs text-blue-600 hover:text-blue-700 font-semibold text-center border-t border-gray-100 hover:bg-blue-50 transition-colors"
                >
                    Show {rows.length - 15} more…
                </button>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GSTReport() {
    const [taxRate, setTaxRate]       = useState(0.13); // 13% HST default for ON
    const [periodMode, setPeriodMode] = useState('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd]   = useState('');
    const [reportData, setReportData] = useState(null);
    const [error, setError]           = useState(null);
    const [loading, setLoading]       = useState(false);
    const [activeTab, setActiveTab]   = useState('itc'); // 'itc' | 'collected' | 'both'

    // Auto-detect date range from ledger
    const detectedPeriod = useMemo(() => {
        const txns = window.RoboLedger?.Ledger?.getAll?.() || [];
        if (!txns.length) return null;
        const dates = txns.map(t => t.date).filter(Boolean).sort();
        return { start: dates[0], end: dates[dates.length - 1] };
    }, []);

    // Initialise custom dates when period detected
    useEffect(() => {
        if (detectedPeriod && !customStart) {
            setCustomStart(detectedPeriod.start);
            setCustomEnd(detectedPeriod.end);
        }
    }, [detectedPeriod]);

    // Compute active date range
    const activeRange = useMemo(() => {
        if (!detectedPeriod && periodMode !== 'custom') return null;
        const base = detectedPeriod || { start: customStart, end: customEnd };

        if (periodMode === 'custom') return { start: customStart, end: customEnd };
        if (periodMode === 'all')    return base;

        // YTD / quarters — derive from the latest date in the dataset
        const endYr = base.end ? parseInt(base.end.slice(0, 4)) : new Date().getFullYear();
        const ranges = {
            ytd: { start: `${endYr}-01-01`, end: base.end },
            q1:  { start: `${endYr}-01-01`, end: `${endYr}-03-31` },
            q2:  { start: `${endYr}-04-01`, end: `${endYr}-06-30` },
            q3:  { start: `${endYr}-07-01`, end: `${endYr}-09-30` },
            q4:  { start: `${endYr}-10-01`, end: `${endYr}-12-31` },
        };
        return ranges[periodMode] || base;
    }, [periodMode, customStart, customEnd, detectedPeriod]);

    const generate = () => {
        if (!activeRange?.start || !activeRange?.end) {
            setError('No date range available — please import statements first or choose Custom.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const ledger = window.RoboLedger?.Ledger;
            const coa    = window.RoboLedger?.COA;
            if (!ledger || !coa) throw new Error('Ledger not initialised');

            const gen  = new ReportGenerator(ledger, coa);
            const data = gen.generateGSTReport(activeRange.start, activeRange.end, taxRate);

            // Enrich with account names
            const enrich = (txArr) => txArr.map(tx => ({
                ...tx,
                accountName: coa.get(tx.category)?.name || tx.category || '',
            }));
            data.details.revenueTransactions  = enrich(data.details.revenueTransactions);
            data.details.expenseTransactions  = enrich(data.details.expenseTransactions);

            setReportData(data);
        } catch (e) {
            console.error('[GSTReport]', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-run when range or rate changes
    useEffect(() => {
        if (activeRange?.start && activeRange?.end) generate();
    }, [activeRange, taxRate]);

    const exportCSV = () => {
        if (!reportData) return;
        const lines = [
            ['GST/HST Report'],
            ['Period', `${activeRange.start} to ${activeRange.end}`],
            ['Rate', `${(taxRate * 100).toFixed(1)}%`],
            [],
            ['=== GST COLLECTED (2160) ==='],
            ['Date', 'Description', 'Account', 'Amount', 'GST Collected'],
            ...reportData.details.revenueTransactions.map(t =>
                [t.date, t.description, t.accountName, t.amount.toFixed(2), t.gst.toFixed(2)]),
            [],
            ['=== GST ITC / PAID (2150) ==='],
            ['Date', 'Description', 'Account', 'Amount', 'GST ITC'],
            ...reportData.details.expenseTransactions.map(t =>
                [t.date, t.description, t.accountName, t.amount.toFixed(2), t.gst.toFixed(2)]),
            [],
            ['=== SUMMARY ==='],
            ['GST Collected (2160)', reportData.gstCollected.toFixed(2)],
            ['GST ITC Paid (2150)',  reportData.gstPaid.toFixed(2)],
            ['Net GST Payable',      reportData.netGSTPayable.toFixed(2)],
        ].map(r => r.join(',')).join('\n');

        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([lines], { type: 'text/csv' }));
        a.download = `gst-report-${activeRange.start}-${activeRange.end}.csv`;
        a.click();
    };

    const net = reportData?.netGSTPayable ?? 0;
    const isRefund = net < 0;

    return (
        <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

            {/* ── Page header ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200">
                <button
                    onClick={() => window.__reportsGoBack?.()}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                    <i className="ph ph-arrow-left text-lg"></i>
                </button>
                <i className="ph ph-receipt text-lg text-emerald-600"></i>
                <div>
                    <h1 className="text-sm font-bold text-gray-800 leading-tight">GST / HST Ledger</h1>
                    <p className="text-[10px] text-gray-400 leading-tight">Collected · ITC · Net Payable</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {reportData && (
                        <>
                            <button
                                onClick={exportCSV}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                <i className="ph ph-download-simple text-sm"></i>
                                CSV
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                <i className="ph ph-printer text-sm"></i>
                                Print
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Controls bar ─────────────────────────────────────────────── */}
            <ReportControls
                taxRate={taxRate}        setTaxRate={setTaxRate}
                periodMode={periodMode}  setPeriodMode={setPeriodMode}
                customStart={customStart} setCustomStart={setCustomStart}
                customEnd={customEnd}     setCustomEnd={setCustomEnd}
                detectedPeriod={detectedPeriod || (customStart ? { start: customStart, end: customEnd } : null)}
                onGenerate={generate}
            />

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-start gap-2">
                        <i className="ph ph-warning text-lg mt-0.5 flex-shrink-0"></i>
                        <span>{error}</span>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                        <i className="ph ph-spinner-gap animate-spin text-xl"></i>
                        Calculating…
                    </div>
                )}

                {/* Empty state */}
                {!loading && !reportData && !error && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <i className="ph ph-receipt text-5xl text-gray-200 mb-4"></i>
                        <p className="text-gray-500 font-medium mb-1">No data yet</p>
                        <p className="text-xs text-gray-400">Import transactions, then click <strong>Run</strong></p>
                    </div>
                )}

                {/* Report content */}
                {!loading && reportData && (
                    <>
                        {/* ── 3 summary KPI cards ─────────────────────────── */}
                        <div className="grid grid-cols-3 gap-3">
                            {/* GST Collected */}
                            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GST Collected</span>
                                    <span className="text-[10px] font-mono text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">2160</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-600 font-mono">{fmt(reportData.gstCollected)}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{reportData.summary.revenueCount} revenue txns</p>
                            </div>

                            {/* GST ITC */}
                            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GST ITC Paid</span>
                                    <span className="text-[10px] font-mono text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">2150</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-600 font-mono">{fmt(reportData.gstPaid)}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{reportData.summary.expenseCount} expense txns</p>
                            </div>

                            {/* Net payable / refund */}
                            <div className={`rounded-xl border p-4 shadow-sm ${isRefund
                                ? 'bg-purple-50 border-purple-100'
                                : 'bg-red-50 border-red-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        {isRefund ? 'GST Refund' : 'Net Payable'}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {isRefund ? '← CRA owes you' : '→ Owing to CRA'}
                                    </span>
                                </div>
                                <p className={`text-2xl font-bold font-mono ${isRefund ? 'text-purple-600' : 'text-red-600'}`}>
                                    {fmt(Math.abs(net))}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Collected {fmt(reportData.gstCollected)} − ITC {fmt(reportData.gstPaid)}
                                </p>
                            </div>
                        </div>

                        {/* ── GST Ledger detail ────────────────────────────── */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                            {/* Tab bar */}
                            <div className="flex items-center border-b border-gray-100 px-4">
                                {[
                                    { id: 'itc',       label: 'GST ITC / Paid',    badge: reportData.summary.expenseCount,   color: 'text-blue-600',   active: 'border-blue-500' },
                                    { id: 'collected', label: 'GST Collected',      badge: reportData.summary.revenueCount,   color: 'text-emerald-600', active: 'border-emerald-500' },
                                    { id: 'both',      label: 'All GST Transactions', badge: reportData.summary.revenueCount + reportData.summary.expenseCount, color: 'text-gray-600', active: 'border-gray-500' },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap
                                            ${activeTab === tab.id
                                                ? `${tab.color} ${tab.active}`
                                                : 'text-gray-400 border-transparent hover:text-gray-600'
                                            }`}
                                    >
                                        {tab.label}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                                            ${activeTab === tab.id ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
                                            {tab.badge}
                                        </span>
                                    </button>
                                ))}

                                {/* Period + rate summary on right */}
                                <div className="ml-auto text-[10px] text-gray-300 font-mono pr-1">
                                    {activeRange.start} – {activeRange.end} · {(taxRate * 100).toFixed(0)}%
                                </div>
                            </div>

                            {/* Tab content */}
                            <div className="overflow-x-auto">
                                {(activeTab === 'itc' || activeTab === 'both') && (
                                    <div>
                                        {activeTab === 'both' && (
                                            <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-blue-500 uppercase tracking-wider bg-blue-50 border-b border-blue-100">
                                                GST ITC / Paid — account 2150
                                            </div>
                                        )}
                                        <TxTable
                                            rows={reportData.details.expenseTransactions}
                                            gstLabel="GST ITC"
                                            gstColor="text-blue-600"
                                            accentClass="border-blue-200"
                                        />
                                    </div>
                                )}

                                {(activeTab === 'collected' || activeTab === 'both') && (
                                    <div>
                                        {activeTab === 'both' && (
                                            <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 border-b border-emerald-100 border-t border-gray-100">
                                                GST Collected — account 2160
                                            </div>
                                        )}
                                        <TxTable
                                            rows={reportData.details.revenueTransactions}
                                            gstLabel="GST Collected"
                                            gstColor="text-emerald-600"
                                            accentClass="border-emerald-200"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── CRA Summary Box ──────────────────────────────── */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                                CRA Filing Summary · GST34
                            </h3>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                                    <span className="text-gray-600">Line 105 — GST/HST Collected</span>
                                    <span className="font-mono font-semibold text-emerald-600">{fmt(reportData.gstCollected)}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                                    <span className="text-gray-600">Line 106 — Input Tax Credits (ITC)</span>
                                    <span className="font-mono font-semibold text-blue-600">{fmt(reportData.gstPaid)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1.5">
                                    <span className="font-bold text-gray-800">
                                        Line 109 — {isRefund ? 'Refund Claimed' : 'Net Tax (Remittance)'}
                                    </span>
                                    <span className={`font-mono font-bold text-lg ${isRefund ? 'text-purple-600' : 'text-red-600'}`}>
                                        {fmt(Math.abs(net))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default GSTReport;
