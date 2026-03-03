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
// amount: dollars (e.g. 100.00)
// Returns: INTEGER CENTS (e.g. 500 for $5.00 at 5% GST) — matches ledger.core.js convention
function calculateTax(amount, province) {
    if (!amount || !province || !TAX_RATES[province]) return 0;
    return Math.round(amount * TAX_RATES[province].total);  // dollars × rate% = cents
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
    rowPaddingX: '4px',

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
    window.GRID_TOKENS = GRID_TOKENS; // Expose for debugging
    console.log('[GRID_TOKENS] Recalculated for theme:', window.UI_STATE?.gridTheme);
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
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
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
    if (!value && value !== 0) return '';
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
            {categories.filter(cat => cat.code !== '9970').map(cat => (
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
    columnHelper.accessor('debit', {
        header: 'DEBIT',
        size: 85,
        minSize: 75,
        maxSize: 100,
        enableColumnFilter: true,
        filterFn: 'auto',
        cell: info => {
            const val = info.getValue();
            const row = info.row.original;
            const account = window.RoboLedger?.Accounts?.get(row.account_id);
            const isLiability = (account?.accountType || '').toLowerCase() === 'creditcard' ||
                account?.type === 'liability' || account?.type === 'creditcard';

            // Color logic:
            // - ASSET accounts (chequing/savings): Debits are BAD (withdrawals) = RED
            // - LIABILITY accounts (credit cards): Debits are GOOD (payments reduce debt) = GREEN
            const color = isLiability ? '#10b981' : '#ef4444';

            return (
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
            );
        }
    }),

    // 6. Credit
    columnHelper.accessor('credit', {
        header: 'CREDIT',
        size: 85,
        minSize: 75,
        maxSize: 100,
        enableColumnFilter: true,
        filterFn: 'auto',
        cell: info => {
            const val = info.getValue();
            const row = info.row.original;
            const account = window.RoboLedger?.Accounts?.get(row.account_id);
            const isLiability = (account?.accountType || '').toLowerCase() === 'creditcard' ||
                account?.type === 'liability' || account?.type === 'creditcard';

            // Color logic:
            // - ASSET accounts (chequing/savings): Credits are GOOD (deposits) = GREEN
            // - LIABILITY accounts (credit cards): Credits are BAD (charges increase debt) = RED
            const color = isLiability ? '#ef4444' : '#10b981';

            return (
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
            );
        }
    }),

    //7. Account (COA Dropdown)
    columnHelper.accessor('category', {
        header: 'ACCOUNT',
        size: 220,
        minSize: 180,
        enableColumnFilter: true,
        filterFn: (row, columnId, filterValue) => {
            const categoryValue = row.getValue(columnId);
            const tx = row.original;

            // Special case: "UNCATEGORIZED" matches empty/null category or codes not in COA
            if (filterValue === 'UNCATEGORIZED') {
                if (!categoryValue || categoryValue === '' || categoryValue === 'Uncategorized') {
                    return true;
                }
                const coaAccounts = window.RoboLedger?.COA?.getAll() || [];
                const accountExists = coaAccounts.some(acc => acc.code === categoryValue);
                return !accountExists;
            }

            // GST sub-account codes (2148–2174) — match by gst_account field, not category
            // These codes never appear as a transaction's category, but appear in the trial
            // balance as GST sub-ledger entries seeded from tax_cents.
            const GST_CODES = new Set(['2148','2149','2150','2151','2160','2170','2171','2172','2173','2174']);
            if (GST_CODES.has(String(filterValue))) {
                return tx.gst_enabled && String(tx.gst_account) === String(filterValue);
            }

            // Standard exact match by category code
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
        size: 85,  // Wide enough for full balance numbers
        minSize: 80,
        maxSize: 100,
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

    // Optional: Sales Tax (GST/HST) with toggle
    columnHelper.accessor('tax_cents', {
        header: 'GST/HST',
        size: 110,      // Increased to fit toggle + amount
        minSize: 100,
        maxSize: 130,
        cell: info => {
            const val = info.getValue();
            const row = info.row.original;

            const catStr = String(row.category || '');

            // ── Default gst_enabled for first render ──────────────────────────
            // Structural transfers (CC payments, bank transfers, inter-account) default
            // to OFF — all other transactions (including uncategorized) default to ON.
            // The toggle is always shown — user can override for any row.
            if (row.gst_enabled === undefined) {
                const isStructuralTransfer =
                    catStr === '9971' ||  // CC Payment
                    row._isCCPayment ||
                    row._isBankRebate ||
                    row.transaction_type === 'transfer';
                row.gst_enabled = !isStructuralTransfer;
            }

            // Auto-calculate tax_cents if enabled but not yet stored
            let displayValue = val;
            if (row.gst_enabled && (!val || val === 0)) {
                const province = window.UI_STATE?.province;
                const amount = row.debit || row.credit || 0;
                if (province && amount) {
                    const calculatedTax = calculateTax(amount, province);
                    displayValue = calculatedTax;
                    // Write back so LiveReportPanel can use it
                    row.tax_cents = calculatedTax;
                    // GST account routing:
                    // Revenue (4xxx) on a NON-credit-card account = GST Collected (2160)
                    // Everything on a credit card = always GST ITC/Paid (2150) — CC charges are NEVER revenue
                    const acctForGST = window.RoboLedger?.Accounts?.get(row.account_id);
                    const isCCAcct   = !!(acctForGST?.brand || acctForGST?.cardNetwork ||
                                         (acctForGST?.accountType || '').toLowerCase() === 'creditcard');
                    const isRevenue  = !isCCAcct && catStr.startsWith('4');
                    row.gst_account = isRevenue ? '2160' : '2150';
                    row.gst_type    = isRevenue ? 'collected' : 'itc';
                }
            }

            const handleToggle = (e) => {
                e.stopPropagation();

                row.gst_enabled = !row.gst_enabled;

                if (row.gst_enabled) {
                    // GST ENABLED: compute and store
                    const province = window.UI_STATE?.province;
                    const amount = row.debit || row.credit || 0;
                    if (province && amount) {
                        const calculatedTax = calculateTax(amount, province);
                        row.tax_cents = calculatedTax;
                        const acctForGST = window.RoboLedger?.Accounts?.get(row.account_id);
                        const isCCAcct   = !!(acctForGST?.brand || acctForGST?.cardNetwork ||
                                             (acctForGST?.accountType || '').toLowerCase() === 'creditcard');
                        const isRevenue  = !isCCAcct && catStr.startsWith('4');
                        row.gst_account = isRevenue ? '2160' : '2150';
                        row.gst_type    = isRevenue ? 'collected' : 'itc';
                    }
                } else {
                    // GST DISABLED: clear
                    row.tax_cents   = 0;
                    row.gst_account = null;
                    row.gst_type    = null;
                }

                // Persist to ledger store
                try {
                    window.RoboLedger?.Ledger?.updateMetadata(row.tx_id, {
                        gst_enabled: row.gst_enabled,
                        tax_cents:   row.tax_cents   || 0,
                        gst_account: row.gst_account || null,
                        gst_type:    row.gst_type    || null,
                    });
                } catch(e) { /* non-critical */ }

                // Force re-render
                const tableData = info.table.options.data;
                const newData = [...tableData];
                newData[info.row.index] = { ...row };
                if (info.table.options.meta?.setData) {
                    info.table.options.meta.setData(newData);
                }

                // Refresh UB so GST totals update
                setTimeout(() => window.updateUtilityBar?.(), 50);
            };

            return (
                <div className="flex items-center justify-end gap-1.5">
                    {/* Toggle button */}
                    <button
                        onClick={handleToggle}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                        title={row.gst_enabled
                            ? `GST enabled → ${row.gst_type === 'collected' ? 'Collected (2160)' : 'ITC/Paid (2150)'} — click to disable`
                            : `GST disabled — click to enable (routes to ${catStr.startsWith('4') ? 'Collected 2160' : 'ITC/Paid 2150'})`
                        }
                    >
                        <i className={`ph ${row.gst_enabled ? 'ph-check-circle' : 'ph-circle'} text-sm`}
                           style={{ color: row.gst_enabled ? '#16a34a' : '#d1d5db' }}></i>
                    </button>

                    {/* Amount */}
                    <span
                        className="text-right block font-mono"
                        style={{
                            fontSize: GRID_TOKENS.numberFontSize,
                            fontWeight: GRID_TOKENS.numberFontWeight,
                            color: row.gst_enabled ? GRID_TOKENS.numberColor : '#cbd5e1',
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: '52px',
                        }}
                    >
                        {row.gst_enabled && displayValue ? formatCurrency(displayValue / 100) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </span>
                </div>
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
    columnVisibility: initialColumnVisibility = { tax_cents: true }
}) {
    // CRITICAL: Update UI_STATE with new theme values
    if (window.UI_STATE) {
        window.UI_STATE.gridTheme = gridTheme;
        window.UI_STATE.gridFontSize = gridFontSize;
        window.UI_STATE.gridDensity = gridDensity;
    }

    // ── Derive a stable token snapshot from props — React tracks this properly ──
    // Using useMemo means whenever gridTheme / gridFontSize / gridDensity props
    // change, React re-derives TK and re-renders all consumers of it.
    const rowHeights = { compact: 36, comfortable: 42, spacious: 56 };
    const TK = useMemo(() => {
        // Sync UI_STATE so getActiveTheme() reads the right value
        if (window.UI_STATE) window.UI_STATE.gridTheme = gridTheme;
        if (window.recalculateGridTokens) window.recalculateGridTokens();
        const base = { ...GRID_TOKENS };
        // Apply density override
        base.rowHeight = rowHeights[gridDensity] ?? base.rowHeight;
        // Apply font size
        if (gridFontSize) {
            base.cellFontSize       = `${gridFontSize}px`;
            base.descLine1FontSize  = `${gridFontSize}px`;
            base.descLine2FontSize  = `${Math.max(9, gridFontSize - 1.5)}px`;
            base.numberFontSize     = `${gridFontSize}px`;
        }
        return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gridTheme, gridFontSize, gridDensity]);

    // Keep module-level GRID_TOKENS in sync for legacy callers
    Object.assign(GRID_TOKENS, TK);

    console.log('[TRANSACTIONS_TABLE] Rendering with theme:', gridTheme, 'fontSize:', gridFontSize, 'density:', gridDensity, 'rowHeight:', TK.rowHeight);


    const [data, setData] = useState(initialData || []);
    const [sorting, setSorting] = useState([{ id: 'date', desc: true }]);
    const [columnVisibility, setColumnVisibility] = useState(initialColumnVisibility); // Use prop or default
    const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter || '');
    const [rowSelection, setRowSelection] = useState({});
    const [density] = useState('comfortable'); // Fixed at comfortable for now

    // BULK ACTION BAR STATE
    const [bulkCOAOpen, setBulkCOAOpen]       = useState(false);  // COA picker open
    const [bulkRenameOpen, setBulkRenameOpen] = useState(false);  // Rename input open
    const [bulkRenameValue, setBulkRenameValue] = useState('');

    // INLINE FILTERS: State for column-specific filters
    const [columnFilters, setColumnFilters] = useState([]);
    const [showFilters, setShowFilters] = useState(false);

    // EXPERIMENTAL: Audit sidebar state
    const [auditSidebarOpen, setAuditSidebarOpen] = useState(false);
    const [selectedAuditTransaction, setSelectedAuditTransaction] = useState(null);

    // EXCEL-LIKE: Cell focus & inline editing state
    const [focusedCell, setFocusedCell] = useState(null); // { rowIndex, columnId }
    const [editingCell, setEditingCell] = useState(null);  // { rowIndex, columnId, value }
    const editInputRef = useRef(null);

    // PANEL SYSTEM: Mutual exclusion - only one panel at a time (null | 'utility' | 'report')
    const [activePanel, setActivePanel] = useState(null);

    // DRILL STACK: Multi-level breadcrumb trail for drill-down navigation.
    // Each entry = { label: string, data: rows[], source: rows[] (the full set at that level) }
    // - drillStack[0] = root (All Transactions)
    // - drillStack[n] = nth drill level (e.g. Revenue → Rental Revenue)
    // Empty array = no drill active (root view)
    const [drillStack, setDrillStack] = useState([]);

    // Legacy compat getter — the "current active filter label" for things that read it
    const activeFilterLabel = drillStack.length > 0 ? drillStack[drillStack.length - 1].label : null;

    // SYNC: Update data when prop changes (for account switching)
    useEffect(() => {
        setData(initialData || []);
    }, [initialData]);

    // SYNC: Update columnVisibility when prop changes (for settings drawer saves)
    // This ensures mountTransactionsTable() with new savedPrefs updates the grid
    useEffect(() => {
        setColumnVisibility(prev => ({ ...prev, ...initialColumnVisibility }));
    }, [initialColumnVisibility]);

    // SYNC: Update globalFilter when search query changes (for live search)
    useEffect(() => {
        setGlobalFilter(initialGlobalFilter || '');
    }, [initialGlobalFilter]);

    // ═══════════════════════════════════════════════════════════════════════════
    // EXCEL-LIKE KEYBOARD NAVIGATION & INLINE EDITING
    // ═══════════════════════════════════════════════════════════════════════════

    // Columns that support keyboard navigation (order matters for Tab/arrow keys)
    const NAV_COLUMNS = useMemo(() => ['date', 'description', 'debit', 'credit', 'category'], []);
    // Columns that are inline-editable (double-click or Enter)
    const EDITABLE_COLUMNS = useMemo(() => new Set(['date', 'description', 'debit', 'credit']), []);

    // Focus the edit input when editing starts
    useEffect(() => {
        if (editingCell && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingCell]);

    // Commit edit value to ledger with full audit trail
    const commitCellEdit = (rowIndex, columnId, value) => {
        const rows = table.getRowModel().rows;
        const row = rows[rowIndex];
        if (!row) return;
        const txId = row.original.tx_id;
        if (!txId) return;

        const tx = window.RoboLedger?.Ledger?.get?.(txId);
        if (!tx) return;

        // Build audit history entry
        const historyEntry = {
            field: columnId,
            old_value: null,
            new_value: value,
            timestamp: new Date().toISOString(),
            edited_by: 'user'
        };

        if (columnId === 'debit' || columnId === 'credit') {
            const numVal = parseFloat(String(value).replace(/[$,]/g, '')) || 0;
            const cents = Math.round(numVal * 100);
            const oldAmount = tx.amount_cents || 0;
            const oldPolarity = tx.polarity;

            historyEntry.old_value = `${oldPolarity} $${(oldAmount / 100).toFixed(2)}`;

            if (columnId === 'debit' && numVal > 0) {
                historyEntry.new_value = `DEBIT $${numVal.toFixed(2)}`;
                window.RoboLedger.Ledger.updateTransaction(txId, {
                    amount_cents: cents,
                    polarity: 'DEBIT',
                    edit_history: [...(tx.edit_history || []), historyEntry]
                });
            } else if (columnId === 'credit' && numVal > 0) {
                historyEntry.new_value = `CREDIT $${numVal.toFixed(2)}`;
                window.RoboLedger.Ledger.updateTransaction(txId, {
                    amount_cents: cents,
                    polarity: 'CREDIT',
                    edit_history: [...(tx.edit_history || []), historyEntry]
                });
            } else if (numVal === 0) {
                // Clear the field — keep opposite polarity or zero out
                historyEntry.new_value = `${columnId.toUpperCase()} $0.00`;
                window.RoboLedger.Ledger.updateTransaction(txId, {
                    amount_cents: 0,
                    polarity: columnId === 'debit' ? 'DEBIT' : 'CREDIT',
                    edit_history: [...(tx.edit_history || []), historyEntry]
                });
            }
        } else if (columnId === 'date') {
            historyEntry.old_value = tx.date || tx.date_iso || '';
            historyEntry.new_value = value;
            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (dateRegex.test(value)) {
                window.RoboLedger.Ledger.updateTransaction(txId, {
                    date: value,
                    date_iso: value,
                    edit_history: [...(tx.edit_history || []), historyEntry]
                });
            } else {
                if (window.showToast) window.showToast('Invalid date format. Use YYYY-MM-DD', 'error');
                return;
            }
        } else if (columnId === 'description') {
            // Description already has its own edit handler via DescriptionCell
            window.RoboLedger.Ledger.updateDescription(txId, value);
            setEditingCell(null);
            if (window.updateWorkspace) window.updateWorkspace();
            return;
        }

        setEditingCell(null);
        // Refresh data
        if (window.updateWorkspace) window.updateWorkspace();
        else setData([...data]);
    };

    // Start editing current focused cell
    const startEditing = (rowIndex, columnId) => {
        if (!EDITABLE_COLUMNS.has(columnId)) return;
        const rows = table.getRowModel().rows;
        const row = rows[rowIndex];
        if (!row) return;

        let currentValue = '';
        if (columnId === 'debit') {
            currentValue = row.original.debit ? String(row.original.debit) : '';
        } else if (columnId === 'credit') {
            currentValue = row.original.credit ? String(row.original.credit) : '';
        } else if (columnId === 'date') {
            currentValue = row.original.date_iso || row.original.date || '';
        } else if (columnId === 'description') {
            currentValue = row.original.payee || row.original.description || '';
        }

        setEditingCell({ rowIndex, columnId, value: currentValue });
    };

    // Keyboard handler for grid navigation
    const handleGridKeyDown = (e) => {
        // Global shortcuts that work regardless of focus state
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
            e.preventDefault();
            handleAddTransaction();
            return;
        }

        // Don't intercept if user is typing in an input/textarea/select that's NOT our edit cell
        const tag = e.target.tagName?.toLowerCase();
        if ((tag === 'input' || tag === 'textarea' || tag === 'select') && !e.target.dataset?.gridEdit) return;

        if (!focusedCell) return;

        const rows = table.getRowModel().rows;
        const { rowIndex, columnId } = focusedCell;
        const colIdx = NAV_COLUMNS.indexOf(columnId);

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                const nextRow = Math.min(rowIndex + 1, rows.length - 1);
                setFocusedCell({ rowIndex: nextRow, columnId });
                // Scroll into view
                rowVirtualizer.scrollToIndex(nextRow, { align: 'auto' });
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                const prevRow = Math.max(rowIndex - 1, 0);
                setFocusedCell({ rowIndex: prevRow, columnId });
                rowVirtualizer.scrollToIndex(prevRow, { align: 'auto' });
                break;
            }
            case 'ArrowRight': {
                e.preventDefault();
                if (colIdx < NAV_COLUMNS.length - 1) {
                    setFocusedCell({ rowIndex, columnId: NAV_COLUMNS[colIdx + 1] });
                }
                break;
            }
            case 'ArrowLeft': {
                e.preventDefault();
                if (colIdx > 0) {
                    setFocusedCell({ rowIndex, columnId: NAV_COLUMNS[colIdx - 1] });
                }
                break;
            }
            case 'Tab': {
                e.preventDefault();
                if (e.shiftKey) {
                    // Move left or to previous row
                    if (colIdx > 0) {
                        setFocusedCell({ rowIndex, columnId: NAV_COLUMNS[colIdx - 1] });
                    } else if (rowIndex > 0) {
                        setFocusedCell({ rowIndex: rowIndex - 1, columnId: NAV_COLUMNS[NAV_COLUMNS.length - 1] });
                    }
                } else {
                    // Move right or to next row
                    if (colIdx < NAV_COLUMNS.length - 1) {
                        setFocusedCell({ rowIndex, columnId: NAV_COLUMNS[colIdx + 1] });
                    } else if (rowIndex < rows.length - 1) {
                        setFocusedCell({ rowIndex: rowIndex + 1, columnId: NAV_COLUMNS[0] });
                    }
                }
                break;
            }
            case 'Enter': {
                e.preventDefault();
                if (editingCell) {
                    // Commit and move down
                    commitCellEdit(editingCell.rowIndex, editingCell.columnId, editingCell.value);
                    const nextRow = Math.min(rowIndex + 1, rows.length - 1);
                    setFocusedCell({ rowIndex: nextRow, columnId });
                } else {
                    startEditing(rowIndex, columnId);
                }
                break;
            }
            case 'Escape': {
                e.preventDefault();
                if (editingCell) {
                    setEditingCell(null);
                } else {
                    setFocusedCell(null);
                }
                break;
            }
            case 'F2': {
                e.preventDefault();
                startEditing(rowIndex, columnId);
                break;
            }
            case 'Delete':
            case 'Backspace': {
                if (!editingCell && EDITABLE_COLUMNS.has(columnId)) {
                    e.preventDefault();
                    // Clear cell and start editing
                    setEditingCell({ rowIndex, columnId, value: '' });
                }
                break;
            }
            default: {
                // If user starts typing alphanumeric, enter edit mode
                if (!editingCell && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    if (EDITABLE_COLUMNS.has(columnId)) {
                        e.preventDefault();
                        setEditingCell({ rowIndex, columnId, value: e.key });
                    }
                }
                break;
            }
        }
    };

    // ADD TRANSACTION: Insert a new manual transaction row
    const handleAddTransaction = () => {
        const accountId = window.UI_STATE?.selectedAccount;
        const tx = window.RoboLedger?.Ledger?.createManual?.(accountId !== 'ALL' ? accountId : undefined);
        if (tx) {
            if (window.showToast) window.showToast('New transaction added', 'success');
            if (window.updateWorkspace) window.updateWorkspace();
            else setData([...data]);
        }
    };

    // DIRECT BRIDGE: Expose setData so utility-bar and setTxGridFilter can drive
    // the grid without going through the stale React root reference.
    useEffect(() => {
        window.__txGridSetData = (rows) => setData(rows || []);
        // Clear filter bridge — called by setTxGridFilter(null) and vanilla JS
        window.__txGridClearFilter = () => {
            setDrillStack([]);
            window._txGridActiveFilter = null;
        };
        return () => {
            delete window.__txGridSetData;
            delete window.__txGridClearFilter;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // DETAIL MODE: Sidebar collapse detection
    const [isDetailMode, setIsDetailMode] = useState(() => {
        const sidebar = document.getElementById('sidebar');
        return sidebar?.classList.contains('collapsed') || false;
    });

    useEffect(() => {
        const handleSidebarCollapse = (e) => {
            const isCollapsed = e.detail?.isCollapsed ?? false;
            console.log('[DETAIL_MODE] Sidebar collapsed event received:', isCollapsed);
            setIsDetailMode(isCollapsed);
            console.log('[DETAIL_MODE] Current activePanel:', activePanel);

            if (isCollapsed) {
                // DETAIL MODE ON: Open utility bar automatically
                console.log('[DETAIL_MODE] Opening utility bar');
                setActivePanel('utility');

                // Auto-scroll to FilterToolbar
                console.log('[DETAIL_MODE] Auto-scrolling to FilterToolbar');
                if (parentRef.current) {
                    setTimeout(() => {
                        // Find the FilterToolbar sticky element (the blue box)
                        const filterToolbar = parentRef.current.querySelector('[style*="sticky"]');
                        if (filterToolbar) {
                            console.log('[DETAIL_MODE] Scrolling FilterToolbar into view');
                            filterToolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                            // Fallback: calculate scroll from header cards
                            const headerCards = parentRef.current.querySelectorAll('.batch-action-bar, .reconciliation-container, .metadata-container');
                            let scrollAmount = 0;
                            headerCards.forEach(card => {
                                scrollAmount += card.offsetHeight;
                            });
                            console.log('[DETAIL_MODE] Fallback: Scroll amount calculated:', scrollAmount);
                            parentRef.current.scrollTo({ top: scrollAmount || 250, behavior: 'smooth' });
                        }
                    }, 100);
                }
            } else {
                // DETAIL MODE OFF: Close all panels
                console.log('[DETAIL_MODE] Deactivating all panels');
                setActivePanel(null);
            }
        };

        window.addEventListener('sidebarCollapsed', handleSidebarCollapse);
        return () => window.removeEventListener('sidebarCollapsed', handleSidebarCollapse);
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // BATCH ACTION HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * BULK CATEGORIZE: Apply a COA code to all selected transactions
     * Called when user picks an account from the inline COA picker in the bulk bar
     */
    const handleBulkSetCOA = (code) => {
        if (!code) return;
        // Use getSelectedRowModel() so we always get row.original.tx_id regardless
        // of what getRowId resolved to (avoids ref-vs-tx_id key mismatch).
        // Use batchUpdateCategories so the entire batch does ONE localStorage save
        // instead of N saves (critical for 500+ row selections).
        const selectedRows = table.getSelectedRowModel().rows;
        if (selectedRows.length === 0) return;

        const tx_ids = selectedRows
            .map(r => r.original.tx_id)
            .filter(Boolean);

        const updated = window.RoboLedger?.Ledger?.batchUpdateCategories?.(tx_ids, code) ?? 0;

        if (window.showToast) window.showToast(`Categorized ${updated} transaction${updated !== 1 ? 's' : ''} → ${code}`, 'success');

        // Close picker, clear selection, refresh
        setBulkCOAOpen(false);
        setRowSelection({});
        if (window.updateWorkspace) window.updateWorkspace();
        else setData([...data]);
    };

    /**
     * BULK RENAME: Rename all selected transactions — each change is audit-trailed
     */
    const handleBulkRename = () => {
        const newName = bulkRenameValue.trim();
        if (!newName) return;
        const selectedRows = table.getSelectedRowModel().rows;
        if (selectedRows.length === 0) return;

        let renamed = 0;
        selectedRows.forEach(row => {
            const txId = row.original.tx_id;
            if (!txId) return;
            try {
                // updateDescription writes to edit_history[] for audit trail
                const ok = window.RoboLedger?.Ledger?.updateDescription?.(txId, newName);
                if (ok !== false) renamed++;
            } catch (e) {
                console.warn('[BULK_RENAME] Failed for', txId, e);
            }
        });

        console.log(`[BULK_RENAME] Renamed ${renamed}/${selectedRows.length} to "${newName}"`);
        if (window.showToast) window.showToast(`Renamed ${renamed} transaction${renamed !== 1 ? 's' : ''}`, 'success');

        // Close rename, clear, refresh
        setBulkRenameOpen(false);
        setBulkRenameValue('');
        setRowSelection({});
        if (window.updateWorkspace) window.updateWorkspace();
        else setData([...data]);
    };

    /**
     * BULK DELETE: Remove selected transactions from ledger
     */
    const handleBulkDelete = () => {
        const selectedRows = table.getSelectedRowModel().rows;
        if (selectedRows.length === 0) return;

        // Delete each transaction using the actual tx_id from original data
        let deleted = 0;
        selectedRows.forEach(row => {
            const txId = row.original.tx_id;
            if (txId && window.RoboLedger?.Ledger?.deleteTransaction?.(txId)) {
                deleted++;
            }
        });

        console.log(`[BULK_DELETE] Deleted ${deleted}/${selectedRows.length} transactions`);
        if (window.showToast) window.showToast(`Deleted ${deleted} transaction${deleted !== 1 ? 's' : ''}`, 'success');

        // Clear selection
        setRowSelection({});

        // Force re-render by updating data
        if (window.RoboLedger?.Ledger) {
            setData(window.RoboLedger.Ledger.getAllTransactions?.() || []);
        }
    };

    // Expose column visibility control to window (for settings drawer)
    useEffect(() => {
        window.setGridColumnVisibility = (columnId, visible) => {
            setColumnVisibility(prev => ({
                ...prev,
                [columnId]: visible // TanStack: true = visible, false = hidden
            }));
        };

        // EXPERIMENTAL: Expose audit sidebar function
        window.openAuditSidebar = (row) => {
            const gridContainer = parentRef.current;
            if (gridContainer) {
                const scrollTop = gridContainer.scrollTop;
                const topBarHeight = 280;
                if (scrollTop < topBarHeight) {
                    gridContainer.scrollTo({
                        top: topBarHeight,
                        behavior: 'smooth'
                    });
                }
            }
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
        getRowId: (row) => row.tx_id || row.id || String(row.ref), // tx_id first — it's the ledger store key
        meta: {
            setData, // Enable GST toggle to update data
        },
    });

    const parentRef = useRef(null);

    const rowVirtualizer = useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => TK.rowHeight,
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
            className="bg-white relative"
            tabIndex={0}
            onKeyDown={handleGridKeyDown}
            style={{
                height: 'calc(100vh - 60px)', // Fixed height minus nav
                overflow: 'hidden',
                display: 'flex',
                flexDirection: activePanel ? 'row' : 'column',
                minWidth: 0,  // Prevent outer container from expanding beyond its flex allocation
                outline: 'none',
            }}
        >
            {/* Scrolling container with fixed height */}
            <div
                ref={parentRef}
                style={{
                    flex: 1,
                    minWidth: 0,  // Critical: allows flex child to shrink below content width,
                                  // so sticky right-0 balance column is relative to this container's
                                  // actual right edge (= panel left edge), not an oversized content width
                    height: '100%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    position: 'relative',
                }}
            >
                {/* ── Bulk Action Bar ─────────────────────────────────────────── */}
                {Object.keys(rowSelection).length > 0 && (
                    <div className="sticky top-0 z-40 bg-white border-b border-[#e5e7eb] shadow-sm">

                        {/* Main toolbar row — same height / padding as FilterToolbar */}
                        <div className="flex items-center gap-2 px-4 h-[44px]">

                            {/* Selection count pill */}
                            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 shrink-0">
                                <i className="ph ph-check-square text-indigo-500 text-[13px]"></i>
                                <span className="text-[11px] font-bold text-indigo-700 tabular-nums">
                                    {Object.keys(rowSelection).length} selected
                                </span>
                            </div>

                            {/* Thin separator */}
                            <div className="w-px h-5 bg-[#e5e7eb] mx-1 shrink-0" />

                            {/* ── Categorize ── */}
                            <button
                                onClick={() => { setBulkCOAOpen(o => !o); setBulkRenameOpen(false); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-all ${
                                    bulkCOAOpen
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-[#374151] border-[#e5e7eb] hover:bg-[#f9fafb] hover:border-indigo-300'
                                }`}
                            >
                                <i className="ph ph-tag text-[13px]"></i>
                                Categorize
                                <i className={`ph ph-caret-${bulkCOAOpen ? 'up' : 'down'} text-[10px] opacity-60`}></i>
                            </button>

                            {/* ── Rename ── */}
                            <button
                                onClick={() => { setBulkRenameOpen(o => !o); setBulkCOAOpen(false); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-all ${
                                    bulkRenameOpen
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white text-[#374151] border-[#e5e7eb] hover:bg-[#f9fafb] hover:border-indigo-300'
                                }`}
                            >
                                <i className="ph ph-pencil-simple text-[13px]"></i>
                                Rename
                                <i className={`ph ph-caret-${bulkRenameOpen ? 'up' : 'down'} text-[10px] opacity-60`}></i>
                            </button>

                            {/* ── Delete ── */}
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border border-[#e5e7eb] text-red-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all"
                            >
                                <i className="ph ph-trash text-[13px]"></i>
                                Delete
                            </button>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Deselect all */}
                            <button
                                onClick={() => { setRowSelection({}); setBulkCOAOpen(false); setBulkRenameOpen(false); setBulkRenameValue(''); }}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] text-[#9ca3af] hover:text-[#374151] hover:bg-[#f9fafb] border border-transparent hover:border-[#e5e7eb] transition-all"
                                title="Clear selection"
                            >
                                <i className="ph ph-x text-[12px]"></i>
                                Deselect
                            </button>
                        </div>

                        {/* ── COA Picker sub-panel ─────────────────────────────── */}
                        {bulkCOAOpen && (
                            <div className="px-4 pt-2 pb-3 bg-[#fafbfc] border-t border-[#e5e7eb]">
                                <p className="text-[11px] text-[#6b7280] font-medium mb-2">
                                    Apply category to <span className="font-bold text-indigo-600">{Object.keys(rowSelection).length}</span> transaction{Object.keys(rowSelection).length !== 1 ? 's' : ''}
                                </p>
                                <div className="max-w-md">
                                    <COADropdown
                                        value=""
                                        onChange={(code) => handleBulkSetCOA(code)}
                                        txId="bulk"
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── Rename sub-panel ─────────────────────────────────── */}
                        {bulkRenameOpen && (
                            <div className="px-4 pt-2 pb-3 bg-[#fafbfc] border-t border-[#e5e7eb]">
                                <p className="text-[11px] text-[#6b7280] font-medium mb-2">
                                    New description for <span className="font-bold text-indigo-600">{Object.keys(rowSelection).length}</span> transaction{Object.keys(rowSelection).length !== 1 ? 's' : ''}
                                    <span className="ml-1.5 text-[10px] text-amber-600 font-normal">· audit trailed</span>
                                </p>
                                <div className="flex gap-2 max-w-lg">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={bulkRenameValue}
                                        onChange={e => setBulkRenameValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleBulkRename();
                                            if (e.key === 'Escape') { setBulkRenameOpen(false); setBulkRenameValue(''); }
                                        }}
                                        placeholder="New description / payee name…"
                                        className="flex-1 px-3 py-1.5 text-[12px] border border-[#e5e7eb] rounded-md focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white text-[#1e293b] placeholder-[#c0c4cc] transition-all"
                                    />
                                    <button
                                        onClick={handleBulkRename}
                                        disabled={!bulkRenameValue.trim()}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
                                            bulkRenameValue.trim()
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                : 'bg-[#e5e7eb] text-[#9ca3af] cursor-not-allowed'
                                        }`}
                                    >
                                        <i className="ph ph-check text-[13px]"></i>
                                        Apply
                                    </button>
                                    <button
                                        onClick={() => { setBulkRenameOpen(false); setBulkRenameValue(''); }}
                                        className="px-3 py-1.5 rounded-md text-[12px] font-medium text-[#6b7280] border border-[#e5e7eb] hover:bg-[#f3f4f6] transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Filter Toolbar - STICKY: Freezes at top when scrolling */}
                <div style={{ position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#fff', display: 'flex', alignItems: 'stretch' }}>
                    <div style={{ flex: 1 }}>
                    <FilterToolbar
                        refPrefix={window.UI_STATE?.refPrefix || 'CHQ1'}
                        searchQuery={window.UI_STATE?.searchQuery || ''}
                        selectedAccount={window.UI_STATE?.selectedAccount || 'ALL'}
                        accounts={window.RoboLedger?.Accounts?.getActive?.() || window.RoboLedger?.Accounts?.getAll() || []}
                        onRefPrefixChange={(value) => window.updateRefPrefix?.(value)}
                        onSearchChange={(value) => window.handleSearch?.(value)}
                        onAccountChange={(value) => window.switchAccount?.(value)}
                        onToggleFilters={() => window.toggleGridFilters?.()}
                        onToggleSettings={() => window.toggleSettings?.(true)}
                        isDetailMode={isDetailMode}  // Pass mode to show/hide panel toggles
                        activePanel={activePanel}     // Pass active panel for button highlighting
                        activeFilter={drillStack.length === 0 ? null : activeFilterLabel}
                        drillPath={drillStack.length > 0 ? drillStack : null}
                        onDrillBack={(idx) => {
                            // idx=0 means navigate to root (all transactions)
                            if (idx === 0 || idx >= drillStack.length) {
                                // Navigate to root
                                const rootData = drillStack[0]?.source || window._txGridAllData || data;
                                window.__txGridSetData?.(rootData);
                                window._txGridAllData = rootData;
                                window._txGridActiveFilter = null;
                                setDrillStack([]);
                            } else {
                                // Navigate to ancestor level idx (1-indexed in drillStack)
                                const target = drillStack[idx - 1];
                                if (target) {
                                    window.__txGridSetData?.(target.data);
                                    window._txGridAllData = target.source;
                                    window._txGridActiveFilter = target.label;
                                    setDrillStack(drillStack.slice(0, idx));
                                }
                            }
                        }}
                        onClearFilter={() => {
                            // Clear all drill levels, restore root data
                            const rootData = drillStack[0]?.source || window._txGridAllData || data;
                            window.__txGridSetData?.(rootData);
                            window._txGridAllData = rootData;
                            window._txGridActiveFilter = null;
                            setDrillStack([]);
                        }}
                        onToggleReportPanel={() => {
                            const newPanel = activePanel === 'report' ? null : 'report';
                            setActivePanel(newPanel);

                            // Auto-scroll to hide header containers (like audit drawer)
                            if (newPanel === 'report' && parentRef.current) {
                                const headerContainers = parentRef.current.querySelector('.batch-action-bar, .reconciliation-container, .metadata-container');
                                if (headerContainers) {
                                    setTimeout(() => {
                                        parentRef.current.scrollTo({ top: 200, behavior: 'smooth' });
                                    }, 100);
                                }
                            }
                        }}
                        onToggleUtilityBar={() => {
                            const newPanel = activePanel === 'utility' ? null : 'utility';
                            setActivePanel(newPanel);

                            // Auto-scroll to hide top cards and show only filter toolbar
                            if (newPanel === 'utility' && parentRef.current) {
                                setTimeout(() => {
                                    // Scroll past all header cards to show FilterToolbar at top
                                    const headerCards = parentRef.current.querySelectorAll('.batch-action-bar, .reconciliation-container, .metadata-container');
                                    let scrollAmount = 0;
                                    headerCards.forEach(card => {
                                        scrollAmount += card.offsetHeight;
                                    });
                                    parentRef.current.scrollTo({ top: scrollAmount || 250, behavior: 'smooth' });
                                }, 100);
                            }
                        }}
                        onExport={(format) => window.TransactionExporter?.exportCurrentView(format)}
                    />
                    </div>
                    {/* Add Transaction button — next to FilterToolbar */}
                    <button
                        onClick={handleAddTransaction}
                        title="Add a new manual transaction (Ctrl+Shift+N)"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '0 14px',
                            background: 'none',
                            border: 'none',
                            borderLeft: '1px solid #e2e8f0',
                            color: '#64748b',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'none'; }}
                    >
                        <i className="ph ph-plus-circle" style={{ fontSize: '15px' }}></i>
                        Add
                    </button>
                </div>

                {/* Grid Header */}
                <div className="flex bg-[#f8fafc] border-b border-[#e2e8f0] sticky top-[44px] z-20">
                    {table.getFlatHeaders().map(header => (
                        <div
                            key={header.id}
                            className={`relative flex items-center group select-none ${getStickyClass(header.id)} ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                            style={{
                                width: header.id === 'description' ? undefined : header.getSize(),
                                flex: header.id === 'description' ? '1 1 0' : undefined,
                                minWidth: header.id === 'description' ? '250px' : undefined,
                                flexShrink: 0,
                                height: TK.headerHeight,
                                // Custom padding per column (match cell padding)
                                padding: header.id === 'select' ? '0 4px 0 12px' :  // Checkbox: 12px left padding
                                    header.id === 'balance' ? '0 6px 0 2px' :   // Balance: 6px right (SYMMETRIC)
                                        `0 ${TK.rowPaddingX}`,           // Others: default
                                fontSize: TK.headerFontSize,
                                fontWeight: TK.headerFontWeight,
                                letterSpacing: TK.headerLetterSpacing,
                                color: TK.headerColor,
                                textTransform: 'uppercase',
                                borderRight: `1px solid ${TK.borderColor}`  // Vertical dividers
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
                    <div className="flex bg-[#FFF9C4] border-b border-[#fde047] sticky top-[88px] z-19" style={{ transition: 'all 0.2s ease' }}>
                        {table.getFlatHeaders().map(header => (
                            <div
                                key={`filter-${header.id}`}
                                className={`relative flex items-center ${getStickyClass(header.id)}`}
                                style={{
                                    width: header.id === 'description' ? undefined : header.getSize(),
                                    flex: header.id === 'description' ? '1 1 0' : undefined,
                                    minWidth: header.id === 'description' ? '250px' : undefined,
                                    flexShrink: 0,
                                    height: '40px',
                                    padding: header.id === 'select' ? '0 4px 0 12px' :
                                        header.id === 'balance' ? '0 6px 0 2px' :
                                            `0 ${TK.rowPaddingX}`,
                                    borderRight: `1px solid ${TK.borderColor}`
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
                                    rowBg = TK.selectedRowBg || '#eff6ff';
                                } else if (TK.rowColors && Array.isArray(TK.rowColors)) {
                                    // Rainbow mode: cycle through color palette
                                    rowBg = TK.rowColors[rowIndex % TK.rowColors.length];
                                } else {
                                    // Standard alternating (2 colors)
                                    rowBg = rowIndex % 2 === 0 ? TK.rowBg : TK.rowBgAlt;
                                }
                                const hoverBg = TK.hoverBg || '#f8fafc';

                                return (
                                    <div
                                        key={row.id}
                                        className="flex absolute top-0 left-0 w-full transition-colors group"
                                        style={{
                                            height: `${TK.rowHeight}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                            borderBottom: `1px solid ${TK.borderColor}`,
                                            backgroundColor: rowBg
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBg}
                                    >
                                        {row.getVisibleCells().map(cell => {
                                            const colId = cell.column.id;
                                            const isFocused = focusedCell && focusedCell.rowIndex === virtualRow.index && focusedCell.columnId === colId;
                                            const isEditing = editingCell && editingCell.rowIndex === virtualRow.index && editingCell.columnId === colId;
                                            const isNavigable = NAV_COLUMNS.includes(colId);
                                            const isEditable = EDITABLE_COLUMNS.has(colId);

                                            return (
                                            <div
                                                key={cell.id}
                                                className={`flex items-center ${colId === 'category' ? 'overflow-visible' : 'overflow-hidden'} ${getStickyClass(colId)}`}
                                                onClick={() => {
                                                    if (isNavigable) setFocusedCell({ rowIndex: virtualRow.index, columnId: colId });
                                                }}
                                                onDoubleClick={() => {
                                                    if (isEditable) {
                                                        setFocusedCell({ rowIndex: virtualRow.index, columnId: colId });
                                                        startEditing(virtualRow.index, colId);
                                                    }
                                                }}
                                                style={{
                                                    width: colId === 'description' ? undefined : cell.column.getSize(),
                                                    flex: colId === 'description' ? '1 1 0' : undefined,
                                                    minWidth: colId === 'description' ? '250px' : undefined,
                                                    flexShrink: 0,
                                                    // Custom padding per column
                                                    padding: colId === 'select' ? '0 4px 0 12px' :  // Checkbox: 12px left padding
                                                        colId === 'balance' ? '0 6px 0 2px' :   // Balance: 6px right (SYMMETRIC)
                                                            '0 8px 0 2px',                               // Others: minimal left, standard right
                                                    borderRight: `1px solid ${TK.borderColor}`,
                                                    position: colId === 'category' ? 'relative' : undefined,
                                                    // Focus indicator
                                                    ...(isFocused ? {
                                                        boxShadow: 'inset 0 0 0 2px #3b82f6',
                                                        borderRadius: '2px',
                                                    } : {}),
                                                }}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        ref={editInputRef}
                                                        data-grid-edit="true"
                                                        type={colId === 'date' ? 'date' : colId === 'debit' || colId === 'credit' ? 'number' : 'text'}
                                                        step={colId === 'debit' || colId === 'credit' ? '0.01' : undefined}
                                                        value={editingCell.value}
                                                        onChange={(e) => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                commitCellEdit(editingCell.rowIndex, editingCell.columnId, editingCell.value);
                                                                const nextRow = Math.min(virtualRow.index + 1, table.getRowModel().rows.length - 1);
                                                                setFocusedCell({ rowIndex: nextRow, columnId: colId });
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setEditingCell(null);
                                                            } else if (e.key === 'Tab') {
                                                                e.preventDefault();
                                                                commitCellEdit(editingCell.rowIndex, editingCell.columnId, editingCell.value);
                                                                const ci = NAV_COLUMNS.indexOf(colId);
                                                                if (e.shiftKey) {
                                                                    if (ci > 0) setFocusedCell({ rowIndex: virtualRow.index, columnId: NAV_COLUMNS[ci - 1] });
                                                                } else {
                                                                    if (ci < NAV_COLUMNS.length - 1) setFocusedCell({ rowIndex: virtualRow.index, columnId: NAV_COLUMNS[ci + 1] });
                                                                }
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            commitCellEdit(editingCell.rowIndex, editingCell.columnId, editingCell.value);
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            border: 'none',
                                                            outline: 'none',
                                                            background: '#eff6ff',
                                                            padding: '4px 6px',
                                                            fontSize: TK.cellFontSize,
                                                            fontFamily: colId === 'debit' || colId === 'credit' ? 'JetBrains Mono, monospace' : TK.fontFamily,
                                                            textAlign: colId === 'debit' || colId === 'credit' ? 'right' : 'left',
                                                            boxSizing: 'border-box',
                                                        }}
                                                    />
                                                ) : (
                                                <div className="w-full text-left">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </div>
                                                )}
                                            </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20">
                            <i className="ph ph-database text-[#cbd5e1] text-[64px] mb-4"></i>
                            <h3 className="text-[16px] font-semibold text-[#64748b] mb-2">No transactions found</h3>
                            <p className="text-[13px] text-[#94a3b8] mb-4">Import a bank statement to get started</p>
                            <button
                                onClick={handleAddTransaction}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 20px',
                                    background: '#3b82f6',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                <i className="ph ph-plus-circle" style={{ fontSize: '15px' }}></i>
                                Add Manual Transaction
                            </button>
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

            {/* RESIZABLE PANEL SYSTEM: One panel, swap content based on activePanel */}
            <ResizablePanel
                isOpen={activePanel !== null}
                onClose={() => setActivePanel(null)}
                title={
                    activePanel === 'utility' ? 'Dashboard & Stats' :
                        activePanel === 'report' ? 'Trial Balance' :
                            'Panel'
                }
                defaultWidth={360}
                minWidth={350}
                maxWidth={450}
            >
                {activePanel === 'utility' && (
                    <UtilityBar
                        transactions={data}
                        activeFilter={activeFilterLabel}
                        accounts={window.RoboLedger?.Accounts?.getActive?.() || window.RoboLedger?.Accounts?.getAll() || []}
                        selectedAccount={window.UI_STATE?.selectedAccount || 'ALL'}
                        onAccountChange={(value) => window.switchAccount?.(value)}
                        onClearFilter={() => {
                            const source = window._txGridAllData || data;
                            window.__txGridSetData?.(source);
                            setActiveFilterLabel(null);
                            window._txGridActiveFilter = null;
                        }}
                        onFilterTransactions={(spec) => {
                            // source = the current full unfiltered dataset at this level
                            const source = window._txGridAllData || data;
                            if (!window._txGridAllData) window._txGridAllData = source;

                            if (!spec) {
                                // Clear all
                                window.__txGridSetData?.(source);
                                window._txGridActiveFilter = null;
                                setDrillStack([]);
                            } else if (typeof spec.filter === 'function') {
                                const filtered = source.filter(spec.filter);
                                const label    = spec.label || 'Filtered';

                                // Push a new level onto the drill stack
                                // Each entry records: the label shown, the filtered rows, and the source
                                setDrillStack(prev => [
                                    ...prev,
                                    { label, data: filtered, source }
                                ]);

                                window.__txGridSetData?.(filtered);
                                window._txGridActiveFilter = label;

                                // Update source pointer so next drill uses filtered as base
                                window._txGridAllData = source;
                            }
                        }}
                    />
                )}
                {activePanel === 'report' && (
                    <LiveReportPanel
                        reportType="trial-balance"
                        transactions={data}
                        selectedAccount={columnFilters.find(f => f.id === 'category')?.value || null}
                        onAccountClick={(accountCode, accountName) => {
                            // Report mode drill: filter grid to this account's transactions
                            // AND push to breadcrumb trail
                            const source = window._txGridAllData || data;
                            if (!window._txGridAllData) window._txGridAllData = source;

                            const filtered = source.filter(tx =>
                                tx.category === accountCode ||
                                tx.gst_account === accountCode
                            );
                            const label = accountName
                                ? `${accountCode} · ${accountName}`
                                : accountCode;

                            setDrillStack(prev => [...prev, {
                                label,
                                data: filtered,
                                source,
                            }]);

                            window.__txGridSetData?.(filtered);
                            window._txGridAllData = source;
                            window._txGridActiveFilter = label;

                            // Also set column filter so trial balance highlights the row
                            setColumnFilters([{ id: 'category', value: accountCode }]);
                        }}
                        onClearFilter={() => {
                            // Clear both column filter and drill stack
                            setColumnFilters(filters => filters.filter(f => f.id !== 'category'));
                            const rootData = drillStack[0]?.source || window._txGridAllData || data;
                            window.__txGridSetData?.(rootData);
                            window._txGridAllData = rootData;
                            window._txGridActiveFilter = null;
                            setDrillStack([]);
                        }}
                    />
                )}
            </ResizablePanel>
        </div>
    );
}
