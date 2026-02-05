import { assert, assertThrows } from './assertions.ts';
import { BrainCOAGate } from '../src/brain/coa_gate.ts';
import { COAService } from '../src/core/coa.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';
import type { TCV } from '../src/brain/tcv.ts';

export async function runBrainGateTests() {
    console.log('\n--- Running Brain Gate Tests ---');

    COAService.clear();
    COAService.register({
        account_code: '8800',
        name: 'Repairs',
        metadata: {
            canonical_class: CanonicalAccountClass.EXP_OP_G_A,
            root_class: AccountRootClass.EXPENSE,
            normal_balance: NormalBalance.DEBIT,
            statement: FinancialStatement.IS,
            is_reconcilable: false,
            allows_aje: true,
            capitalization_threshold: 250000, // $2,500
            requires_authority: false
        }
    });

    const tcv: TCV = {
        tx_id: 'tx_cap',
        merchant_name_raw: 'ROOF REPAIR',
        merchant_name_normalized: 'ROOF REPAIR',
        amount_cents: 500000, // $5,000
        amount_bucket: 'MAJOR',
        instrument_type: CanonicalAccountClass.CASH_LIQ,
        polarity: 'CREDIT',
        day_of_week: 1,
        day_of_month: 1,
        eligibility_set: [CanonicalAccountClass.EXP_OP_G_A]
    };

    // 1. Capitalization Breach Rejection
    assertThrows(() => {
        BrainCOAGate.check(tcv, '8800');
    }, 'COA_GATE_CAPITALIZATION_REQUIRED');

    // 2. Instrument Ineligibility
    const tcvIneligible = { ...tcv, eligibility_set: [CanonicalAccountClass.REV_OP] };
    assertThrows(() => {
        BrainCOAGate.check(tcvIneligible, '8800');
    }, 'COA_GATE_INSTRUMENT_MISMATCH');

    console.log('[PASS] Brain Gate Tests');
}
