import type { TransactionStatus } from '../../types/transaction.ts';

/**
 * RoboLedgers: Zen Mode UX Contract
 * A high-abstraction lens for business owners.
 * Rule: No account codes, no txsigs, only merchant-focused intent.
 */

export interface ZenTransactionProjection {
    readonly id: string;
    readonly merchant_display: string;
    readonly category_name: string;
    readonly amount_display: string; // e.g., "$12.50"
    readonly date: string;
    readonly status_badge: TransactionStatus;
    readonly confidence_label: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ZenIntentRequests {
    /**
     * Request to rename a merchant globally.
     * This updates the normalization map, not the raw transaction.
     */
    renameMerchant(rawName: string, newName: string): Promise<void>;

    /**
     * Request to confirm a predicted category.
     */
    confirmCategory(txId: string): Promise<void>;
}
