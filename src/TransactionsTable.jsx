import React, { useEffect, useState, useMemo, useRef } from 'react';
import { UNCATEGORIZED_CODE } from './constants/accounts.js';
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
import { CategoryDropdown } from './components/CategoryDropdown';
import { AuditSidebar } from './components/AuditSidebar';
import { FilterToolbar } from './components/FilterToolbar';
import { LiveReportPanel } from './components/LiveReportPanel';
import { ResizablePanel } from './components/ResizablePanel';
import { UtilityBar } from './components/UtilityBar';

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
        hoverBg: '#fef08a',        // Darker yellow on hover
        headerBg: '#fef08a',
        headerColor: '#713f12',
        rowBg: '#fef9c3',          // Visible yellow (same as old hover)
        rowBgAlt: '#fefce8'        // Slightly lighter yellow
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
        hoverBg: '#dbeafe',
        headerBg: '#eff6ff',
        headerColor: '#3b82f6',
        rowBg: '#f0f9ff',
        rowBgAlt: '#e0f2fe'
    },
    'spectrum': {
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 50,
        borderColor: '#e9d5ff',
        hoverBg: '#ede9fe',
        headerBg: '#f3e8ff',
        headerColor: '#7c3aed',
        rowBg: '#faf5ff',
        rowBgAlt: '#f3e8ff'
    },
    'subliminal': {
        fontFamily: 'Georgia, serif',
        cellFontSize: '11.5px',
        headerFontSize: '10.5px',
        rowHeight: 48,
        borderColor: '#e7e5e4',
        hoverBg: '#f5f5f4',
        headerBg: '#e7e5e4',
        headerColor: '#44403c',
        rowBg: '#fafaf9',
        rowBgAlt: '#f5f5f4'
    },
    'subtle': {
        fontFamily: 'Inter, sans-serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 50,
        borderColor: '#e2e8f0',
        hoverBg: '#e2e8f0',
        headerBg: '#f1f5f9',
        headerColor: '#64748b',
        rowBg: '#ffffff',
        rowBgAlt: '#f1f5f9'
    },
    'tracker': {
        fontFamily: '"SF Mono", Monaco, "Cascadia Code", monospace',
        cellFontSize: '11px',
        headerFontSize: '10px',
        rowHeight: 46,
        borderColor: '#86efac',
        hoverBg: '#bbf7d0',
        headerBg: '#dcfce7',
        headerColor: '#15803d',
        rowBg: '#f0fdf4',
        rowBgAlt: '#dcfce7'
    },
    'vintage': {
        fontFamily: '"Times New Roman", Times, serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 50,
        borderColor: '#d4a373',
        hoverBg: '#fde8cc',
        headerBg: '#fde8cc',
        headerColor: '#92400e',
        rowBg: '#fff8f0',
        rowBgAlt: '#fef3e2'
    },
    'wave': {
        fontFamily: '"Trebuchet MS", sans-serif',
        cellFontSize: '12px',
        headerFontSize: '11px',
        rowHeight: 52,
        borderColor: '#67e8f9',
        hoverBg: '#a5f3fc',
        headerBg: '#cffafe',
        headerColor: '#0e7490',
        rowBg: '#ecfeff',
        rowBgAlt: '#cffafe'
    },
    'webapp': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        cellFontSize: '13px',
        headerFontSize: '12px',
        rowHeight: 54,
        borderColor: '#e5e5e5',
        hoverBg: '#e5e5e5',
        headerBg: '#f5f5f5',
        headerColor: '#525252',
        rowBg: '#ffffff',
        rowBgAlt: '#f5f5f5'
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
    headerFontSize: '11px',
    headerFontWeight: 600,
    headerLetterSpacing: '0.06em',
    headerColor: '#94a3b8',
    headerHeight: '36px',

    // Typography - Cells
    cellFontSize: '13px',
    cellFontWeight: 400,
    cellColor: '#1e293b',
    cellLineHeight: '1.4',

    // Typography - Description Line 1 (Payee)
    descLine1FontSize: '13px',
    descLine1FontWeight: 550,
    descLine1Color: '#0f172a',

    // Typography - Description Line 2 (Type/Memo)
    descLine2FontSize: '11.5px',
    descLine2FontWeight: 400,
    descLine2Color: '#94a3b8',

    // Typography - Numbers
    numberFontSize: '13px',
    numberFontWeight: 550,

    // Row Dimensions
    rowHeight: 52, // Comfortable but not bloated
    rowPaddingX: '6px',

    // Colors
    debitColor: '#1e293b',
    creditColor: '#059669',
    negativeColor: '#dc2626',
    borderColor: '#f1f5f9',
    hoverBg: '#f8fafc',
    rowBg: '#ffffff',        // Even rows
    rowBgAlt: '#fafbfc',    // Subtle alternating
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
    window.GRID_TOKENS = GRID_TOKENS; // Expose for debugging
    return GRID_TOKENS;
};

