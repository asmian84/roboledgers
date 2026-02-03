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
}

export function generateTxSig(inputs: TxSigInputs): string {
    const { account_id, date, amount_cents, currency, raw_description } = inputs;

    const source = [
        account_id,
        date,
        Math.abs(amount_cents).toString(),
        currency.toUpperCase(),
        raw_description.trim()
    ].join('|');

    return createHash('sha256').update(source).digest('hex');
}
