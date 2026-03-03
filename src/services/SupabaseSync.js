/**
 * SupabaseSync — persists client metadata and ledger data to Supabase.
 *
 * Requires two tables in your Supabase project (run the SQL migration below):
 *
 *   -- 1. Client metadata
 *   CREATE TABLE IF NOT EXISTS client_profiles (
 *     id              TEXT NOT NULL,
 *     user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *     name            TEXT NOT NULL,
 *     legal_name      TEXT,
 *     industry        TEXT,
 *     province        TEXT    DEFAULT 'AB',
 *     fiscal_year_end INTEGER DEFAULT 12,
 *     currency        TEXT    DEFAULT 'CAD',
 *     gst_number      TEXT,
 *     color           TEXT    DEFAULT '#3b82f6',
 *     accountant_id   TEXT,
 *     created         DATE,
 *     last_active     DATE,
 *     tx_count        INTEGER DEFAULT 0,
 *     account_count   INTEGER DEFAULT 0,
 *     created_at      TIMESTAMPTZ DEFAULT NOW(),
 *     updated_at      TIMESTAMPTZ DEFAULT NOW(),
 *     PRIMARY KEY (id, user_id)
 *   );
 *   ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Users manage own clients" ON client_profiles
 *     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 *
 *   -- 2. Ledger data (full snapshot as JSONB)
 *   CREATE TABLE IF NOT EXISTS client_ledger_data (
 *     client_id  TEXT  NOT NULL,
 *     user_id    UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *     data       JSONB NOT NULL DEFAULT '{}',
 *     updated_at TIMESTAMPTZ DEFAULT NOW(),
 *     PRIMARY KEY (client_id, user_id)
 *   );
 *   ALTER TABLE client_ledger_data ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Users manage own ledger data" ON client_ledger_data
 *     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 *
 * Strategy: LOCAL-FIRST
 *   - Reads always come from IndexedDB / localStorage (fast, synchronous).
 *   - Writes go to both local AND Supabase (async, fire-and-forget).
 *   - On init / switchClient, if local data is missing, a cloud fallback is
 *     triggered to restore from Supabase (handles browser-cleared scenarios).
 *   - Ledger saves are debounced to at most one cloud write per 10 seconds
 *     to avoid hammering Supabase on every keystroke / import.
 */

import { supabase } from '../lib/supabaseClient.js';

const LEDGER_SYNC_DEBOUNCE_MS = 10_000; // max 1 cloud ledger write per 10 s
const _debounceTimers = {};              // clientId → setTimeout handle

const SupabaseSync = {

    // ── Internal: get current authenticated user ────────────────────────────
    async _getUser() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            return user || null;
        } catch { return null; }
    },

    // ════════════════════════════════════════════════════════════════════════
    // CLIENT METADATA
    // ════════════════════════════════════════════════════════════════════════

    /** Upsert a client profile row. Call after every create/edit. */
    async saveClient(client) {
        const user = await this._getUser();
        if (!user || !client?.id) return;

        const { error } = await supabase.from('client_profiles').upsert({
            id:              client.id,
            user_id:         user.id,
            name:            client.name,
            legal_name:      client.legalName      || null,
            industry:        client.industry       || null,
            province:        client.province       || 'AB',
            fiscal_year_end: client.fiscalYearEnd  ?? 12,
            currency:        client.currency       || 'CAD',
            gst_number:      client.gstNumber      || null,
            color:           client.color          || '#3b82f6',
            accountant_id:   client.accountantId   || null,
            created:         client.created        || null,
            last_active:     client.lastActive     || null,
            tx_count:        client.txCount        ?? 0,
            account_count:   client.accountCount   ?? 0,
            updated_at:      new Date().toISOString(),
        }, { onConflict: 'id,user_id' });

        if (error) console.error('[SUPABASE_SYNC] saveClient error:', error.message);
        else       console.log('[SUPABASE_SYNC] Client saved to cloud:', client.id, client.name);
    },

    /**
     * Fetch all clients for the current user from Supabase.
     * Returns null on error or when not logged in.
     */
    async loadClients() {
        const user = await this._getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('client_profiles')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[SUPABASE_SYNC] loadClients error:', error.message);
            return null;
        }

        // Map snake_case DB columns back to camelCase app objects
        return (data || []).map(row => ({
            id:            row.id,
            name:          row.name,
            legalName:     row.legal_name,
            industry:      row.industry,
            province:      row.province,
            fiscalYearEnd: row.fiscal_year_end,
            currency:      row.currency,
            gstNumber:     row.gst_number,
            color:         row.color,
            accountantId:  row.accountant_id,
            created:       row.created,
            lastActive:    row.last_active,
            txCount:       row.tx_count    || 0,
            accountCount:  row.account_count || 0,
        }));
    },

    /** Delete a client profile and its ledger data from Supabase. */
    async deleteClient(clientId) {
        const user = await this._getUser();
        if (!user || !clientId) return;

        // Cancel any pending debounced ledger sync
        clearTimeout(_debounceTimers[clientId]);
        delete _debounceTimers[clientId];

        // Delete ledger data first
        await supabase.from('client_ledger_data')
            .delete().eq('client_id', clientId).eq('user_id', user.id);

        const { error } = await supabase.from('client_profiles')
            .delete().eq('id', clientId).eq('user_id', user.id);

        if (error) console.error('[SUPABASE_SYNC] deleteClient error:', error.message);
        else       console.log('[SUPABASE_SYNC] Client deleted from cloud:', clientId);
    },

    // ════════════════════════════════════════════════════════════════════════
    // LEDGER DATA
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Schedule a debounced cloud ledger save.
     * Rapid calls (e.g. categorising 500 rows) coalesce into one write.
     * Called from ledger.core.js save() on every local write.
     */
    scheduleLedgerSave(clientId, data) {
        if (!clientId || !data) return;
        clearTimeout(_debounceTimers[clientId]);
        _debounceTimers[clientId] = setTimeout(() => {
            this.saveLedger(clientId, data);
        }, LEDGER_SYNC_DEBOUNCE_MS);
    },

    /** Immediately write a ledger snapshot to Supabase. */
    async saveLedger(clientId, data) {
        const user = await this._getUser();
        if (!user || !clientId || !data) return;

        const { error } = await supabase.from('client_ledger_data').upsert({
            client_id:  clientId,
            user_id:    user.id,
            data:       data,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,user_id' });

        if (error) console.error('[SUPABASE_SYNC] saveLedger error:', error.message);
        else       console.log('[SUPABASE_SYNC] Ledger synced to cloud:', clientId);
    },

    /**
     * Fetch a ledger snapshot for a client from Supabase.
     * Returns the parsed data object, or null if not found / not logged in.
     */
    async loadLedger(clientId) {
        const user = await this._getUser();
        if (!user || !clientId) return null;

        const { data, error } = await supabase
            .from('client_ledger_data')
            .select('data')
            .eq('client_id', clientId)
            .eq('user_id', user.id)
            .single();

        if (error) {
            // PGRST116 = no rows — expected if client was never synced
            if (error.code !== 'PGRST116') {
                console.error('[SUPABASE_SYNC] loadLedger error:', error.message);
            }
            return null;
        }

        return data?.data || null;
    },
};

// Expose globally so vanilla JS shell (app.js, ledger.core.js) can access it
window.SupabaseSync = SupabaseSync;

export default SupabaseSync;
