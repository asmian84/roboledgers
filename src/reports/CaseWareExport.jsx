import React, { useState } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import { ReportFilters } from './components/ReportFilters.jsx';
import ReportHeader from './components/ReportHeader.jsx';
import ReportFooter from './components/ReportFooter.jsx';

/**
 * CaseWareExport - Full Working Paper Export for CaseWare
 * Generates GIFI-coded trial balance, general ledger, and journal entries
 * in CaseWare-compatible CSV format
 */
export function CaseWareExport() {
    const [dateRange, setDateRange] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exportLog, setExportLog] = useState([]);

    const LEADSHEET_NAMES = {
        'A': 'Cash & Bank', 'B': 'Investments', 'C': 'Receivables',
        'D': 'Inventories', 'E': 'Loans Receivable', 'L': 'Deposits & Prepaids',
        'M': 'LT Loans Receivable', 'N': 'LT Investments', 'U': 'Capital Assets',
        'W': 'Intangibles', 'PP': 'Future Income Taxes', 'AA': 'Demand Loans',
        'BB': 'AP & Accrued', 'CC': 'GST/HST', 'DD': 'SH Loans (ST)',
        'EE': 'Related Companies', 'FF': 'Income Taxes Payable', 'HH': 'Deferred Rev & LTD',
        'KK': 'Long-term Debt', 'MM': 'LT SH & Related', 'SS': 'Share Capital',
        'TT': 'Retained Earnings', '20': 'Revenue', '30': 'Cost of Sales',
        '40': 'G&A Expenses', '70': 'Other Income', '80': 'Income Taxes'
    };

    const generateReport = (range) => {
        if (!range?.start || !range?.end) return;
        setLoading(true);
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );
            const tb = generator.generateTrialBalance(range.start, range.end);
            const gj = generator.generateGeneralJournal(range.start, range.end);
            const is = generator.generateIncomeStatement(range.start, range.end);
            const bs = generator.generateBalanceSheet(range.end);

            // Group TB accounts by leadsheet
            const byLeadsheet = {};
            tb.accounts.forEach(acc => {
                const ls = acc.leadsheet || '??';
                if (!byLeadsheet[ls]) byLeadsheet[ls] = [];
                byLeadsheet[ls].push(acc);
            });

            setReportData({ tb, gj, is, bs, byLeadsheet });
            setDateRange(range);
        } catch (error) {
            console.error('[CASAWARE] Generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (n) => new Intl.NumberFormat('en-CA', {
        style: 'currency', currency: 'CAD', minimumFractionDigits: 2
    }).format(n);

    // Export Trial Balance in CaseWare format
    const exportTrialBalance = () => {
        if (!reportData) return;
        const rows = [
            ['CaseWare Trial Balance Export'],
            ['Client', window.UI_STATE?.activeClientName || 'Unknown'],
            ['Period', `${dateRange.start} to ${dateRange.end}`],
            ['Generated', new Date().toISOString()],
            [''],
            ['Leadsheet', 'Account Code', 'Account Name', 'Debit', 'Credit', 'Balance', 'Root Type'],
        ];

        reportData.tb.accounts.forEach(acc => {
            rows.push([
                acc.leadsheet || '',
                acc.code,
                `"${acc.name}"`,
                acc.debit > 0 ? acc.debit.toFixed(2) : '',
                acc.credit > 0 ? acc.credit.toFixed(2) : '',
                acc.balance.toFixed(2),
                acc.root || ''
            ]);
        });

        rows.push([]);
        rows.push(['', 'TOTALS', '', reportData.tb.totals.debit.toFixed(2), reportData.tb.totals.credit.toFixed(2), reportData.tb.totals.balance.toFixed(2)]);

        downloadCSV(rows, `CW_TrialBalance_${dateRange.start}_to_${dateRange.end}.csv`);
        addLog('Trial Balance CSV exported');
    };

    // Export General Ledger by Leadsheet
    const exportGeneralLedger = () => {
        if (!reportData) return;
        const rows = [
            ['CaseWare General Ledger Export'],
            ['Client', window.UI_STATE?.activeClientName || 'Unknown'],
            ['Period', `${dateRange.start} to ${dateRange.end}`],
            [''],
            ['Date', 'Ref', 'Account Code', 'Account Name', 'Leadsheet', 'Description', 'Debit', 'Credit', 'Source Account'],
        ];

        reportData.gj.transactions.forEach(tx => {
            const amt = (tx.amount_cents || 0) / 100;
            rows.push([
                tx.date || '',
                tx.ref || '',
                tx.account_code || '',
                `"${tx.account_name || ''}"`,
                '', // Leadsheet can be looked up from COA
                `"${(tx.description || tx.payee || '').replace(/"/g, '""')}"`,
                tx.polarity === 'DEBIT' ? amt.toFixed(2) : '',
                tx.polarity === 'CREDIT' ? amt.toFixed(2) : '',
                `"${tx.source_account || ''}"`,
            ]);
        });

        downloadCSV(rows, `CW_GeneralLedger_${dateRange.start}_to_${dateRange.end}.csv`);
        addLog('General Ledger CSV exported');
    };

    // Export Balance Sheet in CaseWare format
    const exportBalanceSheet = () => {
        if (!reportData) return;
        const rows = [
            ['CaseWare Balance Sheet Export'],
            ['Client', window.UI_STATE?.activeClientName || 'Unknown'],
            ['As of', dateRange.end],
            [''],
            ['Section', 'Account Code', 'Account Name', 'Amount'],
        ];

        ['ASSETS', 'LIABILITIES', 'EQUITY'].forEach(section => {
            const items = section === 'ASSETS' ? reportData.bs.assets :
                          section === 'LIABILITIES' ? reportData.bs.liabilities : reportData.bs.equity;
            rows.push([section]);
            items.forEach(item => {
                rows.push(['', item.code, `"${item.name}"`, item.amount.toFixed(2)]);
            });
            const total = section === 'ASSETS' ? reportData.bs.totals.assets :
                          section === 'LIABILITIES' ? reportData.bs.totals.liabilities : reportData.bs.totals.equity;
            rows.push(['', '', `Total ${section}`, total.toFixed(2)]);
            rows.push([]);
        });

        downloadCSV(rows, `CW_BalanceSheet_${dateRange.end}.csv`);
        addLog('Balance Sheet CSV exported');
    };

    // Export Full Working Paper Package
    const exportFullPackage = () => {
        exportTrialBalance();
        setTimeout(() => exportGeneralLedger(), 500);
        setTimeout(() => exportBalanceSheet(), 1000);
        addLog('Full working paper package exported (3 files)');
    };

    const downloadCSV = (rows, filename) => {
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    };

    const addLog = (msg) => {
        setExportLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
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

            {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Generating working papers...</div>}

            {reportData && !loading && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
                    <ReportHeader
                        reportTitle="CaseWare Working Paper Export"
                        subtitle={`Period: ${dateRange.start} to ${dateRange.end}`}
                    />

                    <div style={{ padding: '20px 24px' }}>
                        {/* Summary Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                            <div style={{ background: '#f0f9ff', borderRadius: 10, padding: 14, border: '1px solid #bae6fd' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase', marginBottom: 4 }}>Accounts</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{reportData.tb.accounts.length}</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>in trial balance</div>
                            </div>
                            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14, border: '1px solid #bbf7d0' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', marginBottom: 4 }}>Transactions</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{reportData.gj.count.toLocaleString()}</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>journal entries</div>
                            </div>
                            <div style={{ background: '#faf5ff', borderRadius: 10, padding: 14, border: '1px solid #e9d5ff' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 4 }}>Leadsheets</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{Object.keys(reportData.byLeadsheet).length}</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>CaseWare sections</div>
                            </div>
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>TB Balance</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: reportData.tb.isBalanced ? '#16a34a' : '#dc2626' }}>
                                    {reportData.tb.isBalanced ? 'Balanced' : fmt(reportData.tb.difference)}
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>
                                    DR {fmt(reportData.tb.totals.debit)} | CR {fmt(reportData.tb.totals.credit)}
                                </div>
                            </div>
                        </div>

                        {/* Export Buttons */}
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Export Files</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                            <button onClick={exportFullPackage}
                                style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                                    <i className="ph ph-package" style={{ marginRight: 4 }}></i> Full Package
                                </div>
                                <div style={{ fontSize: 10, opacity: 0.8 }}>TB + GL + BS (3 CSVs)</div>
                            </button>
                            <button onClick={exportTrialBalance}
                                style={{ padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                                    <i className="ph ph-scales" style={{ marginRight: 4 }}></i> Trial Balance
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>GIFI-coded TB</div>
                            </button>
                            <button onClick={exportGeneralLedger}
                                style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                                    <i className="ph ph-list-bullets" style={{ marginRight: 4 }}></i> General Ledger
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>Full GL export</div>
                            </button>
                            <button onClick={exportBalanceSheet}
                                style={{ padding: '12px 16px', background: '#faf5ff', border: '1px solid #e9d5ff', color: '#7c3aed', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                                    <i className="ph ph-stack" style={{ marginRight: 4 }}></i> Balance Sheet
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>Classified BS</div>
                            </button>
                        </div>

                        {/* Leadsheet Preview */}
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Leadsheet Summary</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                            {Object.entries(reportData.byLeadsheet)
                                .sort((a, b) => a[0].localeCompare(b[0]))
                                .map(([ls, accs]) => {
                                    const totalDebit = accs.reduce((s, a) => s + a.debit, 0);
                                    const totalCredit = accs.reduce((s, a) => s + a.credit, 0);
                                    return (
                                        <div key={ls} style={{ background: '#f8fafc', borderRadius: 8, padding: 10, border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{ls}</span>
                                                <span style={{ fontSize: 10, color: '#64748b' }}>{accs.length} accts</span>
                                            </div>
                                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>
                                                {LEADSHEET_NAMES[ls] || 'Other'}
                                            </div>
                                            <div style={{ fontSize: 10, fontFamily: 'monospace' }}>
                                                DR: {fmt(totalDebit)} | CR: {fmt(totalCredit)}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        {/* Export Log */}
                        {exportLog.length > 0 && (
                            <div style={{ background: '#f1f5f9', borderRadius: 8, padding: 12, marginTop: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Export Log</div>
                                {exportLog.map((log, i) => (
                                    <div key={i} style={{ fontSize: 11, color: '#475569', padding: '2px 0' }}>
                                        <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{log.time}</span>
                                        {' '}<i className="ph ph-check-circle" style={{ color: '#16a34a', fontSize: 10 }}></i>{' '}
                                        {log.msg}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <ReportFooter />
                </div>
            )}
        </div>
    );
}
