import React, { useState, useEffect, useMemo } from 'react';

/**
 * BankReconciliationReport — QuickBooks-style interactive reconciliation
 *
 * 3 phases:
 *   'setup'    — account / date / statement balance form
 *   'clearing' — two-panel: transaction checkboxes (left) + live summary (right)
 *   'history'  — past completed reconciliations table
 */

const STORAGE_KEY = 'roboledger_reconciliation_history';

function ssGet(key) {
    try {
        const _SS = window.StorageService;
        if (_SS) return _SS.get(key);
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function ssSet(key, val) {
    try {
        const _SS = window.StorageService;
        if (_SS) { _SS.set(key, val); return; }
        localStorage.setItem(key, JSON.stringify(val));
    } catch {}
}
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

const fmt = (n) => new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 2
}).format(n ?? 0);

const fmtDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m,10)-1]} ${parseInt(day,10)}, ${y}`;
};

// ─── compute live summary ──────────────────────────────────────────────────
function computeSummary(transactions, checkedIds, statementBalance, account) {
    const openingBal = account?.openingBalance ?? 0;

    let bookBalance = openingBal;
    transactions.forEach(tx => {
        const amt = Math.abs((tx.amount_cents || 0) / 100);
        bookBalance += tx.polarity === 'CREDIT' ? amt : -amt;
    });

    const clearedDeposits = transactions
        .filter(tx => tx.polarity === 'CREDIT' && checkedIds[tx.tx_id])
        .reduce((s, tx) => s + Math.abs((tx.amount_cents || 0) / 100), 0);

    const clearedPayments = transactions
        .filter(tx => tx.polarity === 'DEBIT' && checkedIds[tx.tx_id])
        .reduce((s, tx) => s + Math.abs((tx.amount_cents || 0) / 100), 0);

    const clearedDepositCount = transactions.filter(tx => tx.polarity === 'CREDIT' && checkedIds[tx.tx_id]).length;
    const clearedPaymentCount = transactions.filter(tx => tx.polarity === 'DEBIT' && checkedIds[tx.tx_id]).length;

    const adjustedBalance = statementBalance + clearedDeposits - clearedPayments;
    const variance = bookBalance - adjustedBalance;
    const isReconciled = Math.abs(variance) < 0.01;

    return { bookBalance, clearedDeposits, clearedPayments, clearedDepositCount, clearedPaymentCount, adjustedBalance, variance, isReconciled };
}

// ─── Setup Screen ─────────────────────────────────────────────────────────
function SetupScreen({ accounts, onStart, onHistory }) {
    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
    const [statementBalance, setStatementBalance] = useState('');

    const history = ssGet(STORAGE_KEY) || [];
    const lastForAccount = history
        .filter(h => h.accountId === accountId)
        .sort((a, b) => b.completedAt > a.completedAt ? 1 : -1)[0];

    return (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => window.__reportsGoBack?.()}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="ph ph-arrow-left"></i> Back
                    </button>
                    <div style={{ width: 1, height: 16, background: '#e2e8f0' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="ph ph-bank" style={{ fontSize: 16, color: '#94a3b8' }}></i>
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>Bank Reconciliation</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Match your bank statement to your books</div>
                        </div>
                    </div>
                </div>
                {history.length > 0 && (
                    <button onClick={onHistory}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                        <i className="ph ph-clock-counter-clockwise"></i> History
                    </button>
                )}
            </div>

            {/* Setup Card */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Reconciliation Setup</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Enter your bank statement details to begin</div>
                </div>
                <div style={{ padding: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</label>
                            <select value={accountId} onChange={e => setAccountId(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#0f172a', background: 'white' }}>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name || acc.id}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statement Ending Date</label>
                            <input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Statement Ending Balance</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>$</span>
                            <input type="number" value={statementBalance} onChange={e => setStatementBalance(e.target.value)}
                                placeholder="0.00" step="0.01"
                                style={{ width: '100%', padding: '9px 12px 9px 24px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Enter the ending balance shown on your bank statement</div>
                    </div>

                    {lastForAccount && (
                        <div style={{ padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#0369a1' }}>
                            <i className="ph ph-info" style={{ marginRight: 6 }}></i>
                            Last reconciled: <strong>{fmtDate(lastForAccount.statementDate)}</strong> — Statement balance {fmt(lastForAccount.statementBalance)}
                        </div>
                    )}

                    <button
                        onClick={() => onStart({ accountId, statementDate, statementBalance: parseFloat(statementBalance) || 0 })}
                        disabled={!accountId || !statementDate || statementBalance === ''}
                        style={{ width: '100%', padding: '11px', background: accountId && statementDate && statementBalance !== '' ? '#1e293b' : '#94a3b8', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: accountId && statementDate && statementBalance !== '' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <i className="ph ph-check-square"></i> Start Reconciling
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Transaction Row ──────────────────────────────────────────────────────
function TxRow({ tx, checked, onToggle, dimmed }) {
    const amt = Math.abs((tx.amount_cents || 0) / 100);
    const desc = tx.payee || tx.description || tx.raw_description || '—';

    const handleViewInLedger = (e) => {
        e.stopPropagation(); // don't toggle the checkbox
        // Select the transaction (opens inspector panel) then navigate to the ledger
        if (window.selectTransaction) window.selectTransaction(tx.tx_id);
        if (window.navigateTo) window.navigateTo('import');
    };

    return (
        <div onClick={() => !dimmed && onToggle(tx.tx_id)}
            style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                borderBottom: '1px solid #f1f5f9', cursor: dimmed ? 'default' : 'pointer',
                background: checked ? (tx.polarity === 'CREDIT' ? '#f0fdf4' : '#fef2f2') : 'white',
                opacity: dimmed ? 0.45 : 1,
                transition: 'background 0.1s',
            }}>
            {/* Checkbox */}
            <div style={{
                width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? (tx.polarity === 'CREDIT' ? '#16a34a' : '#dc2626') : '#cbd5e1'}`,
                background: checked ? (tx.polarity === 'CREDIT' ? '#16a34a' : '#dc2626') : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.1s'
            }}>
                {checked && <i className="ph ph-check" style={{ fontSize: 11, color: 'white', fontWeight: 700 }}></i>}
            </div>
            {/* Date */}
            <div style={{ fontSize: 11, color: '#94a3b8', width: 68, flexShrink: 0 }}>{fmtDate(tx.date)}</div>
            {/* Description */}
            <div style={{ flex: 1, fontSize: 12, color: '#0f172a', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>
            {/* Category badge */}
            {tx.category_name && (
                <div style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>{tx.category_name}</div>
            )}
            {/* Amount */}
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: tx.polarity === 'CREDIT' ? '#16a34a' : '#dc2626', flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
                {tx.polarity === 'CREDIT' ? '+' : '-'}{fmt(amt)}
            </div>
            {/* Audit highlight button — jump to this tx in the ledger */}
            <button
                onClick={handleViewInLedger}
                title="View in Ledger"
                style={{
                    flexShrink: 0, width: 24, height: 24, borderRadius: 5,
                    border: '1px solid #e2e8f0', background: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#94a3b8', padding: 0,
                    transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'white'; }}
            >
                <i className="ph ph-arrow-square-out" style={{ fontSize: 12 }}></i>
            </button>
        </div>
    );
}

