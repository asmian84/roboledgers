import { randomUUID } from 'crypto';
import type { RawParsedTransaction } from '../parsers_raw/types.ts';
import { Polarity, TransactionStatus } from '../types/transaction.ts';
import type { CanonicalTransaction } from '../types/transaction.ts';
import { generateTxSig } from '../ledger/txsig.ts';
import { ParserAdapter } from '../parsers/adapter.ts';

/**
 * RoboLedgers: Ingestion Service
 * Converts normalized sensor data into truth-layer Canonical Transactions.
 */

export class IngestionService {
    /**
     * Transforms normalized statement data into a Canonical Transaction.
     * This is where high-level accounting logic (txsig, polarity) is applied.
     */
    static transform(
        raw: RawParsedTransaction,
        account_id: string,
        currency: string = 'CAD'
    ): CanonicalTransaction {

        // 1. Normalize through the Firewall (ParserAdapter)
        const normalized = ParserAdapter.adapt(raw, currency);

        // 2. Generate Truth-Layer Fingerprint (txsig)
        const txsig = generateTxSig({
            account_id,
            date: normalized.date,
            amount_cents: normalized.amount_cents,
            currency: normalized.currency,
            raw_description: normalized.raw_description
        });

        const now = new Date().toISOString();

        return {
            tx_id: randomUUID(),
            account_id,
            date: normalized.date,
            amount_cents: Math.abs(normalized.amount_cents),
            currency: normalized.currency,
            // Polarity logic belongs here in the Ingest layer, not the parser.
            polarity: normalized.amount_cents >= 0 ? Polarity.DEBIT : Polarity.CREDIT,
            raw_description: normalized.raw_description,
            txsig,
            source_system: normalized.source_id,
            created_at: now,
            updated_at: now,
            version: 1,
            status: TransactionStatus.RAW
        };
    }
}
