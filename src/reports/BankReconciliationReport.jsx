import React, { useState, useEffect } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';
import ReportHeader from './components/ReportHeader.jsx';
import ReportFooter from './components/ReportFooter.jsx';

/**
 * BankReconciliationReport - Compare bank statement balance to book balance
 * Shows outstanding deposits, cheques, and variance
 */
export function BankReconciliationReport() {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [asOfDate, setAsOfDate] = useState('');
    const [bankBalance, setBankBalance] = useState('');
    const [reportData, setReportData] = useState(null);

    useEffect(() => {
        const accs = window.RoboLedger?.Accounts?.getActive?.() || window.RoboLedger?.Accounts?.getAll?.() || [];
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccount(accs[0].id);

        // Default to today
        setAsOfDate(new Date().toISOString().split('T')[0]);
    }, []);

    const generateReport = () => {
        if (!selectedAccount || !asOfDate) return;
        try {
            const generator = new ReportGenerator(
                window.RoboLedger.Ledger,
                window.RoboLedger.COA
            );
            const data = generator.generateBankReconciliation(
                selectedAccount, asOfDate, parseFloat(bankBalance) || 0
            );
            setReportData(data);
        } catch (error) {
            console.error('[BANK_RECON] Generation failed:', error);
        }
    };

    const fmt = (n) => new Intl.NumberFormat('en-CA', {
        style: 'currency', currency: 'CAD', minimumFractionDigits: 2
    }).format(n);

    const exportCSV = () => {
        if (!reportData) return;
        const rows = [
            ['Bank Reconciliation'],
            ['Account', reportData.accountName],
            ['As of', reportData.asOfDate],
            [''],
            ['Bank Statement Balance', reportData.bankBalance.toFixed(2)],
            [''],
            ['Outstanding Deposits:'],
            ...reportData.outstandingDeposits.map(d => [d.date, d.description, d.amount.toFixed(2)]),
            ['Total Outstanding Deposits', reportData.totalOutstandingDeposits.toFixed(2)],
            [''],
            ['Outstanding Cheques/Payments:'],
            ...reportData.outstandingCheques.map(c => [c.date, c.description, c.amount.toFixed(2)]),
            ['Total Outstanding Cheques', reportData.totalOutstandingCheques.toFixed(2)],
            [''],
            ['Adjusted Bank Balance', reportData.adjustedBankBalance.toFixed(2)],
            ['Book Balance', reportData.bookBalance.toFixed(2)],
            ['Variance', reportData.variance.toFixed(2)],
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `bank-reconciliation-${selectedAccount}-${asOfDate}.csv`;
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

            {/* Input Form */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                    <i className="ph ph-bank" style={{ marginRight: 6 }}></i> Bank Reconciliation Setup
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Account</label>
                        <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name || acc.id}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>As of Date</label>
                        <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Bank Statement Balance ($)</label>
                        <input type="number" value={bankBalance} onChange={e => setBankBalance(e.target.value)}
                            placeholder="0.00" step="0.01"
                            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                </div>
                <button onClick={generateReport}
                    style={{ marginTop: 12, padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <i className="ph ph-scales" style={{ marginRight: 6 }}></i> Reconcile
                </button>
            </div>

            {reportData && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    <ReportHeader
                        reportTitle="Bank Reconciliation"
                        subtitle={`${reportData.accountName} — As of ${reportData.asOfDate}`}
                    />

                    <div style={{ padding: '20px 24px' }}>
                        {/* Status Badge */}
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px',
                                borderRadius: 20, fontSize: 13, fontWeight: 700,
                                background: reportData.isReconciled ? '#f0fdf4' : '#fef2f2',
                                color: reportData.isReconciled ? '#16a34a' : '#dc2626',
                                border: `1px solid ${reportData.isReconciled ? '#bbf7d0' : '#fecaca'}`
                            }}>
                                <i className={`ph ph-${reportData.isReconciled ? 'check-circle' : 'warning-circle'}`}></i>
                                {reportData.isReconciled ? 'Reconciled' : `Variance: ${fmt(reportData.variance)}`}
                            </span>
                        </div>

                        {/* Bank Balance Section */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', padding: '8px 0', borderBottom: '2px solid #0f172a', marginBottom: 8 }}>
                                BANK BALANCE
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                                <span>Balance per Bank Statement</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt(reportData.bankBalance)}</span>
                            </div>
                        </div>

                        {/* Outstanding Deposits */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', padding: '6px 0', textTransform: 'uppercase' }}>
                                Add: Outstanding Deposits ({reportData.outstandingDeposits.length})
                            </div>
                            {reportData.outstandingDeposits.slice(0, 15).map((d, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0 3px 16px', fontSize: 11, color: '#475569' }}>
                                    <span>{d.date} — {d.description.substring(0, 40)}</span>
                                    <span style={{ fontFamily: 'monospace' }}>{fmt(d.amount)}</span>
                                </div>
                            ))}
                            {reportData.outstandingDeposits.length > 15 && (
                                <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 16 }}>
                                    ...and {reportData.outstandingDeposits.length - 15} more
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600 }}>
                                <span>Total Outstanding Deposits</span>
                                <span style={{ fontFamily: 'monospace', color: '#16a34a' }}>{fmt(reportData.totalOutstandingDeposits)}</span>
                            </div>
                        </div>

                        {/* Outstanding Cheques */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', padding: '6px 0', textTransform: 'uppercase' }}>
                                Less: Outstanding Cheques ({reportData.outstandingCheques.length})
                            </div>
                            {reportData.outstandingCheques.slice(0, 15).map((c, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0 3px 16px', fontSize: 11, color: '#475569' }}>
                                    <span>{c.date} — {c.description.substring(0, 40)}</span>
                                    <span style={{ fontFamily: 'monospace' }}>({fmt(c.amount)})</span>
                                </div>
                            ))}
                            {reportData.outstandingCheques.length > 15 && (
                                <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 16 }}>
                                    ...and {reportData.outstandingCheques.length - 15} more
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600 }}>
                                <span>Total Outstanding Cheques</span>
                                <span style={{ fontFamily: 'monospace', color: '#dc2626' }}>({fmt(reportData.totalOutstandingCheques)})</span>
                            </div>
                        </div>

                        {/* Summary */}
                        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                                <span>Adjusted Bank Balance</span>
                                <span style={{ fontFamily: 'monospace' }}>{fmt(reportData.adjustedBankBalance)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                                <span>Book Balance</span>
                                <span style={{ fontFamily: 'monospace' }}>{fmt(reportData.bookBalance)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, fontWeight: 800, color: reportData.isReconciled ? '#16a34a' : '#dc2626' }}>
                                <span>Variance</span>
                                <span style={{ fontFamily: 'monospace' }}>{fmt(reportData.variance)}</span>
                            </div>
                        </div>
                    </div>

                    <ReportFooter />
                </div>
            )}
        </div>
    );
}
