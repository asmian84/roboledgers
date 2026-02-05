import { SystemGuard } from '../core/system_guard.ts';
import type { TCV } from './tcv.ts';
import { CanonicalAccountClass } from '../types/coa.ts';

/**
 * RoboLedgers: Categorization Scoring Engine
 * Reference: docs/canonical_specifications/03_categorization_brain.md
 */
export interface ScoreBreakdown {
    identity: number;
    memory: number;
    context: number;
    similarity: number;
    gate: number;
    anomaly: number;
    total: number;
}

export class ScoringEngine {
    /**
     * Calculates a deterministic confidence score for a candidate category.
     * Returns a value between 0.0 and 1.0.
     */
    static calculate(tcv: TCV, candidate: CanonicalAccountClass): number {
        if (!SystemGuard.isBrainEnabled()) {
            console.warn('[BRAIN] Categorization disabled by global kill-switch.');
            return 0; // Safe degradation: no confidence
        }
        const breakdown = this.getBreakdown(tcv, candidate);

        // Normalize to 0.0 - 1.0 (Total max positive score is 400)
        let normalized = breakdown.total / 400;

        // Clamp
        return Math.max(0, Math.min(1, normalized));
    }

    /**
     * Provides detailed score breakdown for DecisionTrace.
     */
    static getBreakdown(tcv: TCV, candidate: CanonicalAccountClass): ScoreBreakdown {
        const i = this.calculateIdentity(tcv, candidate);
        const m = this.calculateMemory(tcv, candidate);
        const c = this.calculateContext(tcv, candidate);
        const l = this.calculateSimilarity(tcv, candidate);
        const g = this.calculateGate(tcv, candidate);
        const a = this.calculateAnomaly(tcv, candidate);

        return {
            identity: i,
            memory: m,
            context: c,
            similarity: l,
            gate: g,
            anomaly: a,
            total: i + m + c + l + g - a
        };
    }

    private static calculateIdentity(tcv: TCV, candidate: any): number {
        // Exact registry match logic (Mocked for now)
        return 0;
    }

    private static calculateMemory(tcv: TCV, candidate: any): number {
        // Historical recurrence logic (Mocked for now)
        return 0;
    }

    private static calculateContext(tcv: TCV, candidate: any): number {
        // Profile alignment (Mocked for now)
        return 0;
    }

    private static calculateSimilarity(tcv: TCV, candidate: any): number {
        // String distance logic (Mocked for now)
        return 0;
    }

    private static calculateGate(tcv: TCV, candidate: CanonicalAccountClass): number {
        // If it's in the eligibility set, full marks.
        // If not, it's a hard penalty (as per spec -1000).
        return tcv.eligibility_set.includes(candidate) ? 100 : -1000;
    }

    private static calculateAnomaly(tcv: TCV, candidate: any): number {
        // Anomaly penalty (Mocked for now)
        return 0;
    }
}
