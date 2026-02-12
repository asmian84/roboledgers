import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { COADropdown } from './components/COADropdown';
import { AuditSidebar } from './components/AuditSidebar';

// Canadian Tax Rates (GST, PST, HST, QST) by Province/Territory
const TAX_RATES = {
    'ON': { total: 13, gst: 0, pst: 0, hst: 13, qst: 0 },       // Ontario
    'BC': { total: 12, gst: 5, pst: 7, hst: 0, qst: 0 },        // British Columbia
    'AB': { total: 5, gst: 5, pst: 0, hst: 0, qst: 0 },         // Alberta
    'QC': { total: 14.975, gst: 5, pst: 0, hst: 0, qst: 9.975 }, // Quebec
    'NS': { total: 15, gst: 0, pst: 0, hst: 15, qst: 0 },       // Nova Scotia
    'NB': { total: 15, gst: 0, pst: 0, hst: 15, qst: 0 },       // New Brunswick
    'MB': { total: 12, gst: 5, pst: 7, hst: 0, qst: 0 },        // Manitoba
    'SK': { total: 11, gst: 5, pst: 6, hst: 0, qst: 0 },        // Saskatchewan
    'PE': { total: 15, gst: 0, pst: 0, hst: 15, qst: 0 },       // Prince Edward Island
    'NL': { total: 15, gst: 0, pst: 0, hst: 15, qst: 0 },       // Newfoundland and Labrador
    'YT': { total: 5, gst: 5, pst: 0, hst: 0, qst: 0 },         // Yukon
    'NT': { total: 5, gst: 5, pst: 0, hst: 0, qst: 0 },         // Northwest Territories
    'NU': { total: 5, gst: 5, pst: 0, hst: 0, qst: 0 }          // Nunavut
};

