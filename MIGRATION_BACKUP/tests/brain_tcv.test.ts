import { assert } from './assertions.ts';
import { TCVGenerator } from '../src/brain/tcv.ts';
import { COAService } from '../src/core/coa.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';
import { Polarity, TransactionStatus } from '../src/types/transaction.ts';

export async function runTCVTests() {
    console.log('\n--- Running TCV Tests ---');

    // Setup COA required for TCV
    COAService.clear();
    COAService.register({
        account_code: '1000',
        name: 'Chequing',
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

    const tx = {
        tx_id: 'tx_abc',
        account_id: '1000',
        date: '2025-05-20',
        amount_cents: 12500, // $125.00
        currency: 'CAD',
        polarity: Polarity.DEBIT,
        raw_description: 'AMZN MKTP US 1234 05/20',
        txsig: 'sig',
        source_system: 'SRC',
        created_at: 'now',
        updated_at: 'now',
        version: 1,
        status: TransactionStatus.RAW
    } as any;

    const tcv = TCVGenerator.generate(tx);

    // 1. Fully Populated
    assert(tcv.tx_id === 'tx_abc', 'TCV must preserve tx_id');
    assert(!!tcv.merchant_name_normalized, 'Merchant must be normalized');

    // 2. Normalization Logic
    assert(tcv.merchant_name_normalized === 'AMZN MKTP US', 'Should strip numbers and dates');

    // 3. Amount Bucketing
    assert(tcv.amount_bucket === 'LARGE', '$125 should be LARGE bucket');

    // 4. Date components
    assert(tcv.day_of_week === 2, '2025-05-20 is a Tuesday (2)');
    assert(tcv.day_of_month === 20, 'Day of month mismatch');

    console.log('[PASS] TCV Tests');
}