// Expose initial tokens
window.GRID_TOKENS = GRID_TOKENS;

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
    // Fix negative zero: -0.00 should display as 0.00
    const displayValue = Object.is(value, -0) || value === 0 ? 0 : value;
    return `$${displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Text Filter (for Description, Ref#)
function TextFilter({ column }) {
    const value = column.getFilterValue() || '';
    const [localValue, setLocalValue] = useState(value);

    // Debounce filter updates
    useEffect(() => {
        const timeout = setTimeout(() => {
            column.setFilterValue(localValue || undefined);
        }, 300);
        return () => clearTimeout(timeout);
    }, [localValue, column]);

    return (
        <input
            type="text"
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            placeholder="Filter..."
            style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: '11px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                outline: 'none',
            }}
        />
    );
}

// Category Filter (Dropdown)
function CategoryFilter({ column }) {
    const value = column.getFilterValue() || '';

    // Get unique categories from window.RoboLedger
    const categories = useMemo(() => {
        const coa = window.RoboLedger?.COA?.getAll() || [];
        return coa.map(c => ({ code: c.code, name: c.name }));
    }, []);

    return (
        <select
            value={value}
            onChange={e => column.setFilterValue(e.target.value || undefined)}
            style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: '11px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                outline: 'none',
                background: 'white'
            }}
        >
            <option value="">All</option>
            <option value="UNCATEGORIZED">Uncategorized</option>
            {categories.filter(cat => cat.code !== UNCATEGORIZED_CODE).map(cat => (
                <option key={cat.code} value={cat.code}>{cat.name}</option>
            ))}
        </select>
    );
}

// Amount Filter (supports >, <, =, range)
function AmountFilter({ column }) {
    const value = column.getFilterValue() || '';
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        const timeout = setTimeout(() => {
            column.setFilterValue(localValue || undefined);
        }, 300);
        return () => clearTimeout(timeout);
    }, [localValue, column]);

    return (
        <input
            type="text"
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            placeholder=">100"
            style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: '11px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                outline: 'none',
            }}
        />
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN DEFINITIONS — PROPER ORDER
// ═══════════════════════════════════════════════════════════════════════════

const columnHelper = createColumnHelper();

const columns = [
    // 1. Checkbox
    columnHelper.display({
        id: 'select',
        size: 44,  // Optimized proportion (~10% of min grid width)
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
                        whiteSpace: 'nowrap'
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
        enableColumnFilter: true,
        filterFn: 'includesString',
        cell: info => (
            <span
                style={{
                    fontSize: GRID_TOKENS.cellFontSize,
                    fontWeight: GRID_TOKENS.cellFontWeight,
                    color: GRID_TOKENS.cellColor,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap'
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
        enableColumnFilter: true,
        filterFn: 'includesString',
        cell: ({ row }) => <DescriptionCell row={row.original} />
    }),

    // 5. Debit
    // ASSET accounts  (chq/sav):   DEBIT = money OUT  → red
    // LIABILITY accounts (CC):     DEBIT = payment IN → reduces debt → green
    //   Accounting convention for liability: purchases flow to CREDIT side, payments to DEBIT side.
    //   Raw parsers store CC purchases as polarity=DEBIT (bank-statement perspective).
    //   We flip the display: for CC accounts, raw DEBIT (purchase) shows in Credit column; raw CREDIT (payment) shows in Debit column.
    columnHelper.display({
        id: 'debit',
        header: 'DEBIT',
        size: 105,
        minSize: 90,
        maxSize: 130,
        cell: info => {
            const row = info.row.original;
            const account = window.RoboLedger?.Accounts?.get(row.account_id);
            const isLiability = (account?.accountType || '').toLowerCase() === 'creditcard' ||
                account?.type === 'liability' || account?.type === 'creditcard';

            // For LIABILITY: Debit column shows raw CREDIT amounts (payment reducing liability = DR the liability)
            // For ASSET:     Debit column shows raw DEBIT amounts (money out)
            const val = isLiability ? (row.credit || 0) : (row.debit || 0);

            // Color: payment/debit on liability is GREEN (reduces what you owe), withdrawal on asset is RED
            const color = isLiability ? '#10b981' : '#ef4444';

            return val ? (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: color,
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {formatCurrency(val)}
                </span>
            ) : <span className="text-right block" style={{ color: '#cbd5e1' }}>—</span>;
        }
    }),

    // 6. Credit
    // ASSET accounts  (chq/sav):   CREDIT = money IN  → green
    // LIABILITY accounts (CC):     CREDIT = purchase  → increases debt → red
    columnHelper.display({
        id: 'credit',
        header: 'CREDIT',
        size: 105,
        minSize: 90,
        maxSize: 130,
        cell: info => {
            const row = info.row.original;
            const account = window.RoboLedger?.Accounts?.get(row.account_id);
            const isLiability = (account?.accountType || '').toLowerCase() === 'creditcard' ||
                account?.type === 'liability' || account?.type === 'creditcard';

            // For LIABILITY: Credit column shows raw DEBIT amounts (purchase increasing liability = CR the liability)
            // For ASSET:     Credit column shows raw CREDIT amounts (money in)
            const val = isLiability ? (row.debit || 0) : (row.credit || 0);

            // Color: purchase/credit on liability is RED (you owe more), deposit on asset is GREEN
            const color = isLiability ? '#ef4444' : '#10b981';

            return val ? (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: color,
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {formatCurrency(val)}
                </span>
            ) : <span className="text-right block" style={{ color: '#cbd5e1' }}>—</span>;
        }
    }),

    //7. Account (COA Dropdown)
    columnHelper.accessor('category', {
        header: 'ACCOUNT',
        size: 320,
        minSize: 250,
        maxSize: 450,
        enableColumnFilter: true,
        filterFn: (row, columnId, filterValue) => {
            const categoryValue = row.getValue(columnId);

            // Special case: "UNCATEGORIZED" should match what COADropdown displays as "Uncategorized"
            // COADropdown shows "Uncategorized" when: !currentAccount (code not found in COA list OR empty/null)
            if (filterValue === 'UNCATEGORIZED') {
                if (!categoryValue || categoryValue === '' || categoryValue === 'Uncategorized') {
                    return true; // Empty/null category
                }
                // Also check if the code exists in COA - if not, it shows as "Uncategorized"
                const coaAccounts = window.RoboLedger?.COA?.getAll() || [];
                const accountExists = coaAccounts.some(acc => acc.code === categoryValue);
                return !accountExists; // If code doesn't exist in COA, it displays as "Uncategorized"
            }

            // Otherwise exact match by code
            return categoryValue === filterValue;
        },
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
                <COADropdown
                    value={row.original.category || ''}
                    onChange={handleUpdateCategory}
                    txId={row.original.tx_id}
                />
            );
        }
    }),

    // 8. Balance (DYNAMIC CALCULATION - updates based on sort order)
    columnHelper.display({
        id: 'balance',
        header: 'BALANCE',
        size: 110,  // Wide enough for large balances e.g. $12,345.67
        minSize: 100,
        maxSize: 140,
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
        size: 80,
        minSize: 70,
        maxSize: 100,
        cell: info => {
            const val = info.getValue();
            const row = info.row.original;

            // No GST on financial / pass-through transactions:
            //   CC payments, bank transfers, interest income/expense, refunds, cash back,
            //   dividends, insurance, payroll, e-transfer rounded amounts, inter-bank
            const noGSTCategories = ['9971', '9970', '7700', '7000', '4900', '4800', '8100'];
            const desc = (row.raw_description || row.payee || '').toUpperCase();
            const amount = row.debit || row.credit || 0;
            // Rounded amount heuristic: amounts like $1500.00, $250.00 — no cents → likely non-taxable
            const isRoundedAmount = amount > 0 && amount % 100 === 0 && amount >= 5000; // >= $50.00, no cents
            const isFinancialTx = /\bPAYMENT\b|\bINTEREST\b|\bTRANSFER\b|\bCASH\s*BACK\b|\bREFUND\b|\bREBATE\b|\bDIVIDEND\b|\bINSURANCE\b|\bPAYROLL\b|\bSALARY\b|\bWAGE\b|\bT4\b/.test(desc)
                || noGSTCategories.includes(row.category)
                || (row._isCCPayment)
                || (row._isCashBack)
                || (row._isBankRebate)
                || (row.transaction_type_label || '').includes('e-transfer') && isRoundedAmount;

            if (isFinancialTx) {
                return <span className="text-right block" style={{ color: '#cbd5e1', fontSize: GRID_TOKENS.numberFontSize }}>—</span>;
            }

            // Auto-calculate tax if not already stored
            let displayValue = val;
            if (!val || val === 0) {
                const province = window.UI_STATE?.province || 'AB';
                const amount = row.debit || row.credit || 0;
                if (province && amount) {
                    displayValue = calculateTax(amount, province);
                }
            }

            return (
                <span
                    className="text-right block font-mono"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: '#64748b',
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {displayValue ? `$${(displayValue / 100).toFixed(2)}` : '—'}
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
    columnVisibility: initialColumnVisibility = { tax_cents: false },
    initialCategoryFilter = null,   // Persisted drill-down filter (category COA code)
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
    const rowHeights = {
        compact: 36,      // 20% reduction
        comfortable: 42,  // Sweet spot (Caseware-standard)
        spacious: 56      // Balanced spacing
    };
    if (rowHeights[gridDensity]) {
        GRID_TOKENS.rowHeight = rowHeights[gridDensity];
    }

    const [data, setData] = useState(initialData || []);
    const [sorting, setSorting] = useState([{ id: 'date', desc: true }]);
    const [columnVisibility, setColumnVisibility] = useState(initialColumnVisibility); // Use prop or default
    const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter || '');
    const [rowSelection, setRowSelection] = useState({});
    const [density] = useState('comfortable'); // Fixed at comfortable for now

    // INLINE FILTERS: State for column-specific filters
    // Initialise from persisted drill-down filter if provided (survives re-renders)
    const [columnFilters, setColumnFilters] = useState(
        initialCategoryFilter ? [{ id: 'category', value: initialCategoryFilter }] : []
    );
    const [showFilters, setShowFilters] = useState(false);

    // EXPERIMENTAL: Audit sidebar state
    const [auditSidebarOpen, setAuditSidebarOpen] = useState(false);
    const [selectedAuditTransaction, setSelectedAuditTransaction] = useState(null);

    // PANEL SYSTEM: Tab-based side panel
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'trial-balance'

    // SYNC: Update data when prop changes (for account switching)
    useEffect(() => {
        setData(initialData || []);
    }, [initialData]);

    // SYNC: Update globalFilter when search query changes (for live search)
    useEffect(() => {
        setGlobalFilter(initialGlobalFilter || '');
    }, [initialGlobalFilter]);

    // DETAIL MODE: Sidebar collapse detection
    useEffect(() => {
        const handleSidebarCollapse = (e) => {
            const isCollapsed = e.detail?.isCollapsed ?? false;

            if (isCollapsed) {
                // DETAIL MODE ON: Open panel with dashboard tab + scroll to top
                setIsPanelOpen(true);
                setActiveTab('dashboard');
                if (parentRef.current) {
                    parentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else {
                // DETAIL MODE OFF: Close panel
                setIsPanelOpen(false);
            }
        };

        window.addEventListener('sidebarCollapsed', handleSidebarCollapse);
        return () => window.removeEventListener('sidebarCollapsed', handleSidebarCollapse);
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // BATCH ACTION HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Auto-categorize selected transactions using RuleEngine
     */
    const [bulkCOA, setBulkCOA] = useState('');
    const [showBulkCOAPicker, setShowBulkCOAPicker] = useState(false);
    const [showBulkRename, setShowBulkRename] = useState(false);
    const [bulkRenameValue, setBulkRenameValue] = useState('');

    const getSelectedTxs = () =>
        Object.keys(rowSelection)
            .map(id => window.RoboLedger?.Ledger?.get(id))
            .filter(Boolean);

    const handleBulkCategorize = () => {
        const selectedTxIds = Object.keys(rowSelection);
        if (selectedTxIds.length === 0) return;
        const selectedTxs = getSelectedTxs();
        if (selectedTxs.length === 0) return alert('No valid transactions selected');

        // Use RuleEngine to auto-categorize
        const results = window.RoboLedger?.RuleEngine?.bulkCategorize(selectedTxs);
        if (results) {
            if (window.showToast) window.showToast(`✅ Categorized ${results.categorized}/${selectedTxs.length} transactions`, 'success');
            setRowSelection({});
            setData([...(window.RoboLedger?.Ledger?.getAll() || data)]);
            if (window.updateWorkspace) window.updateWorkspace();
        } else {
            alert('Bulk categorization failed — RuleEngine not available');
        }
    };

    const handleBulkSetCOA = (code) => {
        if (!code) return;
        const selectedTxs = getSelectedTxs();
        let updated = 0;
        selectedTxs.forEach(tx => {
            if (window.RoboLedger?.Ledger?.updateCategory) {
                window.RoboLedger.Ledger.updateCategory(tx.tx_id, code);
                updated++;
            }
        });
        const coaName = window.RoboLedger?.COA?.get(code)?.name || code;
        if (window.showToast) window.showToast(`✅ Set ${updated} transactions → ${coaName}`, 'success');
        setShowBulkCOAPicker(false);
        setBulkCOA('');
        setRowSelection({});
        setData([...(window.RoboLedger?.Ledger?.getAll() || data)]);
        if (window.updateWorkspace) window.updateWorkspace();
    };

    const handleBulkRename = () => {
        if (!bulkRenameValue.trim()) return;
        const selectedTxs = getSelectedTxs();
        let updated = 0;
        selectedTxs.forEach(tx => {
            if (window.RoboLedger?.Ledger?.update) {
                window.RoboLedger.Ledger.update(tx.tx_id, { payee: bulkRenameValue.trim(), raw_description: bulkRenameValue.trim() });
                updated++;
            }
        });
        if (window.showToast) window.showToast(`✅ Renamed ${updated} transactions`, 'success');
        setShowBulkRename(false);
        setBulkRenameValue('');
        setRowSelection({});
        setData([...(window.RoboLedger?.Ledger?.getAll() || data)]);
    };

    const handleAddRow = () => {
        const accId = window.UI_STATE?.selectedAccount;
        if (!accId || accId === 'ALL') return alert('Select a specific account first to add a row.');
        if (window.RoboLedger?.Ledger?.createManual) {
            window.RoboLedger.Ledger.createManual(accId);
            setData([...(window.RoboLedger?.Ledger?.getAll() || data)]);
            if (window.updateWorkspace) window.updateWorkspace();
        }
    };

    const handleBulkDelete = () => {
        const selectedTxIds = Object.keys(rowSelection);
        if (selectedTxIds.length === 0) return;
        if (!confirm(`Delete ${selectedTxIds.length} selected transaction${selectedTxIds.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;

        let deleted = 0;
        selectedTxIds.forEach(txId => {
            if (window.RoboLedger?.Ledger?.deleteTransaction?.(txId)) deleted++;
        });
        setRowSelection({});
        if (window.RoboLedger?.Ledger) setData(window.RoboLedger.Ledger.getAll());
        if (window.updateWorkspace) window.updateWorkspace();
        if (window.showToast) window.showToast(`🗑 Deleted ${deleted} transaction${deleted !== 1 ? 's' : ''}`, 'info');
    };

    // Expose column visibility control to window (for settings drawer)
    useEffect(() => {
        window.setGridColumnVisibility = (columnId, visible) => {
            setColumnVisibility(prev => ({
                ...prev,
                [columnId]: !visible // TanStack uses inverted logic
            }));
        };

        // Expose audit sidebar function
        window.openAuditSidebar = (row) => {
            setSelectedAuditTransaction(row);
            setAuditSidebarOpen(true);
        };

        // FILTERS: Expose toggle for filter button in app.js
        window.toggleGridFilters = () => {
            setShowFilters(prev => !prev);
        };
        window.getGridFiltersVisible = () => showFilters;
        window.getActiveFiltersCount = () => columnFilters.length;

        return () => {
            delete window.setGridColumnVisibility;
            delete window.openAuditSidebar;
            delete window.toggleGridFilters;
            delete window.getGridFiltersVisible;
            delete window.getActiveFiltersCount;
        };
    }, [columnFilters, showFilters]);

    // Update filter badge count in app.js
    useEffect(() => {
        const filterBadge = document.getElementById('column-filter-badge');
        if (filterBadge) {
            const count = columnFilters.length;
            if (count > 0) {
                filterBadge.textContent = count;
                filterBadge.style.display = 'block';
            } else {
                filterBadge.style.display = 'none';
            }
        }
    }, [columnFilters]);

    // TABLE INSTANCE: React Table with all features enabled
    const table = useReactTable({
        data,  // Use data directly - filtering handled by columnFilters
        columns,
        state: {
            sorting,
            globalFilter,
            columnVisibility,
            rowSelection,
            columnFilters, // Enable column-specific filters
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onColumnFiltersChange: setColumnFilters, // Handle filter changes
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        columnResizeMode: 'onChange',
        enableRowSelection: true,
        enableMultiRowSelection: true,
        getRowId: (row) => row.id || String(row.ref),
    });

    const parentRef = useRef(null);

    // DETAIL MODE DETECTION: Nav collapsed = Detail mode ON
    // NOTE: Nav collapse state is in DOM class, NOT UI_STATE.panelState
    const [isDetailMode, setIsDetailMode] = useState(() => {
        const sidebar = document.getElementById('sidebar');
        return sidebar?.classList.contains('collapsed') || false;
    });

    // Listen for sidebar collapse events
    useEffect(() => {
        const handleSidebarToggle = (event) => {
            const collapsed = event.detail?.isCollapsed;
            if (collapsed !== undefined) {
                setIsDetailMode(collapsed);
            }
        };

        window.addEventListener('sidebarCollapsed', handleSidebarToggle);
        return () => window.removeEventListener('sidebarCollapsed', handleSidebarToggle);
    }, []);

    // Close panel when exiting detail mode
    useEffect(() => {
        if (!isDetailMode && isPanelOpen) {
            setIsPanelOpen(false);
        }
    }, [isDetailMode]);

    // Scroll to top when entering detail mode (workspace header hidden via CSS)
    useEffect(() => {
        if (isDetailMode && parentRef.current) {
            parentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isDetailMode]);

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
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                backgroundColor: '#f9fafb'
            }}
        >
            {/* 77% GRID SECTION */}
            <div
                style={{
                    width: isDetailMode && isPanelOpen ? '77%' : '100%',  // 77% only in detail mode with panel
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'width 0.3s ease',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'  // Prevent width bleeding
                }}
            >
                {/* Bulk Action Bar — appears when rows are selected */}
                {Object.keys(rowSelection).length > 0 && (
                    <div style={{ position: 'relative', zIndex: 40 }}>
                        <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: '#1e40af', borderColor: '#1d4ed8' }}>
                            {/* Count badge */}
                            <div style={{ background: 'white', color: '#1e40af', fontWeight: 800, fontSize: '12px', padding: '2px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                                {Object.keys(rowSelection).length} selected
                            </div>

                            <div className="flex items-center gap-1 ml-2">
                                {/* Auto-categorize */}
                                <button onClick={handleBulkCategorize} title="AI auto-categorize selected"
                                    style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph ph-robot" style={{ fontSize: '13px' }}></i> Auto-Cat
                                </button>

                                {/* Set COA (Account) */}
                                <button onClick={() => { setShowBulkCOAPicker(p => !p); setShowBulkRename(false); }} title="Set account for all selected"
                                    style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph ph-tag" style={{ fontSize: '13px' }}></i> Set Account
                                </button>

                                {/* Rename */}
                                <button onClick={() => { setShowBulkRename(p => !p); setShowBulkCOAPicker(false); }} title="Rename/re-describe selected"
                                    style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph ph-pencil-simple" style={{ fontSize: '13px' }}></i> Rename
                                </button>

                                {/* Add row */}
                                <button onClick={handleAddRow} title="Add blank row to current account"
                                    style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph ph-plus" style={{ fontSize: '13px' }}></i> Add Row
                                </button>

                                {/* Delete */}
                                <button onClick={handleBulkDelete} title="Delete selected transactions"
                                    style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.25)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph ph-trash" style={{ fontSize: '13px' }}></i> Delete
                                </button>
                            </div>

                            <button onClick={() => setRowSelection({})} title="Clear selection"
                                style={{ marginLeft: 'auto', padding: '4px 8px', background: 'transparent', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                                <i className="ph ph-x"></i>
                            </button>
                        </div>

                        {/* COA Picker sub-bar */}
                        {showBulkCOAPicker && (
                            <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>Set Account:</span>
                                <select
                                    value={bulkCOA}
                                    onChange={e => setBulkCOA(e.target.value)}
                                    style={{ flex: 1, maxWidth: '320px', padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white' }}
                                >
                                    <option value="">— Choose COA account —</option>
                                    {(window.RoboLedger?.COA?.getAll() || []).map(a => (
                                        <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                                    ))}
                                </select>
                                <button onClick={() => handleBulkSetCOA(bulkCOA)} disabled={!bulkCOA}
                                    style={{ padding: '5px 14px', background: '#1e40af', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: bulkCOA ? 'pointer' : 'not-allowed', opacity: bulkCOA ? 1 : 0.5 }}>
                                    Apply
                                </button>
                                <button onClick={() => setShowBulkCOAPicker(false)} style={{ padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>
                                    <i className="ph ph-x"></i>
                                </button>
                            </div>
                        )}

                        {/* Rename sub-bar */}
                        {showBulkRename && (
                            <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>New name:</span>
                                <input
                                    type="text"
                                    value={bulkRenameValue}
                                    onChange={e => setBulkRenameValue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleBulkRename()}
                                    placeholder="e.g. Costco Wholesale"
                                    style={{ flex: 1, maxWidth: '320px', padding: '4px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white' }}
                                    autoFocus
                                />
                                <button onClick={handleBulkRename} disabled={!bulkRenameValue.trim()}
                                    style={{ padding: '5px 14px', background: '#1e40af', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: bulkRenameValue.trim() ? 'pointer' : 'not-allowed', opacity: bulkRenameValue.trim() ? 1 : 0.5 }}>
                                    Rename All
                                </button>
                                <button onClick={() => setShowBulkRename(false)} style={{ padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>
                                    <i className="ph ph-x"></i>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Add Row button (always visible in bottom corner) */}
                <button onClick={handleAddRow} title="Add blank row to current account"
                    style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50, width: '44px', height: '44px', borderRadius: '50%', background: '#1e40af', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(30,64,175,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}
                    onMouseOver={e => e.currentTarget.style.background = '#1d4ed8'}
                    onMouseOut={e => e.currentTarget.style.background = '#1e40af'}
                >
                    <i className="ph ph-plus"></i>
                </button>

                {/* SCROLL CONTAINER - wraps metadata + toolbar + grid */}
                <div
                    ref={parentRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        position: 'relative'
                    }}
                >
                    {/* Metadata summary - compact stats strip */}
                    {data.length > 0 && !isDetailMode && (
                        <div style={{
                            display: 'flex', gap: '16px', padding: '6px 16px',
                            fontSize: '11px', color: '#9ca3af', borderBottom: '1px solid #f3f4f6',
                            background: '#fafbfc'
                        }}>
                            <span><strong style={{ color: '#6b7280' }}>{data.length.toLocaleString()}</strong> transactions</span>
                            <span>Total: <strong style={{ color: '#6b7280' }}>{new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
                                data.reduce((sum, tx) => sum + Math.abs((tx.amount_cents || 0)), 0) / 100
                            )}</strong></span>
                        </div>
                    )}

                    {/* Filter Toolbar - STICKY within scroll container */}
                    <FilterToolbar
                        showFilters={showFilters}
                        onToggleFilters={() => setShowFilters(prev => !prev)}
                        onToggleSettings={() => window.toggleSettings?.(true)}
                        isDetailMode={isDetailMode}
                        isPanelOpen={isPanelOpen}
                        onTogglePanel={() => setIsPanelOpen(prev => !prev)}
                        onExport={(format) => window.TransactionExporter?.exportCurrentView(format)}
                    />
                </div>

                {/* Grid Header */}
                <div className="flex bg-[#fafbfc] border-b border-[#e5e7eb] sticky top-[42px] z-20">
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
                                // Custom padding per column (match cell padding)
                                padding: header.id === 'select' ? '0' :
                                    header.id === 'balance' ? '0 8px 0 4px' :
                                        `0 ${GRID_TOKENS.rowPaddingX}`,
                                justifyContent: header.id === 'select' ? 'center' : undefined,
                                fontSize: GRID_TOKENS.headerFontSize,
                                fontWeight: GRID_TOKENS.headerFontWeight,
                                letterSpacing: GRID_TOKENS.headerLetterSpacing,
                                color: GRID_TOKENS.headerColor,
                                textTransform: 'uppercase',
                                borderRight: `1px solid ${GRID_TOKENS.borderColor}`  // Vertical dividers
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

                {/* Inline Filters Row - Collapsible */}
                {showFilters && (
                    <div className="flex bg-[#FFF9C4] border-b border-[#fde047] sticky top-[78px] z-19" style={{ transition: 'all 0.2s ease' }}>
                        {table.getFlatHeaders().map(header => (
                            <div
                                key={`filter-${header.id}`}
                                className={`relative flex items-center ${getStickyClass(header.id)}`}
                                style={{
                                    width: header.id === 'description' ? undefined : header.getSize(),
                                    flex: header.id === 'description' ? '1 1 0' : undefined,
                                    minWidth: header.id === 'description' ? '250px' : undefined,
                                    flexShrink: 0,
                                    height: '36px',
                                    padding: header.id === 'select' ? '0 4px 0 8px' :
                                        header.id === 'balance' ? '0 8px 0 4px' :
                                            `0 ${GRID_TOKENS.rowPaddingX}`,
                                    borderRight: `1px solid ${GRID_TOKENS.borderColor}`
                                }}
                            >
                                {/* Render appropriate filter input based on column */}
                                {header.column.getCanFilter() && (() => {
                                    const columnId = header.id;
                                    if (columnId === 'description' || columnId === 'ref') {
                                        return <TextFilter column={header.column} />;
                                    } else if (columnId === 'category') {
                                        return <CategoryFilter column={header.column} />;
                                    } else if (columnId === 'debit' || columnId === 'credit' || columnId === 'balance') {
                                        return <AmountFilter column={header.column} />;
                                    } else if (columnId === 'date') {
                                        return <TextFilter column={header.column} />;
                                    }
                                    return null;
                                })()}
                            </div>
                        ))}
                    </div>
                )}


                {/* Virtualized Body */}
                <div className="flex-1 bg-white">
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
                                                    padding: cell.column.id === 'select' ? '0' :
                                                        cell.column.id === 'balance' ? '0 8px 0 4px' :
                                                            `0 ${GRID_TOKENS.rowPaddingX}`,
                                                    justifyContent: cell.column.id === 'select' ? 'center' : undefined,
                                                    borderRight: `1px solid ${GRID_TOKENS.borderColor}`,
                                                    position: cell.column.id === 'category' ? 'relative' : undefined
                                                }}
                                            >
                                                <div className="w-full text-left">
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

            {/* TABBED SIDE PANEL — Detail mode only */}
            {isDetailMode && isPanelOpen && (
                <div
                    style={{
                        width: '23%',
                        height: '100%',
                        borderLeft: '1px solid #e5e7eb',
                        backgroundColor: '#fafbfc',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* Tab Bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#ffffff',
                        padding: '0 4px',
                        minHeight: '38px',
                        gap: '0',
                    }}>
                        {[
                            { id: 'dashboard', icon: 'ph-squares-four', label: 'Dashboard' },
                            { id: 'trial-balance', icon: 'ph-scales', label: 'Trial Balance' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '8px 10px',
                                    fontSize: '11px',
                                    fontWeight: activeTab === tab.id ? 600 : 500,
                                    color: activeTab === tab.id ? '#4f46e5' : '#9ca3af',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: activeTab === tab.id ? '2px solid #4f46e5' : '2px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <i className={`ph ${tab.icon}`} style={{ fontSize: '13px' }}></i>
                                {tab.label}
                            </button>
                        ))}
                        {/* Close button */}
                        <button
                            onClick={() => setIsPanelOpen(false)}
                            style={{
                                marginLeft: 'auto',
                                padding: '4px 6px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#9ca3af',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                            title="Close panel"
                        >
                            <i className="ph ph-x" style={{ fontSize: '14px' }}></i>
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div style={{ flex: 1, overflow: 'auto', padding: activeTab === 'trial-balance' ? '0' : '16px' }}>
                        {activeTab === 'dashboard' && <UtilityBar transactions={data} />}
                        {activeTab === 'trial-balance' && (
                            <LiveReportPanel
                                reportType="trial-balance"
                                transactions={data}
                                selectedAccount={columnFilters.find(f => f.id === 'category')?.value || null}
                                onAccountClick={(accountCode) => {
                                    // Persist to UI_STATE so it survives the next renderTransactionsGrid() call
                                    if (window.UI_STATE) window.UI_STATE.activeCategoryFilter = accountCode;
                                    setColumnFilters([{ id: 'category', value: accountCode }]);
                                }}
                                onClearFilter={() => {
                                    // Clear persisted filter too
                                    if (window.UI_STATE) window.UI_STATE.activeCategoryFilter = null;
                                    setColumnFilters(filters => filters.filter(f => f.id !== 'category'));
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
