/**
 * RoboLedgers: Adjusting Journal Entry (AJE) Model
 * Reference: docs/canonical_specifications/05_authority_layer.md
 */

export const AJEReasonCode = {
    RECLASSIFICATION: 'RECLASSIFICATION',
    ACCRUAL: 'ACCRUAL',
    DEFERRAL: 'DEFERRAL',
    CORRECTION: 'CORRECTION',
    TAX_ADJUSTMENT: 'TAX_ADJUSTMENT'
} as const;

export type AJEReasonCode = (typeof AJEReasonCode)[keyof typeof AJEReasonCode];

export const AJEStatus = {
    POSTED: 'POSTED',
    VOIDED: 'VOIDED'
} as const;

export type AJEStatus = (typeof AJEStatus)[keyof typeof AJEStatus];

export interface AJEEntry {
    readonly account_id: string;
    readonly amount_cents: number; // Positive for Debit, Negative for Credit (or vice versa? Let's be explicit)
    readonly type: 'DEBIT' | 'CREDIT';
}

export interface AdjustingJournalEntry {
    readonly aje_id: string;      // UUID
    readonly period_id: string;   // Must be LOCKED
    readonly entries: AJEEntry[];
    readonly reason_code: AJEReasonCode;
    readonly reference_tx_id?: string;
    readonly created_by: string;  // actor_id
    readonly created_at: string;  // ISO Date
    status: AJEStatus;
}
