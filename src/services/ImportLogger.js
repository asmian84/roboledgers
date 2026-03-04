/**
 * ImportLogger — captures parser/ingestion console output per upload session.
 *
 * Architecture:
 *  - Installs a global console intercept that captures any log/warn/error tagged
 *    with [INGEST], [PARSER], [FORENSICS], [UPLOAD], [CSV], [IMPORT].
 *  - Sessions are created per-file in handleFilesSelected() via startSession().
 *  - Sessions persist to IndexedDB via StorageService (localStorage fallback).
 *  - Max 100 sessions retained; oldest rotated out automatically.
 *  - window.ImportLogger exposed globally so app.js can call it without imports.
 *
 * Usage:
 *   const sid = window.ImportLogger.startSession(file.name, file.size);
 *   // ... upload happens, all [INGEST]/[PARSER] logs auto-captured ...
 *   window.ImportLogger.endSession(sid, { txCount: n, error: null });
 *
 *   // In the Logs UI:
 *   window.ImportLogger.getSessions()      // all sessions, newest first
 *   window.ImportLogger.formatForAI(id)   // copy-to-clipboard text
 *   window.ImportLogger.clear()            // wipe all logs
 */

const MAX_SESSIONS = 100;
const STORAGE_KEY  = 'roboledger_import_logs';

// Which console tags to capture — covers all parser/ingest activity
const CAPTURE_RE = /\[(INGEST|PARSER|FORENSICS|UPLOAD|CSV|IMPORT|LEDGER)\]/;

