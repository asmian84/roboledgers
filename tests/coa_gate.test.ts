import { assert, assertThrows } from './assertions.ts';
import { COAService } from '../src/core/coa.ts';
import { COAGate } from '../src/core/coa_gate.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';
import { Polarity, TransactionStatus } from '../src/types/transaction.ts';

export async function runCOAGateTests() {
    console.log('\n--- Running COA Gate Tests ---');

    COAService.clear();

    // Register some accounts for testing
    COAService.register({
        account_code: '1000',
        name: 'Chequing Account',
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

    COAService.register({
        account_code: '1500',
        name: 'Equipment',
        metadata: {
            canonical_class: CanonicalAccountClass.FA_EQUIP,
            root_class: AccountRootClass.ASSET,
            normal_balance: NormalBalance.DEBIT,
            statement: FinancialStatement.BS,
            is_reconcilable: false,
            allows_aje: true,
            capitalization_threshold: 100000,
            requires_authority: true
        }
    });

    const validTx = {
        tx_id: 'tx_001',
        account_id: '1000',
        date: '2025-02-01',
        amount_cents: 10000,
        currency: 'CAD',
        polarity: Polarity.DEBIT,
        raw_description: 'TEST',
        txsig: 'sig_001',
        source_system: 'SRC_001',
        created_at: 'now',
        updated_at: 'now',
        version: 1,
        status: TransactionStatus.RAW
    } as any;

    // 1. Valid Validation
    COAGate.validate(validTx);

    // 2. Unmapped Account Rejection
    const invalidTx = { ...validTx, account_id: '9999' };
    assertThrows(() => {
        COAGate.validate(invalidTx);
    }, 'DESIGN_INCOMPLETE_COA_ERROR');

    console.log('[PASS] COA Gate Tests');
}
