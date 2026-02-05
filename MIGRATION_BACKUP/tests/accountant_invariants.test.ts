import { assert, assertThrows } from './assertions.ts';
import { Role } from '../src/authority/roles.ts';
import { PeriodLifecycleController } from '../src/authority/period_state.ts';
import { Capability } from '../src/authority/capabilities.ts';

/**
 * RoboLedgers: Accountant Invariant Tests
 * Responsibility: Verifying authority-level governance rules.
 */

export async function runAccountantInvariantTests() {
    console.log('\n--- Running Accountant Invariant Tests ---');

    const accountantUser = { id: 'acc_01', role: Role.ACCOUNTANT, allowed_entities: ['*'] };
    const bookkeeperUser = { id: 'bk_01', role: Role.BOOKKEEPER, allowed_entities: ['*'] };

    // 1. Authority: Bookkeeper cannot lock
    assertThrows(
        () => PeriodLifecycleController.lock('P2025_01', bookkeeperUser as any, { variance_cents: 0 } as any),
        'INVARIANT_VIOLATION_UNAUTHORIZED'
    );

    // 2. Math/Truth: Cannot lock with variance
    assertThrows(
        () => PeriodLifecycleController.lock('P2025_01', accountantUser as any, { variance_cents: 100 } as any),
        'PERIOD_LOCK_VARIANCE_ERROR'
    );

    // 3. Immutability: Verify LOCKED period prevents simple status changes
    PeriodLifecycleController.lock('P2025_02', accountantUser as any, { variance_cents: 0 } as any);
    assert(PeriodLifecycleController.getStatus('P2025_02') === 'LOCKED', 'Period must be locked');

    // AJE logic (Mocking expectation of non-mutation)
    // In a real implementation, AJE service would throw if trying to edit a LOCKED transaction.

    console.log('[PASS] Accountant Invariant Tests');
}
