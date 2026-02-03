import type { PeriodStatus } from '../../authority/period_state.ts';

/**
 * RoboLedgers: Accountant UX Contract
 * High-authority lens for fiscal period governance and audit readiness.
 */

export interface TrialBalanceRow {
    readonly account_code: string;
    readonly account_name: string;
    readonly debit: string;
    readonly credit: string;
    readonly balance: string;
    readonly canonical_class: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
}

export interface AccountantPeriodProjection {
    readonly period_id: string;
    readonly status: PeriodStatus;
    readonly version: number;
    readonly trial_balance: TrialBalanceRow[];
    readonly is_balanced: boolean;
    readonly pending_ajes_count: number;
}

export interface AJEInput {
    readonly effective_date: string;
    readonly lines: {
        account_code: string;
        description: string;
        debit?: number;
        credit?: number;
    }[];
    readonly rationale: string;
    readonly references: string[]; // tx_ids or period refs
}

export interface AccountantIntentRequests {
    /**
     * Intent: "Review and fix the ledger boundaries."
     */
    postAJE(input: AJEInput): Promise<void>;

    /**
     * Intent: "Seal the period truth."
     */
    lockPeriod(periodId: string): Promise<void>;

    /**
     * Intent: "Formally attest to the findings."
     */
    certifyPeriod(periodId: string, proofHash: string): Promise<void>;
}