// Helper: Calculate GST/tax for a transaction amount
function calculateTax(amount, province) {
    if (!amount || !province || !TAX_RATES[province]) return 0;
    return (amount * TAX_RATES[province].total) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID DESIGN TOKENS — SINGLE SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════════════════

// Caseware Professional Themes (matching Caseware naming exactly)
const CASEWARE_THEMES = {
    'vanilla': {
        fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        cellFontSize: '13.5px',
        headerFontSize: '12px',
        rowHeight: 56,
        borderColor: '#f1f5f9',
        hoverBg: '#fefcf3',
        headerBg: '#fffef9',
        headerColor: '#78716c',
        rowBg: '#fffef9',
        rowBgAlt: '#fefce8'
    },
    'classic': {
        fontFamily: 'Arial, Helvetica, sans-serif',
        cellFontSize: '11px',
        headerFontSize: '11px',
        rowHeight: 48,
        borderColor: '#d0d0d0',
        hoverBg: '#e8f4f8',
        headerBg: '#f0f0f0',
        headerColor: '#333333',
        rowBg: '#ffffff',
        rowBgAlt: '#f5f5f5'
    },
    'default': {
        fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        cellFontSize: '13px',
        headerFontSize: '12px',
        rowHeight: 54,
        borderColor: '#e5e7eb',
        hoverBg: '#f9fafb',
        headerBg: '#ffffff',
        headerColor: '#6b7280',
        rowBg: '#ffffff',
        rowBgAlt: '#f9fafb'
    },
    'ledger-pad': {
        fontFamily: '"Courier New", Courier, monospace',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 50,
        borderColor: '#c7d2fe',
        hoverBg: '#eef2ff',
        headerBg: '#e0e7ff',
        headerColor: '#4338ca',
        rowBg: '#ede9fe',
        rowBgAlt: '#f5f3ff'
    },
    'post-it-note': {
        fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 52,
        borderColor: '#fde047',
        hoverBg: '#fef9c3',
        headerBg: '#fef08a',
        headerColor: '#713f12',
        rowBg: '#fefce8',      // Light yellow
        rowBgAlt: '#fffbeb'    // Lighter yellow
    },
    'rainbow': {
        fontFamily: 'Inter, sans-serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 52,
        borderColor: '#e0e0e0',
        hoverBg: '#fce7f3',
        headerBg: '#f3f4f6',
        headerColor: '#374151',
        // Rainbow: cycle through multiple colors instead of just 2
        rowColors: ['#fee2e2', '#fed7aa', '#fef3c7', '#d9f99d', '#bfdbfe', '#ddd6fe', '#fce7f3']  // Red, Orange, Yellow, Green, Blue, Purple, Pink
    },
    'social': {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        cellFontSize: '13px',
        headerFontSize: '12px',
        rowHeight: 56,
        borderColor: '#e4e7eb',
        hoverBg: '#f0f9ff',
        headerBg: '#eff6ff',
        headerColor: '#3b82f6'
    },
    'spectrum': {
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 50,
        borderColor: '#e9d5ff',
        hoverBg: '#faf5ff',
        headerBg: '#f3e8ff',
        headerColor: '#7c3aed'
    },
    'subliminal': {
        fontFamily: 'Georgia, serif',
        cellFontSize: '11.5px',
        headerFontSize: '10.5px',
        rowHeight: 48,
        borderColor: '#f5f5f4',
        hoverBg: '#fafaf9',
        headerBg: '#f5f5f4',
        headerColor: '#78716c'
    },
    'subtle': {
        fontFamily: 'Inter, sans-serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 50,
        borderColor: '#f1f5f9',
        hoverBg: '#f8fafc',
        headerBg: '#f1f5f9',
        headerColor: '#64748b'
    },
    'tracker': {
        fontFamily: '"SF Mono", Monaco, "Cascadia Code", monospace',
        cellFontSize: '11px',
        headerFontSize: '10px',
        rowHeight: 46,
        borderColor: '#22c55e',
        hoverBg: '#f0fdf4',
        headerBg: '#dcfce7',
        headerColor: '#15803d'
    },
    'vintage': {
        fontFamily: '"Times New Roman", Times, serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 50,
        borderColor: '#d4a373',
        hoverBg: '#fef3e2',
        headerBg: '#fde8cc',
        headerColor: '#92400e'
    },
    'wave': {
        fontFamily: '"Trebuchet MS", sans-serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 52,
        borderColor: '#a5f3fc',
        hoverBg: '#cffafe',
        headerBg: '#ecfeff',
        headerColor: '#0e7490'
    },
    'webapp': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        cellFontSize: '13px',
        headerFontSize: '12px',
        rowHeight: 54,
        borderColor: '#e5e5e5',
        hoverBg: '#fafafa',
        headerBg: '#f5f5f5',
        headerColor: '#525252'
    }
};

// Get active theme settings from UI_STATE
function getActiveTheme() {
    const themeName = window.UI_STATE?.gridTheme || 'default';
    return CASEWARE_THEMES[themeName] || CASEWARE_THEMES['default'];
}

// Dynamic GRID_TOKENS - merges defaults with active theme
const GRID_TOKENS_BASE = {
    // Typography - Headers
    headerFontSize: '12px',
    headerFontWeight: 600,
    headerLetterSpacing: '0.04em',
    headerColor: '#6B7280',
    headerHeight: '36px',

    // Typography - Cells
    cellFontSize: '13.5px',
    cellFontWeight: 400,
    cellColor: '#111827',
    cellLineHeight: '1.3',

    // Typography - Description Line 1 (Payee)
    descLine1FontSize: '13.5px',
    descLine1FontWeight: 500,
    descLine1Color: '#111827',

    // Typography - Description Line 2 (Type)
    descLine2FontSize: '12px',
    descLine2FontWeight: 400,
    descLine2Color: '#6B7280',

    // Typography - Numbers
    numberFontSize: '13.5px',
    numberFontWeight: 500,

    // Row Dimensions
    rowHeight: 56, // Comfortable density (px)
    rowPaddingX: '16px',

    // Colors
    debitColor: '#111827',
    creditColor: '#10b981',
    negativeColor: '#ef4444',
    borderColor: '#f1f5f9',
    hoverBg: '#f8fafc',
    rowBg: '#ffffff',        // Even rows
    rowBgAlt: '#ffffff',     // Odd rows (same for default)
    selectedRowBg: '#eff6ff',
};

