export interface CertifiedCFOMetrics {
    readonly entity_id: string;
    readonly period_range: {
        readonly from: string;
        readonly to: string;
    };
    readonly source_certification_ids: string[];

    readonly liquidity: {
        readonly current_ratio: number;
        readonly quick_ratio: number;
        readonly cash_ratio: number;
    };

    readonly runway: {
        readonly monthly_burn_cents: number;
        readonly months_remaining: number;
    };

    readonly metadata: {
        readonly generated_at: string;
        readonly truth_state: "CERTIFIED";
    };
}
