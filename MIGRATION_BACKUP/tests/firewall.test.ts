import { assert } from './assertions.ts';
import { ParserAdapter } from '../src/parsers/adapter.ts';
import type { RawParsedTransaction } from '../src/parsers_raw/types.ts';

export async function runFirewallTests() {
    console.log('\n--- Running Firewall & Adapter Tests ---');

    const raw: RawParsedTransaction = {
        source_id: 'AMEX_RAW',
        raw_date: '02/15/2025',
        raw_description: ' WHOLE FOODS MARKET ',
        raw_amount: '$150.25'
    };

    // 1. Adapter Normalization
    const normalized = ParserAdapter.adapt(raw, 'USD');

    assert(normalized.date === '2025-02-15', 'Date must be ISO-8601');
    assert(normalized.amount_cents === 15025, 'Amount must be integer cents');
    assert(normalized.raw_description === 'WHOLE FOODS MARKET', 'Description must be trimmed');
    assert(normalized.currency === 'USD', 'Currency must be standardized');

    // 2. Prohibited Fields Check (Type level mainly, but we verify no leakage)
    // We check that normalized object DOES NOT have sensitive fields
    const anyNorm = normalized as any;
    assert(anyNorm.txsig === undefined, 'Adapter must NOT generate txsig');
    assert(anyNorm.polarity === undefined, 'Adapter must NOT decide polarity');
    assert(anyNorm.category_id === undefined, 'Adapter must NOT assign category');
}
