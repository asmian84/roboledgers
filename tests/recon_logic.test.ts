import { assert, assertThrows } from './assertions.ts';
import { TransferMatcher } from '../src/reconciliation/transfer_matcher.ts';
import { ReconciliationStateMachine } from '../src/reconciliation/state.ts';
import { COAService } from '../src/core/coa.ts';
import { Polarity } from '../src/types/transaction.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';

export async function runTransferTests() {
    console.log('\n--- Running Recon Transfer Tests ---');

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

    COAService.register({
        account_code: '5000',
        name: 'Revenue',
        metadata: {
            canonical_class: CanonicalAccountClass.REV_OP,
            root_class: AccountRootClass.REVENUE,
            normal_balance: NormalBalance.CREDIT,
            statement: FinancialStatement.IS,
            is_reconcilable: false,
            allows_aje: true,
            requires_authority: false
        }
    });

    const txA = { account_id: '1000', amount_cents: 1000, polarity: Polarity.DEBIT, date: '2025-01-01' } as any;
    const txB = { account_id: '1000', amount_cents: 1000, polarity: Polarity.CREDIT, date: '2025-01-02' } as any;

    // 1. Valid Match
    assert(TransferMatcher.match(txA, txB), 'Transfers within Assets should match');

    // 2. P&L Contamination Rejection
    const txPL = { account_id: '5000', amount_cents: 1000, polarity: Polarity.CREDIT, date: '2025-01-01' } as any;
    assertThrows(() => {
        TransferMatcher.match(txA, txPL);
    }, 'TRANSFER_PL_CONTAMINATION');

    console.log('[PASS] Transfer Tests');
}

export async function runProofRequiredTests() {
    console.log('\n--- Running Proof Requirement Tests ---');

    // 1. Non-zero variance rejection
    const invalidProof = {
        account_id: '1000',
        variance_cents: 1, // $0.01 variance
        proof_hash: 'abc',
        generated_at: 'now'
    } as any;

    assertThrows(() => {
        ReconciliationStateMachine.reconcile('1000', invalidProof);
    }, 'RECON_PROOF_VARIANCE_ERROR');

    // 2. Missing manifest rejection
    const missingHash = {
        account_id: '1000',
        variance_cents: 0,
        proof_hash: '',
        generated_at: 'now'
    } as any;

    assertThrows(() => {
        ReconciliationStateMachine.reconcile('1000', missingHash);
    }, 'RECON_PROOF_MANIFEST_MISSING');

    console.log('[PASS] Proof Requirement Tests');
}
