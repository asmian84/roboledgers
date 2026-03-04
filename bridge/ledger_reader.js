/**
 * bridge/ledger_reader.js — RoboLedger State Reader
 *
 * Reads ledger_state.json (written by the RoboLedger browser app on export)
 * and converts the in-memory data structures into neutral bridge schema objects.
 *
 * This module ports the minimal subset of ReportGenerator.js logic needed to
 * produce Trial Balance lines and transaction lists. It is self-contained — no
 * browser globals, no ES module imports.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
    makeLedgerAccount,
    makeTBLine,
    makeJournalEntry,
    makeTransaction,
    makeProviderHealth,
    mapAccountType,
    inferAccountType,
    ACCOUNT_TYPES,
} = require('./schema');

// ── Constants ─────────────────────────────────────────────────────────────────

const UNCATEGORIZED_CODE = '9970';
const STATE_FILE = path.join(__dirname, '..', 'ledger_state.json');

// ── State cache ───────────────────────────────────────────────────────────────

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30s — re-reads file if stale

/**
 * Load and parse ledger_state.json. Caches for CACHE_TTL_MS.
 * @returns {object} Raw ledger state
 */
function loadState() {
    const now = Date.now();
    if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

    if (!fs.existsSync(STATE_FILE)) {
        throw new Error(
            `ledger_state.json not found at ${STATE_FILE}. ` +
            `Click "Export Ledger State" inside RoboLedger to generate it.`
        );
    }

    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    _cache = JSON.parse(raw);
    _cacheTime = now;
    return _cache;
}

/** Force cache invalidation (called after a new export is received). */
function invalidateCache() {
    _cache = null;
    _cacheTime = 0;
}

// ── Polarity helpers (mirrors ReportGenerator._isSourceCreditNormal) ─────────

function isSourceCreditNormal(tx, accountsById) {
    const acct = accountsById[tx.account_id];
    if (!acct) return false;
    if ((acct.accountType || '').toLowerCase() === 'creditcard') return true;
    if (acct.cardNetwork || acct.brand) return true;
    return false;
}

function effectivePolarity(tx, accountsById) {
    if (isSourceCreditNormal(tx, accountsById)) {
        return tx.polarity === 'CREDIT' ? 'DEBIT' : 'CREDIT';
    }
    return tx.polarity || 'DEBIT';
}

// ── COA helpers ───────────────────────────────────────────────────────────────

/**
 * Build a code → account map from the state's coa array.
 * RoboLedger stores COA as an array of {code, name, root, class, ...}.
 */
function buildCOAMap(state) {
    const map = {};
    const coaEntries = state.coa || state.chartOfAccounts || [];
    for (const entry of coaEntries) {
        if (entry && entry.code) {
            map[String(entry.code)] = entry;
        }
    }
    return map;
}

/**
 * Build an id → account map from source bank/CC accounts.
 */
function buildAccountsById(state) {
    const byId = {};
    const accounts = state.accounts || [];
    for (const a of accounts) {
        if (a && a.id) byId[a.id] = a;
    }
    return byId;
}

/**
 * Resolve COA entry for a code. Falls back gracefully.
 */
