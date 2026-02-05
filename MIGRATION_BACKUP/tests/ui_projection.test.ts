import { assert } from './assertions.ts';
import { ProjectionService } from '../src/ui/projection_service.ts';
import { COAService } from '../src/core/coa.ts';
import { Polarity, TransactionStatus } from '../src/types/transaction.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';

export async function runUIProjectionTests() {
    console.log('\n--- Running UI Projection Tests ---');

    COAService.clear();
    COAService.register({
        account_code: '1000',
        name: 'Main Bank',
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
        tx_id: 'tx_ui_01',
        account_id: '1000',
        date: '2025-01-01',
        amount_cents: 1250,
        currency: 'CAD',
        polarity: Polarity.CREDIT,
        raw_description: 'STARBUCKS #123 COFFEE',
        clean_description: 'Starbucks',
        status: TransactionStatus.PREDICTED,
        category_id: undefined
    } as any;

    // 1. Zen Projection Check (Abstraction Layer)
    const zen = ProjectionService.projectZen(tx);
    assert(zen.merchant_display === 'Starbucks', 'Zen should use clean description');
    assert(zen.amount_display === '12.50 CAD', 'Zen should format amount');
    assert(!('txsig' in zen), 'Zen should NOT see txsig');
    assert(!('account_id' in zen), 'Zen should NOT see account_id');

    // 2. Bookkeeper Projection Check (Detail Layer)
    const bk = ProjectionService.projectBookkeeper(tx);
    assert(bk.amount_cents === 1250, 'Bookkeeper should see raw cents');
    assert(bk.account_name === 'Main Bank', 'Bookkeeper should see account name');

    console.log('[PASS] UI Projection Tests');
}
