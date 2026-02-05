import type { CertifiedCFOMetrics } from '../ui/contracts/cfo.ts';
import { PeriodLifecycleController, PeriodStatus } from '../authority/period_state.ts';
import { CanonicalAccountClass } from '../types/coa.ts';
import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: CFO Intelligence Service
 * Responsibility: Derive decision-quality metrics exclusively from CERTIFIED periods.
 */
export class CFOMetricsService {

    /**
     * Generates financial health metrics for a specific period.
     * GATING RULE: The period MUST be LOCKED. Open/Unreconciled periods are forbidden.
     */
    static generateMetrics(periodId: string, entityId: string): CertifiedCFOMetrics {
        // 1. Enforce Source Truth (LOCKED or ADJUSTED)
        const status = PeriodLifecycleController.getStatus(periodId);
        if (status !== PeriodStatus.LOCKED && status !== PeriodStatus.ADJUSTED) {
            throw new InvariantViolationError(
                'INVARIANT_VIOLATION_UNCERTIFIED_DATA_ACCESS',
                `Cannot generate certified metrics from uncertified period ${periodId} (Status: ${status}).`
            );
        }

        // 2. Fetch Aggregated Balances (Mocking aggregation logic for now)
        // In a real implementation, we would sum ledger txs filtered by period + entity
        const cash = this.sumByClass(CanonicalAccountClass.CASH_LIQ, entityId);
        const shortTermDebt = this.sumByClass(CanonicalAccountClass.DEBT_ST, entityId);
        const accrLiab = this.sumByClass(CanonicalAccountClass.ACCR_LIAB, entityId);
        const opExpense = this.sumByClass(CanonicalAccountClass.EXP_OP_G_A, entityId); // Simplified Proxy

        // 3. Compute Derived Ratios (Core Intelligence)
        const currentLiabilities = shortTermDebt + accrLiab;
        const currentRatio = currentLiabilities === 0 ? 0 : cash / currentLiabilities;
        const burnRate = opExpense; // Simplified for MVP (Monthly OpEx)
        const runway = burnRate === 0 ? 999 : cash / burnRate;

        return {
            entity_id: entityId,
            period_range: {
                from: '2024-01-01', // Mock dates for now
                to: '2024-01-31'
            },
            source_certification_ids: ['cert_123'], // Mock cert aggregation
            liquidity: {
                current_ratio: parseFloat(currentRatio.toFixed(2)),
                quick_ratio: parseFloat(currentRatio.toFixed(2)), // Simplified
                cash_ratio: parseFloat(currentRatio.toFixed(2))   // Simplified
            },
            runway: {
                monthly_burn_cents: burnRate,
                months_remaining: parseFloat(runway.toFixed(1))
            },
            metadata: {
                generated_at: new Date().toISOString(),
                truth_state: 'CERTIFIED'
            }
        };
    }

    // Helper to query COA metadata (Mocking value-lookup for invariant testing)
    private static sumByClass(className: string, entityId: string): number {
        // In real system: Ledger.sum(account_id WHERE account.class = className AND account.entity IN entityIds)
        // For MVP Invariant Test: We return a static "truth" value to verify the locking gate works.
        return 1000000; // $10,000.00
    }
}
