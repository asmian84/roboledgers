import { assert, assertThrows } from './assertions.ts';
import { AJEPosingEngine } from '../src/adjustments/posting.ts';
import { AJEPeriodRules } from '../src/adjustments/period_rules.ts';
import { RestatementService } from '../src/adjustments/restatement.ts';
import { PeriodLifecycleController, PeriodStatus } from '../src/authority/period_state.ts';
import { Role } from '../src/authority/roles.ts';
import { AJEReasonCode, AJEStatus } from '../src/adjustments/aje.ts';
import { COAService } from '../src/core/coa.ts';
import {
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../src/types/coa.ts';

export async function runAJETests() {
    console.log('\n--- Running AJE Invariant Tests ---');

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

    const aje = {
        aje_id: 'aje_01',
        period_id: 'P_2024_01',
        entries: [
            { account_id: '1000', amount_cents: 100, type: 'DEBIT' as const },
            { account_id: '1001', amount_cents: 100, type: 'CREDIT' as const }
        ],
        reason_code: AJEReasonCode.RECLASSIFICATION,
        created_by: 'acc_01',
        created_at: new Date().toISOString(),
        status: AJEStatus.POSTED
    };

    // 1. Balance Enforcement
    const unbalanced = { ...aje, entries: [aje.entries[0]] };
    assertThrows(() => {
        AJEPosingEngine.validate(unbalanced as any);
    }, 'AJE_UNBALANCED');

    // 2. Locked Period Requirement
    PeriodLifecycleController.clear();
    // Status is OPEN by default
    assertThrows(() => {
        AJEPeriodRules.assertLockRequirement(aje as any);
    }, 'AJE_LOCKED_PERIOD_REQUIRED');

    // Lock the period and retry
    PeriodLifecycleController.lock('P_2024_01', { id: 'acc_01', role: Role.ACCOUNTANT }, { variance_cents: 0, proof_hash: 'abc' } as any);
    AJEPeriodRules.assertLockRequirement(aje as any); // Should pass now

    // 3. Restatement Versioning
    RestatementService.clear();
    const v1 = RestatementService.promote('P_2024_01', ['aje_01']);
    assert(v1.version === 1, 'First version should be 1');

    const v2 = RestatementService.promote('P_2024_01', ['aje_02']);
    assert(v2.version === 2, 'Second version should be 2');

    console.log('[PASS] AJE Invariant Tests');
}
