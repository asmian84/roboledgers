/**
 * RuleEngine - Pattern-based transaction categorization
 * 
 * Features:
 * - Condition matching (contains, equals, regex, numerical)
 * - Multiple conditions with AND/OR logic
 * - Priority-based rule application
 * - Auto-categorization and bulk operations
 */

class RuleEngine {
    constructor() {
        this.STORAGE_KEY = 'roboledger_categorization_rules';
        this.rules = this.loadRules();

        // Initialize vendor matcher
        this.vendorMatcher = new window.VendorMatcher();

        // Auto-import default rules if none exist
        if (this.rules.length === 0) {
            console.log('[RULE_ENGINE] No rules found, importing defaults...');
            this.importDefaultRules();
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
        console.log(`[RULE_ENGINE] Created rule: ${name}`);
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

                console.log(`[RULE_ENGINE] Matched rule "${rule.name}" for transaction:`, transaction.description);

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
                console.log(`[RULE_ENGINE] Vendor match for "${transaction.description}":`, match);
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

    /**
     * Import default rules with COA codes
     */
    importDefaultRules() {
        const defaultRules = [
            {
                name: 'TELUS → Telephone & Internet (6400)',
                conditions: [{ field: 'description', operator: 'contains', value: 'TELUS' }],
                action: { coa_code: '6400' },
                logic: 'AND',
                priority: 8
            },
            {
                name: 'NETFLIX → Software & Subscriptions (7200)',
                conditions: [{ field: 'description', operator: 'contains', value: 'NETFLIX' }],
                action: { coa_code: '7200' },
                logic: 'AND',
                priority: 7
            },
            {
                name: 'OPENPHONE → Telephone & Internet (6400)',
                conditions: [{ field: 'description', operator: 'contains', value: 'OPENPHONE' }],
                action: { coa_code: '6400' },
                logic: 'AND',
                priority: 7
            },
            {
                name: 'Gas Stations → Fuel (8300)',
                conditions: [
                    { field: 'description', operator: 'contains', value: 'GAS' },
                ],
                action: { coa_code: '8300' },
                logic: 'OR',
                priority: 6
            }
        ];

        defaultRules.forEach(r => {
            this.createRule(r.name, r.conditions, r.action, r.logic, r.priority);
        });

        console.log('[RULE_ENGINE] Imported default rules with COA codes');
    }
}

// Singleton instance
const ruleEngine = new RuleEngine();

// Make available globally
window.RuleEngine = ruleEngine;

export default ruleEngine;
