import { TransactionStatus } from '../types/transaction.ts';
import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: Decision State Machine
 * Manages the lifecycle of a categorization decision.
 * Reference: docs/canonical_specifications/03_categorization_brain.md (Section 4)
 */
export class DecisionStateMachine {
    /**
     * Validates if a state transition is legal.
     * Throws on illegal transitions.
     */
    static validateTransition(from: TransactionStatus, to: TransactionStatus): void {
        if (from === to) return;

        // 1. LOCKED is terminal
        if (from === TransactionStatus.LOCKED) {
            throw new InvariantViolationError(
                'STATE_LOCKED_IS_TERMINAL',
                `Cannot transition out of LOCKED state.`
            );
        }

        // 2. Formal Progress Path
        // RAW -> PREDICTED -> CONFIRMED -> LOCKED
        const order = {
            [TransactionStatus.RAW]: 0,
            [TransactionStatus.PREDICTED]: 1,
            [TransactionStatus.CONFIRMED]: 2,
            [TransactionStatus.RECONCILED]: 3,
            [TransactionStatus.LOCKED]: 4,
            [TransactionStatus.VOIDED]: -1,
            [TransactionStatus.VOID_REPLACEMENT]: -1
        };

        const fromRank = order[from] ?? -1;
        const toRank = order[to] ?? -1;

        // Reject backward transitions
        if (toRank < fromRank) {
            throw new InvariantViolationError(
                'STATE_BACKWARD_TRANSITION',
                `Cannot transition backward from ${from} to ${to}.`
            );
        }

        // Reject skipping to LOCKED from RAW/PREDICTED without CONFIRMED
        if (to === TransactionStatus.LOCKED && fromRank < 2) {
            throw new InvariantViolationError(
                'STATE_SKIP_CONFIRMATION',
                `Cannot transition to LOCKED without being CONFIRMED first.`
            );
        }
    }
}
