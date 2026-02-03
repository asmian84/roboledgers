import { assert } from './assertions.ts';
import { generateTxSig } from '../src/ledger/txsig.ts';
import type { TxSigInputs } from '../src/ledger/txsig.ts';

/**
 * RoboLedgers: Forensic Hardening Tests
 * Verifies that spatial entropy prevents false-positive collisions.
 */

export async function runTxSigCollisionTests() {
    console.log('\n--- Running txsig Collision Tests ---');

    const baseInput: TxSigInputs = {
        account_id: 'acc_123',
        date: '2025-01-01',
        amount_cents: 500,
        currency: 'CAD',
        raw_description: 'COFFEE SHOP #1'
    };

    // Scenario 1: Identical Transactions without Locator (Legacy Risk)
    const hashA = generateTxSig({ ...baseInput });
    const hashB = generateTxSig({ ...baseInput });
    assert(hashA === hashB, 'Legacy identical transactions should effectively collide (deterministic)');

    // Scenario 2: Identical Transactions with DIFFERENT Locators (Hardened)
    // E.g., two coffees on the same day on different lines of the statement
    const hashRow10 = generateTxSig({
        ...baseInput,
        source_locator: { page: 1, y_coord: 100 }
    });

    const hashRow12 = generateTxSig({
        ...baseInput,
        source_locator: { page: 1, y_coord: 120 }
    });

    assert(hashRow10 !== hashRow12, 'Spatial entropy MUST produce distinct hashes for identical content');
    console.log(`[PASSED] Row 10 Sig: ${hashRow10.substring(0, 8)}... != Row 12 Sig: ${hashRow12.substring(0, 8)}...`);

    // Scenario 3: Identical Transactions with SAME Locators (True Duplicate)
    const hashRow10Duplicate = generateTxSig({
        ...baseInput,
        source_locator: { page: 1, y_coord: 100 }
    });

    assert(hashRow10 === hashRow10Duplicate, 'Same content + same location MUST produce identical hash (True Duplicate)');

    console.log('[PASS] txsig Collision Tests');
}
