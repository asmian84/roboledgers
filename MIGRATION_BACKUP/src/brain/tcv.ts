import type { CanonicalTransaction } from '../types/transaction.ts';
import { COAService } from '../core/coa.ts';
import type { CanonicalAccountClass } from '../types/coa.ts';

/**
 * RoboLedgers: Transaction Context Vector (TCV)
 * A deterministic representation of a transaction for the Brain.
 */
export interface TCV {
    readonly tx_id: string;
    readonly merchant_name_raw: string;
    readonly merchant_name_normalized: string;
    readonly amount_cents: number;
    readonly amount_bucket: 'SMALL' | 'MEDIUM' | 'LARGE' | 'MAJOR';
    readonly instrument_type: CanonicalAccountClass;
    readonly polarity: string;
    readonly day_of_week: number; // 0-6
    readonly day_of_month: number; // 1-31
    readonly eligibility_set: CanonicalAccountClass[];
}

export class TCVGenerator {
    /**
     * Generates a TCV from a Canonical Transaction.
     */
    static generate(tx: CanonicalTransaction): TCV {
        const account = COAService.get(tx.account_id);

        return {
            tx_id: tx.tx_id,
            merchant_name_raw: tx.raw_description,
            merchant_name_normalized: this.normalizeMerchant(tx.raw_description),
            amount_cents: tx.amount_cents,
            amount_bucket: this.bucketAmount(tx.amount_cents),
            instrument_type: account.metadata.canonical_class,
            polarity: tx.polarity,
            day_of_week: new Date(tx.date).getUTCDay(),
            day_of_month: new Date(tx.date).getUTCDate(),
            eligibility_set: this.deriveEligibility(account.metadata.canonical_class)
        };
    }

    /**
     * Strips common non-merchant text (dates, card numbers).
     */
    private static normalizeMerchant(desc: string): string {
        // Basic stripping (Implementation will grow)
        return desc
            .replace(/\d{4,}/g, '') // Remove long numbers
            .replace(/\b\d{2}\/\d{2}\b/g, '') // Remove dates
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    /**
     * Categorizes amount into buckets for faster pattern matching.
     */
    private static bucketAmount(cents: number): 'SMALL' | 'MEDIUM' | 'LARGE' | 'MAJOR' {
        if (cents < 1000) return 'SMALL';      // < $10
        if (cents < 10000) return 'MEDIUM';    // < $100
        if (cents < 100000) return 'LARGE';    // < $1,000
        return 'MAJOR';                        // >= $1,000
    }

    /**
     * Determines which COA classes this transaction is allowed to hit.
     */
    private static deriveEligibility(instrument: CanonicalAccountClass): CanonicalAccountClass[] {
        // This logic consumes COA intelligence to restrict possibilities early.
        // For now, return a placeholder set based on common sense.
        // (A real accountant would map Bank -> Expense/Asset, etc.)
        return [];
    }
}
