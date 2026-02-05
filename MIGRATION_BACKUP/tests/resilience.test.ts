import { assert, assertThrows } from './assertions.ts';
import { SystemGuard, SystemSafetyState } from '../src/core/system_guard.ts';
import { LedgerService } from '../src/core/ledger.ts';
import { IngestionService } from '../src/core/ingestion.ts';
import { LedgerReconstructor } from '../src/core/recovery.ts';
import { Polarity, TransactionStatus } from '../src/types/transaction.ts';

/**
 * RoboLedgers: Resilience & Hardening Invariants
 * Phase 15: Operational Durability
 */

export async function runResilienceTests() {
    console.log('\n--- Running Phase 15 Resilience Tests ---');

    const mockRawTx = {
        source_id: 'TEST_BANK',
        raw_date: '2025-02-01',
        raw_description: 'HEB GROCERY',
        raw_amount: '50.00',
        page: 1,
        y_coord: 100
    };

    // 1. Invariant: READ-ONLY Lockdown
    SystemGuard.setSafetyState(SystemSafetyState.READ_ONLY_LOCKDOWN);
    assertThrows(() => {
        LedgerService.post({} as any);
    }, 'SYSTEM_READ_ONLY_LOCKDOWN');

    SystemGuard.setSafetyState(SystemSafetyState.FULLY_OPERATIONAL);

    // 2. Invariant: Idempotent Ingestion
    LedgerService.clear();
    const tx1 = IngestionService.transform(mockRawTx, 'acc_1')!;
    LedgerService.post(tx1);

    const tx2 = IngestionService.transform(mockRawTx, 'acc_1');
    assert(tx2 === null, 'Second ingestion of identical tx must return null (Idempotent)');

    // 3. Invariant: Ledger Reconstruction
    const log = [tx1];
    LedgerService.clear();
    const result = await LedgerReconstructor.replay(log);
    assert(result.SuccessCount === 1, 'Reconstruction should restore the tx');
    assert(LedgerService.existsBySig(tx1.txsig), 'Ledger should have restored the sig index');

    // 4. Invariant: Brain Kill-Switch
    SystemGuard.activateKillSwitch('BRAIN_KILL_SWITCH');
    assert(SystemGuard.isBrainEnabled() === false, 'Brain kill-switch should be active');

    console.log('[PASS] Resilience Tests');
}
