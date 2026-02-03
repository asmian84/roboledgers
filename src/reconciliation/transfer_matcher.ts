import type { CanonicalTransaction } from '../types/transaction.ts';
import { COAService } from '../core/coa.ts';
import { AccountRootClass } from '../types/coa.ts';
import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: Internal Transfer Matcher
 * Pairs transactions between entity accounts to ensure zero-sum integrity.
 */
export class TransferMatcher {
    /**
     * Identifies pairs that satisfy transfer matching criteria.
     * Criteria: Same amount, opposite polarity, +/- 5 days.
     */
    static match(txA: CanonicalTransaction, txB: CanonicalTransaction): boolean {
        // 1. Same amount, opposite polarity
        if (txA.amount_cents !== txB.amount_cents) return false;
        if (txA.polarity === txB.polarity) return false;

        // 2. Date tolerance (+/- 5 days)
        const dateA = new Date(txA.date).getTime();
        const dateB = new Date(txB.date).getTime();
        const diffDays = Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24);
        if (diffDays > 5) return false;

        // 3. Prevent P&L (Revenue/Expense) contamination
        const accA = COAService.get(txA.account_id);
        const accB = COAService.get(txB.account_id);

        const isPL = (root: string) => root === AccountRootClass.REVENUE || root === AccountRootClass.EXPENSE;
        if (isPL(accA.metadata.root_class) || isPL(accB.metadata.root_class)) {
            throw new InvariantViolationError(
                'TRANSFER_PL_CONTAMINATION',
                `Internal transfers cannot involve P&L accounts (${txA.account_id} or ${txB.account_id}).`
            );
        }

        return true;
    }
}
