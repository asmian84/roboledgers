import { assert, assertThrows } from './assertions.ts';
import { CFOMetricsService } from '../src/intelligence/cfo_metrics.ts';
import { PeriodLifecycleController } from '../src/authority/period_state.ts';
import { Role } from '../src/authority/roles.ts';

/**
 * RoboLedgers: CFO Intelligence Invariants
 * Phase 14B: Derived Truth
 */

export async function runMetricInvariantsTests() {
    console.log('\n--- Running CFO Metric Invariant Tests ---');

    PeriodLifecycleController.clear();

    const mockEntityIds = ['e1'];
    const periodId = 'P_METRIC_TEST';
    const accountant = { id: 'acc_01', role: Role.ACCOUNTANT, allowed_entities: ['*'] };

    // 1. Rejection of OPEN Period
    // Period is OPEN by default
    assertThrows(() => {
        CFOMetricsService.generateMetrics(periodId, 'E1');
    }, 'INVARIANT_VIOLATION_UNCERTIFIED_DATA_ACCESS');

    // 2. Acceptance of LOCKED Period
    const validProof = { variance_cents: 0, proof_hash: 'h1' } as any;
    PeriodLifecycleController.lock(periodId, accountant as any, validProof);

    const metrics = CFOMetricsService.generateMetrics(periodId, 'E1');

    // Verify Contract Structure
    assert(metrics.metadata.truth_state === 'CERTIFIED', 'Metrics must be CERTIFIED');
    assert(metrics.entity_id === 'E1', 'Entity ID must match');

    // Verify Logic (Mock Values)
    // Cash = 1M, Liabilities = 2M (1M Debt + 1M Accr) -> Ratio 0.5
    assert(metrics.liquidity.current_ratio === 0.5, `Expected Current Ratio 0.5, got ${metrics.liquidity.current_ratio}`);

    console.log('[PASS] CFO Metric Invariant Tests');
}
