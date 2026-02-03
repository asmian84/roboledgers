import type { TransactionStatus, Polarity } from '../../types/transaction.ts';

/**
 * RoboLedgers: Bookkeeper UX Contract
 * Middle-authority lens for transactional verification.
 */

export interface BookkeeperTransactionProjection {
    readonly id: string;
    readonly date: string;
    readonly description: string;
    readonly amount_cents: number;
    readonly polarity: Polarity;
    readonly status: TransactionStatus;
    readonly account_name: string;
    readonly category_code: string;
    readonly is_matched: boolean;
}

export interface BookkeeperIntentRequests {
    /**
     * Propose a categorization for a RAW/PREDICTED transaction.
     */
    proposeCategory(txId: string, categoryCode: string): Promise<void>;

    /**
     * Request a balance reconciliation.
     */
    requestReconciliation(accountId: string, periodRange: { start: string, end: string }): Promise<void>;

    /**
     * Link an internal transfer pair.
     */
    matchTransfer(txIdA: string, txIdB: string): Promise<void>;
}