// ─── Clearing Screen ──────────────────────────────────────────────────────
function ClearingScreen({ setupData, accounts, onBack, onFinish }) {
    const { accountId, statementDate, statementBalance } = setupData;
    const account = accounts.find(a => a.id === accountId);
    const accountName = account?.name || accountId;

    // Load all transactions for this account up to statement date
    const allTxns = useMemo(() => {
        const ledger = window.RoboLedger?.Ledger;
        const all = ledger?.getAll?.() || ledger?.getAllTransactions?.() || [];
        return all
            .filter(tx => tx.account_id === accountId && tx.date && tx.date <= statementDate)
            .sort((a, b) => a.date > b.date ? 1 : -1);
    }, [accountId, statementDate]);

    // Pre-check previously reconciled transactions
    const [checkedIds, setCheckedIds] = useState(() => {
        const init = {};
        allTxns.forEach(tx => { if (tx.status === 'RECONCILED') init[tx.tx_id] = true; });
        return init;
    });

    const deposits = allTxns.filter(tx => tx.polarity === 'CREDIT');
    const payments = allTxns.filter(tx => tx.polarity === 'DEBIT');

    const summary = useMemo(() =>
        computeSummary(allTxns, checkedIds, statementBalance, account),
        [allTxns, checkedIds, statementBalance, account]
    );

    const toggle = (tx_id) => {
        setCheckedIds(prev => ({ ...prev, [tx_id]: !prev[tx_id] }));
    };

    const selectAll = (list) => {
        setCheckedIds(prev => {
            const next = { ...prev };
            list.forEach(tx => { next[tx.tx_id] = true; });
            return next;
        });
    };
    const clearAll = (list) => {
        setCheckedIds(prev => {
            const next = { ...prev };
            list.forEach(tx => { next[tx.tx_id] = false; });
            return next;
        });
    };

    const handleFinish = () => {
        const ledger = window.RoboLedger?.Ledger;
        const clearedTxIds = Object.entries(checkedIds).filter(([,v]) => v).map(([k]) => k);

        // Mark all checked as RECONCILED in ledger
        if (ledger?.update) {
            clearedTxIds.forEach(tx_id => {
                ledger.update(tx_id, { status: 'RECONCILED' });
            });
        } else if (ledger?.updateTransaction) {
            clearedTxIds.forEach(tx_id => {
                ledger.updateTransaction(tx_id, { status: 'RECONCILED' });
            });
        }

        // Save history record
        const history = ssGet(STORAGE_KEY) || [];
        history.push({
            id: uuidv4(),
            accountId,
            accountName,
            statementDate,
            statementBalance,
            bookBalance: summary.bookBalance,
            variance: summary.variance,
            clearedTxIds,
            clearedDeposits: summary.clearedDeposits,
            clearedPayments: summary.clearedPayments,
            completedAt: new Date().toISOString(),
        });
        ssSet(STORAGE_KEY, history);

        onFinish();
    };

    const col = { dep: '#16a34a', pmt: '#dc2626' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 0, fontFamily: 'inherit', overflow: 'hidden' }}>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', background: '#1e293b', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={onBack}
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="ph ph-arrow-left"></i> Back
                    </button>
                    <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{accountName}</div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: 11, padding: '3px 10px', borderRadius: 5 }}>
                        Statement ending {fmtDate(statementDate)}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: summary.isReconciled ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.12)',
                        color: summary.isReconciled ? '#4ade80' : '#f87171',
                        border: `1px solid ${summary.isReconciled ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                    }}>
                        <i className={`ph ph-${summary.isReconciled ? 'check-circle' : 'warning-circle'}`}></i>
                        {summary.isReconciled ? 'Reconciled' : `Off by ${fmt(Math.abs(summary.variance))}`}
                    </div>
                    <button onClick={handleFinish} disabled={!summary.isReconciled}
                        style={{
                            padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none',
                            background: summary.isReconciled ? '#16a34a' : '#374151',
                            color: summary.isReconciled ? 'white' : '#6b7280',
                            cursor: summary.isReconciled ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                        <i className="ph ph-check-fat"></i> Finish Reconciliation
                    </button>
                </div>
            </div>

            {/* Two-panel body */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* ── LEFT: Transaction Lists ── */}
                <div style={{ flex: 1, minWidth: 0, overflow: 'auto', background: '#f8fafc' }}>

                    {/* Payments / Debits */}
                    <div style={{ background: 'white', margin: 16, marginBottom: 8, borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid #f1f5f9', background: '#fef2f2' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="ph ph-arrow-up-right" style={{ color: col.pmt, fontSize: 15 }}></i>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payments & Other Withdrawals</span>
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>({payments.length})</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => selectAll(payments)} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: 'white', border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>All</button>
                                <button onClick={() => clearAll(payments)} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: 'white', border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>None</button>
                            </div>
                        </div>
                        {payments.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No payment transactions</div>
                        ) : (
                            payments.map(tx => (
                                <TxRow key={tx.tx_id} tx={tx} checked={!!checkedIds[tx.tx_id]} onToggle={toggle} dimmed={false} />
                            ))
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontSize: 12, fontWeight: 700 }}>
                            <span style={{ color: '#64748b' }}>{summary.clearedPaymentCount} of {payments.length} cleared</span>
                            <span style={{ color: col.pmt, fontFamily: 'monospace' }}>−{fmt(summary.clearedPayments)}</span>
                        </div>
                    </div>

                    {/* Deposits / Credits */}
                    <div style={{ background: 'white', margin: 16, marginTop: 8, borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="ph ph-arrow-down-left" style={{ color: col.dep, fontSize: 15 }}></i>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deposits & Other Credits</span>
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>({deposits.length})</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => selectAll(deposits)} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: 'white', border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>All</button>
                                <button onClick={() => clearAll(deposits)} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: 'white', border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>None</button>
                            </div>
                        </div>
                        {deposits.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No deposit transactions</div>
                        ) : (
                            deposits.map(tx => (
                                <TxRow key={tx.tx_id} tx={tx} checked={!!checkedIds[tx.tx_id]} onToggle={toggle} dimmed={false} />
                            ))
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontSize: 12, fontWeight: 700 }}>
                            <span style={{ color: '#64748b' }}>{summary.clearedDepositCount} of {deposits.length} cleared</span>
                            <span style={{ color: col.dep, fontFamily: 'monospace' }}>+{fmt(summary.clearedDeposits)}</span>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Live Summary Panel ── */}
                <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid #e2e8f0', background: 'white', overflow: 'auto' }}>
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Summary</div>
                    </div>

                    <div style={{ padding: 18 }}>

                        {/* Statement balance */}
                        <SummaryRow label="Statement Ending Balance" value={fmt(statementBalance)} color="#0f172a" bold size={14} />

                        <div style={{ height: 1, background: '#f1f5f9', margin: '14px 0' }}></div>

                        {/* Cleared deposits */}
                        <SummaryRow
                            label={`+ Cleared Deposits`}
                            sub={`${summary.clearedDepositCount} item${summary.clearedDepositCount !== 1 ? 's' : ''}`}
                            value={`+${fmt(summary.clearedDeposits)}`}
                            color="#16a34a"
                        />

                        <div style={{ height: 8 }}></div>

                        {/* Cleared payments */}
                        <SummaryRow
                            label={`− Cleared Payments`}
                            sub={`${summary.clearedPaymentCount} item${summary.clearedPaymentCount !== 1 ? 's' : ''}`}
                            value={`−${fmt(summary.clearedPayments)}`}
                            color="#dc2626"
                        />

                        <div style={{ height: 1, background: '#e2e8f0', margin: '14px 0' }}></div>

                        {/* Adjusted balance */}
                        <SummaryRow label="Adjusted Balance" value={fmt(summary.adjustedBalance)} color="#0f172a" bold />

                        <div style={{ height: 1, background: '#f1f5f9', margin: '14px 0' }}></div>

                        {/* Book balance */}
                        <SummaryRow label="Book Balance" value={fmt(summary.bookBalance)} color="#0f172a" bold />

                        <div style={{ height: 1, background: '#e2e8f0', margin: '16px 0' }}></div>

                        {/* Difference / Variance */}
                        <div style={{
                            padding: '14px 16px', borderRadius: 10,
                            background: summary.isReconciled ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${summary.isReconciled ? '#bbf7d0' : '#fecaca'}`,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: summary.isReconciled ? '#15803d' : '#b91c1c' }}>Difference</span>
                                <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: summary.isReconciled ? '#15803d' : '#b91c1c' }}>
                                    {fmt(summary.variance)}
                                </span>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 11, color: summary.isReconciled ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className={`ph ph-${summary.isReconciled ? 'check-circle' : 'warning-circle'}`}></i>
                                {summary.isReconciled
                                    ? 'Your accounts are reconciled!'
                                    : 'Check off items until difference = $0.00'}
                            </div>
                        </div>

                        {/* Help tip */}
                        <div style={{ marginTop: 16, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                            <i className="ph ph-lightbulb" style={{ marginRight: 4, color: '#f59e0b' }}></i>
                            Check off each transaction that appears on your bank statement. When Difference = $0.00, click Finish.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SummaryRow({ label, sub, value, color, bold, size }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
            <div>
                <div style={{ fontSize: size || 12, fontWeight: bold ? 700 : 500, color: '#475569' }}>{label}</div>
                {sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
            </div>
            <div style={{ fontSize: size || 13, fontWeight: bold ? 800 : 600, fontFamily: 'monospace', color: color || '#0f172a' }}>{value}</div>
        </div>
    );
}

// ─── History Screen ───────────────────────────────────────────────────────
function HistoryScreen({ accounts, onBack }) {
    const [filterAccountId, setFilterAccountId] = useState('ALL');
    const [expandedId, setExpandedId] = useState(null);

    const history = (ssGet(STORAGE_KEY) || []).sort((a, b) => b.completedAt > a.completedAt ? 1 : -1);
    const filtered = filterAccountId === 'ALL' ? history : history.filter(h => h.accountId === filterAccountId);

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button onClick={onBack}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className="ph ph-arrow-left"></i> Back
                </button>
                <div style={{ width: 1, height: 16, background: '#e2e8f0' }}></div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Reconciliation History</div>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <select value={filterAccountId} onChange={e => setFilterAccountId(e.target.value)}
                    style={{ padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: 'white' }}>
                    <option value="ALL">All Accounts</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
            </div>

            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                    <i className="ph ph-clock-counter-clockwise" style={{ fontSize: 40, display: 'block', marginBottom: 12 }}></i>
                    No reconciliation history found
                </div>
            ) : (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 100px 80px', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <span>Account</span>
                        <span>Statement Date</span>
                        <span>Statement Bal.</span>
                        <span>Book Balance</span>
                        <span>Variance</span>
                        <span>Txns</span>
                    </div>
                    {filtered.map(h => (
                        <React.Fragment key={h.id}>
                            <div onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 100px 80px', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: expandedId === h.id ? '#f8fafc' : 'white', transition: 'background 0.1s' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{h.accountName}</span>
                                <span style={{ fontSize: 13, color: '#475569' }}>{fmtDate(h.statementDate)}</span>
                                <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#0f172a' }}>{fmt(h.statementBalance)}</span>
                                <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#0f172a' }}>{fmt(h.bookBalance)}</span>
                                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: Math.abs(h.variance) < 0.01 ? '#16a34a' : '#dc2626' }}>
                                    {fmt(h.variance)}
                                </span>
                                <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {h.clearedTxIds?.length || 0}
                                    <i className={`ph ph-caret-${expandedId === h.id ? 'up' : 'down'}`} style={{ fontSize: 12, color: '#94a3b8' }}></i>
                                </span>
                            </div>
                            {expandedId === h.id && (
                                <div style={{ padding: '12px 16px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                        <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', marginBottom: 3 }}>CLEARED DEPOSITS</div>
                                            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#16a34a' }}>{fmt(h.clearedDeposits)}</div>
                                        </div>
                                        <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', marginBottom: 3 }}>CLEARED PAYMENTS</div>
                                            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#dc2626' }}>{fmt(h.clearedPayments)}</div>
                                        </div>
                                        <div style={{ padding: '10px 14px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', marginBottom: 3 }}>COMPLETED</div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0284c7' }}>{new Date(h.completedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Root Component ───────────────────────────────────────────────────────
export function BankReconciliationReport() {
    const [phase, setPhase] = useState('setup'); // 'setup' | 'clearing' | 'history'
    const [setupData, setSetupData] = useState(null);
    const [accounts, setAccounts] = useState([]);

    useEffect(() => {
        // Use same source + filter as the main transactions dropdown:
        //   getActive() (prunes GENERIC PARSER ghosts) → filter out blank/placeholder names
        const raw = window.RoboLedger?.Accounts?.getActive?.()
            || window.RoboLedger?.Accounts?.getAll?.()
            || [];
        const accs = raw.filter(a => a.name && a.name.trim() !== '' && a.name !== 'New Account');
        setAccounts(accs);
    }, []);

    if (phase === 'history') {
        return <HistoryScreen accounts={accounts} onBack={() => setPhase('setup')} />;
    }

    if (phase === 'clearing' && setupData) {
        return (
            <ClearingScreen
                setupData={setupData}
                accounts={accounts}
                onBack={() => setPhase('setup')}
                onFinish={() => setPhase('setup')}
            />
        );
    }

    return (
        <SetupScreen
            accounts={accounts}
            onStart={(data) => { setSetupData(data); setPhase('clearing'); }}
            onHistory={() => setPhase('history')}
        />
    );
}
