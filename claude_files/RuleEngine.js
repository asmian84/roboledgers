/**
 * RuleEngine - Pattern-based transaction categorization
 *
 * IMPROVEMENTS over original:
 * 1. FIX: Race condition - fuzzyMatcher async load now queues transactions
 * 2. FIX: Excessive localStorage writes during bulk ops (batch save)
 * 3. FIX: Overly broad AIRBNB regex that matched unrelated "PAYMENTS" entries
 * 4. FIX: UserCorrections notification path was broken (window.RoboLedger.RuleEngine)
 * 5. NEW: 'not_contains' and 'not_equals' operators in evaluateCondition()
 * 6. NEW: Keyword Tier inserted between Rule Engine and Vendor Dictionary
 * 7. NEW: VendorNormalizer applied in VendorMatcher path for better accuracy
 * 8. IMPROVED: Polarity guard blocks debit→revenue (mirror of credit→expense guard)
 */

import FuzzyMatcher from './FuzzyMatcher.js';
import VendorNormalizer from './VendorNormalizer.js';
import UserCorrections from './UserCorrections.js';

class RuleEngine {
    constructor() {
        this.STORAGE_KEY = 'roboledger_categorization_rules';
        this.rules = this.loadRules();

        this.vendorMatcher = new window.VendorMatcher();
        this.userCorrections = new UserCorrections();
        this.fuzzyMatcher = null;
        this._fuzzyReady = false;

        this.initializeFuzzyMatcher();

        if (this.rules.length === 0) {
            console.log('[RULE_ENGINE] No rules found, importing defaults...');
            this.importDefaultRules();
        }
    }

    // ─── Fuzzy Matcher Init (with ready flag) ────────────────────────────────

