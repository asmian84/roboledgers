/**
 * RuleEngine.js — UPDATED to use SignalFusionEngine
 *
 * DROP THIS FILE INTO: src/services/RuleEngine.js
 * (Replace your existing RuleEngine.js entirely)
 *
 * Changes from previous version:
 *   - applyRules() now delegates to SignalFusionEngine.categorize()
 *   - All bug fixes from audit still apply (batch save, race condition, etc.)
 *   - matchesConditions() and evaluateCondition() kept as-is (still used by fusion)
 *   - importDefaultRules() kept and updated
 */

import FuzzyMatcher from './FuzzyMatcher.js';
import VendorNormalizer from './VendorNormalizer.js';
import UserCorrections from './UserCorrections.js';
import SignalFusionEngine, { getConfidenceTier } from './SignalFusionEngine.js';

class RuleEngine {
    constructor() {
        this.STORAGE_KEY    = 'roboledger_categorization_rules';
        this.RULES_VERSION_KEY = 'roboledger_rules_version';
        this.CURRENT_RULES_VERSION = 2; // Bump this when adding new default rules
        this.rules          = this.loadRules();
        this.userCorrections = new UserCorrections();
        this.vendorMatcher  = new window.VendorMatcher();
        this.fuzzyMatcher   = null;
        this._fuzzyReady    = false;
        this.fusionEngine   = null;

        // Promise that resolves when fusionEngine is ready (after async FuzzyMatcher fetch)
        // Callers can await window.RuleEngine.ready before calling bulkCategorize()
        this.ready = new Promise(resolve => { this._resolveReady = resolve; });

        this.initializeFuzzyMatcher();

        if (this.rules.length === 0) {
            console.log('[RULE_ENGINE] No rules found, importing defaults...');
            this.importDefaultRules();
            this._saveRulesVersion();
        } else {
            // [FIX] Migrate rules for existing users: merge new defaults that don't exist yet
            this._migrateRulesIfNeeded();
        }
    }

    // ─── Initialization ──────────────────────────────────────────────────────

    async initializeFuzzyMatcher() {
        try {
            const response   = await fetch('/src/data/vendor_training.json');
            const trainingData = await response.json();
            const corrections  = this.userCorrections.getCorrections();

            this.fuzzyMatcher = new FuzzyMatcher(trainingData, corrections);

            // Spin up the fusion engine now that fuzzyMatcher is ready
            this._initFusionEngine();
            this._resolveReady(); // Signal that categorization is ready

            this._fuzzyReady = true;
            const stats = this.fuzzyMatcher.getStats();
            console.log(`[RULE_ENGINE] FuzzyMatcher loaded: ${stats.totalVendors} vendors`);
        } catch (e) {
            console.warn('[RULE_ENGINE] FuzzyMatcher load failed, fusion will run without it:', e);
            this._initFusionEngine(); // still init fusion without fuzzy
            this._resolveReady(); // Signal ready even without fuzzy matcher
            this._fuzzyReady = true;
        }
    }

    _initFusionEngine() {
        // Pull vendor dictionary from VendorMatcher if it's loaded
        const dict = this.vendorMatcher?.dictionary || [];

        this.fusionEngine = new SignalFusionEngine({
            vendorDictionary: dict,
            fuzzyMatcher:     this.fuzzyMatcher,
            allTransactions:  [], // populated by calling updateTransactionContext()
        });

        console.log('[RULE_ENGINE] ✅ fusionEngine ready — categorization active');
    }

    /**
     * IMPORTANT: Call this whenever you load or update the full transaction list.
     * The fusion engine needs it for recurring detection.
     *
     * Example: call this right after loading transactions from storage.
     *   ruleEngine.updateTransactionContext(allTransactions);
     */
    updateTransactionContext(transactions) {
        this.fusionEngine?.updateTransactionList(transactions);
    }

    // ─── Storage ─────────────────────────────────────────────────────────────

    loadRules() {
        try {
            const _SS = window.StorageService;
            const stored = _SS ? _SS.get(this.STORAGE_KEY) : localStorage.getItem(this.STORAGE_KEY);
            if (stored) return (typeof stored === 'string') ? JSON.parse(stored) : stored;
        } catch (e) {
            console.error('[RULE_ENGINE] Failed to load rules:', e);
        }
        return [];
    }

