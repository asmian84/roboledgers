import type { CertifiedCFOMetrics } from '../ui/contracts/cfo.ts';
import type { ForecastScenario, ForecastResult } from '../ui/contracts/forecast.ts';
import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: Forecasting Engine
 * Phase 14C: "What-If" Modeling Layer
 * MANDATE: Pure Math. No Ledger Access. No Mutation.
 */
export class ForecastEngine {

    /**
     * Projects future cash state based on certified history and user assumptions.
     * Inputs MUST be certified deliverables.
     */
    static runScenario(
        baseMetrics: CertifiedCFOMetrics,
        scenario: ForecastScenario
    ): ForecastResult {

        // 1. Structural Verification (Truth State Gate)
        if (baseMetrics.metadata.truth_state !== "CERTIFIED") {
            throw new InvariantViolationError(
                'INVARIANT_VIOLATION_UNCERTIFIED_DATA_ACCESS',
                'Forecasting engine can only consume CERTIFIED truth sources.'
            );
        }

        // 2. Pure Math Modeling
        // Start with current liquid cash (Derived from ratios/burn for mock simplicity)
        // In real system, baseMetrics would carry absolute balance snapshot
        let projectedBalance = 1000000; // Mock: $10,000.00 base from metrics

        const monthlyRevenue = 500000; // Mock
        const monthlyExpense = baseMetrics.runway.monthly_burn_cents;

        const revenueGrowth = scenario.assumptions.revenue_growth_rate || 1.0;
        const expenseGrowth = scenario.assumptions.expense_growth_rate || 1.0;

        // Projection for 12 months out (example)
        const nextMonthRevenue = monthlyRevenue * revenueGrowth;
        const nextMonthExpense = monthlyExpense * expenseGrowth;
        const nextMonthNet = nextMonthRevenue - nextMonthExpense;

        // Apply one-time events
        let oneTimeImpact = 0;
        if (scenario.assumptions.one_time_events) {
            oneTimeImpact = scenario.assumptions.one_time_events.reduce((sum, e) => sum + e.amount_cents, 0);
        }

        const finalProjectedBalance = projectedBalance + nextMonthNet + oneTimeImpact;
        const projectedRunway = nextMonthExpense === 0 ? 99 : finalProjectedBalance / nextMonthExpense;

        return {
            scenario_id: scenario.scenario_id,
            based_on_certification_ids: baseMetrics.source_certification_ids,
            projected_runway_months: parseFloat(projectedRunway.toFixed(1)),
            projected_cash_balance_cents: Math.round(finalProjectedBalance),
            confidence_level: "MEDIUM",
            truth_state: "PROJECTION"
        };
    }
}
