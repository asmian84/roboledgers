/**
 * RuleEngine - Pattern-based transaction categorization
 * 
 * Features:
 * - Condition matching (contains, equals, regex, numerical)
 * - Multiple conditions with AND/OR logic
 * - Priority-based rule application
 * - Auto-categorization and bulk operations
 * - ML-based fuzzy matching fallback
 */

import FuzzyMatcher from './FuzzyMatcher.js';
import VendorNormalizer from './VendorNormalizer.js';
import UserCorrections from './UserCorrections.js';

class RuleEngine {
    constructor() {
        this.STORAGE_KEY = 'roboledger_categorization_rules';
        this.rules = this.loadRules();

        // Initialize vendor matcher (existing)
        this.vendorMatcher = new window.VendorMatcher();

        // Initialize user corrections
        this.userCorrections = new UserCorrections();

        // Initialize fuzzy matcher with training data + user corrections
        this.initializeFuzzyMatcher();

        // Auto-import default rules if none exist
        if (this.rules.length === 0) {
            console.log('[RULE_ENGINE] No rules found, importing defaults...');
            this.importDefaultRules();
        }
    }

    /**
     * Initialize fuzzy matcher with training data and user corrections
     */
    async initializeFuzzyMatcher() {
        try {
            const response = await fetch('/src/data/vendor_training.json');
            const trainingData = await response.json();

            // Load user corrections
            const userCorrections = this.userCorrections.getCorrections();

            // Initialize with both datasets
            this.fuzzyMatcher = new FuzzyMatcher(trainingData, userCorrections);

            const stats = this.fuzzyMatcher.getStats();
            const userStats = this.userCorrections.getStats();
            console.log(`[RULE_ENGINE] 🧠 FuzzyMatcher loaded: ${stats.totalVendors} vendors`);
            console.log(`[RULE_ENGINE] 📚 User trained: ${userStats.vendors} vendors, ${userStats.totalCorrections} corrections`);
        } catch (e) {
            console.warn('[RULE_ENGINE] Failed to load fuzzy matcher:', e);
            this.fuzzyMatcher = null;
        }
    }

