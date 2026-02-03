import { SystemGuard } from './system_guard.ts';
import type { CanonicalTransaction } from '../types/transaction.ts';
import { TransactionStatus } from '../types/transaction.ts';
import { InvariantViolationError } from './errors.ts';

/**
 * RoboLedgers: Core Ledger Service
 * The "Truth Vault" that enforces accounting invariants at the application layer.
 */
export class LedgerService {
    private static transactions: Map<string, CanonicalTransaction> = new Map();
    // Map of txsig -> tx_id for duplicate detection
    private static sigIndex: Map<string, string> = new Map();

    /**
     * Checks if a transaction signature already exists.
     */
    static existsBySig(txsig: string): boolean {
        return this.sigIndex.has(txsig);
    }

    /**
     * Posts a new transaction to the ledger.
     * MANDATE: Enforces txsig uniqueness and Core Immutability.
     */
    static post(tx: CanonicalTransaction): void {
        SystemGuard.assertWritable();
        // 1. Duplicate Detection (txsig)
        if (this.sigIndex.has(tx.txsig)) {
            throw new InvariantViolationError(
                'TXSIG_DUPLICATE',
                `A transaction with footprint ${tx.txsig} already exists in account ${tx.account_id}`,
                { tx_id: tx.tx_id, txsig: tx.txsig }
            );
        }

        // 2. Persist
        this.transactions.set(tx.tx_id, { ...tx });
        this.sigIndex.set(tx.txsig, tx.tx_id);

        console.log(`[LEDGER] POSTED: ${tx.tx_id} | ${tx.amount_cents} ${tx.currency} | ${tx.txsig}`);
    }

    /**
     * Voids an existing transaction.
     * MANDATE: Original records are NEVER deleted.
     */
    static void(tx_id: string, actor_id: string): void {
        SystemGuard.assertWritable();
        const tx = this.transactions.get(tx_id);
        if (!tx) {
            throw new InvariantViolationError('TX_NOT_FOUND', `Transaction ${tx_id} does not exist`);
        }

        if (tx.status === TransactionStatus.VOIDED) {
            return; // Already voided
        }

        // Update status to VOIDED and increment version
        const updatedTx: CanonicalTransaction = {
            ...tx,
            status: TransactionStatus.VOIDED,
            version: tx.version + 1,
            updated_at: new Date().toISOString()
        };

        this.transactions.set(tx_id, updatedTx);
        console.log(`[LEDGER] VOIDED: ${tx_id} (Version: ${updatedTx.version})`);
    }

    /**
     * Prevents destructive updates to CORE-IMMUTABLE fields.
     */
    static preventMutation(tx_id: string, proposed: Partial<CanonicalTransaction>): void {
        const existing = this.transactions.get(tx_id);
        if (!existing) return;

        const immutableFields: (keyof CanonicalTransaction)[] = [
            'tx_id', 'account_id', 'date', 'amount_cents', 'currency', 'polarity', 'raw_description', 'txsig', 'source_locator'
        ];

        for (const field of immutableFields) {
            if (proposed[field] !== undefined && proposed[field] !== existing[field]) {
                throw new InvariantViolationError(
                    'IMMUTABLE_FIELD',
                    `Field "${field}" is immutable and cannot be modified. Use VOID and REPLACE.`,
                    { tx_id, field }
                );
            }
        }
    }

    // Internal helper for tests
    static clear(): void {
        this.transactions.clear();
        this.sigIndex.clear();
    }
}
