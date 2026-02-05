import type { AdjustingJournalEntry } from './aje.ts';

/**
 * RoboLedgers: AJE Audit Trail
 */
export interface AJEAuditLog {
    readonly aje_id: string;
    readonly period_id: string;
    readonly actor_id: string;
    readonly reason_code: string;
    readonly balance_cents: number;
    readonly timestamp: string;
}

export class AJEAuditService {
    private static log: AJEAuditLog[] = [];

    /**
     * Records the creation/posting of an AJE.
     */
    static record(aje: AdjustingJournalEntry): void {
        const entry: AJEAuditLog = {
            aje_id: aje.aje_id,
            period_id: aje.period_id,
            actor_id: aje.created_by,
            reason_code: aje.reason_code,
            balance_cents: aje.entries[0]?.amount_cents || 0, // Simplified for log view
            timestamp: new Date().toISOString()
        };

        this.log.push(Object.freeze(entry));
        console.log(`[AUDIT] AJE POSTED: ${aje.aje_id} | Period: ${aje.period_id} | Reason: ${aje.reason_code}`);
    }

    static getHistory(periodId: string): AJEAuditLog[] {
        return this.log.filter(l => l.period_id === periodId);
    }

    static clear(): void {
        this.log = [];
    }
}
