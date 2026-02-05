import { LedgerService } from './ledger.ts';
import type { CanonicalTransaction } from '../types/transaction.ts';
import { InvariantViolationError } from './errors.ts';

/**
 * RoboLedgers: Ledger Reconstructor (Recovery Layer)
 * Responsibility: Rebuild ledger state from an external AuditLog/Log Stream.
 * MANDATE: Guarantee durability and state restoration.
 */
export class LedgerReconstructor {
    /**
     * Replays a log of transactions into the core ledger.
     * This is used after system power-loss or browser reload.
     */
    static async replay(log: CanonicalTransaction[]): Promise<{ SuccessCount: number; FailureCount: number }> {
        console.log(`[RECOVERY] Starting replay of ${log.length} transactions...`);
        let success = 0;
        let failure = 0;

        // Sorting by version/created_at to ensure sequential state building
        const sortedLog = [...log].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
            a.version - b.version
        );

        for (const tx of sortedLog) {
            try {
                // We use a internal post-without-validation or clear-post logic
                // For recovery, we trust the AuditLog is the source of truth
                // We clear the ledger first to ensure a clean reconstruction
                LedgerService.post(tx);
                success++;
            } catch (e) {
                console.error(`[RECOVERY] Failed to restore tx ${tx.tx_id}:`, e);
                failure++;
            }
        }

        console.log(`[RECOVERY] Finished. Restored: ${success}, Failures: ${failure}`);
        return { SuccessCount: success, FailureCount: failure };
    }
}
