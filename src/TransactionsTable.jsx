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
    rowHeight: 56, // Comfortable density (px)
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
    const fullDesc = row.payee || row.description || 'No Description';

    let payeeName = fullDesc;
    let transactionType = row.transaction_type_label || '';

    if (fullDesc.includes(',')) {
        const parts = fullDesc.split(',');
        payeeName = parts[0].trim();
        transactionType = parts.slice(1).join(',').trim();
    }

    return (
        <div className="flex flex-col overflow-hidden" style={{ gap: '2px' }}>
            <span
                className="truncate"
                style={{
                    fontSize: GRID_TOKENS.descLine1FontSize,
                    fontWeight: GRID_TOKENS.descLine1FontWeight,
                    color: GRID_TOKENS.descLine1Color,
                    lineHeight: GRID_TOKENS.cellLineHeight
                }}
            >
                {payeeName}
            </span>
            {transactionType && (
                <span
                    className="truncate"
                    style={{
                        fontSize: GRID_TOKENS.descLine2FontSize,
                        fontWeight: GRID_TOKENS.descLine2FontWeight,
                        color: GRID_TOKENS.descLine2Color,
                        lineHeight: GRID_TOKENS.cellLineHeight
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

    // 2. Ref # (e.g., CHQ1-001)
    columnHelper.accessor('ref', {
        header: 'REF #',
        size: 100,
        minSize: 90,
        maxSize: 120,
        cell: info => (
            <span
                style={{
                    fontSize: GRID_TOKENS.cellFontSize,
                    fontWeight: GRID_TOKENS.cellFontWeight,
                    color: GRID_TOKENS.cellColor,
                    fontVariantNumeric: 'tabular-nums'
                }}
            >
                {info.getValue() || '-'}
            </span>
        )
    }),

    // 3. Date
    columnHelper.accessor('date', {
        header: 'DATE',
        size: 110,
        minSize: 100,
        maxSize: 130,
        cell: info => (
            <span
                style={{
                    fontSize: GRID_TOKENS.cellFontSize,
                    fontWeight: GRID_TOKENS.cellFontWeight,
                    color: GRID_TOKENS.cellColor,
                    fontVariantNumeric: 'tabular-nums'
                }}
            >
                {info.getValue()}
            </span>
        )
    }),

    // 4. Description (Two-line cell - Flex)
    columnHelper.display({
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
            return (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: GRID_TOKENS.debitColor,
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
            return (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: GRID_TOKENS.creditColor,
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
        size: 150,
        minSize: 120,
        maxSize: 200,
        cell: info => (
            <span
                className="truncate"
                style={{
                    fontSize: GRID_TOKENS.cellFontSize,
                    fontWeight: GRID_TOKENS.cellFontWeight,
                    color: GRID_TOKENS.cellColor
                }}
            >
                {info.getValue() || 'Uncategorized'}
            </span>
        )
    }),

    // 8. Balance
    columnHelper.accessor('balance', {
        header: 'BALANCE',
        size: 140,
        minSize: 120,
        maxSize: 170,
        cell: info => {
            const val = info.getValue() || 0;
            return (
                <span
                    className="text-right block"
                    style={{
                        fontSize: GRID_TOKENS.numberFontSize,
                        fontWeight: GRID_TOKENS.numberFontWeight,
                        color: val < 0 ? GRID_TOKENS.negativeColor : GRID_TOKENS.cellColor,
                        fontVariantNumeric: 'tabular-nums'
                    }}
                >
                    {formatCurrency(val)}
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
        <div className="flex flex-col h-full w-full bg-white overflow-hidden relative">
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
                                            className={`flex items-center overflow-hidden ${getStickyClass(cell.column.id)}`}
                                            style={{
                                                width: cell.column.id === 'description' ? undefined : cell.column.getSize(),
                                                flex: cell.column.id === 'description' ? '1 1 0' : undefined,
                                                minWidth: cell.column.id === 'description' ? '250px' : undefined,
                                                flexShrink: 0,
                                                padding: `0 ${GRID_TOKENS.rowPaddingX}`,
                                                borderRight: `1px solid ${GRID_TOKENS.borderColor}`
                                            }}
                                        >
                                            <div className="w-full overflow-hidden">
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
