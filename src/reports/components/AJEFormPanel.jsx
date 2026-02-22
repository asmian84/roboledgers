import React, { useState, useEffect, useCallback } from 'react';

/**
 * AJEFormPanel — Compact inline Adjusting Journal Entry panel
 * Used in the 30% side panel of the Trial Balance split view.
 * Also reused by AJEReport.jsx for the full-page view.
 *
 * Props:
 *   compact  - boolean, if true renders in slim side-panel mode
 *   onPost   - callback after a successful journal entry post (triggers TB refresh)
 *   periodStart / periodEnd - date range to filter displayed entries
 */
export function AJEFormPanel({ compact = false, onPost, periodStart, periodEnd }) {
    const [entries, setEntries] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [description, setDescription] = useState('');
    const [entryDate, setEntryDate] = useState(periodEnd || new Date().toISOString().split('T')[0]);
    const [entryType, setEntryType] = useState('AJE');
    const [lines, setLines] = useState([
        { account_code: '', account_name: '', debit: '', credit: '' },
        { account_code: '', account_name: '', debit: '', credit: '' },
    ]);
    const [error, setError] = useState('');
    const [coaList, setCoaList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeLineIdx, setActiveLineIdx] = useState(null);

    useEffect(() => {
        refreshEntries();
        loadCOA();
    }, []);

    // Update default date when period changes
    useEffect(() => {
        if (periodEnd) setEntryDate(periodEnd);
    }, [periodEnd]);

    const loadCOA = () => {
        const coa = window.RoboLedger?.COA;
        const all = coa?.getAll?.() || coa?.getAllAccounts?.() || coa?.list?.() || [];
        setCoaList(all);
    };

    const refreshEntries = useCallback(() => {
        const je = window.RoboLedger?.Ledger?.getJournalEntries?.() || [];
        let filtered = je;
        if (periodStart && periodEnd) {
            filtered = je.filter(e => e.date >= periodStart && e.date <= periodEnd);
        }
        setEntries(filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    }, [periodStart, periodEnd]);

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

        if (field === 'account_code' && value) {
            const acc = window.RoboLedger?.COA?.get?.(value);
            if (acc) newLines[idx].account_name = acc.name;
        }

        // Debit/credit exclusivity
        if (field === 'debit' && value) newLines[idx].credit = '';
        if (field === 'credit' && value) newLines[idx].debit = '';

        setLines(newLines);
    };

    const selectAccount = (idx, code, name) => {
        const newLines = [...lines];
        newLines[idx] = { ...newLines[idx], account_code: code, account_name: name };
        setLines(newLines);
        setActiveLineIdx(null);
        setSearchTerm('');
    };

    const submitEntry = () => {
        setError('');

        if (!description.trim()) {
            setError('Description is required');
            return;
        }

        const validLines = lines.filter(l => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
        if (validLines.length < 2) {
            setError('At least 2 valid lines required');
            return;
        }

        const totalDebit = validLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
        const totalCredit = validLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            setError(`Debits (${fmt(totalDebit)}) must equal Credits (${fmt(totalCredit)})`);
            return;
        }

        const ledger = window.RoboLedger?.Ledger;
        if (!ledger?.createJournalEntry) {
            setError('Journal entry API not available');
            return;
        }

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
            onPost?.();
        } else {
            setError('Failed to post. Period may be locked.');
        }
    };

    const deleteEntry = (entryId) => {
        const ledger = window.RoboLedger?.Ledger;
        if (ledger?.deleteJournalEntry?.(entryId)) {
            refreshEntries();
            onPost?.();
        }
    };

    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

    // Filtered COA for search dropdown
    const filteredCOA = searchTerm
        ? coaList.filter(a =>
            String(a.code).includes(searchTerm) ||
            (a.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 12)
        : coaList.slice(0, 12);

    // Summary stats
    const totalAdjDR = entries.reduce((s, e) => s + (e.totalDebit || 0), 0);
    const totalAdjCR = entries.reduce((s, e) => s + (e.totalCredit || 0), 0);

    const inputStyle = {
        width: '100%', padding: compact ? '5px 6px' : '7px 8px',
        border: '1.5px solid #e2e8f0', borderRadius: 6,
        fontSize: compact ? 11 : 12, boxSizing: 'border-box',
        outline: 'none',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
                padding: compact ? '10px 12px' : '14px 16px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: compact ? 12 : 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <i className="ph ph-notebook" style={{ color: '#7c3aed' }}></i>
                            Journal Entries
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            {entries.length} entries | DR {fmt(totalAdjDR)} | CR {fmt(totalAdjCR)}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        style={{
                            padding: '5px 10px', background: showForm ? '#f1f5f9' : '#7c3aed',
                            color: showForm ? '#475569' : 'white', border: 'none', borderRadius: 6,
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4
                        }}
                    >
                        <i className={`ph ph-${showForm ? 'x' : 'plus'}`}></i>
                        {showForm ? 'Cancel' : 'New'}
                    </button>
                </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: compact ? '8px 10px' : '12px 14px' }}>

                {/* Entry Form */}
                {showForm && (
                    <div style={{
                        background: '#faf5ff', borderRadius: 8, padding: compact ? 10 : 14,
                        border: '1px solid #e9d5ff', marginBottom: 12
                    }}>
                        {/* Description + Date + Type */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                                placeholder="Description (e.g. Year-end amortization)"
                                style={inputStyle} />
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }} />
                                <select value={entryType} onChange={e => setEntryType(e.target.value)}
                                    style={{ ...inputStyle, flex: 1, padding: '5px 4px' }}>
                                    <option value="AJE">AJE</option>
                                    <option value="RJE">RJE</option>
                                    <option value="CJE">CJE</option>
                                </select>
                            </div>
                        </div>

                        {/* Line items */}
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'flex', gap: 4 }}>
                            <span style={{ flex: 2 }}>Account</span>
                            <span style={{ flex: 1, textAlign: 'right' }}>Debit</span>
                            <span style={{ flex: 1, textAlign: 'right' }}>Credit</span>
                            <span style={{ width: 24 }}></span>
                        </div>

                        {lines.map((line, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 4, marginBottom: 4, position: 'relative' }}>
                                <div style={{ flex: 2, position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={line.account_code ? `${line.account_code} ${line.account_name}` : ''}
                                        placeholder="Search account..."
                                        onFocus={() => setActiveLineIdx(idx)}
                                        onChange={e => {
                                            setSearchTerm(e.target.value);
                                            setActiveLineIdx(idx);
                                            // If user clears the field
                                            if (!e.target.value) {
                                                updateLine(idx, 'account_code', '');
                                                updateLine(idx, 'account_name', '');
                                            }
                                        }}
                                        style={{ ...inputStyle, fontSize: 10 }}
                                    />
                                    {activeLineIdx === idx && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                            background: 'white', border: '1px solid #e2e8f0', borderRadius: 6,
                                            maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}>
                                            {filteredCOA.map(a => (
                                                <div key={a.code}
                                                    onClick={() => selectAccount(idx, String(a.code), a.name)}
                                                    style={{
                                                        padding: '5px 8px', cursor: 'pointer', fontSize: 10,
                                                        borderBottom: '1px solid #f1f5f9',
                                                        display: 'flex', gap: 6, alignItems: 'center',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                    onMouseLeave={e => e.currentTarget.style.background = ''}
                                                >
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#6366f1', minWidth: 32 }}>{a.code}</span>
                                                    <span style={{ color: '#1e293b' }}>{a.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input type="number" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)}
                                    placeholder="0.00" step="0.01" min="0"
                                    style={{ ...inputStyle, flex: 1, textAlign: 'right', fontSize: 10 }} />
                                <input type="number" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)}
                                    placeholder="0.00" step="0.01" min="0"
                                    style={{ ...inputStyle, flex: 1, textAlign: 'right', fontSize: 10 }} />
                                <button onClick={() => removeLine(idx)}
                                    style={{
                                        background: 'none', border: 'none', cursor: lines.length <= 2 ? 'not-allowed' : 'pointer',
                                        color: lines.length <= 2 ? '#cbd5e1' : '#dc2626', fontSize: 12, width: 24, padding: 0,
                                    }}>
                                    <i className="ph ph-x"></i>
                                </button>
                            </div>
                        ))}

                        {/* Totals */}
                        <div style={{
                            display: 'flex', gap: 4, marginTop: 6, paddingTop: 6,
                            borderTop: '2px solid #0f172a', fontSize: 10, fontWeight: 700
                        }}>
                            <span style={{ flex: 2, color: '#64748b' }}>TOTALS</span>
                            <span style={{ flex: 1, textAlign: 'right', fontFamily: 'monospace', color: '#1d4ed8' }}>{fmt(totalDebit)}</span>
                            <span style={{ flex: 1, textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>{fmt(totalCredit)}</span>
                            <span style={{ width: 24 }}></span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                            <button onClick={addLine}
                                style={{
                                    padding: '4px 8px', background: 'white', border: '1px solid #e2e8f0',
                                    borderRadius: 5, fontSize: 10, cursor: 'pointer', fontWeight: 600
                                }}>
                                <i className="ph ph-plus" style={{ marginRight: 2 }}></i> Line
                            </button>
                            <div style={{ flex: 1 }}></div>
                            {!isBalanced && totalDebit > 0 && (
                                <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>
                                    Off by {fmt(Math.abs(totalDebit - totalCredit))}
                                </span>
                            )}
                            {isBalanced && (
                                <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
                                    <i className="ph ph-check-circle" style={{ marginRight: 2 }}></i> Balanced
                                </span>
                            )}
                            <button onClick={submitEntry} disabled={!isBalanced}
                                style={{
                                    padding: '5px 12px', background: isBalanced ? '#16a34a' : '#94a3b8',
                                    color: 'white', border: 'none', borderRadius: 6, fontSize: 11,
                                    fontWeight: 600, cursor: isBalanced ? 'pointer' : 'not-allowed'
                                }}>
                                <i className="ph ph-check" style={{ marginRight: 3 }}></i> Post
                            </button>
                        </div>

                        {error && (
                            <div style={{
                                marginTop: 6, padding: '5px 8px', background: '#fef2f2',
                                border: '1px solid #fecaca', borderRadius: 5, fontSize: 10, color: '#dc2626'
                            }}>
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* Entries list */}
                {entries.length === 0 && !showForm && (
                    <div style={{ textAlign: 'center', padding: compact ? 20 : 32, color: '#94a3b8', fontSize: 11 }}>
                        <i className="ph ph-notebook" style={{ fontSize: 20, display: 'block', marginBottom: 6 }}></i>
                        No journal entries for this period.
                    </div>
                )}

                {entries.map(entry => (
                    <div key={entry.id} style={{
                        background: 'white', borderRadius: 6, padding: compact ? '8px 10px' : '10px 12px',
                        marginBottom: 6, border: '1px solid #e2e8f0',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                                    background: entry.type === 'AJE' ? '#dbeafe' : entry.type === 'RJE' ? '#fef3c7' : '#f3e8ff',
                                    color: entry.type === 'AJE' ? '#2563eb' : entry.type === 'RJE' ? '#d97706' : '#7c3aed',
                                }}>{entry.type}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>
                                    {entry.description?.length > (compact ? 25 : 40)
                                        ? entry.description.slice(0, compact ? 25 : 40) + '...'
                                        : entry.description}
                                </span>
                            </div>
                            <button onClick={() => deleteEntry(entry.id)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#dc2626', fontSize: 12, padding: '2px 4px', opacity: 0.6,
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                            >
                                <i className="ph ph-trash"></i>
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748b' }}>
                            <span>{entry.date}</span>
                            <span style={{ fontFamily: 'monospace' }}>DR {fmt(entry.totalDebit || 0)}</span>
                            <span style={{ fontFamily: 'monospace' }}>CR {fmt(entry.totalCredit || 0)}</span>
                        </div>
                        {/* Expandable lines — show on hover or click */}
                        {entry.lines && entry.lines.length > 0 && (
                            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                                {entry.lines.map((line, li) => (
                                    <div key={li} style={{
                                        display: 'flex', gap: 4, fontSize: 9, color: '#64748b', padding: '1px 0',
                                    }}>
                                        <span style={{ fontFamily: 'monospace', minWidth: 28, color: '#6366f1', fontWeight: 600 }}>{line.account_code}</span>
                                        <span style={{ flex: 1 }}>{line.account_name}</span>
                                        {(line.debit || 0) > 0 && <span style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>{fmt(line.debit)}</span>}
                                        {(line.credit || 0) > 0 && <span style={{ fontFamily: 'monospace', color: '#dc2626' }}>{fmt(line.credit)}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default AJEFormPanel;