const ImportLogger = {

    _sessions:    [],    // Array<Session> in-memory, newest last
    _current:     null,  // Session currently being populated
    _intercepted: false, // Guard against double-install

    /**
     * Install the global console intercept.
     * Must be called once at startup (done automatically at module load).
     */
    init() {
        if (this._intercepted) return;
        this._intercepted = true;

        const self = this;
        const _orig = {
            log:   console.log.bind(console),
            warn:  console.warn.bind(console),
            error: console.error.bind(console),
        };
        this._origConsole = _orig; // keep for emergency restore

        function _wrap(level) {
            return function (...args) {
                // Always pass through to the real console first
                _orig[level](...args);

                const s = self._current;
                if (!s) return; // no active session → nothing to capture

                // Serialize all args to one string
                const msg = args.map(a => {
                    if (a === null)      return 'null';
                    if (a === undefined) return 'undefined';
                    if (a instanceof Error) return `${a.name}: ${a.message}`;
                    if (typeof a === 'object') {
                        try { return JSON.stringify(a, null, 0); } catch { return String(a); }
                    }
                    return String(a);
                }).join(' ');

                // Filter: only capture tagged parser/ingest messages
                if (!CAPTURE_RE.test(msg)) return;

                const entry = { t: Date.now(), level, msg };
                s.logs.push(entry);
                if (level === 'error') s.errors.push(msg);
                if (level === 'warn')  s.warnings.push(msg);

                // Auto-extract bank and parser name from routing log lines
                const bankMatch   = msg.match(/\[PARSER\] Detected (\w[\w\s]+?) statement/i);
                if (bankMatch)   s.bank   = bankMatch[1].trim();

                const parserMatch = msg.match(/\[PARSER\] Routing to ([A-Za-z0-9 ]+?) (?:Parser|parser)/i);
                if (parserMatch) s.parser = parserMatch[1].trim();
            };
        }

        console.log   = _wrap('log');
        console.warn  = _wrap('warn');
        console.error = _wrap('error');

        this._loadFromStorage();
        _orig.log('[ImportLogger] ✓ Console intercept active, sessions loaded:', this._sessions.length);
    },

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Begin a new upload session for one file.
     * Returns sessionId — pass this to endSession() when the upload finishes.
     */
    startSession(filename, fileSize = 0) {
        const ext      = (filename.split('.').pop() || '').toLowerCase();
        const fileType = ext === 'pdf'  ? 'pdf'
                       : (ext === 'csv' || ext === 'xlsx') ? 'csv'
                       : 'other';

        // Close any dangling session that was never finished
        if (this._current) {
            this._finalizeSession(this._current, { status: 'warning' });
            this._sessions.push(this._current);
        }

        const session = {
            id:        (typeof crypto !== 'undefined' && crypto.randomUUID)
                           ? crypto.randomUUID()
                           : `s${Date.now()}_${Math.random().toString(36).slice(2)}`,
            filename,
            fileSize,
            fileType,
            timestamp: Date.now(),
            endTime:   null,
            status:    'running',
            txCount:   0,
            bank:      '',
            parser:    '',
            logs:      [],
            errors:    [],
            warnings:  [],
        };

        this._current = session;
        return session.id;
    },

    /**
     * Finalize the current session and persist to storage.
     * @param {string} sessionId  – must match the value returned by startSession()
     * @param {object} opts       – { txCount: number, error: Error|string|null }
     */
    endSession(sessionId, { txCount = 0, error = null } = {}) {
        const s = this._current;
        if (!s || s.id !== sessionId) return null; // mismatched or no session

        this._finalizeSession(s, { txCount, error });
        this._sessions.push(s);
        this._current = null;

        // Rotate: keep only the last MAX_SESSIONS
        if (this._sessions.length > MAX_SESSIONS) {
            this._sessions = this._sessions.slice(-MAX_SESSIONS);
        }

        this._saveToStorage();
        return s;
    },

    /** Return all sessions, newest first. */
    getSessions() { return [...this._sessions].reverse(); },

    /** Find one session by id. Returns null if not found. */
    getSession(id) { return this._sessions.find(s => s.id === id) ?? null; },

    /** Delete all stored sessions (cannot be undone). */
    clear() {
        this._sessions = [];
        this._current  = null;
        const _SS = window.StorageService;
        if (_SS) _SS.remove(STORAGE_KEY);
        else     localStorage.removeItem(STORAGE_KEY);
    },

    /**
     * Format one session as a text report suitable for pasting to an AI assistant.
     * Returns the formatted string.
     */
    formatForAI(sessionId) {
        const s = this.getSession(sessionId);
        if (!s) return '(session not found)';

        const dur  = s.endTime
            ? `${((s.endTime - s.timestamp) / 1000).toFixed(1)}s`
            : 'in progress';

        const lines = [
            '═══════════════════════════════════════════',
            'RoboLedger Import Log',
            `File    : ${s.filename} (${s.fileType.toUpperCase()}, ${_fmtBytes(s.fileSize)})`,
            `Date    : ${new Date(s.timestamp).toLocaleString()}`,
            `Duration: ${dur}`,
            `Status  : ${s.status.toUpperCase()}`,
            `Imported: ${s.txCount} transaction${s.txCount !== 1 ? 's' : ''}`,
            s.bank   ? `Bank    : ${s.bank}`   : null,
            s.parser ? `Parser  : ${s.parser}` : null,
            `Errors  : ${s.errors.length}`,
            `Warnings: ${s.warnings.length}`,
            '═══════════════════════════════════════════',
            '',
            '--- CONSOLE LOG ---',
            '',
        ].filter(l => l !== null);

        for (const e of s.logs) {
            const ts  = new Date(e.t).toISOString().slice(11, 23); // HH:MM:SS.mmm
            const lvl = e.level.toUpperCase().padEnd(5);
            lines.push(`${ts} [${lvl}] ${e.msg}`);
        }

        if (s.errors.length) {
            lines.push('', '--- ERRORS SUMMARY ---');
            s.errors.forEach((err, i) => lines.push(`  ${i + 1}. ${err}`));
        }

        return lines.join('\n');
    },

    // ── Private helpers ───────────────────────────────────────────────────────

    _finalizeSession(s, { txCount, error, status } = {}) {
        s.endTime = Date.now();
        if (txCount != null) s.txCount = txCount;
        if (status) {
            s.status = status;
        } else if (error) {
            s.status = 'error';
            s.errors.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
        } else if (s.errors.length > 0) {
            s.status = 'warning';
        } else if (s.txCount === 0) {
            s.status = 'warning';
        } else {
            s.status = 'success';
        }
    },

    _saveToStorage() {
        try {
            const payload = this._sessions.slice(-MAX_SESSIONS);
            const _SS = window.StorageService;
            if (_SS) _SS.set(STORAGE_KEY, payload);
            else     localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
            // Non-fatal — storage full or quota exceeded, skip silently
        }
    },

    _loadFromStorage() {
        try {
            const _SS = window.StorageService;
            const raw  = _SS
                ? _SS.get(STORAGE_KEY)
                : JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (Array.isArray(raw)) this._sessions = raw;
        } catch {
            this._sessions = [];
        }
    },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function _fmtBytes(b) {
    if (!b || b === 0) return '?';
    if (b < 1024)    return `${b} B`;
    if (b < 1048576) return `${Math.round(b / 1024)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

// Expose globally so vanilla JS shell (app.js) can call it without ES imports
window.ImportLogger = ImportLogger;

// Auto-install the console intercept immediately
ImportLogger.init();

export default ImportLogger;
