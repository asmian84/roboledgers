import { COAService } from '../core/coa.ts';
import { AccountRootClass } from '../types/coa.ts';
import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: Reconciliation Math Engine
 * Enforces the mathematical truth of bank and credit card reconciliations.
 */
export class ReconciliationMathEngine {
    /**
     * Validates the internal consistency of a reconciliation attempt.
     * Throws INVARIANT_VIOLATION_RECON_MISMATCH on even a $0.01 variance.
     */
    static validate(
        accountId: string,
        openingCents: number,
        sumDebitsCents: number,
        sumCreditsCents: number,
        closingCents: number
    ): number {
        const account = COAService.get(accountId);
        let calculatedClosing = 0;

        // 1. Bank (Assets): Opening + Debits - Credits = Closing
        if (account.metadata.root_class === AccountRootClass.ASSET) {
            calculatedClosing = openingCents + sumDebitsCents - sumCreditsCents;
        }
        // 2. Credit Cards (Liabilities): Opening + Credits - Debits = Closing
        else if (account.metadata.root_class === AccountRootClass.LIABILITY) {
            calculatedClosing = openingCents + sumCreditsCents - sumDebitsCents;
        } else {
            throw new InvariantViolationError(
                'RECON_INVALID_ACCOUNT_TYPE',
                `Account ${accountId} of root class ${account.metadata.root_class} is not eligible for balance reconciliation.`
            );
        }

        const variance = calculatedClosing - closingCents;

        if (variance !== 0) {
            throw new InvariantViolationError(
                'INVARIANT_VIOLATION_RECON_MISMATCH',
                `Reconciliation failed for ${accountId}. Expected ${closingCents}, calculated ${calculatedClosing}. Variance: ${variance} cents.`
            );
        }

        return variance;
    }
}
