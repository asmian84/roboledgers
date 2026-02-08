const {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper
} = window.ReactTable;

const { useVirtualizer } = window.ReactVirtual;

// 1. PayeeCell Renderer
function PayeeCell({ row }) {
    return (
        <div className="flex flex-col leading-tight py-1">
            <span className="text-[13.5px] font-bold text-[#1e293b] truncate">
                {row.payee || row.description || 'No Description'}
            </span>
            <span className="text-[11px] text-[#64748b] truncate opacity-80">
                {row.transaction_type_label || row.raw_description || '—'}
            </span>
        </div>
    );
}

// 2. Column Definitions
const columnHelper = createColumnHelper();

const columns = [
    columnHelper.accessor('date', {
        header: 'Date',
        size: 110,
        cell: info => <span className="text-[#475569] font-mono">{info.getValue()}</span>
    }),
    columnHelper.display({
        id: 'payee',
        header: 'Description',
        size: 360,
        cell: ({ row }) => <PayeeCell row={row.original} />,
    }),
    columnHelper.accessor('category', {
        header: 'Category',
        size: 200,
        cell: info => <span className="text-[#64748b]">{info.getValue() || 'Uncategorized'}</span>
    }),
    columnHelper.accessor('debit', {
        header: 'Debit',
        size: 110,
        cell: info => {
            const val = info.getValue();
            return val ? <span className="text-[#ef4444] font-bold">${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-';
        }
    }),
    columnHelper.accessor('credit', {
        header: 'Credit',
        size: 110,
        cell: info => {
            const val = info.getValue();
            return val ? <span className="text-[#10b981] font-bold">${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-';
        }
    }),
    columnHelper.accessor('balance', {
        header: 'Balance',
        size: 130,
        cell: info => <span className="text-[#1e293b] font-mono font-bold">${(info.getValue() || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
    }),
];

// 3. TransactionsTable Component
function TransactionsTable({ data }) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const parentRef = React.useRef(null);

    const rowVirtualizer = useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52, // Professional density
        overscan: 15,
    });

    return (
        <div
            ref={parentRef}
            className="rl-grid-container h-full overflow-auto"
            style={{ height: '100%', width: '100%', scrollbarGutter: 'stable' }}
        >
            <div
                className="relative w-full"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const row = table.getRowModel().rows[virtualRow.index];
                    return (
                        <div
                            key={row.id}
                            className="flex border-b border-[#f1f5f9] absolute top-0 left-0 w-full hover:bg-[#f8fafc] transition-colors cursor-pointer"
                            style={{
                                height: '52px',
                                transform: `translateY(${virtualRow.start}px)`
                            }}
                        >
                            {row.getVisibleCells().map(cell => (
                                <div
                                    key={cell.id}
                                    className="px-4 flex items-center overflow-hidden border-r border-[#f8fafc] last:border-r-0"
                                    style={{ width: cell.column.getSize() }}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// 4. Global Bridge
window.renderTransactionsGrid = (data) => {
    const container = document.getElementById('txnGrid');
    if (!container) return;

    if (!window._txGridRoot) {
        window._txGridRoot = ReactDOM.createRoot(container);
    }

    // Ensure data is properly structured for the grid
    const canonicalData = data.map(tx => ({
        ...tx,
        payee: tx.description || tx.raw_description || 'Unknown',
        debit: tx.polarity === 'DEBIT' ? tx.amount_cents / 100 : null,
        credit: tx.polarity === 'CREDIT' ? tx.amount_cents / 100 : null,
        balance: tx.balance_cents / 100 || 0,
        category: tx.category_code || tx.category || ''
    }));

    window._txGridRoot.render(
        <TransactionsTable data={canonicalData} />
    );
};
