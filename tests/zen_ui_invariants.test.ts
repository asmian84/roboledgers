import { assert } from './assertions.ts';
import { ProjectionService } from '../src/ui/projection_service.ts';
import { COAService } from '../src/core/coa.ts';
import { Polarity, TransactionStatus } from '../src/types/transaction.ts';

/**
 * RoboLedgers: Zen UI Invariant Tests
 * Ensures the Zen Projection Layer adheres to the High-Abstraction constitutional mandate.
 */

export async function runZenUIInvariantTests() {
    console.log('\n--- Running Zen UI Invariant Tests ---');

    COAService.clear();
    COAService.register({
        account_code: '5000',
        name: 'Dining',
        metadata: {
            canonical_class: 400, // EXPENSE
            root_class: 4, // EXPENSE
            normal_balance: 'DEBIT',
            statement: 'IS',
            is_reconcilable: false,
            allows_aje: true,
            requires_authority: false
        } as any
    });

    const rawTx = {
        tx_id: 'tx_01',
        account_id: '1000', // Forbidden in Zen
        date: '2025-01-01',
        amount_cents: 5000,
        currency: 'CAD',
        polarity: Polarity.CREDIT,
        raw_description: 'AMAZON.CA*12345',
        clean_description: 'Amazon',
        status: TransactionStatus.PREDICTED,
        category_id: '5000', // Forbidden in Zen
        txsig: 'hash_abc_123' // Forbidden in Zen
    } as any;

    // 1. Forbidden Data Leakage Check
    const zen = ProjectionService.projectZen(rawTx);

    assert(!('account_id' in zen), 'Zen projection SHALL NOT contain account_id');
    assert(!('txsig' in zen), 'Zen projection SHALL NOT contain txsig');
    assert(!('category_id' in zen), 'Zen projection SHALL NOT contain category_id (use category_name)');

    // 2. Truth Badge Requirement
    assert('status_badge' in zen, 'Zen projection MUST contain status_badge');
    assert(zen.status_badge === TransactionStatus.PREDICTED, 'Status badge must reflect truth');

    // 3. Amount Abstraction
    assert(typeof zen.amount_display === 'string', 'Zen must use display amounts, not raw cents');
    assert(zen.amount_display.includes('CAD'), 'Amount must be badged with currency');

    console.log('[PASS] Zen UI Invariant Tests');
}