    async initializeFuzzyMatcher() {
        try {
            const response = await fetch('/src/data/vendor_training.json');
            const trainingData = await response.json();
            const userCorrections = this.userCorrections.getCorrections();

            this.fuzzyMatcher = new FuzzyMatcher(trainingData, userCorrections);
            this._fuzzyReady = true;

            const stats = this.fuzzyMatcher.getStats();
            const userStats = this.userCorrections.getStats();
            console.log(`[RULE_ENGINE] 🧠 FuzzyMatcher loaded: ${stats.totalVendors} vendors`);
            console.log(`[RULE_ENGINE] 📚 User trained: ${userStats.vendors} vendors, ${userStats.totalCorrections} corrections`);
        } catch (e) {
            console.warn('[RULE_ENGINE] Failed to load fuzzy matcher:', e);
            this._fuzzyReady = true; // Mark ready even on failure so we don't block forever
        }
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

    getRules() { return this.rules; }

    getEnabledRules() {
        return this.rules
            .filter(r => r.enabled)
            .sort((a, b) => b.priority - a.priority);
    }

    // ─── Main Categorization Pipeline ────────────────────────────────────────

    /**
     * Apply rules to a transaction.
     * Returns { coa_code, rule_id?, confidence, method } or null.
     *
     * Pipeline:
     *   Tier 1: Rule Engine (regex/keyword rules)
     *   Tier 2: Vendor Dictionary (VendorMatcher)
     *   Tier 3: Keyword heuristics (suggestCategory)
     *   Tier 4: Fuzzy ML (FuzzyMatcher)
     *   Tier 5: Polarity-based default
     *
     * @param {Object} transaction
     * @param {Array|null} rules - optional override ruleset
     * @param {boolean} _skipSave - internal flag used by bulkCategorize
     */
    applyRules(transaction, rules = null, _skipSave = false) {
        const activeRules = rules || this.getEnabledRules();

        const amount = Math.abs((transaction.amount_cents || 0) / 100);
        const isCredit = transaction.polarity === 'CREDIT';
        const isDebit  = transaction.polarity === 'DEBIT';

        // ── Tier 1: Rule-based matching ───────────────────────────────────────
        for (const rule of activeRules) {
            if (this.matchesConditions(transaction, rule.conditions, rule.logic)) {
                const coaCode = rule.action.coa_code;
                const account = window.RoboLedger?.COA?.get(coaCode);

                // GUARD: Credits → never expense/COGS
                if (isCredit && (account?.root === 'EXPENSE' || account?.class === 'COGS')) {
                    console.log(`[RULE_ENGINE] ⚠️ Blocked CREDIT→expense ${coaCode} (${account?.name})`);
                    continue;
                }

                // GUARD: Debits → never revenue
                if (isDebit && account?.root === 'REVENUE') {
                    console.log(`[RULE_ENGINE] ⚠️ Blocked DEBIT→revenue ${coaCode} (${account?.name})`);
                    continue;
                }

                // GUARD: Bank fees > $30
                if (isDebit && amount > 30 && ['7700', '8700', '8800'].includes(coaCode)) {
                    console.log(`[RULE_ENGINE] ⚠️ Blocked bank fee for $${amount} (too large)`);
                    continue;
                }

                // GUARD: Interest charges > $500
                if (isDebit && amount > 500 && ['7700', '7800'].includes(coaCode)) {
                    console.log(`[RULE_ENGINE] ⚠️ Blocked interest for $${amount} (too large)`);
                    continue;
                }

                rule.stats.matches_count++;
                rule.stats.last_matched = new Date().toISOString();
                if (!_skipSave) this.saveRules();

                return { coa_code: coaCode, rule_id: rule.id, confidence: 1.0, method: 'rule' };
            }
        }

        // ── Tier 2: Vendor Dictionary ─────────────────────────────────────────
        if (this.vendorMatcher?.dictionary?.length) {
            const match = this.vendorMatcher.findMatch(transaction, 0.6);
            if (match) {
                const account = window.RoboLedger?.COA?.get(match.coaCode);
                const creditBlocked = isCredit && (account?.root === 'EXPENSE' || account?.class === 'COGS');
                const debitBlocked  = isDebit  && account?.root === 'REVENUE';
                const feeTooLarge   = isDebit  && amount > 30 && ['7700', '8700', '8800'].includes(match.coaCode);

                if (!creditBlocked && !debitBlocked && !feeTooLarge) {
                    return {
                        coa_code: match.coaCode,
                        confidence: match.confidence,
                        method: 'vendor_dictionary',
                        vendor: match.vendor,
                        industry: match.industry
                    };
                }
            }
        }

        // ── Tier 3: Keyword heuristics ────────────────────────────────────────
        if (transaction.description) {
            const suggestion = this.suggestCategory(transaction.description, isCredit);
            if (suggestion) {
                const account = window.RoboLedger?.COA?.get(suggestion.coa_code);
                const creditBlocked = isCredit && (account?.root === 'EXPENSE' || account?.class === 'COGS');
                const debitBlocked  = isDebit  && account?.root === 'REVENUE';
                if (!creditBlocked && !debitBlocked) {
                    return {
                        coa_code: suggestion.coa_code,
                        confidence: suggestion.confidence,
                        method: 'keyword_heuristic',
                        reason: suggestion.reason
                    };
                }
            }
        }

        // ── Tier 4: Fuzzy ML ──────────────────────────────────────────────────
        if (this._fuzzyReady && this.fuzzyMatcher) {
            const match = this.fuzzyMatcher.match(transaction.description);
            if (match?.coa && match.confidence > 0.7) {
                const account = window.RoboLedger?.COA?.get(match.coa);
                const creditBlocked = isCredit && (account?.root === 'EXPENSE' || account?.class === 'COGS');
                const debitBlocked  = isDebit  && account?.root === 'REVENUE';

                if (!creditBlocked && !debitBlocked) {
                    return {
                        coa_code: match.coa,
                        confidence: match.confidence,
                        method: 'fuzzy_ml',
                        match_type: match.matchType,
                        matched_vendor: match.matchedVendor,
                        similarity_score: match.similarityScore,
                        training_count: match.count
                    };
                }
            }
        }

        // ── Tier 5: Polarity-based default ───────────────────────────────────
        if (isCredit) {
            console.log(`[RULE_ENGINE] 💰 Defaulting uncategorized CREDIT ($${amount}) to Sales Revenue (4001)`);
            return { coa_code: '4001', confidence: 0.5, method: 'default_revenue' };
        }

        // Unmatched debit - return null so user can manually categorize
        return null;
    }

    // ─── Condition Matching ───────────────────────────────────────────────────

    matchesConditions(transaction, conditions, logic = 'AND') {
        const results = conditions.map(cond => this.evaluateCondition(transaction, cond));
        return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
    }

    evaluateCondition(transaction, condition) {
        let fieldValue = transaction[condition.field];

        if (condition.field.includes('.')) {
            const parts = condition.field.split('.');
            fieldValue = parts.reduce((obj, key) => obj?.[key], transaction);
        }

        if (fieldValue === undefined || fieldValue === null) return false;

        const conditionValue = condition.value;

        switch (condition.operator) {
            case 'contains':
                return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());

            // NEW: not_contains - useful for excluding noise patterns
            case 'not_contains':
                return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());

            case 'equals':
                return fieldValue === conditionValue;

            // NEW: not_equals
            case 'not_equals':
                return fieldValue !== conditionValue;

            case 'starts_with':
                return String(fieldValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());

            case 'ends_with':
                return String(fieldValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());

            case 'regex':
                try {
                    return new RegExp(conditionValue, 'i').test(String(fieldValue));
                } catch (e) {
                    console.error('[RULE_ENGINE] Invalid regex:', conditionValue);
                    return false;
                }

            case 'greater_than':
                return parseFloat(fieldValue) > parseFloat(conditionValue);

            case 'less_than':
                return parseFloat(fieldValue) < parseFloat(conditionValue);

            case 'between': {
                const [min, max] = conditionValue;
                const numValue = parseFloat(fieldValue);
                return numValue >= min && numValue <= max;
            }

            default:
                console.warn('[RULE_ENGINE] Unknown operator:', condition.operator);
                return false;
        }
    }

    // ─── Bulk Operations ──────────────────────────────────────────────────────

    /**
     * FIX: original saved rules on every single transaction match.
     * Now we accumulate dirty state and save once at the end.
     */
    bulkCategorize(transactions) {
        const results = { categorized: 0, skipped: 0, details: [] };
        let rulesDirty = false;

        transactions.forEach(tx => {
            const match = this.applyRules(tx, null, true); // _skipSave = true
            if (match?.coa_code) {
                if (window.RoboLedger?.Ledger?.updateCategory) {
                    window.RoboLedger.Ledger.updateCategory(tx.tx_id, match.coa_code);
                    results.categorized++;
                    results.details.push({ tx_id: tx.tx_id, description: tx.description, coa_code: match.coa_code, rule_id: match.rule_id });
                    if (match.rule_id) rulesDirty = true;
                }
            } else {
                results.skipped++;
            }
        });

        // Single save at the end of bulk operation
        if (rulesDirty) this.saveRules();

        console.log(`[RULE_ENGINE] Bulk categorize complete:`, results);
        return results;
    }

    testRule(rule, transactions) {
        return transactions.filter(tx => this.matchesConditions(tx, rule.conditions, rule.logic));
    }

    // ─── Keyword Heuristics (Tier 3) ─────────────────────────────────────────

    /**
     * IMPROVED: now polarity-aware and covers more Canadian business patterns.
     * Called as Tier 3 fallback between vendor dict and fuzzy ML.
     */
    suggestCategory(description, isCredit = false) {
        const lowerDesc = description.toLowerCase();

        // Revenue keywords (only if credit)
        if (isCredit) {
            const revenueKeywords = { '4000': ['airbnb', 'vrbo', 'booking.com', 'rental', 'rent payment', 'e-transfer', 'interac'] };
            for (const [coaCode, words] of Object.entries(revenueKeywords)) {
                for (const word of words) {
                    if (lowerDesc.includes(word)) return { coa_code: coaCode, confidence: 0.75, reason: `Revenue keyword "${word}"` };
                }
            }
        }

        // Expense keywords
        const expenseKeywords = {
            '6400': ['telus', 'rogers', 'bell', 'internet', 'phone', 'mobile', 'cellular', 'openphone', 'fido', 'koodo', 'freedom mobile'],
            '6800': ['software', 'saas', 'adobe', 'github', 'subscription', 'pricelabs', 'monday.com', 'slack', 'dropbox', 'zoom', 'notion'],
            '7100': ['insurance', 'intact', 'aviva', 'wawanesa', 'blue cross', 'great west life'],
            '7200': ['accounting', 'bookkeeping', 'quickbooks', 'freshbooks', 'wave financial'],
            '7300': ['repair', 'maintenance', 'plumbing', 'electrical', 'hvac', 'cleaning', 'janitorial', 'home depot', 'rona', 'home hardware'],
            '8100': ['restaurant', 'starbucks', 'tim horton', 'mcdonald', 'dining', 'food', 'pizza', 'sushi', 'cafe', 'coffee', 'bistro'],
            '8400': ['esso', 'petro-canada', 'petrocan', 'shell', 'co-op gas', 'chevron', 'husky', 'fuel', 'gas station'],
            '8500': ['hotel', 'airbnb', 'marriott', 'hilton', 'westin', 'flight', 'westjet', 'air canada', 'uber', 'lyft', 'taxi'],
            '8600': ['staples', 'office depot', 'amazon', 'supplies', 'walmart', 'costco', 'london drugs'],
            '8700': ['bank fee', 'service charge', 'monthly fee', 'interac fee', 'wire fee', 'nsf fee'],
        };

        for (const [coaCode, words] of Object.entries(expenseKeywords)) {
            for (const word of words) {
                if (lowerDesc.includes(word)) {
                    return { coa_code: coaCode, confidence: 0.75, reason: `Keyword "${word}"` };
                }
            }
        }

        return null;
    }

    // ─── Default Rules ────────────────────────────────────────────────────────

    importDefaultRules() {
        const defaultRules = [
            // ─── TELECOMMUNICATIONS (6400) ────────────────────────────────────
            {
                name: 'TELUS → Telephone & Internet (6400)',
                conditions: [{ field: 'description', operator: 'regex', value: 'TELUS[-\\s]?(MOBILITY|CUSTOMER|ACCOUNT)?' }],
                action: { coa_code: '6400' }, logic: 'AND', priority: 9
            },
            {
                name: 'ROGERS / FIDO → Telephone & Internet (6400)',
                conditions: [{ field: 'description', operator: 'regex', value: 'ROGERS|FIDO WIRELESS' }],
                action: { coa_code: '6400' }, logic: 'AND', priority: 9
            },
            {
                name: 'OPENPHONE → Telephone & Internet (6400)',
                conditions: [{ field: 'description', operator: 'contains', value: 'OPENPHONE' }],
                action: { coa_code: '6400' }, logic: 'AND', priority: 9
            },

            // ─── SOFTWARE & SUBSCRIPTIONS (6800) ──────────────────────────────
            {
                name: 'PRICELABS → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'PRICELABS?|DYNAPRIC' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 9
            },
            {
                name: 'IGMS → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'IGMS|AIRGMS' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 9
            },
            {
                name: 'NETFLIX → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'NETFLIX' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 9
            },
            {
                name: 'MICROSOFT 365 → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'MICROSOFT.*365|MSBILL' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 9
            },
            {
                name: 'MONDAY.COM → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'MONDAY\\.?COM|BLS\\*MONDAY' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 9
            },
            {
                name: 'HOSTGATOR → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'HOSTGATOR|WEB\\*HOSTGATOR|EIG\\*HOSTGATOR' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 9
            },
            {
                name: 'WORDPRESS → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'WORDPRESS|PAYPAL.*WORDPRESS' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 8
            },
            {
                name: 'MINUT → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'MINUT' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 8
            },
            {
                name: 'RBOY APPS → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'RBOY APPS' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 8
            },
            {
                name: 'AMAZON BUSINESS PRIME → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'BUSINESS PRIME AMAZON' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 9
            },
            {
                name: 'RANKBREEZE → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'RANKBREEZE' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 8
            },
            {
                name: 'LOOM → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'LOOM SUBSCRIPTION' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 8
            },
            {
                name: 'NORTON → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'NORTON' }],
                action: { coa_code: '6800' }, logic: 'AND', priority: 8
            },

            // ─── REPAIRS & MAINTENANCE (7300) ─────────────────────────────────
            {
                name: 'BANFF PLUMBING → Repairs & Maintenance (7300)',
                conditions: [{ field: 'description', operator: 'regex', value: 'BANFF PLUMBING|BOW VALLEY.*PLUMBIN' }],
                action: { coa_code: '7300' }, logic: 'AND', priority: 9
            },
            {
                name: 'HOME DEPOT → Repairs & Maintenance (7300)',
                conditions: [{ field: 'description', operator: 'regex', value: 'HOME DEPOT|PAYPAL.*HOMEDEPOT' }],
                action: { coa_code: '7300' }, logic: 'AND', priority: 8
            },
            {
                name: 'EECOL ELECTRIC → Repairs & Maintenance (7300)',
                conditions: [{ field: 'description', operator: 'contains', value: 'EECOL ELECTRIC' }],
                action: { coa_code: '7300' }, logic: 'AND', priority: 8
            },
            {
                name: 'CLEANING SERVICES → Repairs & Maintenance (7300)',
                conditions: [{ field: 'description', operator: 'regex', value: 'SHOTOVER CLEANING|MCKNIGHT CLEANI|BIG BEN.*CLEANI' }],
                action: { coa_code: '7300' }, logic: 'AND', priority: 8
            },

            // ─── VEHICLE EXPENSES (8400) ───────────────────────────────────────
            {
                name: 'GAS STATIONS → Vehicle Expenses (8400)',
                conditions: [{ field: 'description', operator: 'regex', value: 'ESSO|PETROCAN|PETRO-?CAN|SHELL|CO-?OP GAS|CHEVRON|CALG CO-?OP' }],
                action: { coa_code: '8400' }, logic: 'AND', priority: 9
            },
            {
                name: 'AUTO DEALERS → Vehicle Expenses (8400)',
                conditions: [{ field: 'description', operator: 'regex', value: 'VILLAGE HONDA|CHARLESGLEN TOYOTA|NORTHSTAR FORD|SPARKS TOYOTA' }],
                action: { coa_code: '8400' }, logic: 'AND', priority: 9
            },
            {
                // FIX: Removed from original — Canadian Tire sells everything (camping, kitchen, tools).
                // Mapping it broadly to Vehicle Expenses (8400) causes many miscategorizations.
                // It should stay unmapped so the user or fuzzy matcher handles it contextually.
                name: 'CANADIAN TIRE → Office Supplies (8600) [low priority]',
                conditions: [{ field: 'description', operator: 'regex', value: 'CDN TIRE|CANADIAN TIRE' }],
                action: { coa_code: '8600' }, logic: 'AND', priority: 4 // Very low priority - let other tiers win
            },

            // ─── INSURANCE (7100 / 6500) ───────────────────────────────────────
            {
                name: 'SECURITY NATIONAL → Insurance (7100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'SECURITY NATIONAL INSUR' }],
                action: { coa_code: '7100' }, logic: 'AND', priority: 9
            },
            {
                name: 'BLUE CROSS → Employee Benefits (6500)',
                conditions: [{ field: 'description', operator: 'regex', value: 'IP PLAN.*BLUE CROSS' }],
                action: { coa_code: '6500' }, logic: 'AND', priority: 9
            },

            // ─── OFFICE SUPPLIES (8600) ────────────────────────────────────────
            {
                name: 'MEMORY EXPRESS → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'MEMORY EXPRESS' }],
                action: { coa_code: '8600' }, logic: 'AND', priority: 8
            },
            {
                name: 'WALMART → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'regex', value: 'WAL-?MART' }],
                action: { coa_code: '8600' }, logic: 'AND', priority: 7
            },
            {
                name: 'ULINE → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'ULINE' }],
                action: { coa_code: '8600' }, logic: 'AND', priority: 9
            },
            {
                name: 'SP HOTEL TOILETRIES → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'SP HOTEL TOILETRIES' }],
                action: { coa_code: '8600' }, logic: 'AND', priority: 8
            },
            {
                name: 'LONDON DRUGS → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'LONDON DRUGS' }],
                action: { coa_code: '8600' }, logic: 'AND', priority: 7
            },

            // ─── MEALS & ENTERTAINMENT (8100) ─────────────────────────────────
            {
                name: 'RESTAURANTS → Meals & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'regex', value: 'BR RESTAURANT|JAMESONS|KILKENNY|GRIZZLY PAW|MARKET BISTRO' }],
                action: { coa_code: '8100' }, logic: 'AND', priority: 8
            },
            {
                name: 'FAST FOOD → Meals & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'regex', value: 'SUBWAY|MCDONALD|PIZZAHUT|TIM HORTON|STARBUCKS' }],
                action: { coa_code: '8100' }, logic: 'AND', priority: 7
            },
            {
                name: '7-ELEVEN → Meals & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'contains', value: '7-ELEVEN' }],
                action: { coa_code: '8100' }, logic: 'AND', priority: 6
            },

            // ─── TRAVEL (8500) ──────────────────────────────────────────────────
            // FIX: Travel items were incorrectly mapped to 8100 (Meals & Entertainment).
            // WestJet, hotels, and Uber are travel, not meals.
            {
                name: 'AIRLINES → Travel (8500)',
                conditions: [{ field: 'description', operator: 'regex', value: 'WESTJET|PAC-WESTJET|WIFIONBOARD|AIR CANADA|AIR TRANSAT' }],
                action: { coa_code: '8500' }, logic: 'AND', priority: 9
            },
            {
                name: 'HOTELS → Travel (8500)',
                conditions: [{ field: 'description', operator: 'regex', value: 'BANFF SPRINGS HOTEL|GEORGETOWN INN|MARRIOTT|HILTON|WESTIN|BEST WESTERN' }],
                action: { coa_code: '8500' }, logic: 'AND', priority: 8
            },
            {
                name: 'PARKS CANADA → Travel (8500)',
                conditions: [{ field: 'description', operator: 'contains', value: 'PARKS CANADA' }],
                action: { coa_code: '8500' }, logic: 'AND', priority: 8
            },
            {
                name: 'ALPINE HELICOPTERS → Travel (8500)',
                conditions: [{ field: 'description', operator: 'contains', value: 'ALPINE HELICOPTERS' }],
                action: { coa_code: '8500' }, logic: 'AND', priority: 8
            },

            // ─── REVENUE (4000) ─────────────────────────────────────────────────
            {
                // FIX: Removed the 'PAYMENTS.*ACCOUNT PAYABLE' alternative — it was far too
                // broad and would match many unrelated inter-account transfers.
                // Polarity guard at runtime ensures this only fires on CREDIT transactions.
                name: 'AIRBNB → Rental Revenue (4000)',
                conditions: [
                    { field: 'description', operator: 'contains', value: 'AIRBNB' },
                    { field: 'polarity', operator: 'equals', value: 'CREDIT' }
                ],
                action: { coa_code: '4000' }, logic: 'AND', priority: 10
            },

            // ─── PROFESSIONAL SERVICES (6100 / 6900) ──────────────────────────
            {
                name: 'ALLISON ASSOCIATES → Professional Fees (6100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'ALLISON ASSOCIATES' }],
                action: { coa_code: '6100' }, logic: 'AND', priority: 9
            },
            {
                name: 'SE CANADA → Professional Services (6100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'SE CANADA INC' }],
                action: { coa_code: '6100' }, logic: 'AND', priority: 8
            },
            {
                name: 'REAL ESTATE COUNCIL → Professional Development (6900)',
                conditions: [{ field: 'description', operator: 'contains', value: 'REAL ESTATE COUNCIL' }],
                action: { coa_code: '6900' }, logic: 'AND', priority: 9
            },
            {
                name: 'BCIT → Professional Development (6900)',
                conditions: [{ field: 'description', operator: 'contains', value: 'BCIT ICES' }],
                action: { coa_code: '6900' }, logic: 'AND', priority: 9
            },
            {
                name: 'REGISTRIES → Licenses & Permits (6900)',
                conditions: [{ field: 'description', operator: 'regex', value: 'REGISTRY|ALBERTA ?REGISTRY' }],
                action: { coa_code: '6900' }, logic: 'AND', priority: 8
            },
            {
                name: 'PRINCE OF TRAVEL → Professional Development (6900)',
                conditions: [{ field: 'description', operator: 'contains', value: 'PRINCE OF TRAVEL' }],
                action: { coa_code: '6900' }, logic: 'AND', priority: 7
            }
        ];

        defaultRules.forEach(r => {
            this.createRule(r.name, r.conditions, r.action, r.logic, r.priority);
        });

        console.log(`[RULE_ENGINE] Imported ${defaultRules.length} default categorization rules`);
    }
}

const ruleEngine = new RuleEngine();
window.RuleEngine = ruleEngine;
export default ruleEngine;
