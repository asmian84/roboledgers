import { createColumnHelper } from '@tanstack/react-table'
import { CanonicalTransaction } from '../../types/CanonicalTransaction'
import { PayeeCell } from './renderers/PayeeCell'

const columnHelper = createColumnHelper<CanonicalTransaction>()

export const columns = [
    columnHelper.accessor('date', {
        header: 'Date',
        size: 110,
    }),

    columnHelper.display({
        id: 'payee',
        header: 'Description',
        size: 360,
        cell: ({ row }) => <PayeeCell row={ row.original } />,
  }),

columnHelper.accessor('category', {
    header: 'Category',
    size: 200,
}),

    columnHelper.accessor('debit', {
        header: 'Debit',
        size: 140,
    }),

    columnHelper.accessor('credit', {
        header: 'Credit',
        size: 140,
    }),

    columnHelper.accessor('balance', {
        header: 'Balance',
        size: 160,
    }),
]
