import type { CanonicalTransaction } from '../../types/transaction';
import { TransactionEnrichmentService } from '../../intelligence/enrichment/TransactionEnrichmentService';

export function getTransactionAuditData(tx: CanonicalTransaction) {
  const enrichment = TransactionEnrichmentService.extractFromNotes(tx);

  return {
    // FORENSIC LAYER
    raw_description: tx.raw_description,
    source_system: tx.source_system,
    source_locator: tx.source_locator,
    txsig: tx.txsig,
    created_at: tx.created_at,

    // INTERPRETATION LAYER
    robo_interpretation: enrichment
  };
}
