import React from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { columns } from './columns'

export function TransactionsTable({ data }: { data: any[] }) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    const parentRef = React.useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56,
        overscan: 10,
    })

    return (
        <div
            ref={parentRef}
            className="transactions-table-container h-full overflow-auto"
            style={{ height: '100%', width: '100%' }}
        >
            <div
                className="transactions-table-body relative w-full"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const row = table.getRowModel().rows[virtualRow.index]
                    return (
                        <div
                            key={row.id}
                            className="transactions-table-row flex border-b absolute top-0 left-0 w-full"
                            style={{
                                height: '56px',
                                transform: `translateY(${virtualRow.start}px)`
                            }}
                        >
                            {row.getVisibleCells().map(cell => (
                                <div
                                    key={cell.id}
                                    className="transactions-table-cell px-4 flex items-center overflow-hidden"
                                    style={{ width: cell.column.getSize() }}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                            ))}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
