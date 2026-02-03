import { assert, assertThrows } from './assertions.ts';
import { ReconciliationMathEngine } from '../src/reconciliation/math.ts';
import { COAService } from '../src/core/coa.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';

export async function runBankMathTests() {
    console.log('\n--- Running Recon Bank Math Tests ---');

    COAService.clear();
    COAService.register({
        account_code: '1000',
        name: 'Bank',
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

    // Valid: 100 + 50 - 20 = 130
    ReconciliationMathEngine.validate('1000', 10000, 5000, 2000, 13000);

    // Invalid: $0.01 variance
    assertThrows(() => {
        ReconciliationMathEngine.validate('1000', 10000, 5000, 2000, 13001);
    }, 'INVARIANT_VIOLATION_RECON_MISMATCH');

    console.log('[PASS] Bank Math Tests');
}

export async function runCCMathTests() {
    console.log('\n--- Running Recon CC Math Tests ---');

    COAService.register({
        account_code: '2000',
        name: 'Credit Card',
        metadata: {
            canonical_class: CanonicalAccountClass.AP_TRADE,
            root_class: AccountRootClass.LIABILITY,
            normal_balance: NormalBalance.CREDIT,
            statement: FinancialStatement.BS,
            is_reconcilable: true,
            allows_aje: false,
            requires_authority: false
        }
    });

    // Valid: 100 + 50 (Credits/Charges) - 20 (Debits/Payments) = 130
    ReconciliationMathEngine.validate('2000', 10000, 2000, 5000, 13000);

    // Invalid: $0.01 variance
    assertThrows(() => {
        ReconciliationMathEngine.validate('2000', 10000, 2000, 5000, 13001);
    }, 'INVARIANT_VIOLATION_RECON_MISMATCH');

    console.log('[PASS] CC Math Tests');
}
