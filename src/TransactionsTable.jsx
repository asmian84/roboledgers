import React, { useRef, useEffect, useState } from 'react';
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

// ═══════════════════════════════════════════════════════════════════════════
// GRID DESIGN TOKENS — SINGLE SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════════════════

const GRID_TOKENS = {
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
    rowHeight: 56, // Increased from 48 to accommodate 2-line descriptions // Comfortable density (px)
    rowPaddingX: '16px',

    // Colors
    debitColor: '#111827',
    creditColor: '#10b981',
    negativeColor: '#ef4444',
    borderColor: '#f1f5f9',
    hoverBg: '#f8fafc',
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
            const cleanedValue = editValue.trim().replace(/^,\s*/, '');

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
                    {/* Link icon for audit drawer (future) */}
                    <i
                        className="ph ph-link cursor-pointer hover:text-blue-500"
                        onClick={() => console.log('[AUDIT] Open drawer for:', row.tx_id)}
                        style={{
                            fontSize: '16px',
                            color: '#64748b'
                        }}
                        title="View source document"
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
        size: 130,
        minSize: 120,
        maxSize: 150,
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
        size: 140,
        minSize: 130,
        maxSize: 160,
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
        cell: ({ row }) => <DescriptionCell row={row.original} />
    }),

    // 5. Debit
    columnHelper.accessor('debit', {
        header: 'DEBIT',
        size: 120,
        minSize: 100,
        maxSize: 150,
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
        size: 120,
        minSize: 100,
        maxSize: 150,
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

    // 7. Account (COA Dropdown)
    columnHelper.accessor('category', {
        header: 'ACCOUNT',
        size: 200,
        minSize: 180,
        maxSize: 250,
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
        size: 140,
        minSize: 120,
        maxSize: 170,
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
        size: 110,
        minSize: 100,
        maxSize: 130,
        cell: info => {
            const val = info.getValue();
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
                    {val ? formatCurrency(val / 100) : '-'}
                </span>
            );
        }
    }),
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function TransactionsTable({ data: initialData, globalFilter: initialGlobalFilter }) {
    const [data, setData] = useState(initialData || []);
    const [sorting, setSorting] = useState([{ id: 'date', desc: true }]);
    const [columnVisibility, setColumnVisibility] = useState({ tax_cents: false }); // Hide GST by default
    const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter || '');
    const [rowSelection, setRowSelection] = useState({});
    const [density] = useState('comfortable'); // Fixed at comfortable for now

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
        return () => {
            delete window.setGridColumnVisibility;
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
        if (id === 'select' || id === 'ref') return 'sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]';
        if (id === 'balance') return 'sticky right-0 bg-white z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]';
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
                            return (
                                <div
                                    key={row.id}
                                    className={`flex absolute top-0 left-0 w-full transition-colors group ${isSelected ? 'bg-blue-50/50' : 'hover:bg-[#f8fafc] bg-white'}`}
                                    style={{
                                        height: `${GRID_TOKENS.rowHeight}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                        borderBottom: `1px solid ${GRID_TOKENS.borderColor}`
                                    }}
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
        </div>
    );
}
