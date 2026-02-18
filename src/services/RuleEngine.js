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
        this.rules          = this.loadRules();
        this.userCorrections = new UserCorrections();
        this.vendorMatcher  = new window.VendorMatcher();
        this.fuzzyMatcher   = null;
        this._fuzzyReady    = false;
        this.fusionEngine   = null;

        this.initializeFuzzyMatcher();

        if (this.rules.length === 0) {
            console.log('[RULE_ENGINE] No rules found, importing defaults...');
            this.importDefaultRules();
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

            this._fuzzyReady = true;
            const stats = this.fuzzyMatcher.getStats();
            console.log(`[RULE_ENGINE] FuzzyMatcher loaded: ${stats.totalVendors} vendors`);
        } catch (e) {
            console.warn('[RULE_ENGINE] FuzzyMatcher load failed, fusion will run without it:', e);
            this._initFusionEngine(); // still init fusion without fuzzy
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

        console.log('[RULE_ENGINE] SignalFusionEngine initialized');
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
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) {
            console.error('[RULE_ENGINE] Failed to load rules:', e);
        }
        return [];
    }

    saveRules(rules = this.rules) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rules));
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
            console.warn('[RULE_ENGINE] Fusion engine not ready yet');
            return null;
        }

        const activeRules = _rules || this.getEnabledRules();
        const result      = this.fusionEngine.categorize(transaction, activeRules, this);

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
     * Bulk categorize. Single localStorage save at the end.
     */
    bulkCategorize(transactions) {
        const results    = { categorized: 0, skipped: 0, flagged: 0, details: [] };
        let rulesDirty   = false;

        transactions.forEach(tx => {
            const match = this.applyRules(tx, null, true);

            if (!match?.coa_code) {
                results.skipped++;
                return;
            }

            if (match.needsReview) {
                results.flagged++;
            }

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

        if (condition.field.includes('.')) {
            fieldValue = condition.field.split('.').reduce((obj, key) => obj?.[key], transaction);
        }

        if (fieldValue === undefined || fieldValue === null) return false;

        const val = condition.value;

        switch (condition.operator) {
            case 'contains':
                return String(fieldValue).toLowerCase().includes(String(val).toLowerCase());
            case 'not_contains':
                return !String(fieldValue).toLowerCase().includes(String(val).toLowerCase());
            case 'equals':
                return fieldValue === val;
            case 'not_equals':
                return fieldValue !== val;
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

    // ─── Default Rules ────────────────────────────────────────────────────────

    importDefaultRules() {
        const defaultRules = [
            // TELCO
            { name: 'TELUS → Telephone & Internet (6400)',
              conditions: [{ field: 'description', operator: 'regex', value: 'TELUS[-\\s]?(MOBILITY|CUSTOMER|ACCOUNT)?' }],
              action: { coa_code: '6400' }, logic: 'AND', priority: 9 },
            { name: 'ROGERS / FIDO → Telephone & Internet (6400)',
              conditions: [{ field: 'description', operator: 'regex', value: 'ROGERS|FIDO WIRELESS' }],
              action: { coa_code: '6400' }, logic: 'AND', priority: 9 },
            { name: 'OPENPHONE → Telephone & Internet (6400)',
              conditions: [{ field: 'description', operator: 'contains', value: 'OPENPHONE' }],
              action: { coa_code: '6400' }, logic: 'AND', priority: 9 },

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

            // REVENUE — AIRBNB only fires on CREDIT, both conditions required
            { name: 'AIRBNB → Rental Revenue (4900)',
              conditions: [
                  { field: 'description', operator: 'contains', value: 'AIRBNB' },
                  { field: 'polarity',    operator: 'equals',   value: 'CREDIT' },
              ],
              action: { coa_code: '4900' }, logic: 'AND', priority: 10 },

            // REVENUE — E-Transfer Credits = Rental Revenue (Airbnb guests)
            { name: 'E-Transfer Credit → Rental Revenue (4900)',
              conditions: [
                  { field: 'description', operator: 'regex', value: 'E-TRANSFER|INTERAC|E-TRF|AUTODEPOSIT' },
                  { field: 'polarity',    operator: 'equals',   value: 'CREDIT' },
              ],
              action: { coa_code: '4900' }, logic: 'AND', priority: 9 },

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

            // VEHICLE / GAS
            { name: 'GAS STATIONS → Vehicle (8400)',
              conditions: [{ field: 'description', operator: 'regex', value: 'ESSO|PETROCAN|PETRO-?CAN|SHELL|CO-?OP GAS|CHEVRON|CALG CO-?OP' }],
              action: { coa_code: '8400' }, logic: 'AND', priority: 9 },

            // TRAVEL (corrected from 8100)
            { name: 'AIRLINES → Travel (8500)',
              conditions: [{ field: 'description', operator: 'regex', value: 'WESTJET|PAC-WESTJET|WIFIONBOARD|AIR CANADA' }],
              action: { coa_code: '8500' }, logic: 'AND', priority: 9 },
            { name: 'HOTELS → Travel (8500)',
              conditions: [{ field: 'description', operator: 'regex', value: 'BANFF SPRINGS HOTEL|GEORGETOWN INN|MARRIOTT|HILTON' }],
              action: { coa_code: '8500' }, logic: 'AND', priority: 8 },

            // INSURANCE
            { name: 'SECURITY NATIONAL → Insurance (7100)',
              conditions: [{ field: 'description', operator: 'contains', value: 'SECURITY NATIONAL INSUR' }],
              action: { coa_code: '7100' }, logic: 'AND', priority: 9 },
            { name: 'BLUE CROSS → Benefits (6500)',
              conditions: [{ field: 'description', operator: 'regex', value: 'IP PLAN.*BLUE CROSS' }],
              action: { coa_code: '6500' }, logic: 'AND', priority: 9 },

            // PROFESSIONAL
            { name: 'ALLISON ASSOCIATES → Professional Fees (6100)',
              conditions: [{ field: 'description', operator: 'contains', value: 'ALLISON ASSOCIATES' }],
              action: { coa_code: '6100' }, logic: 'AND', priority: 9 },
            { name: 'REAL ESTATE COUNCIL → Professional Dev (6900)',
              conditions: [{ field: 'description', operator: 'contains', value: 'REAL ESTATE COUNCIL' }],
              action: { coa_code: '6900' }, logic: 'AND', priority: 9 },
            { name: 'REGISTRIES → Licenses (6900)',
              conditions: [{ field: 'description', operator: 'regex', value: 'REGISTRY|ALBERTA ?REGISTRY' }],
              action: { coa_code: '6900' }, logic: 'AND', priority: 8 },

            // MEALS
            { name: 'FAST FOOD → Meals & Entertainment (8100)',
              conditions: [{ field: 'description', operator: 'regex', value: 'SUBWAY|MCDONALD|PIZZAHUT|TIM HORTON|STARBUCKS' }],
              action: { coa_code: '8100' }, logic: 'AND', priority: 7 },

            // OFFICE
            { name: 'ULINE → Office Supplies (8600)',
              conditions: [{ field: 'description', operator: 'contains', value: 'ULINE' }],
              action: { coa_code: '8600' }, logic: 'AND', priority: 9 },
            { name: 'AMAZON BUSINESS PRIME → Software (6800)',
              conditions: [{ field: 'description', operator: 'contains', value: 'BUSINESS PRIME AMAZON' }],
              action: { coa_code: '6800' }, logic: 'AND', priority: 9 },
        ];

        defaultRules.forEach(r => this.createRule(r.name, r.conditions, r.action, r.logic, r.priority));
        console.log(`[RULE_ENGINE] Imported ${defaultRules.length} default rules`);
    }
}

const ruleEngine = new RuleEngine();
window.RuleEngine = ruleEngine;
export default ruleEngine;
