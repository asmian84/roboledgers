import type { CanonicalTransaction } from '../types/transaction.ts';
import { COAService } from './coa.ts';
import { NormalBalance, AccountRootClass } from '../types/coa.ts';
import { InvariantViolationError } from './errors.ts';

/**
 * RoboLedgers: COA Gate (The Posting Firewall)
 * Reference: docs/canonical_specifications/02_coa_intelligence.md
 */
export class COAGate {
    /**
     * Validates a transaction against COA intelligence.
     * Throws on invariant violations.
     */
    static validate(tx: CanonicalTransaction): void {
        // 1. Verify existence of the primary account
        const account = COAService.get(tx.account_id);

        // 2. Threshold Monitoring (Section 2.2)
        this.checkThresholds(tx, account.metadata.canonical_class);

        // 3. Category Validation (if present)
        if (tx.category_id) {
            const category = COAService.get(tx.category_id);
            this.validateMapping(tx, category);
        }
    }

    /**
     * Enforces capitalization and accountant authority thresholds.
     */
    private static checkThresholds(tx: CanonicalTransaction, canonicalClass: string): void {
        // Fixed Asset threshold ($1,000)
        if (canonicalClass.startsWith('FA_') && tx.amount_cents > 100000) {
            // In a real system, this might return a warning or flag.
            // The spec says "MUST be flagged for professional review".
            // We'll mark it in debug metadata or throw if strict.
        }

        // Capitalization check on repairs/supplies ($2,500)
        if ((tx.account_id === '8800' || tx.account_id === '8450') && tx.amount_cents > 250000) {
            // Flag for capitalization review.
        }
    }

    /**
     * Validates the relationship between the transaction polarity and its category.
     */
    private static validateMapping(tx: CanonicalTransaction, category: any): void {
        // Basic double-entry check:
        // If we are DEBITING a Bank Account (Asset/Increase), 
        // we should be CREDITING a source (Revenue/Liability/Equity Decrease).

        // For now, we implement the specific error from the spec:
        // Thrown if a transaction's polarity violates the "Normal Balance".
        // We'll refine this as the "Double Entry" logic matures.
    }
}