function resolveCOA(code, coaMap) {
    return coaMap[String(code)] || coaMap[String(parseInt(code, 10))] || null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return provider health status.
 * @returns {ProviderHealth}
 */
function getHealth() {
    try {
        const state = loadState();
        const txCount = (state.transactions || []).length;
        const acctCount = (state.accounts || []).length;
        const stat = fs.statSync(STATE_FILE);
        return makeProviderHealth({
            ok: true,
            version: state.version || 'unknown',
            client_id: state.client_id || state.clientId || 'default',
            last_export: stat.mtime.toISOString(),
            account_count: acctCount,
            transaction_count: txCount,
        });
    } catch (err) {
        return makeProviderHealth({
            ok: false, version: '', client_id: '', last_export: null, error: err.message,
        });
    }
}

/**
 * Return all ledger accounts (source bank/CC accounts) as neutral LedgerAccount objects.
 * @returns {LedgerAccount[]}
 */
function getAccounts() {
    const state = loadState();
    const coaMap = buildCOAMap(state);
    const accounts = state.accounts || [];

    return accounts.map(acct => {
        const coaCode = acct.coaCode || acct.coa_code || '';
        const coaEntry = resolveCOA(coaCode, coaMap);
        const root = coaEntry?.root || (coaCode ? inferAccountType(coaCode) : ACCOUNT_TYPES.ASSET);
        const type = mapAccountType(root) || inferAccountType(coaCode);

        return makeLedgerAccount({
            id: acct.id || acct.account_id,
            number: acct.coaCode || acct.ref || acct.id,
            name: acct.name || acct.account_name || acct.id,
            accountType: type,
            currency: acct.currency || 'CAD',
        });
    });
}

/**
 * Generate a Trial Balance as of asOfDate.
 * Ports the core of ReportGenerator.generateTrialBalance() to Node.
 *
 * @param {string|Date|null} asOfDate  ISO date string or null for all transactions
 * @returns {TBLine[]}
 */
function getTrialBalance(asOfDate = null) {
    const state = loadState();
    const coaMap = buildCOAMap(state);
    const accountsById = buildAccountsById(state);
    const asOfMs = asOfDate ? new Date(asOfDate).getTime() : null;

    // Build acctId → coaCode lookup for contra entries
    const acctCoaMap = {};
    for (const acct of (state.accounts || [])) {
        if (acct.id && (acct.coaCode || acct.coa_code)) {
            acctCoaMap[acct.id] = acct.coaCode || acct.coa_code;
        }
    }

    const allBuckets = {};

    function ensureBucket(code) {
        const key = String(code);
        if (!allBuckets[key]) {
            const coaEntry = resolveCOA(code, coaMap);
            const root = coaEntry?.root || '';
            const type = mapAccountType(root) || inferAccountType(code);
            allBuckets[key] = {
                code: key,
                name: code === UNCATEGORIZED_CODE
                    ? 'Uncategorized'
                    : (coaEntry?.name || `Account ${code}`),
                account_type: type,
                debit: 0,
                credit: 0,
            };
        }
        return allBuckets[key];
    }

    const transactions = state.transactions || [];

    for (const tx of transactions) {
        // Date filter
        if (asOfMs && tx.date) {
            const txMs = new Date(tx.date).getTime();
            if (txMs > asOfMs) continue;
        }

        const category = tx.category || UNCATEGORIZED_CODE;
        const amount = (tx.amount_cents || 0) / 100;
        const eff = effectivePolarity(tx, accountsById);

        // Side 1: category account
        const bucket = ensureBucket(category);
        if (eff === 'DEBIT') bucket.debit += amount;
        else bucket.credit += amount;

        // GST side
        if (tx.gst_enabled && tx.gst_account && tx.tax_cents) {
            const gstBucket = ensureBucket(tx.gst_account);
            gstBucket.credit += (tx.tax_cents / 100);
        }

        // Side 2: source bank/CC account contra
        const sourceCoaCode = acctCoaMap[tx.account_id];
        if (sourceCoaCode && sourceCoaCode !== category) {
            const srcBucket = ensureBucket(sourceCoaCode);
            if (eff === 'DEBIT') srcBucket.credit += amount;
            else srcBucket.debit += amount;
        }
    }

    // Convert to TBLine array, sort by account code
    return Object.values(allBuckets)
        .filter(b => b.debit !== 0 || b.credit !== 0)
        .sort((a, b) => parseInt(a.code, 10) - parseInt(b.code, 10))
        .map(b => makeTBLine({
            account_id: b.code,
            account_number: b.code,
            account_name: b.name,
            account_type: b.account_type,
            debit: parseFloat(b.debit.toFixed(2)),
            credit: parseFloat(b.credit.toFixed(2)),
        }));
}

/**
 * Return transactions within a date range as neutral Transaction objects.
 *
 * @param {string|null} fromDate  ISO date (inclusive)
 * @param {string|null} toDate    ISO date (inclusive)
 * @returns {Transaction[]}
 */
function getTransactions(fromDate = null, toDate = null) {
    const state = loadState();
    const coaMap = buildCOAMap(state);
    const accountsById = buildAccountsById(state);

    const fromMs = fromDate ? new Date(fromDate).getTime() : null;
    const toMs = toDate ? new Date(toDate).getTime() : null;

    return (state.transactions || [])
        .filter(tx => {
            if (!tx.date) return true;
            const ms = new Date(tx.date).getTime();
            if (fromMs && ms < fromMs) return false;
            if (toMs && ms > toMs) return false;
            return true;
        })
        .map(tx => {
            const amount = (tx.amount_cents || 0) / 100;
            const eff = effectivePolarity(tx, accountsById);
            const srcAcct = accountsById[tx.account_id];
            const coaEntry = resolveCOA(tx.category || UNCATEGORIZED_CODE, coaMap);

            return makeTransaction({
                id: tx.id || tx.tx_id,
                date: tx.date,
                description: tx.description,
                account_id: tx.account_id,
                account_number: srcAcct?.coaCode || tx.account_id,
                account_name: srcAcct?.name || tx.account_id,
                debit_amount: eff === 'DEBIT' ? amount : 0,
                credit_amount: eff === 'CREDIT' ? amount : 0,
                category_code: String(tx.category || UNCATEGORIZED_CODE),
                category_name: coaEntry?.name || 'Uncategorized',
                reference: tx.ref || tx.parser_ref,
                gst_amount: tx.gst_enabled ? (tx.tax_cents || 0) / 100 : 0,
                currency: 'CAD',
            });
        });
}

/**
 * Build synthetic double-entry journal entries from individual transactions.
 * RoboLedger doesn't store journal entries natively — each transaction IS a
 * two-line journal entry (source account ↔ category account).
 *
 * @param {string|null} fromDate
 * @param {string|null} toDate
 * @returns {JournalEntry[]}
 */
function getJournals(fromDate = null, toDate = null) {
    const state = loadState();
    const coaMap = buildCOAMap(state);
    const accountsById = buildAccountsById(state);

    const fromMs = fromDate ? new Date(fromDate).getTime() : null;
    const toMs = toDate ? new Date(toDate).getTime() : null;

    const acctCoaMap = {};
    for (const acct of (state.accounts || [])) {
        if (acct.id) acctCoaMap[acct.id] = acct.coaCode || acct.coa_code || acct.id;
    }

    const entries = [];

    for (const tx of (state.transactions || [])) {
        if (tx.date) {
            const ms = new Date(tx.date).getTime();
            if (fromMs && ms < fromMs) continue;
            if (toMs && ms > toMs) continue;
        }

        const amount = (tx.amount_cents || 0) / 100;
        const eff = effectivePolarity(tx, accountsById);
        const category = tx.category || UNCATEGORIZED_CODE;
        const coaEntry = resolveCOA(category, coaMap);
        const sourceCode = acctCoaMap[tx.account_id] || tx.account_id;
        const srcAcct = accountsById[tx.account_id];
        const srcCoaEntry = resolveCOA(sourceCode, coaMap);

        // Two-line double-entry: category DR/CR and source account CR/DR
        const lines = [
            {
                account_id: category,
                account_number: category,
                account_name: coaEntry?.name || 'Uncategorized',
                debit_amount: eff === 'DEBIT' ? amount : 0,
                credit_amount: eff === 'CREDIT' ? amount : 0,
                memo: tx.description,
            },
            {
                account_id: sourceCode,
                account_number: sourceCode,
                account_name: srcAcct?.name || srcCoaEntry?.name || sourceCode,
                debit_amount: eff === 'CREDIT' ? amount : 0,  // contra
                credit_amount: eff === 'DEBIT' ? amount : 0,
                memo: tx.description,
            },
        ];

        entries.push(makeJournalEntry({
            id: tx.id || tx.tx_id,
            date: tx.date,
            memo: tx.description,
            reference: tx.ref || tx.parser_ref,
            lines,
        }));
    }

    return entries;
}

module.exports = {
    getHealth,
    getAccounts,
    getTrialBalance,
    getTransactions,
    getJournals,
    invalidateCache,
    STATE_FILE,
};
