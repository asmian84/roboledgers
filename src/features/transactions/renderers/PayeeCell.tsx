export function PayeeCell({ row }: { row: any }) {
    return (
        <div className="flex flex-col leading-tight">
            <span className="text-[13.5px] font-medium text-gray-900 truncate">
                {row.payee}
            </span>

            <span className="text-[12px] text-gray-500 truncate">
                {row.transaction_type_label}
            </span>
        </div>
    )
}
