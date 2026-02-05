import type { ScoreBreakdown } from './scoring.ts';

/**
 * RoboLedgers: Decision Trace
 * An immutable record of a categorization event.
 * Reference: docs/canonical_specifications/03_categorization_brain.md (Section 1.1, Step 8)
 */
export interface DecisionTrace {
    readonly tx_id: string;
    readonly timestamp: string;
    readonly candidate_category: string;
    readonly scores: ScoreBreakdown;
    readonly final_confidence: number;
    readonly gate_passed: boolean;
    readonly outcome: 'ACCEPTED' | 'DEFERRED' | 'REJECTED';
}

export class DecisionTraceLogger {
    private static traces: Map<string, DecisionTrace[]> = new Map();

    /**
     * Logs a decision trace for a transaction.
     */
    static log(trace: DecisionTrace): void {
        const history = this.traces.get(trace.tx_id) || [];

        // In a real system, this would be a write-once DB (like AuditLogDB).
        // For this build, we store it in memory but treat it as immutable.
        history.push(Object.freeze(trace));
        this.traces.set(trace.tx_id, history);

        console.log(`[BRAIN] TRACE LOGGED: ${trace.tx_id} -> ${trace.candidate_category} (Conf: ${trace.final_confidence})`);
    }

    /**
     * Retrieves the decision history for a transaction.
     */
    static getHistory(txId: string): DecisionTrace[] {
        return this.traces.get(txId) || [];
    }

    static clear(): void {
        this.traces.clear();
    }
}
