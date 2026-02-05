import { AuthorityGuard, type User } from './guard.ts';
import { Capability } from './capabilities.ts';
import { InvariantViolationError } from '../core/errors.ts';
import type { ReconciliationProof } from '../reconciliation/proof_object.ts';

export const PeriodStatus = {
    OPEN: 'OPEN',
    RECONCILED: 'RECONCILED',
    LOCKED: 'LOCKED',
    ADJUSTED: 'ADJUSTED'
} as const;

export type PeriodStatus = (typeof PeriodStatus)[keyof typeof PeriodStatus];

/**
 * RoboLedgers: Period Lifecycle Controller
 * Governs the progression of financial periods from OPEN to LOCKED.
 */
export class PeriodLifecycleController {
    private static periodState: Map<string, PeriodStatus> = new Map();

    /**
     * Transitions a period to LOCKED status.
     * Mandates CAP_LOCK_PERIOD and a valid Proof Manifest.
     */
    static lock(periodId: string, actor: User, proof: ReconciliationProof): void {
        // 1. Authority Check
        AuthorityGuard.assertCapability(actor, Capability.CAP_LOCK_PERIOD, `locking period ${periodId}`);

        // 2. Proof Validity Check
        if (proof.variance_cents !== 0) {
            throw new InvariantViolationError(
                'PERIOD_LOCK_VARIANCE_ERROR',
                `Cannot lock period ${periodId} with non-zero variance in proof manifest.`
            );
        }

        // 3. Status Transition
        const current = this.periodState.get(periodId) || PeriodStatus.OPEN;
        if (current === PeriodStatus.LOCKED) {
            throw new InvariantViolationError('PERIOD_ALREADY_LOCKED', `Period ${periodId} is already locked.`);
        }

        this.periodState.set(periodId, PeriodStatus.LOCKED);
        console.log(`[GOVERNANCE] PERIOD LOCKED: ${periodId} by ${actor.id}`);
    }

    static getStatus(periodId: string): PeriodStatus {
        return this.periodState.get(periodId) || PeriodStatus.OPEN;
    }

    static clear(): void {
        this.periodState.clear();
    }
}
