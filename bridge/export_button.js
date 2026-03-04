/**
 * RoboLedger Export Button — injected into the RoboLedger UI
 *
 * This script exports the current in-memory ledger state to a JSON file
 * and optionally POSTs it directly to the local Bridge API so Accountware
 * can sync without a manual file transfer.
 *
 * Usage — add to RoboLedger's main.jsx (or inject via browser console):
 *   import { initExportButton } from './bridge/export_button';
 *   initExportButton({ bridgeUrl: 'http://localhost:3001' });
 */

'use strict';

const DEFAULT_BRIDGE_URL = 'http://localhost:3001';

/**
 * Serialize the current window.RoboLedger state into a portable JSON structure.
 * @returns {object} Full ledger state with version metadata.
 */
function serializeLedgerState() {
    const RL = window.RoboLedger;
    if (!RL) throw new Error('window.RoboLedger not found — is the app loaded?');

    const transactions = RL.Ledger?.getAll?.() || RL.Ledger?.getAllTransactions?.() || [];
    const accounts = RL.Accounts?.getAll?.() || [];
    const coaEntries = [];

    // Serialize COA
    if (RL.COA) {
        if (typeof RL.COA.entries === 'function') {
            for (const [, entry] of RL.COA.entries()) coaEntries.push(entry);
        } else if (Array.isArray(RL.COA)) {
            coaEntries.push(...RL.COA);
        }
    }

    return {
        version: window.ROBOLEDGER_VERSION || '5.x',
        client_id: window.ACTIVE_CLIENT_ID || 'default',
        exported_at: new Date().toISOString(),
        transactions,
        accounts,
        coa: coaEntries,
        // Metadata the bridge uses for health reporting
        _meta: {
            transaction_count: transactions.length,
            account_count: accounts.length,
            coa_count: coaEntries.length,
        },
    };
}

/**
 * Download ledger_state.json to the user's Downloads folder.
 * @param {object} state
 */
function downloadStateFile(state) {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ledger_state.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * POST state directly to the Bridge API.
 * @param {object} state
 * @param {string} bridgeUrl
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function pushStateToBridge(state, bridgeUrl) {
    const url = `${bridgeUrl.replace(/\/$/, '')}/export-upload`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Bridge returned ${resp.status}: ${text}`);
    }
    return resp.json();
}

/**
 * Main export action — serialize, push to bridge, and download as fallback.
 * @param {object} opts
 * @param {string}  [opts.bridgeUrl]   Bridge API URL (default: http://localhost:3001)
 * @param {boolean} [opts.download]    Also download the file (default: false)
 * @param {Function} [opts.onSuccess]  Called with server response
 * @param {Function} [opts.onError]    Called with Error
 */
async function exportLedgerState({ bridgeUrl = DEFAULT_BRIDGE_URL, download = false, onSuccess, onError } = {}) {
    let state;
    try {
        state = serializeLedgerState();
        console.log(`[RoboLedger Export] Serialized ${state._meta.transaction_count} transactions, ${state._meta.account_count} accounts`);
    } catch (err) {
        console.error('[RoboLedger Export] Serialization failed:', err);
        onError?.(err);
        return;
    }

    if (download) {
        downloadStateFile(state);
        console.log('[RoboLedger Export] Downloaded ledger_state.json');
    }

    try {
        const result = await pushStateToBridge(state, bridgeUrl);
        console.log('[RoboLedger Export] Pushed to bridge:', result);
        onSuccess?.(result);
    } catch (err) {
        console.warn('[RoboLedger Export] Bridge push failed (will fallback to download):', err.message);
        if (!download) downloadStateFile(state); // Fallback download
        onError?.(err);
    }
}

/**
 * Inject an "Export → Accountware" floating button into the RoboLedger UI.
 * @param {object} opts
 * @param {string} [opts.bridgeUrl]
 * @param {string} [opts.buttonLabel]
 */
function initExportButton({ bridgeUrl = DEFAULT_BRIDGE_URL, buttonLabel = 'Sync → Accountware' } = {}) {
    if (document.getElementById('rl-accountware-export-btn')) return; // Already mounted

    const btn = document.createElement('button');
    btn.id = 'rl-accountware-export-btn';
    btn.textContent = buttonLabel;
    btn.title = 'Export ledger state to Accountware Bridge';
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '9999',
        padding: '10px 18px',
        background: '#2563EB',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
        transition: 'background 0.15s, transform 0.1s',
        letterSpacing: '0.02em',
    });

    btn.addEventListener('mouseenter', () => { btn.style.background = '#1D4ED8'; btn.style.transform = 'translateY(-1px)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#2563EB'; btn.style.transform = 'none'; });

    btn.addEventListener('click', async () => {
        const original = btn.textContent;
        btn.textContent = 'Syncing…';
        btn.disabled = true;

        await exportLedgerState({
            bridgeUrl,
            download: false,
            onSuccess: (r) => {
                btn.textContent = `✓ ${r.transactions ?? '?'} transactions synced`;
                setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3000);
            },
            onError: (err) => {
                btn.textContent = '⬇ Downloaded (bridge offline)';
                setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 4000);
            },
        });
    });

    document.body.appendChild(btn);
    console.log('[RoboLedger Export] Button mounted — bridge:', bridgeUrl);
}

// Auto-init if running in browser with bridge URL set
if (typeof window !== 'undefined' && window.ACCOUNTWARE_BRIDGE_URL) {
    initExportButton({ bridgeUrl: window.ACCOUNTWARE_BRIDGE_URL });
}

// CJS export for the bridge test harness
if (typeof module !== 'undefined') {
    module.exports = { serializeLedgerState, exportLedgerState, initExportButton };
} else {
    window.RoboLedgerExport = { serializeLedgerState, exportLedgerState, initExportButton };
}
