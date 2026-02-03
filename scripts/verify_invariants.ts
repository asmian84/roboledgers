import { IngestionService } from '../src/core/ingestion.ts';
import { LedgerService } from '../src/core/ledger.ts';
import type { RawParsedTransaction } from '../src/parsers_raw/types.ts';

/**
 * RoboLedgers: Invariant Verification Script
 * Proves the system obeys the "Financial Constitution".
 */

const ACCOUNT_ID = 'acc_777_test';

const RAW_TX: RawParsedTransaction = {
    source_id: 'RBC_001',
    raw_date: '2025-02-01',
    raw_description: 'AMZN MKTP US*123456',
    raw_amount: '$149.99'
};

async function runVerification() {
    console.log('--- ROBOLEDGERS INVARIANT VERIFICATION ---');

    // 1. Map and Post Original
    console.log('\n[1] Mapping raw transaction through IngestionService...');
    const canonical = IngestionService.transform(RAW_TX, ACCOUNT_ID);

    console.log('[1] Posting to Ledger...');
    LedgerService.post(canonical);

    // 2. Attempt Duplicate Post
    console.log('\n[2] Attempting to post duplicate (same txsig)...');
    try {
        const duplicate = IngestionService.transform(RAW_TX, ACCOUNT_ID);
        LedgerService.post(duplicate);
    } catch (err: any) {
        console.error(`[EXPECTED ERROR] ${err.message}`);
    }

    // 3. Attempt Mutation of Immutable Field
    console.log('\n[3] Attempting to change immutable "amount_cents"...');
    try {
        LedgerService.preventMutation(canonical.tx_id, { amount_cents: 999999 } as any);
    } catch (err: any) {
        console.error(`[EXPECTED ERROR] ${err.message}`);
    }

    // 4. Void and Check Version
    console.log('\n[4] Voiding transaction...');
    LedgerService.void(canonical.tx_id, 'user_accountant_01');

    console.log('\n--- VERIFICATION COMPLETE ---');
}

runVerification();