    saveRules(rules = this.rules) {
        try {
            const _SS = window.StorageService;
            if (_SS) { _SS.set(this.STORAGE_KEY, rules); }
            else { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rules)); }
            this.rules = rules;
            return true;
        } catch (e) {
            console.error('[RULE_ENGINE] Failed to save rules:', e);
            return false;
        }
    }

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    createRule(name, conditions, action, logic = 'AND', priority = 5, enabled = true) {
        const newRule = {
            id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name, enabled, priority, conditions, logic, action,
            stats: { matches_count: 0, last_matched: null },
            created_at: new Date().toISOString()
        };
        this.rules.push(newRule);
        this.saveRules();
        return newRule;
    }

    updateRule(id, updates) {
        const index = this.rules.findIndex(r => r.id === id);
        if (index === -1) return null;
        this.rules[index] = { ...this.rules[index], ...updates };
        this.saveRules();
        return this.rules[index];
    }

    deleteRule(id) {
        const index = this.rules.findIndex(r => r.id === id);
        if (index === -1) return false;
        this.rules.splice(index, 1);
        this.saveRules();
        return true;
    }

    getRules()       { return this.rules; }
    getEnabledRules() {
        return this.rules
            .filter(r => r.enabled)
            .sort((a, b) => b.priority - a.priority);
    }

    // ─── Main Categorization ─────────────────────────────────────────────────

    /**
     * Categorize a single transaction using the SignalFusionEngine.
     *
     * Returns:
     *   {
     *     coa_code:    '6800',
     *     confidence:  0.87,
     *     method:      'fusion',
     *     signals:     [...],
     *     explanation: 'Categorized because: ...',
     *     needsReview: false,
     *     tier:        { label: 'Auto', color: '#10b981', dot: '🟢' }
     *   }
     *
     * Or null if fusion engine not ready yet (very brief startup window).
     */
    applyRules(transaction, _rules = null, _skipSave = false) {
        if (!this.fusionEngine) {
            console.warn('[RULE_ENGINE] applyRules called but fusionEngine not ready — tx:', transaction?.tx_id);
            return null;
        }

        const activeRules = _rules || this.getEnabledRules();
        const result      = this.fusionEngine.categorize(transaction, activeRules, this);

        // Debug: log every categorization decision
        console.log(`[RULE_ENGINE] "${(transaction.description || transaction.raw_description || '').slice(0, 45)}" → ${result.coa_code || 'NO MATCH'} (conf: ${result.confidence?.toFixed(2)}, method: ${result.method})`);

        // Update rule match stats if a user rule won
        if (result.ruleId && !_skipSave) {
            const rule = this.rules.find(r => r.id === result.ruleId);
            if (rule) {
                rule.stats.matches_count++;
                rule.stats.last_matched = new Date().toISOString();
                this.saveRules();
            }
        }

        // Attach UI tier
        result.tier = getConfidenceTier(result.confidence);

        return result;
    }

    /**
     * Bulk categorize — async, yields to browser every CHUNK_SIZE transactions.
     * Prevents "Aw Snap" / tab crash caused by blocking the main thread with
     * 16,501-vendor fuzzy ML matching on large imports.
     */
    async bulkCategorize(transactions, { chunkSize = 10, onProgress } = {}) {
        const results  = { categorized: 0, skipped: 0, flagged: 0, details: [] };
        let rulesDirty = false;

        for (let i = 0; i < transactions.length; i += chunkSize) {
            const chunk = transactions.slice(i, i + chunkSize);

            chunk.forEach(tx => {
                const match = this.applyRules(tx, null, true);

                if (!match?.coa_code) {
                    results.skipped++;
                    return;
                }

                if (match.needsReview) results.flagged++;

                if (window.RoboLedger?.Ledger?.updateCategory) {
                    window.RoboLedger.Ledger.updateCategory(tx.tx_id, match.coa_code, {
                        confidence:  match.confidence,
                        needsReview: match.needsReview,
                        explanation: match.explanation,
                    });
                    results.categorized++;
                    results.details.push({
                        tx_id:       tx.tx_id,
                        description: tx.description,
                        coa_code:    match.coa_code,
                        confidence:  match.confidence,
                        method:      match.method,
                        needsReview: match.needsReview,
                    });
                    if (match.ruleId) rulesDirty = true;
                }
            });

            if (onProgress) onProgress(Math.min(i + chunkSize, transactions.length), transactions.length);

            // Yield to the browser event loop so the tab stays responsive
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (rulesDirty) this.saveRules();

        console.log(`[RULE_ENGINE] Bulk complete: ${results.categorized} categorized, ${results.flagged} flagged for review, ${results.skipped} skipped`);
        return results;
    }

    // ─── Condition Matching (still used by fusion engine) ────────────────────

    matchesConditions(transaction, conditions, logic = 'AND') {
        const results = conditions.map(cond => this.evaluateCondition(transaction, cond));
        return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
    }

    evaluateCondition(transaction, condition) {
        let fieldValue = transaction[condition.field];

        // ── Virtual field: account_type ───────────────────────────────────────
        // Resolved from account registry so rules can distinguish CC vs CHQ/SAV.
        // Value is lowercased accountType (e.g. 'creditcard', 'chequing', 'savings').
        if (condition.field === 'account_type') {
            const acct = window.RoboLedger?.Accounts?.get(transaction.account_id);
            fieldValue = (acct?.accountType || acct?.type || '').toLowerCase();
            // Also treat metadata.brand / cardNetwork presence as creditcard
            if (!fieldValue && (transaction.metadata?.brand || transaction.metadata?.cardNetwork ||
                                transaction._isCCAcct)) {
                fieldValue = 'creditcard';
            }
        }

        if (condition.field.includes('.')) {
            fieldValue = condition.field.split('.').reduce((obj, key) => obj?.[key], transaction);
        }

        // Virtual field: is_cc — boolean shorthand for account_type === 'creditcard'
        if (condition.field === 'is_cc') {
            const acct = window.RoboLedger?.Accounts?.get(transaction.account_id);
            const isCCByAcct = !!(acct?.brand || acct?.cardNetwork ||
                                  (acct?.accountType || '').toLowerCase() === 'creditcard');
            fieldValue = isCCByAcct || !!transaction._isCCAcct;
        }

        if (fieldValue === undefined || fieldValue === null) return false;

        const val = condition.value;

        switch (condition.operator) {
            case 'contains':
                return String(fieldValue).toLowerCase().includes(String(val).toLowerCase());
            case 'not_contains':
                return !String(fieldValue).toLowerCase().includes(String(val).toLowerCase());
            case 'equals':
                return String(fieldValue).toLowerCase() === String(val).toLowerCase();
            case 'not_equals':   // canonical snake_case
            case 'notEquals':    // camelCase alias
                return String(fieldValue).toLowerCase() !== String(val).toLowerCase();
            case 'starts_with':
                return String(fieldValue).toLowerCase().startsWith(String(val).toLowerCase());
            case 'ends_with':
                return String(fieldValue).toLowerCase().endsWith(String(val).toLowerCase());
            case 'regex':
                try { return new RegExp(val, 'i').test(String(fieldValue)); }
                catch { return false; }
            case 'greater_than':
                return parseFloat(fieldValue) > parseFloat(val);
            case 'less_than':
                return parseFloat(fieldValue) < parseFloat(val);
            case 'between': {
                const [min, max] = val;
                return parseFloat(fieldValue) >= min && parseFloat(fieldValue) <= max;
            }
            default:
                console.warn('[RULE_ENGINE] Unknown operator:', condition.operator);
                return false;
        }
    }

    testRule(rule, transactions) {
        return transactions.filter(tx => this.matchesConditions(tx, rule.conditions, rule.logic));
    }

    // ─── Rule Migration ──────────────────────────────────────────────────────

    _getRulesVersion() {
        try {
            return parseInt(localStorage.getItem(this.RULES_VERSION_KEY) || '0', 10);
        } catch { return 0; }
    }

    _saveRulesVersion() {
        try {
            localStorage.setItem(this.RULES_VERSION_KEY, String(this.CURRENT_RULES_VERSION));
        } catch (e) {
            console.warn('[RULE_ENGINE] Could not save rules version:', e);
        }
    }

    _migrateRulesIfNeeded() {
        const storedVersion = this._getRulesVersion();
        if (storedVersion >= this.CURRENT_RULES_VERSION) return;

        console.log(`[RULE_ENGINE] Migrating rules: v${storedVersion} → v${this.CURRENT_RULES_VERSION}`);

        // Build a set of existing rule names for dedup
        const existingNames = new Set(this.rules.map(r => r.name));

        // Get the full default rule set and add any missing ones
        const defaultRules = this._getDefaultRules();
        let added = 0;
        for (const r of defaultRules) {
            if (!existingNames.has(r.name)) {
                this.createRule(r.name, r.conditions, r.action, r.logic, r.priority);
                added++;
            }
        }

        this._saveRulesVersion();
        if (added > 0) {
            console.log(`[RULE_ENGINE] Migration complete: ${added} new rules added`);
        } else {
            console.log('[RULE_ENGINE] Migration complete: no new rules needed');
        }
    }

    // ─── Default Rules ────────────────────────────────────────────────────────

    _getDefaultRules() {
        return this._defaultRulesArray();
    }

    importDefaultRules() {
        const defaultRules = this._getDefaultRules();
        defaultRules.forEach(r => this.createRule(r.name, r.conditions, r.action, r.logic, r.priority));
        console.log(`[RULE_ENGINE] Imported ${defaultRules.length} default rules`);
    }

    _defaultRulesArray() {
        const defaultRules = [
            // TELCO — COA 9100 Telephone & Internet (corrected from 6400 which is wrong)
            { name: 'TELUS → Telephone & Internet (9100)',
              conditions: [{ field: 'description', operator: 'regex', value: 'TELUS[-\\s]?(MOBILITY|CUSTOMER|ACCOUNT)?' }],
              action: { coa_code: '9100' }, logic: 'AND', priority: 9 },
            { name: 'ROGERS / FIDO → Telephone & Internet (9100)',
              conditions: [{ field: 'description', operator: 'regex', value: 'ROGERS|FIDO WIRELESS' }],
              action: { coa_code: '9100' }, logic: 'AND', priority: 9 },
            { name: 'OPENPHONE → Telephone & Internet (9100)',
              conditions: [{ field: 'description', operator: 'contains', value: 'OPENPHONE' }],
              action: { coa_code: '9100' }, logic: 'AND', priority: 9 },

            // SOFTWARE
            { name: 'PRICELABS → Software (6800)',
              conditions: [{ field: 'description', operator: 'regex', value: 'PRICELABS?|DYNAPRIC' }],
              action: { coa_code: '6800' }, logic: 'AND', priority: 9 },
            { name: 'IGMS → Software (6800)',
              conditions: [{ field: 'description', operator: 'regex', value: 'IGMS|AIRGMS' }],
              action: { coa_code: '6800' }, logic: 'AND', priority: 9 },
            { name: 'MICROSOFT 365 → Software (6800)',
              conditions: [{ field: 'description', operator: 'regex', value: 'MICROSOFT.*365|MSBILL' }],
              action: { coa_code: '6800' }, logic: 'AND', priority: 9 },
            { name: 'MONDAY.COM → Software (6800)',
              conditions: [{ field: 'description', operator: 'regex', value: 'MONDAY\\.?COM|BLS\\*MONDAY' }],
              action: { coa_code: '6800' }, logic: 'AND', priority: 9 },
            { name: 'RBOY APPS → Software (6800)',
              conditions: [{ field: 'description', operator: 'contains', value: 'RBOY APPS' }],
              action: { coa_code: '6800' }, logic: 'AND', priority: 8 },
            { name: 'MINUT → Software (6800)',
              conditions: [{ field: 'description', operator: 'contains', value: 'MINUT' }],
              action: { coa_code: '6800' }, logic: 'AND', priority: 8 },

            // REVENUE — AIRBNB payouts on CHQ/SAV only (CREDIT polarity, non-CC account)
            // AirbnbMENTS / Account Payable Payment = Airbnb remitting rental income
            { name: 'AIRBNB → Rental Revenue (4900)',
              conditions: [
                  { field: 'description', operator: 'regex',  value: 'AIRBNB' },
                  { field: 'polarity',    operator: 'equals',  value: 'CREDIT' },
                  { field: 'account_type', operator: 'notEquals', value: 'creditcard' },
              ],
              action: { coa_code: '4900' }, logic: 'AND', priority: 10 },

            // REVENUE — E-Transfer Credits = Rental Revenue on CHQ/SAV accounts only
            // IMPORTANT: This must NOT fire on CC accounts — CC credits are charges, not income
            // [FIX] TD EasyWeb uses "E-TFR" (not "E-TRF") — added both variants + SEND E-TFR
            { name: 'E-Transfer Credit → Rental Revenue (4900)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'E-TRANSFER|INTERAC|E-TFR|E-TRF|SEND E-TFR|AUTODEPOSIT' },
                  { field: 'polarity',     operator: 'equals',    value: 'CREDIT' },
                  { field: 'account_type', operator: 'notEquals', value: 'creditcard' },
              ],
              action: { coa_code: '4900' }, logic: 'AND', priority: 9 },

            // REVENUE — Received cheques (View Cheque CHQ#xxxxx) on CHQ/SAV only = Rental Revenue
            { name: 'Received Cheque → Rental Revenue (4900)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'View Cheque|CHQ#\\d+' },
                  { field: 'polarity',     operator: 'equals',    value: 'CREDIT' },
                  { field: 'account_type', operator: 'notEquals', value: 'creditcard' },
              ],
              action: { coa_code: '4900' }, logic: 'AND', priority: 10 },

            // REVENUE — Condominium corporation fee deposits (management fee income)
            // Condominium Cor, Bellerose CCN, Bonavista Estat, Lockwood CCN = strata/condo management billings
            { name: 'Condo Corp Deposit → Management Fees (4004)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'Condominium Cor|Bellerose CCN|Bonavista Estat|Lockwood CCN' },
                  { field: 'polarity',     operator: 'equals',    value: 'CREDIT' },
                  { field: 'account_type', operator: 'notEquals', value: 'creditcard' },
              ],
              action: { coa_code: '4004' }, logic: 'AND', priority: 10 },

            // REVENUE — EVE LOUNGE recurring sales credits on CHQ account
            { name: 'EVE LOUNGE → Sales (4001)',
              conditions: [
                  { field: 'description',  operator: 'contains',  value: 'EVE LOUNGE' },
                  { field: 'polarity',     operator: 'equals',    value: 'CREDIT' },
                  { field: 'account_type', operator: 'notEquals', value: 'creditcard' },
              ],
              action: { coa_code: '4001' }, logic: 'AND', priority: 10 },

            // REVENUE — Square POS terminal credits (SQ *VENDOR) on CHQ account = sales
            { name: 'Square POS Credit → Sales (4001)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: '^SQ \\*|^\\d{4} SQ \\*' },
                  { field: 'polarity',     operator: 'equals',    value: 'CREDIT' },
                  { field: 'account_type', operator: 'notEquals', value: 'creditcard' },
              ],
              action: { coa_code: '4001' }, logic: 'AND', priority: 10 },

            // REVENUE — Government / grant deposits (GC xxxxx-DEPOSIT)
            { name: 'GC Government Deposit → Other Gains (4970)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'GC \\d+-DEPOSIT|GC\\d+-DEPOSIT' },
                  { field: 'polarity',     operator: 'equals',    value: 'CREDIT' },
              ],
              action: { coa_code: '4970' }, logic: 'AND', priority: 9 },

            // EXPENSE CREDITS / REFUNDS — Building supply vendors returning funds to CHQ
            { name: 'Building Supply Refund → Supplies (5336)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'KASA SUPPLY|AL MASA HOME|SHOP MAKERS' },
              ],
              action: { coa_code: '5336' }, logic: 'AND', priority: 8 },

            // EXPENSE CREDITS / REFUNDS — Contractors / maintenance vendors returning funds
            { name: 'Maintenance Vendor Refund → Repairs (7300)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'SHOEMAKER DRYWA|DIAMOND HARD|CUTTING EDGE CU|CALGARY LOCK' },
              ],
              action: { coa_code: '7300' }, logic: 'AND', priority: 8 },

            // GOVERNMENT FEES — Provincial registry / land title / corporate registry fees
            // Typically filed as professional fees since they accompany legal transactions
            { name: 'Provincial Registry → Professional Fees (8700)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'PROVINCIAL REGI|REGISTRY|ALBERTA ?REGISTRY' },
              ],
              action: { coa_code: '8700' }, logic: 'AND', priority: 8 },

            // INTER-ACCOUNT / FLAG — Scotia Visa credit on CHQ = credit card overpayment refund
            { name: 'Scotia VISA Credit on CHQ → CC Payment (9971)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'SCOTIA VISA' },
                  { field: 'polarity',     operator: 'equals',    value: 'CREDIT' },
                  { field: 'account_type', operator: 'notEquals', value: 'creditcard' },
              ],
              action: { coa_code: '9971' }, logic: 'AND', priority: 10 },

            // FLAG — ATM withdrawals appearing as credits (wrong polarity — parser artifact)
            // Mark as Unusual Item so accountant can delete or reverse
            { name: 'ATM W/D Credit (wrong polarity) → Unusual Item (9970)',
              conditions: [
                  { field: 'description',  operator: 'regex',     value: 'ATM W/D|ATM\\s*WITHDRAWAL' },
                  { field: 'polarity',     operator: 'equals',    value: 'CREDIT' },
              ],
              action: { coa_code: '9970' }, logic: 'AND', priority: 10 },

            // REPAIRS
            { name: 'HOME DEPOT → Repairs & Maintenance (7300)',
              conditions: [{ field: 'description', operator: 'regex', value: 'HOME DEPOT|PAYPAL.*HOMEDEPOT' }],
              action: { coa_code: '7300' }, logic: 'AND', priority: 8 },
            { name: 'CLEANING SERVICES → Repairs (7300)',
              conditions: [{ field: 'description', operator: 'regex', value: 'SHOTOVER CLEANING|MCKNIGHT CLEANI|BIG BEN.*CLEANI' }],
              action: { coa_code: '7300' }, logic: 'AND', priority: 8 },
            { name: 'BANFF PLUMBING → Repairs (7300)',
              conditions: [{ field: 'description', operator: 'regex', value: 'BANFF PLUMBING|BOW VALLEY.*PLUMBIN' }],
              action: { coa_code: '7300' }, logic: 'AND', priority: 9 },

            // VEHICLE / GAS — COA 7400 Fuel and Oil (CORRECTED: 8400 is Management Remuneration, NEVER fuel)
            { name: 'GAS STATIONS → Fuel & Oil (7400)',
              conditions: [{ field: 'description', operator: 'regex', value: 'ESSO|PETROCAN|PETRO-?CAN|SHELL|CO-?OP GAS|CHEVRON|CALG CO-?OP|FAS GAS|CARDLOCK|ULTRAMAR|HUSKY' }],
              action: { coa_code: '7400' }, logic: 'AND', priority: 9 },

            // TRAVEL — COA 9200 Travel & Accommodations (corrected from 8500 which is wrong in this COA)
            { name: 'AIRLINES → Travel (9200)',
              conditions: [{ field: 'description', operator: 'regex', value: 'WESTJET|PAC-WESTJET|WIFIONBOARD|AIR CANADA' }],
              action: { coa_code: '9200' }, logic: 'AND', priority: 9 },
            { name: 'HOTELS → Travel (9200)',
              conditions: [{ field: 'description', operator: 'regex', value: 'BANFF SPRINGS HOTEL|GEORGETOWN INN|MARRIOTT|HILTON' }],
              action: { coa_code: '9200' }, logic: 'AND', priority: 8 },

            // INSURANCE — COA 7600 (CORRECTED: 7100 is Equipment Repairs in this COA, not Insurance)
            { name: 'SECURITY NATIONAL → Insurance (7600)',
              conditions: [{ field: 'description', operator: 'contains', value: 'SECURITY NATIONAL INSUR' }],
              action: { coa_code: '7600' }, logic: 'AND', priority: 9 },
            // Employee Benefits (Blue Cross group plan) — COA 6900
            { name: 'BLUE CROSS → Employee Benefits (6900)',
              conditions: [{ field: 'description', operator: 'regex', value: 'IP PLAN.*BLUE CROSS|AB BLUE CROSS|ALBERTA BLUE CROSS' }],
              action: { coa_code: '6900' }, logic: 'AND', priority: 9 },

            // PROFESSIONAL — COA 8700 Professional Fees (CORRECTED: 6100 is Amortization — journal entry ONLY)
            { name: 'ALLISON ASSOCIATES → Professional Fees (8700)',
              conditions: [{ field: 'description', operator: 'contains', value: 'ALLISON ASSOCIATES' }],
              action: { coa_code: '8700' }, logic: 'AND', priority: 9 },
            { name: 'REAL ESTATE COUNCIL → Professional Dev (6900)',
              conditions: [{ field: 'description', operator: 'contains', value: 'REAL ESTATE COUNCIL' }],
              action: { coa_code: '6900' }, logic: 'AND', priority: 9 },
            // NOTE: REGISTRIES rule moved to 'Provincial Registry → Professional Fees (8700)' above
            // 6900 (Employee Benefits) was incorrect for registry fees; 8700 (Professional Fees) is correct

            // MEALS — COA 6415 Meals & Entertainment (corrected from 8100 which is wrong in this COA)
            { name: 'FAST FOOD → Meals & Entertainment (6415)',
              conditions: [{ field: 'description', operator: 'regex', value: 'SUBWAY|MCDONALD|PIZZAHUT|TIM HORTON|STARBUCKS|A&W|HARVEYS|WENDYS|BURGER KING' }],
              action: { coa_code: '6415' }, logic: 'AND', priority: 7 },

            // OFFICE
            { name: 'ULINE → Office Supplies (8600)',
              conditions: [{ field: 'description', operator: 'contains', value: 'ULINE' }],
              action: { coa_code: '8600' }, logic: 'AND', priority: 9 },
            { name: 'AMAZON BUSINESS PRIME → Software (6800)',
              conditions: [{ field: 'description', operator: 'contains', value: 'BUSINESS PRIME AMAZON' }],
              action: { coa_code: '6800' }, logic: 'AND', priority: 9 },

            // CC PAYMENTS FROM CHQ/SAV — "AMEX REGULAR", "VISA", "MC" Online Banking Payments
            // Debit from chequing/savings going to pay a credit card = inter-account transfer → 9971
            { name: 'AMEX Payment from CHQ → CC Payment (9971)',
              conditions: [
                  { field: 'description', operator: 'regex',     value: 'AMEX\\s*(REGULAR|GOLD|PLAT|PLATINUM|BUSINESS|CREDIT|CARD)?' },
                  { field: 'polarity',    operator: 'equals',    value: 'DEBIT' },
                  { field: 'account_type',operator: 'not_equals',value: 'creditcard' },
              ],
              action: { coa_code: '9971' }, logic: 'AND', priority: 10 },
            { name: 'VISA Payment from CHQ → CC Payment (9971)',
              conditions: [
                  { field: 'description', operator: 'regex',     value: 'VISA\\s*(PAYMENT|PAYABLE|CARD|CREDIT)?' },
                  { field: 'polarity',    operator: 'equals',    value: 'DEBIT' },
                  { field: 'account_type',operator: 'not_equals',value: 'creditcard' },
              ],
              action: { coa_code: '9971' }, logic: 'AND', priority: 10 },
            { name: 'MC/Mastercard Payment from CHQ → CC Payment (9971)',
              conditions: [
                  { field: 'description', operator: 'regex',     value: 'MASTERCARD|\\bM\\.?C\\.?\\s*(PAYMENT|PAYABLE)' },
                  { field: 'polarity',    operator: 'equals',    value: 'DEBIT' },
                  { field: 'account_type',operator: 'not_equals',value: 'creditcard' },
              ],
              action: { coa_code: '9971' }, logic: 'AND', priority: 10 },

            // PAYROLL / EMPLOYEE EXPENSES
            // PAY EMP-VENDOR = owner/director management remuneration → 8400 (NOT 6000 Advertising)
            // Flag for review so accountant can confirm owner vs employee split
            { name: 'PAY EMP-VENDOR → Management Remuneration (8400)',
              conditions: [
                  { field: 'description', operator: 'regex',  value: 'PAY\\s*EMP[-\\s]?VENDOR' },
                  { field: 'polarity',    operator: 'equals', value: 'DEBIT' },
              ],
              action: { coa_code: '8400' }, logic: 'AND', priority: 10 },
            // Employee payroll runs → 9800 Wages & Benefits
            { name: 'Direct Deposit Payroll → Wages (9800)',
              conditions: [
                  { field: 'description', operator: 'regex',  value: '\\bPAYROLL\\b|SALARY\\s*DEPOSIT|WAGES\\s*DEPOSIT' },
                  { field: 'polarity',    operator: 'equals', value: 'DEBIT' },
              ],
              action: { coa_code: '9800' }, logic: 'AND', priority: 9 },

            // BANK / SAVINGS INTEREST INCOME
            // "Deposit interest", "Interest credited" on SAV/CHQ = interest income → 4860
            // CORRECTED: 7100 is Equipment Repairs in this COA — deposit interest is REVENUE → 4860
            { name: 'Deposit Interest → Interest Income (4860)',
              conditions: [
                  { field: 'description', operator: 'regex',  value: 'DEPOSIT\\s*INTEREST|INTEREST\\s*CREDIT|INTEREST\\s*PAID|SAVINGS\\s*INTEREST|INT\\s*PAID' },
                  { field: 'polarity',    operator: 'equals', value: 'CREDIT' },
              ],
              action: { coa_code: '4860' }, logic: 'AND', priority: 10 },

            // PURCHASE INTEREST charged on CC balance = bank charge → 7700 (corrected from any expense)
            { name: 'Purchase Interest Charge → Bank Charges (7700)',
              conditions: [
                  { field: 'description', operator: 'regex',  value: 'PURCHASE\\s*INTEREST|INTEREST\\s*CHARG' },
                  { field: 'polarity',    operator: 'equals', value: 'CREDIT' },
                  { field: 'account_type',operator: 'equals', value: 'creditcard' },
              ],
              action: { coa_code: '7700' }, logic: 'AND', priority: 10 },

            // AMAZON PURCHASES — expense not revenue (CC charges)
            // Amazon.ca purchases on AMEX/VISA = supplies/office expense
            { name: 'Amazon Purchase → Office Supplies (8600)',
              conditions: [
                  { field: 'description', operator: 'regex',  value: 'AMAZON\\.CA|AMZN\\s*MKTP|AMZ\\*AMAZON' },
                  { field: 'polarity',    operator: 'equals', value: 'CREDIT' },
                  { field: 'account_type',operator: 'equals', value: 'creditcard' },
              ],
              action: { coa_code: '8600' }, logic: 'AND', priority: 9 },

            // NETFLIX — streaming subscription on CC = software/subscription expense
            { name: 'Netflix → Software Subscriptions (6800)',
              conditions: [
                  { field: 'description', operator: 'contains', value: 'NETFLIX' },
              ],
              action: { coa_code: '6800' }, logic: 'AND', priority: 9 },

            // GOOGLE — ads or workspace on CC = software/marketing expense
            { name: 'Google → Software/Advertising (6800)',
              conditions: [
                  { field: 'description', operator: 'regex', value: 'GOOGLE\\*|GOOGLE\\s*(ADS?|WORKSPACE|PLAY|CC)' },
              ],
              action: { coa_code: '6800' }, logic: 'AND', priority: 9 },
        ];

        return defaultRules;
    }
}

const ruleEngine = new RuleEngine();
window.RuleEngine = ruleEngine;
export default ruleEngine;
