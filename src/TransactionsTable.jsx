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

// --- Sub-components ---

function StatusChip({ status }) {
    const statusColors = {
        'needs_review': { bg: '#fef3c7', text: '#92400e', label: 'Needs review' },
        'auto_categorized': { bg: '#dbeafe', text: '#1e40af', label: 'Auto-categorized' },
        'matched': { bg: '#d1fae5', text: '#065f46', label: 'Matched' },
        'excluded': { bg: '#f1f5f9', text: '#475569', label: 'Excluded' }
    };

    const config = statusColors[status] || statusColors['needs_review'];

    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
            style={{ background: config.bg, color: config.text }}
        >
            {config.label}
        </span>
    );
}

function PayeeCell({ row }) {
    const mainText = row.payee || row.description || 'No Description';
    const subText = row.transaction_type_label || ''; // Don't fallback to raw_description

    return (
        <div className="flex flex-col leading-tight py-1 overflow-hidden">
            <span className="text-[13.5px] font-bold text-[#1e293b] truncate">
                {mainText}
            </span>
            {subText && (
                <span className="text-[11px] text-[#64748b] truncate opacity-80">
                    {subText}
                </span>
            )}
        </div>
    );
}

function StatusCell({ status }) {
    return <StatusChip status={status || 'needs_review'} />;
}

function Checkbox({ checked, indeterminate, onChange, className = '' }) {
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

// --- Column Definitions ---
const columnHelper = createColumnHelper();

const columns = [
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
    columnHelper.accessor('date', {
        header: 'Date',
        minSize: 100,
        maxSize: 150,
        cell: info => <span className="text-[#475569] font-mono">{info.getValue()}</span>
    }),
    columnHelper.accessor('status', {
        header: 'Status',
        minSize: 110,
        maxSize: 160,
        cell: info => <StatusCell status={info.getValue()} />
    }),
    columnHelper.display({
        id: 'payee',
        header: 'Description',
        minSize: 250,
        maxSize: 600,
        size: 400, // Preferred size, takes remaining space
        cell: ({ row }) => <PayeeCell row={row.original} />,
    }),
    columnHelper.accessor('category', {
        header: 'Category',
        minSize: 120,
        maxSize: 200,
        cell: info => <span className="text-[#64748b] truncate">{info.getValue() || 'Uncategorized'}</span>
    }),
    columnHelper.accessor('debit', {
        header: 'Debit',
        minSize: 100,
        maxSize: 150,
        cell: info => {
            const val = info.getValue();
            return val ? <span className="text-[#ef4444] font-bold">${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-';
        }
    }),
    columnHelper.accessor('credit', {
        header: 'Credit',
        minSize: 100,
        maxSize: 150,
        cell: info => {
            const val = info.getValue();
            return val ? <span className="text-[#10b981] font-bold">${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-';
        }
    }),
    columnHelper.accessor('balance', {
        header: 'Balance',
        minSize: 110,
        maxSize: 160,
        cell: info => {
            // Balance is already in dollars, no conversion needed
            const balance = info.getValue() || 0;
            return <span className="text-[#1e293b] font-mono font-bold">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
        }
    }),
];

// --- Main Component ---

export function TransactionsTable({ data: initialData, globalFilter: initialGlobalFilter }) {
    const [data, setData] = useState(initialData || []);
    const [sorting, setSorting] = useState([{ id: 'date', desc: true }]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter || '');
    const [rowSelection, setRowSelection] = useState({});
    const [density, setDensity] = useState('comfortable'); // compact | comfortable | spacious

    // Expose density updater to window for app.js
    useEffect(() => {
        window.updateGridDensity = (newDensity) => {
            setDensity(newDensity);
        };
        return () => {
            delete window.updateGridDensity;
        };
    }, []);
    const [showColManager, setShowColManager] = useState(false);

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

    // Density row heights: Compact 40px, Comfortable 56px, Spacious 72px
    const getRowHeight = () => {
        switch (density) {
            case 'compact': return 40;
            case 'spacious': return 72;
            default: return 56; // comfortable
        }
    };

    const rowVirtualizer = useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: getRowHeight,
        overscan: 15,
    });

    // Stickiness Helper
    const getStickyClass = (id) => {
        if (id === 'date' || id === 'select') return 'sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]';
        if (id === 'balance') return 'sticky right-0 bg-white z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]';
        return '';
    };

    return (
        <div className="flex flex-col h-full w-full bg-white overflow-hidden relative">
            {/* Batch Action Bar - Only shown when rows selected */}
            {Object.keys(rowSelection).length > 0 && (
                <div className="flex items-center px-6 py-3 bg-blue-50 border-b border-blue-100 z-30">
                    <span className="text-sm font-bold text-blue-900">{Object.keys(rowSelection).length} selected</span>
                    <div className="ml-auto flex items-center gap-2">
                        <button className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">Categorize</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">Match</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">Exclude</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">Split</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded hover:bg-red-50">Delete</button>
                        <button onClick={() => setRowSelection({})} className="ml-2 p-1.5 text-gray-500 hover:text-gray-700">
                            <i className="ph ph-x text-sm"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Header Rendering */}
            <div className="flex bg-[#f8fafc] border-b border-[#e2e8f0] sticky top-0 z-20">
                {table.getFlatHeaders().map(header => (
                    <div
                        key={header.id}
                        className={`relative px-4 py-3 text-left text-[11px] font-bold text-[#64748b] uppercase tracking-wider flex items-center group select-none ${getStickyClass(header.id)} ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                        style={header.id === 'payee' ? { flex: '1 1 0', minWidth: '200px' } : { width: header.getSize(), flexShrink: 0 }}
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
                className="flex-1 overflow-auto bg-[#fafbfc]"
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
                                    className={`flex border-b border-[#f1f5f9] absolute top-0 left-0 w-full transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50' : 'hover:bg-[#f8fafc] bg-white'}`}
                                    style={{
                                        height: `${density === 'compact' ? 40 : 52}px`,
                                        transform: `translateY(${virtualRow.start}px)`
                                    }}
                                    onClick={() => row.toggleSelected()}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <div
                                            key={cell.id}
                                            className={`px-4 flex items-center overflow-hidden border-r border-[#f1f5f9] last:border-r-0 ${getStickyClass(cell.column.id)}`}
                                            style={cell.column.id === 'payee' ? { flex: '1 1 0', minWidth: '200px' } : { width: cell.column.getSize(), flexShrink: 0 }}
                                        >
                                            <div className="truncate w-full">
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
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <i className="ph ph-mask-happy text-slate-300 text-[40px]"></i>
                        </div>
                        <h3 className="text-[18px] font-bold text-slate-800 mb-2">No transactions found</h3>
                        <p className="text-[14px] text-slate-500 max-width-[320px] text-center px-8">
                            Drag a bank statement here or use the <span className="font-bold text-blue-600">Browse files</span> button to start auditing.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
