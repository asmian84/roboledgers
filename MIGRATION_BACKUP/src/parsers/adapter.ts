import type { RawParsedTransaction } from "../parsers_raw/types.ts";

/**
 * RoboLedgers: Parser Adapter (The Firewall)
 * Standardizes raw sensor data into primitives.
 * MANDATE: NO txsig generation, NO ledger writes, NO polarity logic.
 */

export interface NormalizedTransaction {
    source_id: string;
    date: string;           // ISO-8601
    raw_description: string;
    amount_cents: number;   // Integer
    currency: string;
    source_locator?: {
        page: number;
        y_coord: number;
    };
}

export class ParserAdapter {
    /**
     * Adapts a raw transaction from any parser into a normalized form.
     */
    static adapt(raw: RawParsedTransaction, currency: string = 'CAD'): NormalizedTransaction {
        const normalized: NormalizedTransaction = {
            source_id: raw.source_id,
            date: this.normalizeDate(raw.raw_date),
            raw_description: raw.raw_description.trim(),
            amount_cents: this.parseAmount(raw.raw_amount),
            currency: currency.toUpperCase()
        };

        if (raw.page !== undefined && raw.y_coord !== undefined) {
            normalized.source_locator = {
                page: raw.page,
                y_coord: raw.y_coord
            };
        }

        return normalized;
    }

    /**
     * Standardizes amount strings to integer cents.
     */
    private static parseAmount(amountStr: string): number {
        let clean = amountStr.replace(/[$,\s]/g, '');
        if (clean.startsWith('(') && clean.endsWith(')')) {
            clean = '-' + clean.slice(1, -1);
        }
        const floatAmount = parseFloat(clean);
        if (isNaN(floatAmount)) {
            throw new Error(`ADAPTER_ERROR: Invalid amount format "${amountStr}"`);
        }
        return Math.round(floatAmount * 100);
    }

    /**
     * Standardizes date strings to ISO-8601 (YYYY-MM-DD).
     */
    private static normalizeDate(dateStr: string): string {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            throw new Error(`ADAPTER_ERROR: Invalid date format "${dateStr}"`);
        }
        return d.toISOString().split('T')[0];
    }
}
