/**
 * event_bus_wrapper.ts — Roboledger Financial Event Bus Emission
 * Place in: src/core/event_bus_wrapper.ts
 *
 * Wraps the exact Roboledger mutation points identified from source:
 *   1. LedgerService.post()            → transaction_created
 *   2. RuleEngine category assignment  → account_mapped
 *   3. ReconciliationStateMachine.reconcile() → reconciliation_complete
 *   4. TransactionExporter export      → tb_imported
 *   5. SystemGuard period lock         → period_closed
 *
 * DESIGN:
 * - Emit INSIDE same async context, fire-and-forget (3s timeout)
 * - Failure never throws — ledger write is always primary
 * - source_system = 'roboledger' always
 * - Removes all direct downstream coupling to Accountware
 *
 * USAGE EXAMPLE — in core/ledger.ts LedgerService.post():
 *   this.transactions.set(tx.tx_id, { ...tx });
 *   this.sigIndex.set(tx.txsig, tx.tx_id);
 *   EventBusWrapper.onTransactionPosted(tx).catch(() => {}); // fire-and-forget
 *
 * Authority Separation (RULE-AUTH-01 / RULE-AUTH-02):
 *   Roboledger NEVER calls Accountware's adjustment or signoff endpoints.
 *   Accountware NEVER mutates Roboledger's ledger data.
 */

// ── Config ────────────────────────────────────────────────────────────────────
const ACCOUNTWARE_EVENTS_URL: string | null =
    typeof process !== 'undefined' && process.env?.ACCOUNTWARE_API_URL
        ? `${process.env.ACCOUNTWARE_API_URL}/v1/events/inbound`
        : null;

const SERVICE_TOKEN: string | null =
    typeof process !== 'undefined'
        ? (process.env?.ACCOUNTWARE_SERVICE_TOKEN ?? null)
        : null;

// Entity identity — set at app startup from environment
let _organizationId: string = '';
let _ledgerId: string = '';

export function configureEventBus(organizationId: string, ledgerId: string): void {
    _organizationId = organizationId;
    _ledgerId = ledgerId;
}

// ── v1 Payload Contract ───────────────────────────────────────────────────────
interface FinancialEventPayload {
    entity_id: string;
    monetary_effect: number | null;
    accounts_affected: string[];
    period: string | null;
    actor: { id: string | null; type: 'system'; system: 'roboledger' };
    metadata: Record<string, unknown>;
}

function buildPayload(
    entityId: string,
    opts: {
        monetaryEffect?: number | null;
        accountsAffected?: string[];
        period?: string | null;
        metadata?: Record<string, unknown>;
    } = {}
): FinancialEventPayload {
    return {
        entity_id: entityId,
        monetary_effect: opts.monetaryEffect ?? null,
        accounts_affected: opts.accountsAffected ?? [],
        period: opts.period ?? null,
        actor: { id: null, type: 'system', system: 'roboledger' },
        metadata: opts.metadata ?? {},
    };
}

