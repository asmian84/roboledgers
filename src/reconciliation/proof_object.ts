import { createHash } from 'crypto';

/**
 * RoboLedgers: Reconciliation Proof Object
 * An immutable cryptographic proof of mathematical reconciliation.
 * Reference: docs/canonical_specifications/04_reconciliation_layer.md
 */

export interface ReconciliationProof {
    readonly account_id: string;
    readonly period_start: string; // ISO Date
    readonly period_end: string;   // ISO Date
    readonly opening_balance_cents: number;
    readonly sum_debits_cents: number;
    readonly sum_credits_cents: number;
    readonly closing_balance_cents: number;
    readonly variance_cents: number; // MUST be 0
    readonly proof_hash: string;   // SHA-256 manifest
    readonly generated_at: string; // RFC-3339
}

export class ProofGenerator {
    /**
     * Generates a deterministic hash for a reconciliation proof.
     */
    static generateHash(proof: Omit<ReconciliationProof, 'proof_hash'>): string {
        const manifest = JSON.stringify({
            account_id: proof.account_id,
            period: `${proof.period_start}_${proof.period_end}`,
            math: `${proof.opening_balance_cents}_${proof.sum_debits_cents}_${proof.sum_credits_cents}_${proof.closing_balance_cents}`,
            variance: proof.variance_cents
        });

        // Using native Node.js crypto (consistent with txsig)
        return createHash('sha256').update(manifest).digest('hex');
    }
}
