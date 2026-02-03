import type { PeriodStatus } from '../../authority/period_state.ts';

/**
 * RoboLedgers: Accountant UX Contract
 * High-authority lens for fiscal period governance.
 */

export interface AccountantPeriodProjection {
    readonly period_id: string;
    readonly status: PeriodStatus;
    readonly version: number;
    readonly balance_sheet_ready: boolean;
    readonly pending_ajes_count: number;
}

export interface AccountantIntentRequests {
    /**
     * Final lock of a reconciled period.
     */
    lockPeriod(periodId: string): Promise<void>;

    /**
     * Post an Adjusting Journal Entry.
     */
    postAJE(params: {
        period_id: string;
        entries: { account_id: string, amount_cents: number, type: 'DEBIT' | 'CREDIT' }[];
        reason: string;
    }): Promise<void>;

    /**
     * Certify a period for external reporting.
     */
    certifyPeriod(periodId: string, proofHash: string): Promise<void>;
}