// ── Core emit (fire-and-forget) ───────────────────────────────────────────────
async function emit(body: {
    source_system: 'roboledger';
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: FinancialEventPayload;
    ledger_id?: string;
    engagement_id?: string | null;
}): Promise<void> {
    if (!ACCOUNTWARE_EVENTS_URL || !SERVICE_TOKEN || !_organizationId) {
        // Standalone / offline mode — log locally
        console.info(`[RL EventBus] ${body.event_type} ${body.aggregate_id}`);
        return;
    }
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        fetch(ACCOUNTWARE_EVENTS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_TOKEN}`,
                'X-Organization-ID': _organizationId,
            },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        })
            .catch(e => console.warn('[RL EventBus] emit failed (suppressed):', e?.message))
            .finally(() => clearTimeout(t));
    } catch {
        // Never throw — ledger write is primary
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Hook 1 — LedgerService.post()
 * Call after: this.transactions.set(tx.tx_id, { ...tx }) in core/ledger.ts
 */
export function onTransactionPosted(tx: {
    tx_id: string;
    account_id: string;
    amount_cents: number;
    currency: string;
    date: string;
    source_system: string;
}): Promise<void> {
    const period = tx.date?.substring(0, 7) ?? null; // "YYYY-MM"
    return emit({
        source_system: 'roboledger',
        aggregate_type: 'transaction',
        aggregate_id: tx.tx_id,
        event_type: 'transaction_created',
        ledger_id: _ledgerId,
        payload: buildPayload(tx.tx_id, {
            monetaryEffect: tx.amount_cents / 100,
            accountsAffected: [tx.account_id],
            period,
            metadata: { currency: tx.currency, source: tx.source_system },
        }),
    });
}

/**
 * Hook 2 — RuleEngine category assignment
 * Call after a transaction receives its final category in services/RuleEngine.js
 */
export function onCategoryAssigned(opts: {
    tx_id: string;
    account_id: string;
    category: string;
    gl_code?: string;
    confidence?: number;
    rule_id?: string;
    period?: string;
}): Promise<void> {
    return emit({
        source_system: 'roboledger',
        aggregate_type: 'account',
        aggregate_id: opts.tx_id,
        event_type: 'account_mapped',
        ledger_id: _ledgerId,
        payload: buildPayload(opts.tx_id, {
            accountsAffected: [opts.gl_code ?? opts.account_id],
            period: opts.period ?? null,
            metadata: { category: opts.category, confidence: opts.confidence, rule_id: opts.rule_id },
        }),
    });
}

/**
 * Hook 3 — ReconciliationStateMachine.reconcile()
 * Call after console.log in reconciliation/state.ts (variance_cents === 0 confirmed)
 */
export function onReconciliationComplete(proof: {
    account_id: string;
    period_start: string;
    period_end: string;
    opening_balance_cents: number;
    closing_balance_cents: number;
    variance_cents: number;
    proof_hash: string;
}): Promise<void> {
    const period = proof.period_start?.substring(0, 7) ?? null;
    return emit({
        source_system: 'roboledger',
        aggregate_type: 'ledger',
        aggregate_id: `${proof.account_id}:${proof.period_start}`,
        event_type: 'reconciliation_complete',
        ledger_id: _ledgerId,
        payload: buildPayload(`${proof.account_id}:${proof.period_start}`, {
            period,
            monetaryEffect: proof.variance_cents / 100,
            accountsAffected: [proof.account_id],
            metadata: {
                proof_hash: proof.proof_hash,
                opening_balance_cents: proof.opening_balance_cents,
                closing_balance_cents: proof.closing_balance_cents,
            },
        }),
    });
}

/**
 * Hook 4 — TransactionExporter TB export
 * Call after export resolves in services/TransactionExporter.js
 */
export function onTBExported(opts: {
    export_id: string;
    period: string;
    account_count: number;
    total_cents?: number;
    engagement_id?: string;
}): Promise<void> {
    return emit({
        source_system: 'roboledger',
        aggregate_type: 'ledger',
        aggregate_id: opts.export_id,
        event_type: 'tb_imported',
        ledger_id: _ledgerId,
        engagement_id: opts.engagement_id ?? null,
        payload: buildPayload(opts.export_id, {
            period: opts.period,
            monetaryEffect: opts.total_cents ? opts.total_cents / 100 : null,
            metadata: { account_count: opts.account_count },
        }),
    });
}

/**
 * Hook 5 — Period close (SystemGuard write-lock or explicit period close call)
 * Call when a period is definitively closed / locked in Roboledger
 */
export function onPeriodClosed(opts: {
    ledger_id?: string;
    period: string;
    final_balance_cents?: number;
    engagement_id?: string;
}): Promise<void> {
    const aggId = `${opts.ledger_id ?? _ledgerId}:${opts.period}`;
    return emit({
        source_system: 'roboledger',
        aggregate_type: 'period',
        aggregate_id: aggId,
        event_type: 'period_closed',
        ledger_id: opts.ledger_id ?? _ledgerId,
        engagement_id: opts.engagement_id ?? null,
        payload: buildPayload(aggId, {
            period: opts.period,
            monetaryEffect: opts.final_balance_cents ? opts.final_balance_cents / 100 : null,
            metadata: { period: opts.period },
        }),
    });
}
