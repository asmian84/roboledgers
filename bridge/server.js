/**
 * bridge/server.js — RoboLedger Bridge API
 *
 * Express REST server that exposes RoboLedger's in-memory ledger state
 * in a provider-agnostic format for consumption by Accountware's LedgerAdapter.
 *
 * Start with:
 *   node bridge/server.js
 *   # or via package.json:
 *   npm run bridge
 *
 * Environment variables:
 *   BRIDGE_PORT         Default: 3001
 *   BRIDGE_SECRET       Shared secret for bearer-token auth (optional in dev)
 *   ACCOUNTWARE_ORIGIN  Allowed CORS origin (default: http://localhost:8000)
 */

'use strict';

const http = require('http');
const url = require('url');

const reader = require('./ledger_reader');

const PORT = parseInt(process.env.BRIDGE_PORT || '3001', 10);
const SECRET = process.env.BRIDGE_SECRET || '';  // if set, require Authorization: Bearer <secret>
const ALLOWED_ORIGIN = process.env.ACCOUNTWARE_ORIGIN || 'http://localhost:8000';

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

function err(res, statusCode, message) {
    json(res, statusCode, { success: false, error: message });
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

function checkAuth(req, res) {
    if (!SECRET) return true;  // auth disabled in dev
    const auth = req.headers['authorization'] || '';
    if (auth === `Bearer ${SECRET}`) return true;
    err(res, 401, 'Invalid or missing Bearer token');
    return false;
}

function qp(parsedUrl, key, defaultVal = null) {
    return parsedUrl.query[key] ?? defaultVal;
}

// ── Route handlers ─────────────────────────────────────────────────────────────

function handleHealth(req, res) {
    const health = reader.getHealth();
    json(res, health.ok ? 200 : 503, { success: health.ok, data: health });
}

function handleAccounts(req, res) {
    const accounts = reader.getAccounts();
    json(res, 200, { success: true, data: accounts, count: accounts.length });
}

function handleTrialBalance(req, res, query) {
    const asOf = qp(query, 'as_of');
    const lines = reader.getTrialBalance(asOf || null);
    json(res, 200, {
        success: true,
        data: lines,
        count: lines.length,
        as_of: asOf || 'all',
        is_balanced: Math.abs(
            lines.reduce((s, l) => s + l.debit, 0) -
            lines.reduce((s, l) => s + l.credit, 0)
        ) < 0.01,
    });
}

function handleTransactions(req, res, query) {
    const from = qp(query, 'from');
    const to = qp(query, 'to');
    const txns = reader.getTransactions(from, to);
    json(res, 200, { success: true, data: txns, count: txns.length, from, to });
}

function handleJournals(req, res, query) {
    const from = qp(query, 'from');
    const to = qp(query, 'to');
    const entries = reader.getJournals(from, to);
    json(res, 200, { success: true, data: entries, count: entries.length, from, to });
}

async function handleExportTrigger(req, res) {
    // Signal: a new export has been dropped. Invalidate the reader cache so the
    // next request picks up fresh data.
    reader.invalidateCache();
    json(res, 200, { success: true, message: 'Cache invalidated. Next request will re-read ledger_state.json.' });
}

/**
 * GET /transactions/:accountId
 * Returns paginated, date-filtered transactions for a specific account.
 * Computes a running balance across the returned window.
 */
function handleAccountTransactions(req, res, accountId, query) {
    const from = qp(query, 'from');
    const to = qp(query, 'to');
    const page = Math.max(1, parseInt(qp(query, 'page', '1'), 10));
    const limit = Math.min(500, Math.max(1, parseInt(qp(query, 'limit', '100'), 10)));

    // All transactions across all accounts, date-filtered
    const allTxns = reader.getTransactions(from, to);

    // Filter to this account (by account_id or source_account_id)
    const accountTxns = allTxns.filter(t =>
        t.account_id === accountId ||
        t.source_account_id === accountId ||
        t.category_code === accountId ||
        String(t.account_number) === accountId
    );

    // Sort ascending by date for running balance to be meaningful
    accountTxns.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Compute running balance over the entire filtered set
    let running = 0;
    const withRunning = accountTxns.map(t => {
        running += (t.debit_amount || 0) - (t.credit_amount || 0);
        return { ...t, running_balance: Math.round(running * 100) / 100 };
    });

    // Paginate
    const total = withRunning.length;
    const offset = (page - 1) * limit;
    const slice = withRunning.slice(offset, offset + limit);

    json(res, 200, {
        success: true,
        data: slice,
        total,
        page,
        limit,
        has_more: offset + limit < total,
        running_balance_included: true,
        from,
        to,
    });
}

async function handleExportUpload(req, res) {
    // Accept the JSON body as the new ledger state and write it to ledger_state.json.
    // This allows the RoboLedger browser export button to POST directly to the bridge.
    const fs = require('fs');
    const path = require('path');
    try {
        const body = await parseBody(req);
        if (!body || typeof body !== 'object') {
            return err(res, 400, 'Expected JSON body with ledger state');
        }
        body._imported_at = new Date().toISOString();
        fs.writeFileSync(reader.STATE_FILE, JSON.stringify(body, null, 2), 'utf8');
        reader.invalidateCache();
        const txCount = (body.transactions || []).length;
        const acctCount = (body.accounts || []).length;
        json(res, 200, {
            success: true,
            message: 'Ledger state saved',
            transactions: txCount,
            accounts: acctCount,
        });
    } catch (e) {
        err(res, 500, `Failed to save ledger state: ${e.message}`);
    }
}

// ── Router ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname.replace(/\/$/, '') || '/';
    const method = req.method.toUpperCase();

    // CORS pre-flight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        return res.end();
    }

    if (!checkAuth(req, res)) return;

    try {
        // GET /health
        if (method === 'GET' && pathname === '/health') return handleHealth(req, res);
        // GET /accounts
        if (method === 'GET' && pathname === '/accounts') return handleAccounts(req, res);
        // GET /trial-balance  [?as_of=YYYY-MM-DD]
        if (method === 'GET' && pathname === '/trial-balance') return handleTrialBalance(req, res, parsed.query);
        // GET /transactions   [?from=DATE&to=DATE]
        if (method === 'GET' && pathname === '/transactions') return handleTransactions(req, res, parsed.query);
        // GET /journals       [?from=DATE&to=DATE]
        if (method === 'GET' && pathname === '/journals') return handleJournals(req, res, parsed.query);
        // GET /transactions/:accountId   [?from=DATE&to=DATE&page=N&limit=N]
        const accountTxnMatch = method === 'GET' && pathname.match(/^\/transactions\/([^/]+)$/);
        if (accountTxnMatch) return handleAccountTransactions(req, res, decodeURIComponent(accountTxnMatch[1]), parsed.query);
        // POST /export-trigger   — invalidate cache
        if (method === 'POST' && pathname === '/export-trigger') return handleExportTrigger(req, res);
        // POST /export-upload    — receive full ledger state from browser
        if (method === 'POST' && pathname === '/export-upload') return handleExportUpload(req, res);

        err(res, 404, `Unknown endpoint: ${method} ${pathname}`);
    } catch (e) {
        console.error('[Bridge] Unhandled error:', e);
        err(res, 500, e.message);
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[RoboLedger Bridge] Listening on http://127.0.0.1:${PORT}`);
    console.log(`[RoboLedger Bridge] Auth: ${SECRET ? 'enabled' : 'disabled (dev mode)'}`);
    console.log(`[RoboLedger Bridge] CORS origin: ${ALLOWED_ORIGIN}`);
    console.log(`[RoboLedger Bridge] State file: ${reader.STATE_FILE}`);
});

server.on('error', err => {
    console.error('[Bridge] Server error:', err);
    process.exit(1);
});

module.exports = server;  // for tests
