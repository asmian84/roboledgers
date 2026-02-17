import React, { useState, useEffect, useMemo } from 'react';
import ReportGenerator from '../services/ReportGenerator.js';

/**
 * LiveReportPanel - Real-time updating report panel for split-pane view
 * Displays financial reports alongside transaction grid with live updates
 * Supports drill-down filtering by clicking account rows
 */
export function LiveReportPanel({
    reportType = 'trial-balance',
    transactions,
    selectedAccount = null,
    onAccountClick,
    onClearFilter
}) {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Calculate report data directly from transactions
    // NOTE: Cannot use ReportGenerator here because transactions are already filtered
    // ReportGenerator.generateTrialBalance() would re-filter from global Ledger
    useEffect(() => {
        if (!transactions || transactions.length === 0) {
            setReportData(null);
            return;
        }

        setLoading(true);
        try {
            // Direct calculation from provided transactions
            const accountBalances = {};

            transactions.forEach(tx => {
                const category = tx.category || '9970';

                if (!accountBalances[category]) {
                    // Try multiple lookup strategies for COA
                    let account = window.RoboLedger?.COA?.get(String(category));
                    if (!account) {
                        account = window.RoboLedger?.COA?.get(parseInt(category));
                    }
                    if (!account) {
                        account = window.RoboLedger?.COA?.get(category);
                    }

                    accountBalances[category] = {
                        code: category,
                        name: category === '9970' ? 'Uncategorized' : (account?.name || `Account ${category}`),
                        debit: 0,
                        credit: 0,
                        balance: 0
                    };
                }

                const amount = (tx.amount_cents || 0) / 100;
                if (tx.polarity === 'DEBIT') {
                    accountBalances[category].debit += amount;
                } else if (tx.polarity === 'CREDIT') {
                    accountBalances[category].credit += amount;
                }
            });

            // Calculate balances and sort
            const accounts = Object.values(accountBalances).map(acc => {
                acc.balance = acc.debit - acc.credit;
                return acc;
            }).sort((a, b) => {
                if (a.code === '9970') return 1;
                if (b.code === '9970') return -1;
                const aNum = parseInt(a.code);
                const bNum = parseInt(b.code);
                return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
            });

            // Calculate totals
            let totalDebit = accounts.reduce((sum, acc) => sum + acc.debit, 0);
            let totalCredit = accounts.reduce((sum, acc) => sum + acc.credit, 0);

            // Force balance if needed
            const imbalance = totalDebit - totalCredit;
            if (Math.abs(imbalance) > 0.01) {
                let uncatAccount = accounts.find(a => a.code === '9970');
                if (!uncatAccount) {
                    uncatAccount = {
                        code: '9970',
                        name: 'Uncategorized',
                        debit: 0,
                        credit: 0,
                        balance: 0
                    };
                    accounts.push(uncatAccount);
                }

                if (imbalance > 0) {
                    uncatAccount.credit += imbalance;
                } else {
                    uncatAccount.debit += Math.abs(imbalance);
                }
                uncatAccount.balance = uncatAccount.debit - uncatAccount.credit;

                // Recalculate totals
                totalDebit = accounts.reduce((sum, acc) => sum + acc.debit, 0);
                totalCredit = accounts.reduce((sum, acc) => sum + acc.credit, 0);
            }

            const data = {
                accounts,
                totals: {
                    debit: totalDebit,
                    credit: totalCredit,
                    balance: totalDebit - totalCredit
                },
                isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
            };

            setReportData(data);
        } catch (error) {
            console.error('[LIVE_REPORT_PANEL] Failed to calculate trial balance:', error);
            setReportData(null);
        } finally {
            setLoading(false);
        }
    }, [transactions]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: 'CAD'
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="live-report-panel bg-white border-l border-gray-200 p-6 overflow-auto">
                <div className="flex items-center justify-center h-full">
                    <i className="ph ph-spinner-gap animate-spin text-3xl text-blue-600"></i>
                </div>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="live-report-panel bg-white border-l border-gray-200 p-6 overflow-auto">
                <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                        <i className="ph ph-chart-bar text-6xl mb-3"></i>
                        <p>No data to display</p>
                    </div>
                </div>
            </div>
        );
    }

    // Render Trial Balance
    if (reportType === 'trial-balance') {
        return (
            <div className="live-report-panel bg-white border-l border-gray-200 overflow-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-gray-900">Trial Balance</h3>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${reportData.isBalanced
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {reportData.isBalanced ? '✓ Balanced' : '⚠ Out of Balance'}
                        </div>
                    </div>

                    {/* Breadcrumb Navigation */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        <span
                            onClick={onClearFilter}
                            className={`${selectedAccount ? 'cursor-pointer hover:text-blue-600 hover:underline' : 'text-gray-900 font-semibold'}`}
                        >
                            All Accounts
                        </span>
                        {selectedAccount && (
                            <>
                                <i className="ph ph-caret-right text-gray-400"></i>
                                <span className="text-blue-600 font-semibold">
                                    {reportData.accounts.find(a => a.code === selectedAccount)?.name || selectedAccount}
                                </span>
                            </>
                        )}
                    </div>

                    <p className="text-xs text-gray-500">
                        {reportData.accounts.length} accounts · Live updates
                    </p>
                </div>

                {/* Table */}
                <div className="p-4">
                    <table className="w-full text-xs">
                        <thead className="border-b border-gray-200">
                            <tr>
                                <th className="text-left pb-2 font-bold text-gray-700">Code</th>
                                <th className="text-left pb-2 font-bold text-gray-700">Account</th>
                                <th className="text-right pb-2 font-bold text-gray-700">Debit</th>
                                <th className="text-right pb-2 font-bold text-gray-700">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {reportData.accounts.map(account => (
                                <tr
                                    key={account.code}
                                    onClick={() => onAccountClick?.(account.code)}
                                    className={`cursor-pointer transition-colors ${selectedAccount === account.code
                                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                        : 'hover:bg-gray-50'
                                        }`}
                                    title="Click to filter grid by this account"
                                >
                                    <td className={`py-2 font-mono text-gray-600 ${selectedAccount === account.code ? 'pl-2' : ''}`}>
                                        {account.code}
                                    </td>
                                    <td className="py-2 text-gray-900">{account.name}</td>
                                    <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                                        {account.debit > account.credit ? formatCurrency(account.debit - account.credit) : '—'}
                                    </td>
                                    <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                                        {account.credit > account.debit ? formatCurrency(account.credit - account.debit) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                            <tr>
                                <td colSpan="2" className="py-3 font-bold uppercase text-xs">Totals</td>
                                <td className="py-3 text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(reportData.totals.debit)}
                                </td>
                                <td className="py-3 text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(reportData.totals.credit)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    }

    // Placeholder for other report types
    return (
        <div className="live-report-panel bg-white border-l border-gray-200 p-6">
            <p className="text-gray-500">Report type: {reportType}</p>
        </div>
    );
}

export default LiveReportPanel;
