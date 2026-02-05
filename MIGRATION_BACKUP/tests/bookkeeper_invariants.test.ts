import { assert, assertThrows } from './assertions.ts';
import { Role } from '../src/authority/roles.ts';
import { PeriodLifecycleController } from '../src/authority/period_state.ts';
import { TransferMatcher } from '../src/reconciliation/transfer_matcher.ts';
import { COAService } from '../src/core/coa.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';
import { Polarity } from '../src/types/transaction.ts';

export async function runBookkeeperInvariantTests() {
    console.log('\n--- Running Bookkeeper Invariant Tests ---');

    const bkUser = { id: 'bk_01', role: Role.BOOKKEEPER };

    // 1. Authority Check: Prevents locking
    assertThrows(
        () => PeriodLifecycleController.lock('P1', bkUser as any, { variance_cents: 0 } as any),
        'INVARIANT_VIOLATION_UNAUTHORIZED'
    );

    // 2. Transfer Pairing Rules (Asset/Liability only)
    COAService.clear();
    COAService.register({
        account_code: '1000',
        name: 'Operating Bank',
        metadata: {
            canonical_class: 100,
            root_class: AccountRootClass.ASSET,
            normal_balance: NormalBalance.DEBIT,
            statement: FinancialStatement.BS,
            is_reconcilable: true,
            allows_aje: false,
            requires_authority: false
        } as any
    });

    COAService.register({
        account_code: '4000',
        name: 'Revenue Account',
        metadata: {
            canonical_class: 400,
            root_class: AccountRootClass.REVENUE,
            normal_balance: NormalBalance.CREDIT,
            statement: FinancialStatement.IS,
            is_reconcilable: false,
            allows_aje: true,
            requires_authority: false
        } as any
    });

    const txAsset = {
        tx_id: 'tx1',
        account_id: '1000',
        amount_cents: 1000,
        polarity: Polarity.CREDIT,
        date: '2025-01-01'
    } as any;

    const txPL = {
        tx_id: 'tx2',
        account_id: '4000',
        amount_cents: 1000,
        polarity: Polarity.DEBIT,
        date: '2025-01-01'
    } as any;

    // Pairing with P&L should throw
    assertThrows(
        () => TransferMatcher.match(txAsset, txPL),
        'TRANSFER_PL_CONTAMINATION'
    );

    console.log('[PASS] Bookkeeper Invariant Tests');
}
