/**
 * RoboLedgers: Reconciliation Audit Trail
 * Reference: docs/canonical_specifications/04_reconciliation_layer.md (Section 7.5)
 */
export interface ReconAuditEntry {
    readonly account_id: string;
    readonly timestamp: string;
    readonly inputs: {
        opening: number;
        debits: number;
        credits: number;
        closing: number;
    };
    readonly calculated_variance: number;
    readonly outcome: 'SUCCESS' | 'FAILURE';
    readonly proof_hash?: string;
}

export class ReconciliationAuditTrail {
    private static journal: ReconAuditEntry[] = [];

    /**
     * Logs a reconciliation event to the immutable journal.
     */
    static log(entry: ReconAuditEntry): void {
        this.journal.push(Object.freeze(entry));

        const icon = entry.outcome === 'SUCCESS' ? '✅' : '❌';
        console.log(`[AUDIT] RECON ${icon}: ${entry.account_id} | Variance: ${entry.calculated_variance}c`);
    }

    static getHistory(accountId: string): ReconAuditEntry[] {
        return this.journal.filter(e => e.account_id === accountId);
    }

    static clear(): void {
        this.journal = [];
    }
}