// Apply theme overrides
function getActiveGridTokens() {
    const theme = getActiveTheme();
    const userFontSize = window.UI_STATE?.gridFontSize;

    return {
        ...GRID_TOKENS_BASE,
        // Theme overrides
        fontFamily: theme.fontFamily,
        cellFontSize: userFontSize ? `${userFontSize}px` : theme.cellFontSize,
        headerFontSize: theme.headerFontSize,
        rowHeight: theme.rowHeight,
        borderColor: theme.borderColor,
        hoverBg: theme.hoverBg,
        headerBg: theme.headerBg,
        headerColor: theme.headerColor,
        // Row background colors (rainbow uses rowColors array, others use rowBg/rowBgAlt)
        rowColors: theme.rowColors,           // Array for rainbow cycling
        rowBg: theme.rowBg,                   // Even rows
        rowBgAlt: theme.rowBgAlt,             // Odd rows
        // Update description line sizes based on cell font size
        descLine1FontSize: userFontSize ? `${userFontSize}px` : theme.cellFontSize,
        descLine2FontSize: userFontSize ? `${Math.max(9, userFontSize - 1.5)}px` : (parseInt(theme.cellFontSize) - 1.5) + 'px',
        numberFontSize: userFontSize ? `${userFontSize}px` : theme.cellFontSize,
    };
}

// Export dynamic tokens (initially default)
let GRID_TOKENS = getActiveGridTokens();

// CRITICAL: Function to force recalculation when theme changes
// Called from TransactionsTable component when props change
window.recalculateGridTokens = function () {
    GRID_TOKENS = getActiveGridTokens();
    console.log('[GRID_TOKENS] Recalculated for theme:', window.UI_STATE?.gridTheme);
    return GRID_TOKENS;
};

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Checkbox({ checked, indeterminate, onChange }) {
    return (
        <input
            type="checkbox"
            checked={checked}
            ref={el => { if (el) el.indeterminate = indeterminate }}
            onChange={onChange}
            className="w-4 h-4 text-[#3b82f6] bg-white border-gray-300 rounded focus:ring-[#3b82f6]"
        />
    );
}

