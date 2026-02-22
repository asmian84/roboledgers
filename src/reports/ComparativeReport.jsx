import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportHeader from './components/ReportHeader.jsx';
import { AccountDrillDown } from './components/AccountDrillDown.jsx';


/**
 * ComparativeReport - Current Year vs Prior Year Trial Balance Comparison
 * Shows side-by-side comparison with variance analysis
 */
export function ComparativeReport() {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandedAccount, setExpandedAccount] = useState(null);
    const [currentStart, setCurrentStart] = useState('');
    const [currentEnd, setCurrentEnd] = useState('');
    const [priorStart, setPriorStart] = useState('');
    const [priorEnd, setPriorEnd] = useState('');

    // Auto-populate dates on first load
    React.useEffect(() => {
        const txs = window.RoboLedger?.Ledger?.getAllTransactions?.() || [];
        if (txs.length === 0) return;

        const dates = txs.map(t => t.date).filter(Boolean).sort();
        const latest = new Date(dates[dates.length - 1]);
        const earliest = new Date(dates[0]);

        // Current year: Jan 1 - Dec 31 of latest year
        const year = latest.getFullYear();
        setCurrentStart(`${year}-01-01`);
        setCurrentEnd(`${year}-12-31`);
        setPriorStart(`${year - 1}-01-01`);
        setPriorEnd(`${year - 1}-12-31`);
    }, []);

    const generateReport = () => {
        if (!currentStart || !currentEnd || !priorStart || !priorEnd) return;
        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );
            const data = generator.generateComparativeTrialBalance(
                currentStart, currentEnd, priorStart, priorEnd
            );
            setReportData(data);
        } catch (error) {
            console.error('[COMPARATIVE] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (n) => new Intl.NumberFormat('en-CA', {
        style: 'currency', currency: 'CAD', minimumFractionDigits: 2
    }).format(n);

    const fmtPct = (n) => {
        if (!isFinite(n) || isNaN(n)) return '—';
        return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
    };

    const exportCSV = () => {
        if (!reportData) return;
        const rows = [
            ['Comparative Trial Balance'],
            ['Current Period', `${currentStart} to ${currentEnd}`],
            ['Prior Period', `${priorStart} to ${priorEnd}`],
            [''],
            ['Code', 'Account', 'Current Debit', 'Current Credit', 'Current Balance', 'Prior Debit', 'Prior Credit', 'Prior Balance', 'Variance $', 'Variance %'],
            ...reportData.accounts.map(a => [
                a.code, a.name,
                a.currentDebit.toFixed(2), a.currentCredit.toFixed(2), a.currentBalance.toFixed(2),
                a.priorDebit.toFixed(2), a.priorCredit.toFixed(2), a.priorBalance.toFixed(2),
                a.varianceAmount.toFixed(2), a.variancePct.toFixed(1) + '%'
            ])
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `comparative-tb-${currentStart}-to-${currentEnd}.csv`;
        a.click();
    };

    // Group accounts by root type for display
    const groupByRoot = (accounts) => {
        const groups = {};
        accounts.forEach(acc => {
            const root = acc.root || 'OTHER';
            if (!groups[root]) groups[root] = [];
            groups[root].push(acc);
        });
        return groups;
    };

    const rootOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'OTHER'];
    const rootLabels = { ASSET: 'Assets', LIABILITY: 'Liabilities', EQUITY: 'Equity', REVENUE: 'Revenue', EXPENSE: 'Expenses', OTHER: 'Other' };
    const rootColors = { ASSET: '#3b82f6', LIABILITY: '#dc2626', EQUITY: '#8b5cf6', REVENUE: '#16a34a', EXPENSE: '#d97706', OTHER: '#64748b' };

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <button onClick={() => window.__reportsGoBack?.()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 13, fontWeight: 600 }}>
                    <i className="ph ph-arrow-left" style={{ marginRight: 4 }}></i> Back
                </button>
            </div>

            {/* Date Selection */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                    <i className="ph ph-chart-line" style={{ marginRight: 6 }}></i> Comparative Period Setup
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>Current Start</label>
                        <input type="date" value={currentStart} onChange={e => setCurrentStart(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>Current End</label>
                        <input type="date" value={currentEnd} onChange={e => setCurrentEnd(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Prior Start</label>
                        <input type="date" value={priorStart} onChange={e => setPriorStart(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Prior End</label>
                        <input type="date" value={priorEnd} onChange={e => setPriorEnd(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
                    </div>
                    <button onClick={generateReport}
                        style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <i className="ph ph-chart-line" style={{ marginRight: 4 }}></i> Generate
                    </button>
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Generating...</div>}

            {reportData && !loading && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    <ReportHeader
                        reportTitle="Comparative Trial Balance"
                        subtitle={`Current: ${currentStart} to ${currentEnd} | Prior: ${priorStart} to ${priorEnd}`}
                    />

                    <div style={{ padding: '0 24px 20px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #0f172a' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 10, fontWeight: 700, color: '#0f172a', width: '5%' }}>Code</th>
                                    <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 10, fontWeight: 700, color: '#0f172a', width: '25%' }}>Account</th>
                                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10, fontWeight: 700, color: '#16a34a', width: '14%' }}>Current DR</th>
                                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10, fontWeight: 700, color: '#16a34a', width: '14%' }}>Current CR</th>
                                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10, fontWeight: 700, color: '#64748b', width: '14%' }}>Prior DR</th>
                                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10, fontWeight: 700, color: '#64748b', width: '14%' }}>Prior CR</th>
                                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10, fontWeight: 700, color: '#0f172a', width: '7%' }}>Var $</th>
                                    <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10, fontWeight: 700, color: '#0f172a', width: '7%' }}>Var %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const grouped = groupByRoot(reportData.accounts);
                                    const rows = [];
                                    rootOrder.forEach(root => {
                                        const accs = grouped[root];
                                        if (!accs || accs.length === 0) return;
                                        // Section header
                                        rows.push(
                                            <tr key={`h-${root}`} style={{ background: '#f8fafc' }}>
                                                <td colSpan={8} style={{ padding: '8px 4px', fontWeight: 700, fontSize: 11, color: rootColors[root], textTransform: 'uppercase' }}>
                                                    {rootLabels[root]}
                                                </td>
                                            </tr>
                                        );
                                        // Account rows
                                        accs.forEach(acc => {
                                            const hasVariance = Math.abs(acc.varianceAmount) > 0.01;
                                            const isLargeVariance = Math.abs(acc.variancePct) > 20;
                                            const isExpanded = expandedAccount === acc.code;
                                            rows.push(
                                                <React.Fragment key={`${acc.code}-wrap`}>
                                                <tr key={acc.code}
                                                    style={{
                                                        borderBottom: '1px solid #f1f5f9',
                                                        cursor: 'pointer',
                                                        background: isExpanded ? '#eef2ff' : 'transparent',
                                                        transition: 'background 0.1s'
                                                    }}
                                                    onClick={() => setExpandedAccount(isExpanded ? null : acc.code)}
                                                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                                                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                                                    title={`Click to view transactions for ${acc.code}`}
                                                >
                                                    <td style={{ padding: '5px 4px', color: '#64748b', fontFamily: 'monospace', fontSize: 10 }}>
                                                        <i className={`ph ${isExpanded ? 'ph-caret-down' : 'ph-caret-right'} text-[9px] mr-1 text-gray-400`}></i>
                                                        {acc.code}
                                                    </td>
                                                    <td style={{ padding: '5px 4px', color: '#0f172a' }}>{acc.name}</td>
                                                    <td style={{ padding: '5px 4px', textAlign: 'right', fontFamily: 'monospace', color: acc.currentDebit > 0 ? '#0f172a' : '#cbd5e1' }}>
                                                        {acc.currentDebit > 0 ? fmt(acc.currentDebit) : '—'}
                                                    </td>
                                                    <td style={{ padding: '5px 4px', textAlign: 'right', fontFamily: 'monospace', color: acc.currentCredit > 0 ? '#0f172a' : '#cbd5e1' }}>
                                                        {acc.currentCredit > 0 ? fmt(acc.currentCredit) : '—'}
                                                    </td>
                                                    <td style={{ padding: '5px 4px', textAlign: 'right', fontFamily: 'monospace', color: acc.priorDebit > 0 ? '#64748b' : '#cbd5e1' }}>
                                                        {acc.priorDebit > 0 ? fmt(acc.priorDebit) : '—'}
                                                    </td>
                                                    <td style={{ padding: '5px 4px', textAlign: 'right', fontFamily: 'monospace', color: acc.priorCredit > 0 ? '#64748b' : '#cbd5e1' }}>
                                                        {acc.priorCredit > 0 ? fmt(acc.priorCredit) : '—'}
                                                    </td>
                                                    <td style={{
                                                        padding: '5px 4px', textAlign: 'right', fontFamily: 'monospace',
                                                        fontWeight: hasVariance ? 600 : 400,
                                                        color: !hasVariance ? '#cbd5e1' : acc.varianceAmount > 0 ? '#dc2626' : '#16a34a'
                                                    }}>
                                                        {hasVariance ? fmt(acc.varianceAmount) : '—'}
                                                    </td>
                                                    <td style={{
                                                        padding: '5px 4px', textAlign: 'right', fontSize: 10,
                                                        fontWeight: isLargeVariance ? 700 : 400,
                                                        color: !hasVariance ? '#cbd5e1' : isLargeVariance ? '#dc2626' : '#64748b',
                                                        background: isLargeVariance ? '#fef2f210' : 'transparent'
                                                    }}>
                                                        {hasVariance ? fmtPct(acc.variancePct) : '—'}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <AccountDrillDown
                                                        coaCode={acc.code}
                                                        accountName={acc.name}
                                                        startDate={currentStart}
                                                        endDate={currentEnd}
                                                        onClose={() => setExpandedAccount(null)}
                                                        accentColor="indigo"
                                                    />
                                                )}
                                                </React.Fragment>
                                            );
                                        });
                                    });
                                    return rows;
                                })()}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2px solid #0f172a', fontWeight: 700 }}>
                                    <td colSpan={2} style={{ padding: '8px 4px' }}>TOTALS</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(reportData.currentTotals.debit)}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(reportData.currentTotals.credit)}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{fmt(reportData.priorTotals.debit)}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{fmt(reportData.priorTotals.credit)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                </div>
            )}
        </div>
    );
}
