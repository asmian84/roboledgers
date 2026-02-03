import { assert, assertThrows } from './assertions.ts';
import { ForecastEngine } from '../src/intelligence/forecast_engine.ts';
import type { CertifiedCFOMetrics } from '../src/ui/contracts/cfo.ts';
import type { ForecastScenario } from '../src/ui/contracts/forecast.ts';

/**
 * RoboLedgers: Forecasting Invariants
 * Phase 14C: "What-If" Not Truth
 */

export async function runForecastInvariantTests() {
    console.log('\n--- Running Forecast Invariant Tests ---');

    const validBase: CertifiedCFOMetrics = {
        entity_id: 'E1',
        period_range: { from: '2024-01-01', to: '2024-01-31' },
        source_certification_ids: ['cert_01'],
        liquidity: { current_ratio: 1.5, quick_ratio: 1.2, cash_ratio: 1.0 },
        runway: { monthly_burn_cents: 200000, months_remaining: 5 },
        metadata: { generated_at: '2024-02-01T00:00:00Z', truth_state: 'CERTIFIED' }
    };

    const scenario: ForecastScenario = {
        scenario_id: 'S1',
        label: 'Optimistic Growth',
        assumptions: {
            revenue_growth_rate: 1.2,
            expense_growth_rate: 0.9,
            one_time_events: [
                { date: '2024-03-01', amount_cents: 500000, description: 'Grant Funding' }
            ]
        }
    };

    // 1. Invariant: Separation of Truth (Reject uncertified inputs)
    const invalidBase = { ...validBase, metadata: { ...validBase.metadata, truth_state: 'DRAFT' } } as any;
    assertThrows(() => {
        ForecastEngine.runScenario(invalidBase, scenario);
    }, 'INVARIANT_VIOLATION_UNCERTIFIED_DATA_ACCESS');

    // 2. Invariant: Output Labeling (Force PROJECTION state)
    const result = ForecastEngine.runScenario(validBase, scenario);
    assert(result.truth_state === 'PROJECTION', 'Forecast result must be labeled PROJECTION');
    assert(result.confidence_level !== undefined, 'Forecast must have confidence level');

    // 3. Logic: Assumption Integration
    // Base $10,000 + (Net Diff) + $5,000 Grant
    // Base Net = 5k Rev - 2k Exp = 3k. 
    // Adjusted Rev = 5k * 1.2 = 6k. Adjusted Exp = 2k * 0.9 = 1.8k.
    // Next Month Net = 4.2k. 
    // Total = 10k + 4.2k + 5k = 19.2k
    assert(result.projected_cash_balance_cents === 1920000, `Expected 1,920,000 cents, got ${result.projected_cash_balance_cents}`);

    console.log('[PASS] Forecast Invariant Tests');
}