// Two-line Description Cell (Payee + Transaction Type)
function DescriptionCell({ row }) {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState('');
    const inputRef = React.useRef(null);

    const fullDesc = row.payee || row.description || 'No Description';

    let payeeName = fullDesc;
    let transactionType = row.transaction_type_label || '';

    if (fullDesc.includes(',')) {
        const parts = fullDesc.split(',');
        payeeName = parts[0].trim();
        transactionType = parts.slice(1).join(',').trim();
    }

    const handleEdit = () => {
        // Edit the FULL description (both parts combined)
        const fullEditValue = transactionType
            ? `${payeeName}, ${transactionType}`
            : payeeName;
        setEditValue(fullEditValue);
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    const handleSave = () => {
        if (editValue.trim() && editValue !== fullDesc) {
            // Remove leading comma if present
            let cleanedValue = editValue.trim().replace(/^,\s*/, '');

            // Smart comma injection: if description is long and has no comma, add one
            if (!cleanedValue.includes(',') && cleanedValue.length > 35) {
                // Find a natural break point (after first 1-3 words, before 60% of length)
                const words = cleanedValue.split(' ');
                if (words.length >= 2) {
                    // Try to split after first 1-3 words, or at ~40% of length
                    const maxSplitIndex = Math.min(3, Math.floor(words.length / 2));
                    let splitIndex = 1;

                    // Find split point that keeps first part under 40 chars ideally
                    for (let i = 1; i <= maxSplitIndex; i++) {
                        const firstPart = words.slice(0, i).join(' ');
                        if (firstPart.length <= 40) {
                            splitIndex = i;
                        } else {
                            break;
                        }
                    }

                    const firstPart = words.slice(0, splitIndex).join(' ');
                    const secondPart = words.slice(splitIndex).join(' ');

                    if (secondPart) {
                        cleanedValue = `${firstPart}, ${secondPart}`;
                        console.log('[SMART COMMA] Injected:', cleanedValue);
                    }
                }
            }

            // Update in ledger with the full edited description
            if (window.RoboLedger?.Ledger?.updateDescription) {
                window.RoboLedger.Ledger.updateDescription(row.tx_id, cleanedValue);
            }
            // Trigger workspace refresh
            if (window.updateWorkspace) {
                window.updateWorkspace();
            }
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex flex-col overflow-hidden" style={{ gap: '2px' }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="w-full px-1 py-0.5 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    style={{
                        fontSize: GRID_TOKENS.descLine1FontSize,
                        fontWeight: GRID_TOKENS.descLine1FontWeight,
                        color: GRID_TOKENS.descLine1Color,
                        lineHeight: GRID_TOKENS.cellLineHeight
                    }}
                />
                {transactionType && (
                    <span
                        style={{
                            fontSize: GRID_TOKENS.descLine2FontSize,
                            fontWeight: GRID_TOKENS.descLine2FontWeight,
                            color: GRID_TOKENS.descLine2Color,
                            lineHeight: GRID_TOKENS.cellLineHeight,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {transactionType}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col overflow-hidden group" style={{ gap: '2px' }}>
            <div className="flex items-center justify-between gap-2">
                <span
                    style={{
                        fontSize: GRID_TOKENS.descLine1FontSize,
                        fontWeight: GRID_TOKENS.descLine1FontWeight,
                        color: GRID_TOKENS.descLine1Color,
                        lineHeight: GRID_TOKENS.cellLineHeight,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        wordBreak: 'break-word',
                        flex: 1,
                        minWidth: 0
                    }}
                >
                    {payeeName}
                </span>
                {/* Icons container - far right */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ flexShrink: 0 }}>
                    {/* Pencil icon for edit mode */}
                    <i
                        className="ph ph-pencil-simple cursor-pointer hover:text-blue-500"
                        onClick={handleEdit}
                        style={{
                            fontSize: '16px',
                            color: '#64748b'
                        }}
                        title="Edit description"
                    />
                    {/* Link icon for audit sidebar */}
                    <i
                        className="ph ph-link cursor-pointer hover:text-blue-500"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.openAuditSidebar) {
                                window.openAuditSidebar(row);
                            }
                        }}
                        style={{
                            fontSize: '16px',
                            color: '#64748b'
                        }}
                        title="View audit trail"
                    />
                </div>
            </div>
            {transactionType && (
                <span
                    style={{
                        fontSize: GRID_TOKENS.descLine2FontSize,
                        fontWeight: GRID_TOKENS.descLine2FontWeight,
                        color: GRID_TOKENS.descLine2Color,
                        lineHeight: GRID_TOKENS.cellLineHeight,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                >
                    {transactionType}
                </span>
            )}
        </div>
    );
}

// Number formatting helper
function formatCurrency(value) {
    if (!value && value !== 0) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN DEFINITIONS — PROPER ORDER
// ═══════════════════════════════════════════════════════════════════════════

const columnHelper = createColumnHelper();

const columns = [
    // 1. Checkbox
    columnHelper.display({
        id: 'select',
        size: 50,
        enableResizing: false,
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllPageRowsSelected()}
                indeterminate={table.getIsSomePageRowsSelected()}
                onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                indeterminate={row.getIsSomeSelected()}
                onChange={row.getToggleSelectedHandler()}
            />
        ),
    }),

    // 2. Ref # (e.g., CHQ1-001) - VISUAL COUNTER (resets based on view)
    columnHelper.display({
        id: 'ref',
        header: 'REF #',
        size: 90,
        minSize: 80,
        maxSize: 110,
        cell: info => {
            const row = info.row.original;
            const account = window.RoboLedger?.Accounts?.get(row.account_id);
            const prefix = account?.ref || 'TXN';
            // Get position in SORTED/FILTERED array (not original data index)
            const sortedRows = info.table.getRowModel().rows;
            const sortedIndex = sortedRows.findIndex(r => r.id === info.row.id);
            const counter = String(sortedIndex + 1).padStart(3, '0');
            return (
                <span
                    style={{
                        fontSize: GRID_TOKENS.cellFontSize,
                        fontWeight: GRID_TOKENS.cellFontWeight,
                        color: GRID_TOKENS.cellColor,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        paddingRight: '6px'
                    }}
                >
                    {`${prefix}-${counter}`}
                </span>
            );
        }
    }),

    // 3. Date
    columnHelper.accessor('date', {
        header: 'DATE',
        size: 95,
        minSize: 90,
        maxSize: 105,
        cell: info => (
            <span
                style={{
                    fontSize: GRID_TOKENS.cellFontSize,
                    fontWeight: GRID_TOKENS.cellFontWeight,
                    color: GRID_TOKENS.cellColor,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    paddingRight: '6px'
                }}
            >
                {info.getValue()}
            </span>
        )
    }),

    // 4. Description (Two-line cell - Flex) - Sortable by payee
    columnHelper.accessor('payee', {
        id: 'description',
        header: 'DESCRIPTION',
        minSize: 250,
        size: 400,
        cell: ({ row }) => <DescriptionCell row={row.original} />
    }),

    // 5. Debit
    columnHelper.accessor('debit', {
        header: 'DEBIT',
        size: 85,
        minSize: 75,
        maxSize: 100,
        cell: info => {
            const val = info.getValue();
            const row = info.row.original;
            // Get account to determine type
            const account = window.RoboLedger?.Accounts?.get(row.account_id);
            const isLiability = (account?.accountType || '').toLowerCase() === 'creditcard' ||
                account?.type === 'liability' || account?.type === 'creditcard';
            // Liabilities: debit=green (payment reduces debt), Assets: debit=red (withdrawal reduces balance)
            const debitColor = isLiability ? '#10b981' : '#ef4444';
            return (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: debitColor,
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {formatCurrency(val)}
                </span>
            );
        }
    }),

    // 6. Credit
    columnHelper.accessor('credit', {
        header: 'CREDIT',
        size: 85,
        minSize: 75,
        maxSize: 100,
        cell: info => {
            const val = info.getValue();
            const row = info.row.original;
            // Get account to determine type
            const account = window.RoboLedger?.Accounts?.get(row.account_id);
            const isLiability = (account?.accountType || '').toLowerCase() === 'creditcard' ||
                account?.type === 'liability' || account?.type === 'creditcard';
            // Liabilities: credit=red (purchase increases debt), Assets: credit=green (deposit increases balance)
            const creditColor = isLiability ? '#ef4444' : '#10b981';
            return (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: creditColor,
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {formatCurrency(val)}
                </span>
            );
        }
    }),

    //7. Account (COA Dropdown)
    columnHelper.accessor('category', {
        header: 'ACCOUNT',
        size: 140,
        minSize: 130,
        maxSize: 180,
        cell: ({ row }) => {
            const handleUpdateCategory = (code) => {
                const txId = row.original.tx_id;

                // Update in ledger
                if (window.RoboLedger?.Ledger?.updateCategory) {
                    window.RoboLedger.Ledger.updateCategory(txId, code);
                }

                // Trigger workspace refresh
                if (window.updateWorkspace) {
                    window.updateWorkspace();
                }
            };

            return (
                <div style={{ paddingRight: '6px' }}>
                    <COADropdown
                        value={row.original.category || ''}
                        onChange={handleUpdateCategory}
                        txId={row.original.tx_id}
                    />
                </div>
            );
        }
    }),

    // 8. Balance (DYNAMIC CALCULATION - updates based on sort order)
    columnHelper.display({
        id: 'balance',
        header: 'BALANCE',
        size: 95,
        minSize: 85,
        maxSize: 110,
        cell: info => {
            // Get the sorted rows to calculate running balance
            const sortedRows = info.table.getRowModel().rows;
            const currentRowIndex = sortedRows.findIndex(r => r.id === info.row.id);

            // Get opening balance and account type
            const firstRow = sortedRows[0]?.original;
            const account = window.RoboLedger?.Accounts?.get(firstRow?.account_id);
            const openingBalance = account?.openingBalance || 0;
            const isLiability = (account?.accountType || '').toLowerCase() === 'creditcard' ||
                account?.type === 'liability' || account?.type === 'creditcard';

            // Calculate running balance from opening balance through current row
            let runningBalance = openingBalance;
            for (let i = 0; i <= currentRowIndex; i++) {
                const row = sortedRows[i].original;
                const debit = row.debit || 0;
                const credit = row.credit || 0;

                if (isLiability) {
                    // Liability: debits decrease debt (payments), credits increase debt (purchases)
                    runningBalance = runningBalance - debit + credit;
                } else {
                    // Asset: debits decrease balance (withdrawals), credits increase balance (deposits)
                    runningBalance = runningBalance - debit + credit;
                }
            }

            return (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: runningBalance < 0 ? GRID_TOKENS.negativeColor : GRID_TOKENS.cellColor,
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {formatCurrency(runningBalance)}
                </span>
            );
        }
    }),

    // Optional: Sales Tax (GST/HST)
    columnHelper.accessor('tax_cents', {
        header: 'GST/HST',
        size: 75,
        minSize: 70,
        maxSize: 100,
        cell: info => {
            const val = info.getValue();
            const row = info.row.original;

            // Auto-calculate tax if column is visible and province set
            let displayValue = val;
            if (!val || val === 0) {
                const province = window.UI_STATE?.province;
                const amount = row.debit || row.credit || 0;
                if (province && amount) {
                    const calculatedTax = calculateTax(amount, province);
                    displayValue = calculatedTax;
                }
            }

            return (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.cellFontSize,
                        fontWeight: GRID_TOKENS.cellFontWeight,
                        color: GRID_TOKENS.descLine2Color,
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {displayValue ? `$${displayValue.toFixed(2)}` : '-'}
                </span>
            );
        }
    }),
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function TransactionsTable({
    data: initialData,
    globalFilter: initialGlobalFilter,
    gridTheme = 'default',
    gridFontSize = 13.5,
    gridDensity = 'comfortable',
    columnVisibility: initialColumnVisibility = { tax_cents: false }
}) {
    // CRITICAL: Update UI_STATE with new theme values
    if (window.UI_STATE) {
        window.UI_STATE.gridTheme = gridTheme;
        window.UI_STATE.gridFontSize = gridFontSize;
        window.UI_STATE.gridDensity = gridDensity;
    }

    // Force GRID_TOKENS recalculation (module-level variable gets updated)
    if (window.recalculateGridTokens) {
        window.recalculateGridTokens();
    }

    // Apply density-based rowHeight override
    const DENSITY_ROW_HEIGHTS = {
        'compact': 42,
        'comfortable': 56,
        'spacious': 68
    };
    if (DENSITY_ROW_HEIGHTS[gridDensity]) {
        GRID_TOKENS.rowHeight = DENSITY_ROW_HEIGHTS[gridDensity];
    }

    console.log('[TRANSACTIONS_TABLE] Rendering with theme:', gridTheme, 'fontSize:', gridFontSize, 'density:', gridDensity, 'rowHeight:', GRID_TOKENS.rowHeight);


    const [data, setData] = useState(initialData || []);
    const [sorting, setSorting] = useState([{ id: 'date', desc: true }]);
    const [columnVisibility, setColumnVisibility] = useState(initialColumnVisibility); // Use prop or default
    const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter || '');
    const [rowSelection, setRowSelection] = useState({});
    const [density] = useState('comfortable'); // Fixed at comfortable for now

    // EXPERIMENTAL: Audit sidebar state
    const [auditSidebarOpen, setAuditSidebarOpen] = useState(false);
    const [selectedAuditTransaction, setSelectedAuditTransaction] = useState(null);

    // SYNC: Update data when prop changes (for account switching)
    useEffect(() => {
        setData(initialData || []);
    }, [initialData]);

    // SYNC: Update globalFilter when search query changes (for live search)
    useEffect(() => {
        setGlobalFilter(initialGlobalFilter || '');
    }, [initialGlobalFilter]);

    // Expose column visibility control to window (for settings drawer)
    useEffect(() => {
        window.setGridColumnVisibility = (columnId, visible) => {
            setColumnVisibility(prev => ({
                ...prev,
                [columnId]: !visible // TanStack uses inverted logic
            }));
        };

        // EXPERIMENTAL: Expose audit sidebar function
        window.openAuditSidebar = (row) => {
            // Smart scroll logic: Only scroll if reconciliation/metadata bars would obscure view
            const gridContainer = parentRef.current;
            if (gridContainer) {
                const scrollTop = gridContainer.scrollTop;

                // Height of reconciliation bar + metadata area (approximate)
                const topBarHeight = 280; // Adjust if needed based on your UI

                // Only scroll down if:
                // 1. We're near the top (scrollTop < topBarHeight)
                // 2. AND this would help reveal the transaction row
                if (scrollTop < topBarHeight) {
                    // Scroll just enough to hide the top bars
                    gridContainer.scrollTo({
                        top: topBarHeight,
                        behavior: 'smooth'
                    });
                }
                // Otherwise, don't scroll - the transaction is already visible
            }

            setSelectedAuditTransaction(row);
            setAuditSidebarOpen(true);
        };

        return () => {
            delete window.setGridColumnVisibility;
            delete window.openAuditSidebar;
        };
    }, []);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
            columnVisibility,
            rowSelection,
        },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        columnResizeMode: 'onChange',
        enableRowSelection: true,
    });

    const parentRef = useRef(null);

    const rowVirtualizer = useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => GRID_TOKENS.rowHeight,
        overscan: 15,
    });

    // Sticky column helper
    const getStickyClass = (id) => {
        if (id === 'select' || id === 'ref') return 'sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]';
        if (id === 'balance') return 'sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]';
        return '';
    };

    return (
        <div className="flex flex-col h-full w-full bg-white relative" style={{ transform: 'scale(0.96)', transformOrigin: 'top left' }}>
            {/* Batch Action Bar */}
            {Object.keys(rowSelection).length > 0 && (
                <div className="flex items-center px-6 py-3 bg-blue-50 border-b border-blue-100 z-30">
                    <span className="text-sm font-bold text-blue-900">{Object.keys(rowSelection).length} selected</span>
                    <div className="ml-auto flex items-center gap-2">
                        <button className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">Categorize</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">Match</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded hover:bg-red-50">Delete</button>
                        <button onClick={() => setRowSelection({})} className="ml-2 p-1.5 text-gray-500 hover:text-gray-700">
                            <i className="ph ph-x text-sm"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Grid Header */}
            <div className="flex bg-[#f8fafc] border-b border-[#e2e8f0] sticky top-0 z-20">
                {table.getFlatHeaders().map(header => (
                    <div
                        key={header.id}
                        className={`relative flex items-center group select-none ${getStickyClass(header.id)} ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                        style={{
                            width: header.id === 'description' ? undefined : header.getSize(),
                            flex: header.id === 'description' ? '1 1 0' : undefined,
                            minWidth: header.id === 'description' ? '250px' : undefined,
                            flexShrink: 0,
                            height: GRID_TOKENS.headerHeight,
                            padding: `0 ${GRID_TOKENS.rowPaddingX}`,
                            fontSize: GRID_TOKENS.headerFontSize,
                            fontWeight: GRID_TOKENS.headerFontWeight,
                            letterSpacing: GRID_TOKENS.headerLetterSpacing,
                            color: GRID_TOKENS.headerColor,
                            textTransform: 'uppercase'
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                    >
                        <div className="flex items-center gap-2 truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                                asc: <i className="ph ph-caret-up text-[#3b82f6]"></i>,
                                desc: <i className="ph ph-caret-down text-[#3b82f6]"></i>,
                            }[header.column.getIsSorted()] ?? null}
                        </div>
                        {header.column.getCanResize() && (
                            <div
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                className={`absolute right-0 top-0 h-full w-1 bg-[#3b82f6] opacity-0 group-hover:opacity-100 cursor-col-resize z-30 transition-opacity ${header.column.getIsResizing() ? 'opacity-100' : ''}`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Virtualized Body */}
            <div
                ref={parentRef}
                className="flex-1 overflow-auto bg-white"
                style={{ scrollbarGutter: 'stable' }}
            >
                {data.length > 0 ? (
                    <div
                        className="relative w-full"
                        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                    >
                        {rowVirtualizer.getVirtualItems().map(virtualRow => {
                            const row = table.getRowModel().rows[virtualRow.index];
                            const isSelected = row.getIsSelected();

                            // Determine row background color from theme
                            const rowIndex = virtualRow.index;
                            let rowBg;
                            if (isSelected) {
                                rowBg = GRID_TOKENS.selectedRowBg || '#eff6ff';
                            } else if (GRID_TOKENS.rowColors && Array.isArray(GRID_TOKENS.rowColors)) {
                                // Rainbow mode: cycle through color palette
                                rowBg = GRID_TOKENS.rowColors[rowIndex % GRID_TOKENS.rowColors.length];
                            } else {
                                // Standard alternating (2 colors)
                                rowBg = rowIndex % 2 === 0 ? GRID_TOKENS.rowBg : GRID_TOKENS.rowBgAlt;
                            }
                            const hoverBg = GRID_TOKENS.hoverBg || '#f8fafc';

                            return (
                                <div
                                    key={row.id}
                                    className="flex absolute top-0 left-0 w-full transition-colors group"
                                    style={{
                                        height: `${GRID_TOKENS.rowHeight}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                        borderBottom: `1px solid ${GRID_TOKENS.borderColor}`,
                                        backgroundColor: rowBg
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBg}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <div
                                            key={cell.id}
                                            className={`flex items-center ${cell.column.id === 'category' ? 'overflow-visible' : 'overflow-hidden'} ${getStickyClass(cell.column.id)}`}
                                            style={{
                                                width: cell.column.id === 'description' ? undefined : cell.column.getSize(),
                                                flex: cell.column.id === 'description' ? '1 1 0' : undefined,
                                                minWidth: cell.column.id === 'description' ? '250px' : undefined,
                                                flexShrink: 0,
                                                padding: `0 ${GRID_TOKENS.rowPaddingX}`,
                                                borderRight: `1px solid ${GRID_TOKENS.borderColor}`,
                                                position: cell.column.id === 'category' ? 'relative' : undefined
                                            }}
                                        >
                                            <div className="w-full">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-20">
                        <i className="ph ph-database text-[#cbd5e1] text-[64px] mb-4"></i>
                        <h3 className="text-[16px] font-semibold text-[#64748b] mb-2">No transactions found</h3>
                        <p className="text-[13px] text-[#94a3b8]">Import a bank statement to get started</p>
                    </div>
                )}
            </div>

            {/* EXPERIMENTAL: Audit Sidebar */}
            <AuditSidebar
                isOpen={auditSidebarOpen}
                onClose={() => {
                    setAuditSidebarOpen(false);
                    setSelectedAuditTransaction(null);
                }}
                transaction={selectedAuditTransaction}
            />
        </div>
    );
}
