import React, { useState, useEffect } from 'react';
import { UNCATEGORIZED_CODE, UNCATEGORIZED_NAME } from '../constants/accounts.js';

/**
 * LiveReportPanel — Real-time Trial Balance alongside the transaction grid.
 *
 * Correct Trial Balance behaviour:
 *   - Only shows accounts with actual transaction activity (zero-balance accounts hidden)
 *   - Shows actual debit totals in the Debit column
 *   - Shows actual credit totals in the Credit column
 *   - Grand totals must equal: sum(all debits) = sum(all credits)
 *   - Accounts grouped by type: Assets / Liabilities / Equity / Revenue / Expenses
 *   - Clicking a row filters the grid to that account's transactions
 */
export function LiveReportPanel({
    reportType = 'trial-balance',
    transactions,
    selectedAccount = null,
    onAccountClick,
    onClearFilter
}) {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading]       = useState(false);

    useEffect(() => {
        if (!transactions) { setReportData(null); return; }

        setLoading(true);
        try {
            // ── Step 1: Seed ALL COA accounts (zero-balance included) ──────────
            const accountBalances = {};
            // GST account codes that get their own dedicated TB section
            const GST_CODES = new Set(['2148','2149','2150','2151','2160','2170','2171','2172','2173','2174']);

            const allCOA = window.RoboLedger?.COA?.getAll?.() || [];
            allCOA.forEach(account => {
                const codeStr = String(account.code);
                accountBalances[account.code] = {
                    code:      account.code,
                    name:      account.name,
                    root:      account.root || inferRoot(account.code),
                    leadsheet: account.leadsheet || null,
                    isGST:     GST_CODES.has(codeStr),
                    debit:     0,
                    credit:    0,
                };
            });

            // ── Step 2: Accumulate transaction amounts ────────────────────────
            transactions.forEach(tx => {
                const code = tx.category || UNCATEGORIZED_CODE;

                // Ensure the account exists (for codes outside COA_DEFAULTS)
                if (!accountBalances[code]) {
                    const acct = window.RoboLedger?.COA?.get(String(code))
                              || window.RoboLedger?.COA?.get(parseInt(code));
                    accountBalances[code] = {
                        code,
                        name:      code === UNCATEGORIZED_CODE ? UNCATEGORIZED_NAME
                                 : (acct?.name || `Account ${code}`),
                        root:      acct?.root || inferRoot(code),
                        leadsheet: acct?.leadsheet || null,
                        debit:     0,
                        credit:    0,
                    };
                }

                const amount = (tx.amount_cents || 0) / 100;
                if (tx.polarity === 'DEBIT')  accountBalances[code].debit  += amount;
                if (tx.polarity === 'CREDIT') accountBalances[code].credit += amount;

                // GST sub-account — correct accounting treatment:
                //   2160 GST Collected on Sales   → LIABILITY  (credit — owed to CRA)
                //   2150 GST Paid / ITC            → ASSET      (debit  — receivable from CRA)
                if (tx.gst_enabled && tx.gst_account && tx.tax_cents) {
                    const gstCode   = String(tx.gst_account);
                    const gstAmount = Math.abs(tx.tax_cents || 0) / 100;
                    if (!accountBalances[gstCode]) {
                        const gstAcct = window.RoboLedger?.COA?.get(gstCode)
                                     || window.RoboLedger?.COA?.get(parseInt(gstCode));
                        // 2150 = GST ITC/Paid (asset — debit-normal)
                        // 2160 = GST Collected (liability — credit-normal)
                        const isITC = gstCode === '2150' || tx.gst_type === 'itc';
                        accountBalances[gstCode] = {
                            code:    gstCode,
                            name:    gstAcct?.name || (isITC ? 'GST Paid / ITC (2150)' : 'GST Collected (2160)'),
                            root:    isITC ? 'ASSET' : 'LIABILITY',
                            isGST:   true,
                            debit:   0,
                            credit:  0,
                        };
                    }
                    // ITC is a debit (asset); Collected is a credit (liability)
                    const isITC = gstCode === '2150' || tx.gst_type === 'itc';
                    if (isITC) {
                        accountBalances[gstCode].debit  += gstAmount;
                    } else {
                        accountBalances[gstCode].credit += gstAmount;
                    }
                }
            });

            // ── Step 3: Build sorted account list ─────────────────────────────
            const accounts = Object.values(accountBalances)
                .sort((a, b) => {
                    if (a.code === UNCATEGORIZED_CODE) return 1;
                    if (b.code === UNCATEGORIZED_CODE) return -1;
                    return (parseInt(a.code) || 0) - (parseInt(b.code) || 0);
                });

            // ── Step 4: Totals (sum of ALL actual debits & credits) ───────────
            const totalDebit  = accounts.reduce((s, a) => s + a.debit,  0);
            const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

            // ── Step 5: Group by account root type (active accounts only) ────
            const grouped = { ASSET: [], LIABILITY: [], EQUITY: [], REVENUE: [], EXPENSE: [], GST: [] };
            accounts.forEach(acc => {
                // Skip zero-balance accounts — only show accounts with actual activity
                if (acc.debit === 0 && acc.credit === 0) return;
                // GST accounts get their own dedicated section
                if (acc.isGST) {
                    grouped.GST.push(acc);
                    return;
                }
                const root = acc.root || 'EXPENSE';
                (grouped[root] || grouped.EXPENSE).push(acc);
            });

            setReportData({
                accounts,
                grouped,
                totals: { debit: totalDebit, credit: totalCredit },
                isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
            });
        } catch (err) {
            console.error('[LIVE_REPORT_PANEL] Error:', err);
            setReportData(null);
        } finally {
            setLoading(false);
        }
    }, [transactions]);

    // ─── Formatting ──────────────────────────────────────────────────────────

    const fmt = (amount) =>
        new Intl.NumberFormat('en-CA', {
            style: 'currency', currency: 'CAD',
            minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(amount);

    // ─── Loading / Empty states ───────────────────────────────────────────────

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <i className="ph ph-spinner-gap animate-spin text-2xl text-indigo-500"></i>
        </div>
    );

    if (!reportData) return (
        <div className="flex items-center justify-center h-full text-gray-400 p-6">
            <div className="text-center">
                <i className="ph ph-scales text-4xl mb-2 block"></i>
                <p className="text-xs">No data</p>
            </div>
        </div>
    );

    // ─── Section colours ──────────────────────────────────────────────────────

    const ROOT_LABELS = {
        ASSET:     'Assets',
        LIABILITY: 'Liabilities',
        EQUITY:    'Equity',
        REVENUE:   'Revenue',
        EXPENSE:   'Expenses',
        GST:       'GST / HST',
    };
    const ROOT_COLORS = {
        ASSET:     '#3b82f6',
        LIABILITY: '#ef4444',
        EQUITY:    '#8b5cf6',
        REVENUE:   '#059669',
        EXPENSE:   '#d97706',
        GST:       '#0891b2',
    };

    // ─── Trial Balance render ─────────────────────────────────────────────────

    if (reportType === 'trial-balance') {
        // Count active accounts (those with any transaction activity)
        const activeCount = reportData.accounts.filter(a => a.debit > 0 || a.credit > 0).length;

        return (
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-sm text-gray-900">Trial Balance</h3>
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            reportData.isBalanced
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                        }`}>
                            {reportData.isBalanced ? '✓ Balanced' : '⚠ Unbalanced'}
                        </div>
                    </div>

                    {/* Drill-down breadcrumb */}
                    {selectedAccount && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <span
                                onClick={onClearFilter}
                                className="cursor-pointer hover:text-indigo-600 hover:underline"
                            >
                                All
                            </span>
                            <i className="ph ph-caret-right text-gray-300" style={{ fontSize: '8px' }}></i>
                            <span className="text-indigo-600 font-semibold">
                                {reportData.accounts.find(a => a.code === selectedAccount)?.name || selectedAccount}
                            </span>
                        </div>
                    )}

                    <p className="text-[10px] text-gray-400 mt-1">
                        {activeCount} accounts · Live
                    </p>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
                        <thead className="sticky top-0 bg-gray-50 z-[5]">
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <th className="text-left py-1.5 px-2 font-semibold text-gray-500 uppercase text-[9px] tracking-wider" style={{ width: '44px' }}>Code</th>
                                <th className="text-left py-1.5 px-1 font-semibold text-gray-500 uppercase text-[9px] tracking-wider">Account</th>
                                <th className="text-right py-1.5 px-2 font-semibold text-gray-500 uppercase text-[9px] tracking-wider" style={{ width: '72px' }}>Debit</th>
                                <th className="text-right py-1.5 px-2 font-semibold text-gray-500 uppercase text-[9px] tracking-wider" style={{ width: '72px' }}>Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'GST'].map(rootType => {
                                const items = reportData.grouped[rootType];
                                if (!items?.length) return null;

                                // For GST section, compute net payable
                                const isGSTSection = rootType === 'GST';
                                const gstCollected = isGSTSection
                                    ? items.find(a => String(a.code) === '2160' || a.gst_type === 'collected')
                                    : null;
                                const gstITC = isGSTSection
                                    ? items.find(a => String(a.code) === '2150' || a.gst_type === 'itc')
                                    : null;
                                const netGST = isGSTSection
                                    ? ((gstCollected?.credit || 0) - (gstITC?.debit || 0))
                                    : 0;

                                return (
                                    <React.Fragment key={rootType}>
                                        {/* Section header */}
                                        <tr>
                                            <td colSpan="4" className="py-1.5 px-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: ROOT_COLORS[rootType] }}>
                                                    {ROOT_LABELS[rootType]}
                                                </span>
                                                {isGSTSection && (
                                                    <span className="ml-2 text-[9px] font-normal text-gray-400">
                                                        · Net payable: <span className={`font-semibold ${netGST >= 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(Math.abs(netGST))}{netGST < 0 ? ' refund' : ''}</span>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Account rows — active accounts only (zero-balance accounts hidden) */}
                                        {items.map(account => (
                                            <tr
                                                key={account.code}
                                                onClick={() => onAccountClick?.(account.code)}
                                                className={`transition-colors cursor-pointer ${
                                                    selectedAccount === account.code
                                                        ? 'bg-cyan-50'
                                                        : isGSTSection
                                                            ? 'hover:bg-cyan-50'
                                                            : 'hover:bg-gray-50'
                                                }`}
                                                style={{ borderBottom: '1px solid #f9fafb' }}
                                            >
                                                <td className="py-1.5 px-2 font-mono text-[10px]" style={{ width: '44px', color: ROOT_COLORS[rootType] }}>
                                                    {account.code}
                                                </td>
                                                <td className="py-1.5 px-1 text-gray-800" style={{
                                                    maxWidth: '120px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {account.name}
                                                    {isGSTSection && (
                                                        <span className="ml-1 text-[9px] text-gray-400">
                                                            {String(account.code) === '2150' ? '(ITC)' : '(Collected)'}
                                                        </span>
                                                    )}
                                                </td>
                                                {/* DEBIT column — actual debit total */}
                                                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-gray-700" style={{ width: '72px' }}>
                                                    {account.debit > 0 ? fmt(account.debit) : '—'}
                                                </td>
                                                {/* CREDIT column — actual credit total */}
                                                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-gray-700" style={{ width: '72px' }}>
                                                    {account.credit > 0 ? fmt(account.credit) : '—'}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* GST Net row */}
                                        {isGSTSection && items.length > 1 && (
                                            <tr style={{ borderBottom: '2px solid #e0f2fe', background: '#f0f9ff' }}>
                                                <td className="py-1.5 px-2 text-[10px]" style={{ color: ROOT_COLORS.GST }}></td>
                                                <td className="py-1.5 px-1 text-[10px] font-semibold text-cyan-800">
                                                    Net GST Payable
                                                </td>
                                                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[10px] font-semibold text-cyan-700" colSpan="2">
                                                    {netGST >= 0
                                                        ? <span className="text-red-600">{fmt(netGST)} owed</span>
                                                        : <span className="text-green-600">{fmt(Math.abs(netGST))} refund</span>
                                                    }
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300 sticky bottom-0">
                            <tr>
                                <td colSpan="2" className="py-2 px-2 font-bold uppercase text-[10px] text-gray-700">Totals</td>
                                <td className="py-2 px-2 text-right font-mono font-bold tabular-nums text-[11px]">
                                    {fmt(reportData.totals.debit)}
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-bold tabular-nums text-[11px]">
                                    {fmt(reportData.totals.credit)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    }

    // ─── Placeholder for other report types ───────────────────────────────────
    return (
        <div className="p-6 text-gray-500 text-center">
            <p className="text-xs">Report: {reportType}</p>
        </div>
    );
}

/** Infer account root type from code range when COA entry is missing */
function inferRoot(code) {
    const num = parseInt(code);
    if (isNaN(num))              return 'EXPENSE';
    if (num >= 1000 && num < 2000) return 'ASSET';
    if (num >= 2000 && num < 3000) return 'LIABILITY';
    if (num >= 3000 && num < 4000) return 'EQUITY';
    if (num >= 4000 && num < 5000) return 'REVENUE';
    return 'EXPENSE'; // 5000-9999
}

export default LiveReportPanel;
