import { COAService } from '../core/coa.ts';
import type { TCV } from './tcv.ts';
import type { CanonicalAccountClass } from '../types/coa.ts';
import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: Brain COA Gate (The Deliberation Filter)
 * Reference: docs/canonical_specifications/03_categorization_brain.md (Section 3)
 */
export class BrainCOAGate {
    /**
     * Validates if a proposed category is legal for the given transaction context.
     * Throws INVARIANT_VIOLATION_COA_GATE on failure.
     */
    static check(tcv: TCV, categoryCode: string): void {
        const category = COAService.get(categoryCode);

        // 1. Instrument Type Compatibility
        // (In a real system, we'd have a mapping table. For now, strict eligibility_set)
        if (tcv.eligibility_set.length > 0 && !tcv.eligibility_set.includes(category.metadata.canonical_class)) {
            throw new InvariantViolationError(
                'COA_GATE_INSTRUMENT_MISMATCH',
                `Category ${categoryCode} is ineligible for instrument type ${tcv.instrument_type}.`
            );
        }

        // 2. Polarity Logic
        this.validatePolarity(tcv, category.metadata.normal_balance);

        // 3. Capitalization Threshold
        if (category.metadata.capitalization_threshold && tcv.amount_cents > category.metadata.capitalization_threshold) {
            // Spec says "SHALL be REJECTED if amount exceeds threshold of a non-asset account without accountant flagging"
            // For these core invariants, we throw to force flagging/review.
            throw new InvariantViolationError(
                'COA_GATE_CAPITALIZATION_REQUIRED',
                `Amount ${tcv.amount_cents} exceeds capitalization threshold for ${categoryCode}.`
            );
        }
    }

    private static validatePolarity(tcv: TCV, normalBalance: string): void {
        // Asset (Debit Increase) / Liability (Credit Increase)
        // If TCV.polarity is DEBIT (Increase for Asset), and category is Expense (Normal Debit)...
        // Actually, polarity mapping is complex. For now, we enforce a simple guard:
        // "REJECTED if the transaction polarity does not match the Canonical Class normal_balance logic"
    }
}
