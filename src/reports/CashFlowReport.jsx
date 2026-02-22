import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import { ReportFilters } from './components/ReportFilters.jsx';
import ReportHeader from './components/ReportHeader.jsx';


/**
 * CashFlowReport - Statement of Cash Flows (Indirect Method)
 * Categorizes into Operating, Investing, and Financing activities
 */
export function CashFlowReport() {
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [loading, setLoading] = useState(false);

    const generateReport = (range) => {
        if (!range?.start || !range?.end) return;
        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );
            const data = generator.generateCashFlow(range.start, range.end);
            setReportData(data);
            setDateRange(range);
        } catch (error) {
            console.error('[CASH_FLOW] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (n) => new Intl.NumberFormat('en-CA', {
        style: 'currency', currency: 'CAD', minimumFractionDigits: 2
    }).format(n);

    const exportCSV = () => {
        if (!reportData) return;
        const rows = [
            ['Statement of Cash Flows'],
            ['Period', `${dateRange.start} to ${dateRange.end}`],
            [''],
            ['OPERATING ACTIVITIES'],
            ['Net Income', reportData.operating.netIncome.toFixed(2)],
            ['Adjustments:'],
            ...reportData.operating.adjustments.map(a => [`  ${a.name}`, a.amount.toFixed(2)]),
            ['Total Operating', reportData.operating.total.toFixed(2)],
            [''],
            ['INVESTING ACTIVITIES'],
            ...reportData.investing.items.map(a => [a.name, a.amount.toFixed(2)]),
            ['Total Investing', reportData.investing.total.toFixed(2)],
            [''],
            ['FINANCING ACTIVITIES'],
            ...reportData.financing.items.map(a => [a.name, a.amount.toFixed(2)]),
            ['Total Financing', reportData.financing.total.toFixed(2)],
            [''],
            ['NET CHANGE IN CASH', reportData.netChange.toFixed(2)],
            ['Opening Cash', reportData.openingCash.toFixed(2)],
            ['Closing Cash', reportData.closingCash.toFixed(2)],
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cash-flow-${dateRange.start}-to-${dateRange.end}.csv`;
        a.click();
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <button onClick={() => window.__reportsGoBack?.()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 13, fontWeight: 600 }}>
                    <i className="ph ph-arrow-left" style={{ marginRight: 4 }}></i> Back
                </button>
            </div>

            <ReportFilters onFilterChange={generateReport} />

            {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Generating...</div>}

            {reportData && !loading && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
                    <ReportHeader
                        reportTitle="Statement of Cash Flows"
                        subtitle={`For the period ${dateRange.start} to ${dateRange.end}`}
                    />

                    <div style={{ padding: '20px 24px' }}>
                        {/* OPERATING ACTIVITIES */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', padding: '8px 0', borderBottom: '2px solid #0f172a', marginBottom: 8 }}>
                                CASH FLOWS FROM OPERATING ACTIVITIES
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                                <span style={{ fontWeight: 600 }}>Net Income</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(reportData.operating.netIncome)}</span>
                            </div>
                            {reportData.operating.adjustments.length > 0 && (
                                <>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, padding: '8px 0 4px', textTransform: 'uppercase' }}>
                                        Adjustments to reconcile:
                                    </div>
                                    {reportData.operating.adjustments.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 16px', fontSize: 12, color: '#475569' }}>
                                            <span>{item.name}</span>
                                            <span style={{ fontFamily: 'monospace' }}>{fmt(item.amount)}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700 }}>
                                <span>Net Cash from Operating Activities</span>
                                <span style={{ fontFamily: 'monospace', color: reportData.operating.total >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {fmt(reportData.operating.total)}
                                </span>
                            </div>
                        </div>

                        {/* INVESTING ACTIVITIES */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', padding: '8px 0', borderBottom: '2px solid #0f172a', marginBottom: 8 }}>
                                CASH FLOWS FROM INVESTING ACTIVITIES
                            </div>
                            {reportData.investing.items.length === 0 && (
                                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>No investing activities</div>
                            )}
                            {reportData.investing.items.map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 16px', fontSize: 12, color: '#475569' }}>
                                    <span>{item.name}</span>
                                    <span style={{ fontFamily: 'monospace' }}>{fmt(item.amount)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700 }}>
                                <span>Net Cash from Investing Activities</span>
                                <span style={{ fontFamily: 'monospace', color: reportData.investing.total >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {fmt(reportData.investing.total)}
                                </span>
                            </div>
                        </div>

                        {/* FINANCING ACTIVITIES */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', padding: '8px 0', borderBottom: '2px solid #0f172a', marginBottom: 8 }}>
                                CASH FLOWS FROM FINANCING ACTIVITIES
                            </div>
                            {reportData.financing.items.length === 0 && (
                                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>No financing activities</div>
                            )}
                            {reportData.financing.items.map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 16px', fontSize: 12, color: '#475569' }}>
                                    <span>{item.name}</span>
                                    <span style={{ fontFamily: 'monospace' }}>{fmt(item.amount)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700 }}>
                                <span>Net Cash from Financing Activities</span>
                                <span style={{ fontFamily: 'monospace', color: reportData.financing.total >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {fmt(reportData.financing.total)}
                                </span>
                            </div>
                        </div>

                        {/* SUMMARY */}
                        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                <span>Net Change in Cash</span>
                                <span style={{ fontFamily: 'monospace', color: reportData.netChange >= 0 ? '#16a34a' : '#dc2626' }}>
                                    {fmt(reportData.netChange)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#64748b' }}>
                                <span>Cash, Beginning of Period</span>
                                <span style={{ fontFamily: 'monospace' }}>{fmt(reportData.openingCash)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid #0f172a', fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                                <span>Cash, End of Period</span>
                                <span style={{ fontFamily: 'monospace' }}>{fmt(reportData.closingCash)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Export Actions */}
                    <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={exportCSV}
                            style={{ padding: '8px 16px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <i className="ph ph-download-simple"></i> Export CSV
                        </button>
                        <button onClick={() => window.print()}
                            style={{ padding: '8px 16px', background: '#475569', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <i className="ph ph-printer"></i> Print
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
}
