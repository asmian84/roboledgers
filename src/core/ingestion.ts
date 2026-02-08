import { randomUUID } from 'crypto';
import type { RawParsedTransaction } from '../parsers_raw/types.ts';
import { Polarity, TransactionStatus } from '../types/transaction.ts';
import type { CanonicalTransaction } from '../types/transaction.ts';
import { generateTxSig } from '../ledger/txsig.ts';
import { ParserAdapter } from '../parsers/adapter.ts';
import { LedgerService } from './ledger.ts';
import { TransactionEnrichmentService } from '../intelligence/enrichment/TransactionEnrichmentService';

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
    ): CanonicalTransaction | null {
        // 0. Idempotency Check (Operational Hardening)
        // Normalize once to get the data needed for the txsig check
        const normalizedForSigCheck = ParserAdapter.adapt(raw, currency);
        const txsigForCheck = generateTxSig({
            account_id,
            date: normalizedForSigCheck.date,
            amount_cents: normalizedForSigCheck.amount_cents,
            currency: normalizedForSigCheck.currency,
            raw_description: normalizedForSigCheck.raw_description,
            source_locator: normalizedForSigCheck.source_locator
        });

        if (LedgerService.existsBySig(txsigForCheck)) {
            console.log(`[INGEST] SKIP: Duplicate txsig detected ${txsigForCheck}`);
            return null; // Idempotent return
        }

        // 1. Normalize through the Firewall (ParserAdapter)
        // (We already did this for sig, but keeping structure for clarity or potential refactor)
        const normalized = ParserAdapter.adapt(raw, currency);

        // 2. Generate Truth-Layer Fingerprint (txsig)
        const txsig = generateTxSig({
            account_id,
            date: normalized.date,
            amount_cents: normalized.amount_cents,
            currency: normalized.currency,
            raw_description: normalized.raw_description,
            source_locator: normalized.source_locator
        });

        const now = new Date().toISOString();

        const canonicalTx = {
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
            source_locator: normalized.source_locator,
            source_file_id: normalized.source_file_id,
            created_at: now,
            updated_at: now,
            version: 1,
            status: TransactionStatus.RAW
        };

        return TransactionEnrichmentService.enrich(canonicalTx);
    }
}
