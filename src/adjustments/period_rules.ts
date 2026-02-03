import { PeriodLifecycleController, PeriodStatus } from '../authority/period_state.ts';
import { InvariantViolationError } from '../core/errors.ts';
import type { AdjustingJournalEntry } from './aje.ts';

/**
 * RoboLedgers: AJE Period Interaction Rules
 * Enforces that corrections only happen to the immutable past.
 */
export class AJEPeriodRules {
    /**
     * Asserts that an AJE can be posted to the given period.
     * Throws if period is not LOCKED.
     */
    static assertLockRequirement(aje: AdjustingJournalEntry): void {
        const status = PeriodLifecycleController.getStatus(aje.period_id);

        if (status !== PeriodStatus.LOCKED && status !== PeriodStatus.ADJUSTED) {
            throw new InvariantViolationError(
                'AJE_LOCKED_PERIOD_REQUIRED',
                `Adjusting entries can only be posted to LOCKED periods. Period ${aje.period_id} is currently ${status}.`
            );
        }
    }

    /**
     * Aggregates base ledger balances with AJE adjustments.
     * This represents the "Restated Truth".
     */
    static getRestatedBalance(baseCents: number, ajes: AdjustingJournalEntry[], accountId: string): number {
        let adjustment = 0;

        for (const aje of ajes) {
            for (const entry of aje.entries) {
                if (entry.account_id === accountId) {
                    // Simplified: DEBIT increases Asset, CREDIT increases Liability in this model
                    // Real accounting would use normal_balance from COA metadata
                    adjustment += (entry.type === 'DEBIT' ? entry.amount_cents : -entry.amount_cents);
                }
            }
        }

        return baseCents + adjustment;
    }
}
