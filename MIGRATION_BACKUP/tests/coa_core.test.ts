import { assert, assertThrows } from './assertions.ts';
import { COAService } from '../src/core/coa.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';

export async function runCOACoreTests() {
    console.log('\n--- Running COA Core Tests ---');

    COAService.clear();

    // 1. Valid Registration
    COAService.register({
        account_code: '1000',
        name: 'Cash',
        metadata: {
            canonical_class: CanonicalAccountClass.CASH_LIQ,
            root_class: AccountRootClass.ASSET,
            normal_balance: NormalBalance.DEBIT,
            statement: FinancialStatement.BS,
            is_reconcilable: true,
            allows_aje: false,
            requires_authority: false
        }
    });

    const cash = COAService.get('1000');
    assert(cash.name === 'Cash', 'Account should be retrievable');

    // 2. Numeric Range Enforcement (Lower Bound)
    assertThrows(() => {
        COAService.register({
            account_code: '0999',
            name: 'Invalid',
            metadata: {} as any
        });
    }, 'COA_INVALID_RANGE');

    // 3. Numeric Range Enforcement (Upper Bound)
    assertThrows(() => {
        COAService.register({
            account_code: '10000',
            name: 'Invalid',
            metadata: {} as any
        });
    }, 'COA_INVALID_RANGE');

    // 4. Duplicate Rejection
    assertThrows(() => {
        COAService.register({
            account_code: '1000',
            name: 'Duplicate',
            metadata: {} as any
        });
    }, 'COA_DUPLICATE_ACCOUNT');

    // 5. Incomplete COA Error
    assertThrows(() => {
        COAService.get('9999');
    }, 'DESIGN_INCOMPLETE_COA_ERROR');

    console.log('[PASS] COA Core Tests');
}