    /**
     * Load rules from storage
     */
    loadRules() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('[RULE_ENGINE] Failed to load rules:', e);
        }
        return [];
    }

    /**
     * Save rules to storage
     */
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

    /**
     * Create new rule
     */
    createRule(name, conditions, action, logic = 'AND', priority = 5, enabled = true) {
        const newRule = {
            id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            enabled,
            priority,
            conditions,
            logic,
            action,
            stats: {
                matches_count: 0,
                last_matched: null
            },
            created_at: new Date().toISOString()
        };

        this.rules.push(newRule);
        this.saveRules();
        // console.log(`[RULE_ENGINE] Created rule: ${name}`);
        return newRule;
    }

    /**
     * Update existing rule
     */
    updateRule(id, updates) {
        const index = this.rules.findIndex(r => r.id === id);
        if (index === -1) return null;

        this.rules[index] = {
            ...this.rules[index],
            ...updates
        };

        this.saveRules();
        console.log(`[RULE_ENGINE] Updated rule: ${id}`);
        return this.rules[index];
    }

    /**
     * Delete rule
     */
    deleteRule(id) {
        const index = this.rules.findIndex(r => r.id === id);
        if (index === -1) return false;

        this.rules.splice(index, 1);
        this.saveRules();
        console.log(`[RULE_ENGINE] Deleted rule: ${id}`);
        return true;
    }

    /**
     * Get all rules
     */
    getRules() {
        return this.rules;
    }

    /**
     * Get enabled rules sorted by priority
     */
    getEnabledRules() {
        return this.rules
            .filter(r => r.enabled)
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Apply rules to a transaction
     * Returns { coa_code, rule_id, confidence, method } or null
     */
    applyRules(transaction, rules = null) {
        const activeRules = rules || this.getEnabledRules();

        // Try rule-based matching first
        for (const rule of activeRules) {
            if (this.matchesConditions(transaction, rule.conditions, rule.logic)) {
                // Update stats
                rule.stats.matches_count++;
                rule.stats.last_matched = new Date().toISOString();
                this.saveRules();

                // console.log(`[RULE_ENGINE] Matched rule "${rule.name}" for transaction:`, transaction.description);

                return {
                    coa_code: rule.action.coa_code,
                    rule_id: rule.id,
                    confidence: 1.0,
                    method: 'rule'
                };
            }
        }

        // Fallback to vendor dictionary matching
        if (this.vendorMatcher && this.vendorMatcher.dictionary) {
            // Pass full transaction for context-aware matching
            const match = this.vendorMatcher.findMatch(transaction, 0.6);
            if (match) {
                // console.log(`[RULE_ENGINE] Vendor match for "${transaction.description}":`, match);
                return {
                    coa_code: match.coaCode,
                    confidence: match.confidence,
                    method: 'vendor_dictionary',
                    vendor: match.vendor,
                    industry: match.industry,
                    appliedRule: match.appliedRule // Track which smart rule was applied
                };
            }
        }

        // Fallback to ML-based fuzzy matching
        if (this.fuzzyMatcher) {
            const match = this.fuzzyMatcher.match(transaction.description);
            if (match && match.coa && match.confidence > 0.7) {
                // console.log(`[RULE_ENGINE] Fuzzy match for "${transaction.description}":`, match);
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

        return null;
    }


    /**
     * Check if transaction matches all/any conditions based on logic
     */
    matchesConditions(transaction, conditions, logic = 'AND') {
        const results = conditions.map(cond =>
            this.evaluateCondition(transaction, cond)
        );

        return logic === 'AND'
            ? results.every(Boolean)
            : results.some(Boolean);
    }

    /**
     * Evaluate single condition
     */
    evaluateCondition(transaction, condition) {
        let fieldValue = transaction[condition.field];

        // Handle nested fields (e.g., "audit.rawText")
        if (condition.field.includes('.')) {
            const parts = condition.field.split('.');
            fieldValue = parts.reduce((obj, key) => obj?.[key], transaction);
        }

        if (fieldValue === undefined || fieldValue === null) {
            return false;
        }

        const conditionValue = condition.value;

        switch (condition.operator) {
            case 'contains':
                return String(fieldValue)
                    .toLowerCase()
                    .includes(String(conditionValue).toLowerCase());

            case 'equals':
                return fieldValue === conditionValue;

            case 'starts_with':
                return String(fieldValue)
                    .toLowerCase()
                    .startsWith(String(conditionValue).toLowerCase());

            case 'ends_with':
                return String(fieldValue)
                    .toLowerCase()
                    .endsWith(String(conditionValue).toLowerCase());

            case 'regex':
                try {
                    const regex = new RegExp(conditionValue, 'i');
                    return regex.test(String(fieldValue));
                } catch (e) {
                    console.error('[RULE_ENGINE] Invalid regex:', conditionValue);
                    return false;
                }

            case 'greater_than':
                return parseFloat(fieldValue) > parseFloat(conditionValue);

            case 'less_than':
                return parseFloat(fieldValue) < parseFloat(conditionValue);

            case 'between':
                const [min, max] = conditionValue;
                const numValue = parseFloat(fieldValue);
                return numValue >= min && numValue <= max;

            default:
                console.warn('[RULE_ENGINE] Unknown operator:', condition.operator);
                return false;
        }
    }

    /**
     * Test rule against sample transactions (for preview)
     */
    testRule(rule, transactions) {
        const matches = [];

        for (const tx of transactions) {
            if (this.matchesConditions(tx, rule.conditions, rule.logic)) {
                matches.push(tx);
            }
        }

        return matches;
    }

    /**
     * Bulk categorize transactions using rules
     * Populates ACCOUNT field with COA codes
     */
    bulkCategorize(transactions) {
        const results = {
            categorized: 0,
            skipped: 0,
            details: []
        };

        transactions.forEach(tx => {
            const match = this.applyRules(tx);
            if (match && match.coa_code) {
                // Update transaction ACCOUNT field using updateCategory
                if (window.RoboLedger?.Ledger?.updateCategory) {
                    window.RoboLedger.Ledger.updateCategory(tx.tx_id, match.coa_code);
                    results.categorized++;
                    results.details.push({
                        tx_id: tx.tx_id,
                        description: tx.description,
                        coa_code: match.coa_code,
                        rule_id: match.rule_id
                    });
                }
            } else {
                results.skipped++;
            }
        });

        console.log(`[RULE_ENGINE] Bulk categorize complete:`, results);
        return results;
    }

    /**
     * Suggest COA code based on common patterns in description
     */
    suggestCategory(description) {
        // Simple keyword-based suggestions mapped to COA codes
        const keywords = {
            '6400': ['telus', 'rogers', 'bell', 'internet', 'phone', 'mobile', 'cellular', 'openphone'],
            '7200': ['software', 'saas', 'netflix', 'spotify', 'adobe', 'github', 'subscription'],
            '8300': ['gas', 'fuel', 'petro', 'shell', 'esso', 'chevron'],
            '8200': ['repair', 'mechanic', 'auto', 'tire', 'oil change'],
            '8500': ['hotel', 'airbnb', 'flight', 'uber', 'lyft', 'taxi', 'travel'],
            '8550': ['restaurant', 'starbucks', 'tim hortons', 'mcdonald', 'dining'],
            '8400': ['staples', 'office depot', 'supplies'],
            '8700': ['bank fee', 'service charge', 'monthly fee']
        };

        const lowerDesc = description.toLowerCase();

        for (const [coaCode, words] of Object.entries(keywords)) {
            for (const word of words) {
                if (lowerDesc.includes(word)) {
                    return {
                        coa_code: coaCode,
                        confidence: 0.8,
                        reason: `Contains keyword "${word}"`
                    };
                }
            }
        }

        return null;
    }

    importDefaultRules() {
        const defaultRules = [
            // ═══════════════════════════════════════════════════════
            // TELECOMMUNICATIONS (COA 6400)
            // ═══════════════════════════════════════════════════════
            {
                name: 'TELUS → Telephone & Internet (6400)',
                conditions: [{ field: 'description', operator: 'regex', value: 'TELUS[-\\s]?(MOBILITY|CUSTOMER|ACCOUNT)?' }],
                action: { coa_code: '6400' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'OPENPHONE → Telephone & Internet (6400)',
                conditions: [{ field: 'description', operator: 'contains', value: 'OPENPHONE' }],
                action: { coa_code: '6400' },
                logic: 'AND',
                priority: 9
            },

            // ═══════════════════════════════════════════════════════
            // SOFTWARE & SUBSCRIPTIONS (COA 6800)
            // ═══════════════════════════════════════════════════════
            {
                name: 'PRICELABS → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'PRICELABS?|DYNAPRIC' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'IGMS → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'IGMS|AIRGMS' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'NETFLIX → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'NETFLIX' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'RANKBREEZE → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'RANKBREEZE' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'LOOM → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'LOOM SUBSCRIPTION' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'NORTON → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'NORTON' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'MONDAY.COM → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'MONDAY\\.?COM|BLS\\*MONDAY' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'HOSTGATOR → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'HOSTGATOR|WEB\\*HOSTGATOR|EIG\\*HOSTGATOR' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'WORDPRESS → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'WORDPRESS|PAYPAL.*WORDPRESS' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'TRUSTINDEX → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'TRUSTINDEX' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'EXPERTFLYER → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'EXPERTFLYER' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'MICROSOFT 365 → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'regex', value: 'MICROSOFT.*365|MSBILL' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'RBOY APPS → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'RBOY APPS' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'AMAZON BUSINESS PRIME → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'BUSINESS PRIME AMAZON' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'MINUT → Software & Subscriptions (6800)',
                conditions: [{ field: 'description', operator: 'contains', value: 'MINUT' }],
                action: { coa_code: '6800' },
                logic: 'AND',
                priority: 8
            },

            // ═══════════════════════════════════════════════════════
            // REPAIRS & MAINTENANCE (COA 7300)
            // ═══════════════════════════════════════════════════════
            {
                name: 'BANFF PLUMBING → Repairs & Maintenance (7300)',
                conditions: [{ field: 'description', operator: 'regex', value: 'BANFF PLUMBING|BOW VALLEY.*PLUMBIN' }],
                action: { coa_code: '7300' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'HOME DEPOT → Repairs & Maintenance (7300)',
                conditions: [{ field: 'description', operator: 'regex', value: 'HOME DEPOT|PAYPAL.*HOMEDEPOT' }],
                action: { coa_code: '7300' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'EECOL ELECTRIC → Repairs & Maintenance (7300)',
                conditions: [{ field: 'description', operator: 'contains', value: 'EECOL ELECTRIC' }],
                action: { coa_code: '7300' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'CLEANING SERVICES → Repairs & Maintenance (7300)',
                conditions: [{ field: 'description', operator: 'regex', value: 'SHOTOVER CLEANING|MCKNIGHT CLEANI|BIG BEN.*CLEANI' }],
                action: { coa_code: '7300' },
                logic: 'AND',
                priority: 8
            },

            // ═══════════════════════════════════════════════════════
            // VEHICLE EXPENSES (COA 8400)
            // ═══════════════════════════════════════════════════════
            {
                name: 'AUTO DEALERS → Vehicle Expenses (8400)',
                conditions: [{ field: 'description', operator: 'regex', value: 'VILLAGE HONDA|CHARLESGLEN TOYOTA|NORTHSTAR FORD|PACIFIC MOTORS|SPARKS TOYOTA' }],
                action: { coa_code: '8400' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'CANADIAN TIRE → Vehicle Expenses (8400)',
                conditions: [{ field: 'description', operator: 'regex', value: 'CDN TIRE|CANADIAN TIRE' }],
                action: { coa_code: '8400' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'GAS STATIONS → Vehicle Expenses (8400)',
                conditions: [{ field: 'description', operator: 'regex', value: 'ESSO|PETROCAN|PETRO-?CAN|SHELL|CO-?OP GAS|CHEVRON|CALG CO-?OP' }],
                action: { coa_code: '8400' },
                logic: 'AND',
                priority: 9
            },

            // ═══════════════════════════════════════════════════════
            // INSURANCE (COA 7100 & 6500)
            // ═══════════════════════════════════════════════════════
            {
                name: 'SECURITY NATIONAL → Insurance (7100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'SECURITY NATIONAL INSUR' }],
                action: { coa_code: '7100' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'BLUE CROSS → Employee Benefits (6500)',
                conditions: [{ field: 'description', operator: 'regex', value: 'IP PLAN.*BLUE CROSS' }],
                action: { coa_code: '6500' },
                logic: 'AND',
                priority: 9
            },

            // ═══════════════════════════════════════════════════════
            // OFFICE SUPPLIES (COA 8600)
            // ═══════════════════════════════════════════════════════
            {
                name: 'MEMORY EXPRESS → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'MEMORY EXPRESS' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'WALMART → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'regex', value: 'WAL-?MART' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 7
            },
            {
                name: 'YOUPRENEUR → Office Expenses (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'YOUPRENEUR' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'ULINE → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'ULINE' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'ALIBABA → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'ALIBABA' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'LONDON DRUGS → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'LONDON DRUGS' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 7
            },
            {
                name: 'PHONE/WIRELESS → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'regex', value: 'PHONE EXPERTS|APEX WIRELESS' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'OTTERBOX → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'regex', value: 'OTTERBOX|LIFEPROOF' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'PATAGONIA → Uniforms/Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'PATAGONIA' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 7
            },
            {
                name: 'SP HOTEL TOILETRIES → Office Supplies (8600)',
                conditions: [{ field: 'description', operator: 'contains', value: 'SP HOTEL TOILETRIES' }],
                action: { coa_code: '8600' },
                logic: 'AND',
                priority: 8
            },

            // ═══════════════════════════════════════════════════════
            // MEALS & ENTERTAINMENT (COA 8100)
            // ═══════════════════════════════════════════════════════
            {
                name: 'RESTAURANTS → Meals & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'regex', value: 'BR RESTAURANT|JAMESONS|KILKENNY|GRIZZLY PAW|MARKET BISTRO' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'FAST FOOD → Meals & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'regex', value: 'SUBWAY|MCDONALD|PIZZAHUT|TIM HORTON' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 7
            },
            {
                name: '7-ELEVEN → Meals & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'contains', value: '7-ELEVEN' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 6
            },
            {
                name: 'ANA PAC → Meals & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'ANA PAC' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 7
            },

            // ═══════════════════════════════════════════════════════
            // TRAVEL & ENTERTAINMENT (COA 8100)
            // ═══════════════════════════════════════════════════════
            {
                name: 'AIRBNB → Travel & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'AIRBNB' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'WIFI/AIRLINE → Travel & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'regex', value: 'WIFIONBOARD|WESTJET|PAC-WESTJET' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'PARKS CANADA → Travel & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'PARKS CANADA' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'HOTELS → Travel & Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'regex', value: 'BANFF SPRINGS HOTEL|GEORGETOWN INN' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 7
            },
            {
                name: 'ALPINE HELICOPTERS → Client Entertainment (8100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'ALPINE HELICOPTERS' }],
                action: { coa_code: '8100' },
                logic: 'AND',
                priority: 8
            },

            // ═══════════════════════════════════════════════════════
            // PROFESSIONAL SERVICES (COA 6100, 6900)
            // ═══════════════════════════════════════════════════════
            {
                name: 'ALLISON ASSOCIATES → Professional Fees (6100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'ALLISON ASSOCIATES' }],
                action: { coa_code: '6100' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'REAL ESTATE COUNCIL → Professional Development (6900)',
                conditions: [{ field: 'description', operator: 'contains', value: 'REAL ESTATE COUNCIL' }],
                action: { coa_code: '6900' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'BCIT → Professional Development (6900)',
                conditions: [{ field: 'description', operator: 'contains', value: 'BCIT ICES' }],
                action: { coa_code: '6900' },
                logic: 'AND',
                priority: 9
            },
            {
                name: 'REGISTRIES → Licenses & Permits (6900)',
                conditions: [{ field: 'description', operator: 'regex', value: 'REGISTRY|ALBERTA ?REGISTRY' }],
                action: { coa_code: '6900' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'PRINCE OF TRAVEL → Professional Development (6900)',
                conditions: [{ field: 'description', operator: 'contains', value: 'PRINCE OF TRAVEL' }],
                action: { coa_code: '6900' },
                logic: 'AND',
                priority: 7
            },
            {
                name: 'SE CANADA → Professional Services (6100)',
                conditions: [{ field: 'description', operator: 'contains', value: 'SE CANADA INC' }],
                action: { coa_code: '6100' },
                logic: 'AND',
                priority: 8
            }
        ];

        defaultRules.forEach(r => {
            this.createRule(r.name, r.conditions, r.action, r.logic, r.priority);
        });

        console.log(`[RULE_ENGINE] Imported ${defaultRules.length} default categorization rules`);
    }
}

// Singleton instance
const ruleEngine = new RuleEngine();

// Make available globally
window.RuleEngine = ruleEngine;

export default ruleEngine;
