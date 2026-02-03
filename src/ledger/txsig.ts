import { createHash } from 'crypto';

/**
 * RoboLedgers: txsig Generation (Truth Layer)
 * MANDATE: Only after normalization. Parsers MUST NEVER import this.
 */

export interface TxSigInputs {
    account_id: string;
    date: string;
    amount_cents: number;
    currency: string;
    raw_description: string;
    source_locator?: {
        page: number;
        y_coord: number;
    };
}

export function generateTxSig(inputs: TxSigInputs): string {
    const { account_id, date, amount_cents, currency, raw_description, source_locator } = inputs;

    let source = [
        account_id,
        date,
        Math.abs(amount_cents).toString(),
        currency.toUpperCase(),
        raw_description.trim()
    ].join('|');

    // CONSTITUTIONAL HARDENING (FORENSIC ENTROPY)
    if (source_locator) {
        source += `|p${source_locator.page}:y${Math.round(source_locator.y_coord)}`;
    }

    return createHash('sha256').update(source).digest('hex');
}
