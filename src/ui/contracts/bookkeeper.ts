import type { TransactionStatus } from '../../types/transaction.ts';

/**
 * RoboLedgers: Bookkeeper UX Contract
 * Middle-authority lens for transactional verification and prep.
 */

export interface BookkeeperTransactionProjection {
    readonly tx_id: string;
    readonly date: string;
    readonly merchant: string;
    readonly amount_display: string;
    readonly amount_cents: number;
    readonly predicted_category: string;
    readonly confidence: number;
    readonly state: TransactionStatus;
    readonly account_name: string;
    readonly category_code: string;
    readonly is_matched: boolean;
    readonly allowed_categories: string[]; // For dropdowns
}

export interface ReconciliationPreview {
    readonly opening_balance: string;
    readonly computed_closing: string;
    readonly statement_closing: string;
    readonly variance: string;
    readonly blockers: string[];
}

export interface TransferCandidate {
    readonly source_tx_id: string;
    readonly dest_tx_id: string;
    readonly amount_match: boolean;
    readonly date_delta_days: number;
    readonly confidence: number;
}

export interface BookkeeperIntentRequests {
    /**
     * Intent: "This categorization is correct" or "Apply this new category"
     */
    confirmCategory(txId: string, categoryCode: string): Promise<void>;

    /**
     * Intent: "These represent the same movement of money"
     */
    pairTransfer(txIdA: string, txIdB: string): Promise<void>;

    /**
     * Intent: "Explain unusual or non-obvious transactions"
     */
    addAnnotation(txId: string, note: string): Promise<void>;

    /**
     * Intent: "Mark as statement-only or flag as missing"
     */
    flagDiscrepancy(txId: string, reason: string): Promise<void>;
}
