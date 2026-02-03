import { assert } from './assertions.ts';
import { ScoringEngine } from '../src/brain/scoring.ts';
import { CanonicalAccountClass } from '../src/types/coa.ts';
import type { TCV } from '../src/brain/tcv.ts';

export async function runScoringTests() {
    console.log('\n--- Running Scoring Tests ---');

    const mockTCV: TCV = {
        tx_id: 'tx_123',
        merchant_name_raw: 'STARBUCKS',
        merchant_name_normalized: 'STARBUCKS',
        amount_cents: 550,
        amount_bucket: 'SMALL',
        instrument_type: CanonicalAccountClass.CASH_LIQ,
        polarity: 'DEBIT',
        day_of_week: 1,
        day_of_month: 2,
        eligibility_set: [CanonicalAccountClass.EXP_OP_G_A]
    };

    // 1. Valid Gate Match
    const scoreValid = ScoringEngine.calculate(mockTCV, CanonicalAccountClass.EXP_OP_G_A);
    // With all mocks 0 except gate (100), total is 100/400 = 0.25
    assert(scoreValid === 0.25, 'Score should be 0.25 for gate match only');

    // 2. Gate Rejection (Severe Penalty)
    const scoreInvalid = ScoringEngine.calculate(mockTCV, CanonicalAccountClass.REV_OP);
    // Total is -1000, clamped to 0
    assert(scoreInvalid === 0, 'Score should be clamped to 0 for gate rejection');

    // 3. Breakdown Verification
    const breakdown = ScoringEngine.getBreakdown(mockTCV, CanonicalAccountClass.REV_OP);
    assert(breakdown.gate === -1000, 'Gate penalty must be -1000');
    assert(breakdown.total === -1000, 'Total should reflect penalty before clamping');

    console.log('[PASS] Scoring Tests');
}
