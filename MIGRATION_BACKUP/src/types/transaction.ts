/**
 * RoboLedgers: Canonical Transaction Core
 * Reference: docs/canonical_specifications/01_accounting_invariants.md
 */

export const Polarity = {
    DEBIT: 'DEBIT',
    CREDIT: 'CREDIT'
} as const;

export type Polarity = (typeof Polarity)[keyof typeof Polarity];

export const TransactionStatus = {
    RAW: 'RAW',
    PREDICTED: 'PREDICTED',
    CONFIRMED: 'CONFIRMED',
    RECONCILED: 'RECONCILED',
    LOCKED: 'LOCKED',
    VOIDED: 'VOIDED',
    VOID_REPLACEMENT: 'VOID-REPLACEMENT'
} as const;

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export interface CanonicalTransaction {
    // CORE-IMMUTABLE
    readonly tx_id: string;          // UUID v4
    readonly account_id: string;     // UUID v4
    readonly date: string;           // ISO-8601 YYYY-MM-DD
    readonly amount_cents: number;   // Integer
    readonly currency: string;       // ISO-4217
    readonly polarity: Polarity;
    readonly raw_description: string;
    readonly txsig: string;          // SHA-256
    readonly source_system: string;
    readonly source_locator?: {      // New Forensic Field
        page: number;
        y_coord: number;
    };
    readonly created_at: string;     // RFC-3339

    // VERSIONED
    version: number;                 // Starts at 1
    status: TransactionStatus;
    category_id?: string;            // UUID v4
    clean_description?: string;
    notes?: string;
    tags?: string[];
    updated_at: string;
}

/**
 * Transaction Verification Trace
 * Used for Categorization Brain transparency.
 */
export interface TransactionTrace {
    tx_id: string;
    tcv: Record<string, any>;
    scores: {
        identity: number;
        memory: number;
        context: number;
        similarity: number;
        gate: number;
        penalty: number;
    };
    final_confidence: number;
    decision_rule_id: string;
}
