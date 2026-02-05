import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: Restatement Protocol
 * Manages versions of financial truth for a single period.
 * Reference: docs/canonical_specifications/05_authority_layer.md
 */
export interface PeriodVersion {
    readonly period_id: string;
    readonly version: number; // V1, V2, etc.
    readonly aje_ids: string[];
    readonly timestamp: string;
}

export class RestatementService {
    private static versions: Map<string, PeriodVersion[]> = new Map();

    /**
     * Promotes a period to a new version after AJEs are posted.
     */
    static promote(periodId: string, ajeIds: string[]): PeriodVersion {
        const history = this.versions.get(periodId) || [];
        const nextVersion = history.length + 1;

        const versionRecord: PeriodVersion = {
            period_id: periodId,
            version: nextVersion,
            aje_ids: [...ajeIds],
            timestamp: new Date().toISOString()
        };

        history.push(Object.freeze(versionRecord));
        this.versions.set(periodId, history);

        console.log(`[GOVERNANCE] PERIOD RESTARTED: ${periodId} -> Version ${nextVersion}`);
        return versionRecord;
    }

    static getLatestVersion(periodId: string): PeriodVersion | undefined {
        const history = this.versions.get(periodId);
        return history ? history[history.length - 1] : undefined;
    }

    static clear(): void {
        this.versions.clear();
    }
}
