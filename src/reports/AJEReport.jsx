import React, { useState, useEffect } from 'react';
import ReportHeader from './components/ReportHeader.jsx';
import ReportFooter from './components/ReportFooter.jsx';

/**
 * AJEReport - Adjusting Journal Entries Manager
 * Create, view, and manage journal entries (AJE, RJE, CJE)
 */
export function AJEReport() {
    const [entries, setEntries] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [description, setDescription] = useState('');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [entryType, setEntryType] = useState('AJE');
    const [lines, setLines] = useState([
        { account_code: '', account_name: '', debit: '', credit: '' },
        { account_code: '', account_name: '', debit: '', credit: '' },
    ]);
    const [error, setError] = useState('');
    const [coaList, setCoaList] = useState([]);

    useEffect(() => {
        refreshEntries();
        // Load COA for account picker
        const coa = window.RoboLedger?.COA;
        if (coa?.getAllAccounts) {
            setCoaList(coa.getAllAccounts());
        } else if (coa?.list) {
            setCoaList(coa.list());
        }
    }, []);

    const refreshEntries = () => {
        const je = window.RoboLedger?.Ledger?.getJournalEntries?.() || [];
        setEntries(je.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    };

    const fmt = (n) => new Intl.NumberFormat('en-CA', {
        style: 'currency', currency: 'CAD', minimumFractionDigits: 2
    }).format(n);

    const addLine = () => {
        setLines([...lines, { account_code: '', account_name: '', debit: '', credit: '' }]);
    };

    const removeLine = (idx) => {
        if (lines.length <= 2) return;
        setLines(lines.filter((_, i) => i !== idx));
    };

    const updateLine = (idx, field, value) => {
        const newLines = [...lines];
        newLines[idx] = { ...newLines[idx], [field]: value };

        // If account_code changed, look up account name
        if (field === 'account_code' && value) {
            const acc = window.RoboLedger?.COA?.get?.(value);
            if (acc) newLines[idx].account_name = acc.name;
        }

        // Ensure debit/credit exclusivity
        if (field === 'debit' && value) newLines[idx].credit = '';
        if (field === 'credit' && value) newLines[idx].debit = '';

        setLines(newLines);
    };

    const submitEntry = () => {
        setError('');

        if (!description.trim()) {
            setError('Description is required');
            return;
        }

        // Validate lines
        const validLines = lines.filter(l => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
        if (validLines.length < 2) {
            setError('At least 2 valid lines required');
            return;
        }

        const totalDebit = validLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
        const totalCredit = validLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            setError(`Entry does not balance: Debits (${fmt(totalDebit)}) ≠ Credits (${fmt(totalCredit)})`);
            return;
        }

        const ledger = window.RoboLedger?.Ledger;
        if (!ledger?.createJournalEntry) {
            setError('Journal entry API not available');
            return;
        }

        // Use the first real active account — the ledger engine will also
        // validate and refuse to use ACC-001 placeholders.
        const activeAccounts = window.RoboLedger?.Accounts?.getActive?.() || [];
        const defaultAccountId = activeAccounts[0]?.id || 'JOURNAL';

        const result = ledger.createJournalEntry(
            description.trim(),
            validLines.map(l => ({
                account_code: l.account_code,
                account_name: l.account_name,
                account_id: defaultAccountId,
                debit: parseFloat(l.debit) || 0,
                credit: parseFloat(l.credit) || 0,
            })),
            entryDate,
            entryType
        );

        if (result) {
            setShowForm(false);
            setDescription('');
            setLines([
                { account_code: '', account_name: '', debit: '', credit: '' },
                { account_code: '', account_name: '', debit: '', credit: '' },
            ]);
            refreshEntries();
        } else {
            setError('Failed to post journal entry. The period may be locked.');
        }
    };

    const deleteEntry = (entryId) => {
        const ledger = window.RoboLedger?.Ledger;
        if (ledger?.deleteJournalEntry?.(entryId)) {
            refreshEntries();
        }
    };

    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

    const exportCSV = () => {
        const rows = [
            ['Adjusting Journal Entries'],
            ['Entry ID', 'Date', 'Type', 'Description', 'Debit', 'Credit'],
            ...entries.flatMap(e => [
                [e.id, e.date, e.type, e.description, e.totalDebit?.toFixed(2), e.totalCredit?.toFixed(2)],
            ])
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `journal-entries-${new Date().toISOString().split('T')[0]}.csv`;
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

            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                <ReportHeader
                    reportTitle="Adjusting Journal Entries"
                    subtitle="Create and manage period-end adjustments"
                />

                <div style={{ padding: '20px 24px' }}>
                    {/* New Entry Button */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <button onClick={() => setShowForm(!showForm)}
                            style={{
                                padding: '8px 16px', background: showForm ? '#f1f5f9' : '#3b82f6',
                                color: showForm ? '#475569' : 'white', border: 'none', borderRadius: 8,
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6
                            }}>
                            <i className={`ph ph-${showForm ? 'x' : 'plus'}`}></i>
                            {showForm ? 'Cancel' : 'New Journal Entry'}
                        </button>
                        <button onClick={() => window.openPeriodManager?.()}
                            style={{
                                padding: '8px 16px', background: 'white', color: '#16a34a',
                                border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13,
                                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                            }}>
                            <i className="ph ph-lock-simple"></i> Period Manager
                        </button>
                    </div>

                    {/* Entry Form */}
                    {showForm && (
                        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Description</label>
                                    <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                                        placeholder="e.g. Year-end accrual for utilities"
                                        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date</label>
                                    <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                                        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Type</label>
                                    <select value={entryType} onChange={e => setEntryType(e.target.value)}
                                        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12 }}>
                                        <option value="AJE">AJE (Adjusting)</option>
                                        <option value="RJE">RJE (Reversing)</option>
                                        <option value="CJE">CJE (Closing)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Line Items */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                                        <th style={{ textAlign: 'left', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#64748b', width: '15%' }}>Account</th>
                                        <th style={{ textAlign: 'left', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#64748b', width: '35%' }}>Description</th>
                                        <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#64748b', width: '18%' }}>Debit</th>
                                        <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#64748b', width: '18%' }}>Credit</th>
                                        <th style={{ width: '14%' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line, idx) => (
                                        <tr key={idx}>
                                            <td style={{ padding: '3px 4px' }}>
                                                <input type="text" value={line.account_code} onChange={e => updateLine(idx, 'account_code', e.target.value)}
                                                    placeholder="COA #" list="coa-datalist"
                                                    style={{ width: '100%', padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }} />
                                            </td>
                                            <td style={{ padding: '3px 4px' }}>
                                                <input type="text" value={line.account_name} onChange={e => updateLine(idx, 'account_name', e.target.value)}
                                                    placeholder="Account name"
                                                    style={{ width: '100%', padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }} />
                                            </td>
                                            <td style={{ padding: '3px 4px' }}>
                                                <input type="number" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)}
                                                    placeholder="0.00" step="0.01" min="0"
                                                    style={{ width: '100%', padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, textAlign: 'right', boxSizing: 'border-box' }} />
                                            </td>
                                            <td style={{ padding: '3px 4px' }}>
                                                <input type="number" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)}
                                                    placeholder="0.00" step="0.01" min="0"
                                                    style={{ width: '100%', padding: '5px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, textAlign: 'right', boxSizing: 'border-box' }} />
                                            </td>
                                            <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                                                <button onClick={() => removeLine(idx)}
                                                    style={{ background: 'none', border: 'none', cursor: lines.length <= 2 ? 'not-allowed' : 'pointer', color: lines.length <= 2 ? '#cbd5e1' : '#dc2626', fontSize: 14 }}>
                                                    <i className="ph ph-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid #0f172a' }}>
                                        <td colSpan={2} style={{ padding: '6px 4px', fontWeight: 700, fontSize: 11 }}>TOTALS</td>
                                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', fontSize: 11 }}>{fmt(totalDebit)}</td>
                                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', fontSize: 11 }}>{fmt(totalCredit)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>

                            <datalist id="coa-datalist">
                                {coaList.map(acc => (
                                    <option key={acc.code} value={acc.code}>{acc.code} — {acc.name}</option>
                                ))}
                            </datalist>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button onClick={addLine}
                                    style={{ padding: '5px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                    <i className="ph ph-plus" style={{ marginRight: 4 }}></i> Add Line
                                </button>
                                <div style={{ flex: 1 }}></div>
                                {!isBalanced && totalDebit > 0 && (
                                    <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                                        <i className="ph ph-warning" style={{ marginRight: 4 }}></i>
                                        Off by {fmt(Math.abs(totalDebit - totalCredit))}
                                    </span>
                                )}
                                {isBalanced && (
                                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                                        <i className="ph ph-check-circle" style={{ marginRight: 4 }}></i> Balanced
                                    </span>
                                )}
                                <button onClick={submitEntry} disabled={!isBalanced}
                                    style={{
                                        padding: '7px 16px', background: isBalanced ? '#16a34a' : '#94a3b8',
                                        color: 'white', border: 'none', borderRadius: 7, fontSize: 12,
                                        fontWeight: 600, cursor: isBalanced ? 'pointer' : 'not-allowed'
                                    }}>
                                    <i className="ph ph-check" style={{ marginRight: 4 }}></i> Post Entry
                                </button>
                            </div>

                            {error && (
                                <div style={{ marginTop: 8, padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, color: '#dc2626' }}>
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Entries List */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                        Posted Entries ({entries.length})
                    </div>

                    {entries.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
                            <i className="ph ph-notebook" style={{ fontSize: 24, display: 'block', marginBottom: 8 }}></i>
                            No journal entries yet. Click "New Journal Entry" to create one.
                        </div>
                    )}

                    {entries.map(entry => (
                        <div key={entry.id} style={{
                            background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 8,
                            border: '1px solid #e2e8f0'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                        background: entry.type === 'AJE' ? '#dbeafe' : entry.type === 'RJE' ? '#fef3c7' : '#f3e8ff',
                                        color: entry.type === 'AJE' ? '#2563eb' : entry.type === 'RJE' ? '#d97706' : '#7c3aed',
                                    }}>{entry.type}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{entry.description}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 10, color: '#64748b' }}>{entry.date}</span>
                                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{entry.id}</span>
                                    <button onClick={() => deleteEntry(entry.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13, padding: '2px 4px' }}>
                                        <i className="ph ph-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b' }}>
                                <span>Lines: {entry.lines?.length || 0}</span>
                                <span>Debit: <strong style={{ color: '#0f172a' }}>{fmt(entry.totalDebit || 0)}</strong></span>
                                <span>Credit: <strong style={{ color: '#0f172a' }}>{fmt(entry.totalCredit || 0)}</strong></span>
                            </div>
                        </div>
                    ))}
                </div>

                <ReportFooter />
            </div>
        </div>
    );
}
