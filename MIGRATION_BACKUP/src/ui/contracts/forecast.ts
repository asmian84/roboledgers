/**
 * RoboLedgers: Forecasting Contracts
 * Phase 14C: "What-If" Analysis (NOT CERTIFIED TRUTH)
 */

export interface ForecastScenario {
    readonly scenario_id: string;
    readonly label: string;
    readonly assumptions: {
        readonly revenue_growth_rate?: number; // e.g. 1.05 for 5%
        readonly expense_growth_rate?: number;
        readonly one_time_events?: {
            readonly date: string; // ISO
            readonly amount_cents: number;
            readonly description: string;
        }[];
    };
}

export interface ForecastResult {
    readonly scenario_id: string;
    readonly based_on_certification_ids: string[];
    readonly projected_runway_months: number;
    readonly projected_cash_balance_cents: number;
    readonly confidence_level: "LOW" | "MEDIUM" | "HIGH";
    readonly truth_state: "PROJECTION"; // CRITICAL: NEVER "CERTIFIED"
}
