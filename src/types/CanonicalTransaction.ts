export type CanonicalTransaction = {
    id: string
    date: string
    payee: string
    transaction_type_label: string
    category?: string | null
    debit?: number | null
    credit?: number | null
    balance: number
    status: 'needs_review' | 'categorized' | 'matched'
}
