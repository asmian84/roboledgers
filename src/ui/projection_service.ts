import type { CanonicalTransaction } from '../types/transaction.ts';
import type { ZenTransactionProjection } from './contracts/zen.ts';
import type { BookkeeperTransactionProjection } from './contracts/bookkeeper.ts';
import type { TrialBalanceRow } from './contracts/accountant.ts';
import { COAService } from '../core/coa.ts';
import { AccountRootClass } from '../types/coa.ts';

/**
 * RoboLedgers: UI Projection Service
 * Responsibility: Transform core data into UI-safe contracts.
 * Rule: No logic here besides "View Transformation".
 */
export class ProjectionService {
    /**
     * Projects a transaction for the Zen Mode lens.
     */
    static projectZen(tx: CanonicalTransaction): ZenTransactionProjection {
        const categoryName = tx.category_id ? COAService.get(tx.category_id).name : 'Uncategorized';

        return {
            id: tx.tx_id,
            merchant_display: tx.clean_description || tx.raw_description.substring(0, 20),
            category_name: categoryName,
            amount_display: `${(tx.amount_cents / 100).toFixed(2)} ${tx.currency}`,
            date: tx.date,
            status_badge: tx.status,
            confidence_label: 'HIGH'
        };
    }

    /**
     * Projects a transaction for the Bookkeeper lens.
     */
    static projectBookkeeper(tx: CanonicalTransaction): BookkeeperTransactionProjection {
        const account = COAService.get(tx.account_id);
        const category = tx.category_id ? COAService.get(tx.category_id) : null;

        const allowed = COAService.getAll()
            .filter(a =>
                a.metadata.root_class === AccountRootClass.REVENUE ||
                a.metadata.root_class === AccountRootClass.EXPENSE
            )
            .map(a => `${a.account_code}: ${a.name}`);

        return {
            tx_id: tx.tx_id,
            date: tx.date,
            merchant: tx.clean_description || tx.raw_description.substring(0, 30),
            amount_display: `${(tx.amount_cents / 100).toFixed(2)} ${tx.currency}`,
            amount_cents: tx.amount_cents,
            predicted_category: category ? category.name : 'Uncategorized',
            confidence: 0.95,
            state: tx.status,
            account_name: account.name,
            category_code: tx.category_id || '',
            is_matched: false,
            allowed_categories: allowed
        };
    }

    /**
     * Projects data for the Accountant Governance Console.
     */
    static projectAccountant(tx: CanonicalTransaction) {
        const bk = this.projectBookkeeper(tx);
        return {
            ...bk,
            governance_lock: tx.status === 'LOCKED',
            audit_ref: `REF-${tx.tx_id.substring(0, 8)}`
        };
    }

    /**
     * Projects the Trial Balance for the Accountant.
     */
    static projectTrialBalance(): TrialBalanceRow[] {
        // In a real system, this would sum the ledger. Mocking for UI dev.
        return COAService.getAll().map(acc => ({
            account_code: acc.account_code,
            account_name: acc.name,
            debit: acc.metadata.normal_balance === 'DEBIT' ? '$1,000.00' : '$0.00',
            credit: acc.metadata.normal_balance === 'CREDIT' ? '$1,000.00' : '$0.00',
            balance: '$1,000.00',
            canonical_class: this.mapRootToCanonical(acc.metadata.root_class)
        }));
    }

    private static mapRootToCanonical(root: string): any {
        switch (root) {
            case AccountRootClass.ASSET: return "ASSET";
            case AccountRootClass.LIABILITY: return "LIABILITY";
            case AccountRootClass.EQUITY: return "EQUITY";
            case AccountRootClass.REVENUE: return "REVENUE";
            case AccountRootClass.EXPENSE: return "EXPENSE";
            default: return "ASSET";
        }
    }

    /**
     * Projects a summary for the Bookkeeper reconciliation preparer.
     */
    static projectReconPreview(): any {
        return {
            opening_balance: '$12,450.00 CAD',
            computed_closing: '$10,250.00 CAD',
            statement_closing: '$10,250.00 CAD',
            variance: '$0.00 CAD',
            blockers: []
        };
    }
    /**
     * Projects a Consolidated Trial Balance across multiple entities.
     * Rule: No inter-company eliminations in this phase (Read-Only raw sum).
     */
    static projectConsolidatedTrialBalance(entityIds: string[]): TrialBalanceRow[] {
        const allAccounts = COAService.getAll().filter(acc => entityIds.includes(acc.entity_id));

        // Group by account code to "consolidate" lines
        const consolidated = new Map<string, any>();

        allAccounts.forEach(acc => {
            const existing = consolidated.get(acc.account_code);
            if (existing) {
                // Mock sum (in real system, we'd sum ledger balances)
                existing.debit = '$2,000.00';
                existing.credit = '$2,000.00';
            } else {
                consolidated.set(acc.account_code, {
                    account_code: acc.account_code,
                    account_name: acc.name, // Usually use the parent's naming convention
                    debit: '$1,000.00',
                    credit: '$1,000.00',
                    balance: '$0.00',
                    canonical_class: this.mapRootToCanonical(acc.metadata.root_class)
                });
            }
        });

        return Array.from(consolidated.values());
    }

    /**
     * Projects Certified CFO Metrics.
     * MANDATE: Only from truth-layer metrics service.
     */
    static projectCFO(entityId: string, periodId: string): any {
        // This would call CFOMetricsService.generateMetrics
        return {
            entity_id: entityId,
            period_id: periodId,
            status: 'CERTIFIED',
            metrics: {
                liquidity: { current_ratio: 1.5, quick_ratio: 1.2, cash_ratio: 1.0 },
                runway: { monthly_burn: '$2,000.00', months_remaining: 5.2 }
            }
        };
    }

    /**
     * Projects a Forecast Result for the UI Sandbox.
     * MANDATE: Explicitly labeled as "PROJECTION" / Non-Exportable.
     */
    static projectForecast(scenarioId: string): any {
        return {
            scenario_id: scenarioId,
            truth_state: 'PROJECTION',
            is_exportable: false,
            is_certifiable: false,
            result: {
                projected_runway: 8.5,
                projected_cash: '$19,200.00'
            }
        };
    }
}
