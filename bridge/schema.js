/**
 * bridge/schema.js — Neutral Ledger Schema
 *
 * These types define the contract between the RoboLedger Bridge API and
 * any consuming system (Accountware, QuickBooks adapter, etc.).
 *
 * NO RoboLedger-specific field names leak past this module.
 */

'use strict';

// ── Account types ─────────────────────────────────────────────────────────────

/** Canonical account types understood by Accountware */
const ACCOUNT_TYPES = Object.freeze({
    ASSET: 'asset',
    LIABILITY: 'liability',
    EQUITY: 'equity',
    REVENUE: 'revenue',
    EXPENSE: 'expense',
});

/**
 * Map RoboLedger COA root strings → neutral account_type.
 * @param {string} root  RoboLedger .root value (ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE)
 * @returns {string}
 */
function mapAccountType(root) {
    const map = {
        ASSET: ACCOUNT_TYPES.ASSET,
        LIABILITY: ACCOUNT_TYPES.LIABILITY,
        EQUITY: ACCOUNT_TYPES.EQUITY,
        REVENUE: ACCOUNT_TYPES.REVENUE,
        EXPENSE: ACCOUNT_TYPES.EXPENSE,
        COGS: ACCOUNT_TYPES.EXPENSE,  // COGS is expense-type in Accountware
    };
    return map[String(root || '').toUpperCase()] || ACCOUNT_TYPES.EXPENSE;
}

/**
 * Infer account type from a numeric COA code (fallback when root is missing).
 * @param {string|number} code
 * @returns {string}
 */
function inferAccountType(code) {
    const n = parseInt(code, 10);
    if (n >= 1000 && n < 2000) return ACCOUNT_TYPES.ASSET;
    if (n >= 2000 && n < 3000) return ACCOUNT_TYPES.LIABILITY;
    if (n >= 3000 && n < 4000) return ACCOUNT_TYPES.EQUITY;
    if (n >= 4000 && n < 5000) return ACCOUNT_TYPES.REVENUE;
    return ACCOUNT_TYPES.EXPENSE;
}

// ── Normal balance ────────────────────────────────────────────────────────────

function normalBalance(accountType) {
    return (accountType === ACCOUNT_TYPES.ASSET || accountType === ACCOUNT_TYPES.EXPENSE)
        ? 'debit'
        : 'credit';
}

// ── Factory functions ─────────────────────────────────────────────────────────

/**
 * Build a neutral LedgerAccount record.
 *
 * @param {object} params
 * @param {string}  params.id             Internal RoboLedger account UUID or COA code
 * @param {string}  params.number         COA account number (e.g. "1000")
 * @param {string}  params.name           Human-readable name
 * @param {string}  params.accountType    Neutral type (use ACCOUNT_TYPES)
 * @param {number}  [params.balance=0]    Signed net balance in CAD dollars
 * @param {number}  [params.debit=0]
 * @param {number}  [params.credit=0]
 * @param {string}  [params.currency='CAD']
 * @returns {LedgerAccount}
 */
function makeLedgerAccount({ id, number, name, accountType, balance = 0, debit = 0, credit = 0, currency = 'CAD' }) {
    const type = accountType || inferAccountType(number);
    return Object.freeze({
        id: String(id),
        number: String(number || ''),
        name: String(name || ''),
        account_type: type,
        normal_balance: normalBalance(type),
        balance: Number(balance),
        debit: Number(debit),
        credit: Number(credit),
        currency: String(currency),
    });
}

/**
 * Build a neutral TBLine (one row in a Trial Balance).
 *
 * @param {object} params
 * @param {string}  params.account_id
 * @param {string}  params.account_number
 * @param {string}  params.account_name
 * @param {string}  params.account_type
 * @param {number}  [params.debit=0]
 * @param {number}  [params.credit=0]
 * @param {number}  [params.balance=0]   Signed net (debit-normal positive)
 * @returns {TBLine}
 */
function makeTBLine({ account_id, account_number, account_name, account_type, debit = 0, credit = 0, balance }) {
    const type = account_type || inferAccountType(account_number);
    const net = (balance !== undefined) ? Number(balance) : (Number(debit) - Number(credit));
    return Object.freeze({
        account_id: String(account_id),
        account_number: String(account_number || ''),
        account_name: String(account_name || ''),
        account_type: type,
        debit: Number(debit),
        credit: Number(credit),
        balance: net,
    });
}

/**
 * Build a neutral JournalLine.
 */
function makeJournalLine({ account_id, account_number, account_name, debit_amount, credit_amount, memo }) {
    return Object.freeze({
        account_id: String(account_id || ''),
        account_number: String(account_number || ''),
        account_name: String(account_name || ''),
        debit_amount: Number(debit_amount || 0),
        credit_amount: Number(credit_amount || 0),
        memo: String(memo || ''),
    });
}

/**
 * Build a neutral JournalEntry.
 *
 * @param {object} params
 * @param {string}   params.id
 * @param {string}   params.date        ISO date string
 * @param {string}   [params.memo]
 * @param {string}   [params.reference] External source reference
 * @param {JournalLine[]} params.lines
 * @returns {JournalEntry}
 */
function makeJournalEntry({ id, date, memo, reference, lines = [] }) {
    return Object.freeze({
        id: String(id || ''),
        date: String(date || ''),
        memo: String(memo || ''),
        reference: String(reference || ''),
        lines: lines.map(l => makeJournalLine(l)),
        is_balanced: Math.abs(
            lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0) -
            lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
        ) < 0.01,
    });
}

/**
 * Build a neutral Transaction record (individual GL movement).
 */
function makeTransaction({ id, date, description, account_id, account_number, account_name,
    debit_amount, credit_amount, category_code, category_name,
    reference, gst_amount, currency }) {
    return Object.freeze({
        id: String(id || ''),
        date: String(date || ''),
        description: String(description || ''),
        account_id: String(account_id || ''),
        account_number: String(account_number || ''),
        account_name: String(account_name || ''),
        debit_amount: Number(debit_amount || 0),
        credit_amount: Number(credit_amount || 0),
        category_code: String(category_code || ''),
        category_name: String(category_name || ''),
        reference: String(reference || ''),
        gst_amount: Number(gst_amount || 0),
        currency: String(currency || 'CAD'),
    });
}

/**
 * ProviderHealth — returned by GET /health
 */
function makeProviderHealth({ ok, version, client_id, last_export, account_count = 0, transaction_count = 0, error = null }) {
    return Object.freeze({
        ok: Boolean(ok),
        version: String(version || ''),
        client_id: String(client_id || ''),
        last_export: last_export ? String(last_export) : null,
        account_count: Number(account_count),
        transaction_count: Number(transaction_count),
        error: error ? String(error) : null,
    });
}

module.exports = {
    ACCOUNT_TYPES,
    mapAccountType,
    inferAccountType,
    normalBalance,
    makeLedgerAccount,
    makeTBLine,
    makeJournalLine,
    makeJournalEntry,
    makeTransaction,
    makeProviderHealth,
};
