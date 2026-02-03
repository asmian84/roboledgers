import { assert } from './assertions.ts';
import { DecisionTraceLogger } from '../src/brain/decision_trace.ts';

export async function runTraceTests() {
    console.log('\n--- Running Trace Tests ---');

    DecisionTraceLogger.clear();

    const trace = {
        tx_id: 'tx_trace_1',
        timestamp: new Date().toISOString(),
        candidate_category: '5000',
        scores: {
            identity: 50,
            memory: 0,
            context: 20,
            similarity: 0,
            gate: 100,
            anomaly: 0,
            total: 170
        },
        final_confidence: 0.425,
        gate_passed: true,
        outcome: 'ACCEPTED' as const
    };

    // 1. Logging and Retrieval
    DecisionTraceLogger.log(trace);
    const history = DecisionTraceLogger.getHistory('tx_trace_1');
    assert(history.length === 1, 'Trace should be logged');
    assert(history[0].candidate_category === '5000', 'Trace content mismatch');

    // 2. Immutability
    try {
        (history[0] as any).candidate_category = '9999';
    } catch (e) {
        // Expected if Object.freeze is working (in strict mode)
    }
    // Even if assignment didn't throw, we verify value didn't change
    assert(history[0].candidate_category === '5000', 'Trace must be immutable');

    console.log('[PASS] Trace Tests');
}
