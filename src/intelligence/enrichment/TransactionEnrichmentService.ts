import { CanonicalTransaction } from "../../types/transaction";
import { MerchantClassifier } from "../merchant/MerchantClassifier";
import { DescriptionEngine } from "../descriptions/DescriptionEngine";

type RoboEnrichmentV1 = {
  v: number;
  tx_type?: string;
  counterparty?: string;
  merchant_clean?: string;
  category_predicted?: string;
  description_template?: string;
  description_line_1?: string;
  description_line_2?: string;
};

const PREFIX = "ROBO_ENRICHMENT:";

export class TransactionEnrichmentService {

  static VERSION = 1;

  static enrich(tx: CanonicalTransaction): CanonicalTransaction {
    const enrichment: RoboEnrichmentV1 = {
      v: this.VERSION
    };

    this.inferTransactionType(tx, enrichment);
    this.inferCounterparty(tx, enrichment);
    this.inferMerchant(tx, enrichment);
    this.generateDescriptions(enrichment);

    return this.attachEnvelope(tx, enrichment);
  }

  // --------------------------------------------------
  private static attachEnvelope(
    tx: CanonicalTransaction,
    enrichment: RoboEnrichmentV1
  ): CanonicalTransaction {

    const newNotes = PREFIX + JSON.stringify(enrichment);

    return {
      ...tx,
      notes: newNotes
    };
  }

  // --------------------------------------------------
  private static inferTransactionType(
    tx: CanonicalTransaction,
    enrichment: RoboEnrichmentV1
  ) {
    const desc = tx.raw_description.toLowerCase();

    if (desc.includes("e-transfer") && tx.polarity === "DEBIT") {
      enrichment.tx_type = "INTERAC_IN";
    }
    else if (desc.includes("e-transfer") && tx.polarity === "CREDIT") {
      enrichment.tx_type = "INTERAC_OUT";
    }
    else if (desc.includes("payment - thank you")) {
      enrichment.tx_type = "CREDIT_CARD_PAYMENT";
    }
    else if (desc.includes("direct deposits")) {
      enrichment.tx_type = "PAYROLL_BATCH";
    }
    else if (desc.includes("transfer")) {
      enrichment.tx_type = "INTERNAL_TRANSFER";
    }
  }

  // --------------------------------------------------
  private static inferCounterparty(
    tx: CanonicalTransaction,
    enrichment: RoboEnrichmentV1
  ) {
    const cleaned = tx.raw_description
      .replace(/e-transfer - autodeposit/i, "")
      .replace(/online banking payment/i, "")
      .replace(/payment - thank you/i, "")
      .trim();

    if (cleaned.length > 3 && cleaned.length < 60) {
      enrichment.counterparty = cleaned;
    }
  }

  // --------------------------------------------------
  private static inferMerchant(
    tx: CanonicalTransaction,
    enrichment: RoboEnrichmentV1
  ) {
    const match = MerchantClassifier.classify(tx.raw_description);

    if (match.confidence > 0.8 && match.profile) {
      enrichment.merchant_clean = match.merchant_clean;
      enrichment.category_predicted = match.category;
      enrichment.description_template = match.template;
    }
  }

  // --------------------------------------------------
  private static generateDescriptions(enrichment: RoboEnrichmentV1) {

    // 1) Try merchant template first (highest quality)
    if (enrichment.description_template) {
      const desc = DescriptionEngine.generateFromTemplate(
        enrichment.description_template
      );

      if (desc) {
        enrichment.description_line_1 = desc.line1;
        enrichment.description_line_2 = desc.line2;
        return;
      }
    }

    // 2) Fallback to tx-type descriptions
    const fallback = DescriptionEngine.generateFallback(enrichment.tx_type);
    if (fallback) {
      enrichment.description_line_1 = fallback.line1;
      enrichment.description_line_2 = fallback.line2;
    }
  }

  // --------------------------------------------------
  static extractFromNotes(tx: CanonicalTransaction): RoboEnrichmentV1 | null {
    if (!tx.notes?.startsWith(PREFIX)) return null;
    try {
      return JSON.parse(tx.notes.replace(PREFIX, ""));
    } catch {
      return null;
    }
  }
}
