/**
 * SignalFusionEngine.js
 * 
 * DROP THIS FILE INTO: src/services/SignalFusionEngine.js
 * 
 * Replaces the sequential waterfall (Rule → Vendor → Fuzzy → Default) with a
 * parallel signal-fusion model. All signals fire simultaneously and contribute
 * a weighted confidence score. The COA code with the highest total weighted
 * score wins.
 *
 * Signal weights (tuned for Canadian short-term rental / small business):
 *   userRule       1.00  — explicit user-defined rules, always win
 *   exactVendor    0.95  — exact normalized vendor match from dictionary
 *   recurring      0.80  — same vendor, same amount, ~30-day cadence
 *   keyword        0.75  — keyword match against known patterns
 *   fuzzyML        0.70  — FuzzyMatcher.match() result
 *   amount         0.60  — amount-based heuristics
 *   polarity       0.50  — polarity-only fallback (CREDIT → revenue)
 *
 * Output:
 *   {
 *     coa_code:    '6800',
 *     confidence:  0.87,
 *     method:      'fusion',
 *     signals:     [...],
 *     explanation: 'Categorized because: recurring monthly $47.99, keyword "subscription"',
 *     needsReview: false
 *   }
 */

import VendorNormalizer from './VendorNormalizer.js';

// ─── Thresholds ──────────────────────────────────────────────────────────────

const AUTO_THRESHOLD   = 0.82;  // >= this → auto-categorize, green dot
const REVIEW_THRESHOLD = 0.60;  // >= this → auto-categorize, yellow dot
                                  // < this  → leave uncategorized, red dot

// ─── Signal Weights ───────────────────────────────────────────────────────────

const WEIGHTS = {
    userRule:     1.00,
    exactVendor:  0.95,
    recurring:    0.80,
    keyword:      0.75,
    fuzzyML:      0.70,
    amount:       0.60,
    polarity:     0.50,
};

// ─── Keyword Maps ─────────────────────────────────────────────────────────────

const EXPENSE_KEYWORDS = {
    '6400': ['telus', 'rogers', 'bell', 'fido', 'koodo', 'freedom mobile', 'internet', 'phone', 'mobile', 'cellular', 'openphone', 'shaw', 'videotron'],
    '6500': ['blue cross', 'great west life', 'manulife', 'sunlife', 'employee benefit', 'group benefit', 'health plan'],
    '6800': ['software', 'saas', 'subscription', 'pricelabs', 'igms', 'rankbreeze', 'minut', 'monday.com', 'adobe', 'github', 'dropbox', 'zoom', 'notion', 'slack', 'hostaway', 'guesty', 'rboy', 'norton', 'loom', 'trustindex', 'expertflyer', 'hostgator', 'wordpress'],
    '6900': ['registry', 'licence', 'license', 'permit', 'real estate council', 'bcit', 'training', 'course', 'professional development', 'conference', 'dues', 'membership'],
    '7100': ['insurance', 'intact', 'aviva', 'wawanesa', 'allstate', 'desjardins', 'security national insur'],
    '7200': ['accounting', 'bookkeeping', 'quickbooks', 'freshbooks', 'wave', 'sage', 'payroll'],
    '7300': ['repair', 'maintenance', 'plumbing', 'electrical', 'hvac', 'furnace', 'cleaning', 'janitorial', 'home depot', 'rona', 'home hardware', 'eecol', 'locksmith', 'pest control', 'landscaping', 'snow removal'],
    '8100': ['restaurant', 'starbucks', 'tim horton', 'mcdonald', 'dining', 'pizza', 'sushi', 'cafe', 'coffee', 'bistro', 'grizzly paw', 'jameson', 'kilkenny', '7-eleven'],
    '8400': ['esso', 'petro-canada', 'petrocan', 'shell', 'co-op gas', 'chevron', 'husky', 'ultramar', 'fuel', 'gas station'],
    '8500': ['westjet', 'air canada', 'air transat', 'swoop', 'hotel', 'marriott', 'hilton', 'westin', 'best western', 'parks canada', 'alpine helicopters', 'wifionboard', 'uber', 'lyft', 'taxi'],
    '8600': ['staples', 'office depot', 'amazon', 'costco', 'walmart', 'london drugs', 'uline', 'memory express', 'supplies', 'toiletries', 'otterbox', 'alibaba'],
    '8700': ['bank fee', 'service charge', 'monthly fee', 'interac fee', 'wire fee', 'nsf fee', 'overdraft', 'atm fee'],
};

const REVENUE_KEYWORDS = {
    '4000': ['airbnb', 'vrbo', 'booking.com', 'rental income', 'rent received'],
    '4001': ['sales', 'invoice', 'payment received', 'consulting fee', 'service fee'],
};

// ─── Amount Heuristics ────────────────────────────────────────────────────────

const AMOUNT_RULES = [
    { test: (a, c) => !c && a < 6,                     coa: '8700', confidence: 0.65, note: 'Very small debit → likely bank fee' },
    { test: (a, c) => !c && a >= 9 && a <= 9.99,       coa: '6800', confidence: 0.55, note: '$9-10 recurring → subscription' },
    { test: (a, c) => !c && a >= 14 && a <= 16,        coa: '6800', confidence: 0.55, note: '$14-16 → subscription' },
    { test: (a, c) => !c && a >= 29 && a <= 31,        coa: '6800', confidence: 0.50, note: '$29-31 → subscription' },
    { test: (a, c) => !c && a >= 47 && a <= 50,        coa: '6800', confidence: 0.50, note: '$47-50 → subscription' },
    { test: (a, c) => !c && a >= 99 && a <= 100,       coa: '6800', confidence: 0.55, note: '$99-100 → annual subscription' },
    { test: (a, c) =>  c && a >= 500 && a <= 8000,     coa: '4000', confidence: 0.60, note: 'Large credit → likely rental revenue' },
    { test: (a, c) =>  c && a > 8000,                  coa: null,   confidence: 0,    note: 'Very large credit → likely transfer, skip' },
    { test: (a, c) => !c && a > 1500 && a < 15000,     coa: '7300', confidence: 0.45, note: 'Large debit → likely repair/maintenance' },
];


// =============================================================================
// SignalFusionEngine Class
// =============================================================================

class SignalFusionEngine {

    /**
     * @param {Object} options
     * @param {Array}  options.vendorDictionary  — loaded vendor dict array
     * @param {Object} options.fuzzyMatcher      — FuzzyMatcher instance
     * @param {Array}  options.allTransactions   — full transaction list (for recurring detection)
     */
    constructor({ vendorDictionary = [], fuzzyMatcher = null, allTransactions = [] } = {}) {
        this.vendorDictionary = vendorDictionary;
        this.fuzzyMatcher     = fuzzyMatcher;
        this.allTransactions  = allTransactions;
        this._buildVendorIndex();
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Main entry point. Returns a full categorization result.
     *
     * @param {Object} tx          — raw transaction object
     * @param {Array}  userRules   — enabled, priority-sorted rules from RuleEngine
     * @param {Object} ruleEngine  — RuleEngine instance (for matchesConditions)
     * @returns {Object}           — { coa_code, confidence, method, signals, explanation, needsReview }
     */
    categorize(tx, userRules = [], ruleEngine = null) {
        const enriched = this.enrichTransaction(tx);

        // Fire all signals simultaneously
        const fired = [
            this._signalUserRule(enriched, userRules, ruleEngine),
            this._signalExactVendor(enriched),
            this._signalRecurring(enriched),
            this._signalKeyword(enriched),
            this._signalFuzzyML(enriched),
            this._signalAmount(enriched),
            this._signalPolarity(enriched),
        ].filter(Boolean);

        // Remove signals that violate polarity rules
        const safe = fired.filter(sig => this._polarityAllowed(sig.coa, enriched));

        return this._fuse(safe, enriched);
    }

    /**
     * Enrich a raw transaction with pre-computed signals.
     * Store the enriched version to avoid re-computing for the same transaction.
     */
    enrichTransaction(tx) {
        const amount     = Math.abs((tx.amount_cents || 0) / 100);
        const isCredit   = tx.polarity === 'CREDIT';
        const normalized = VendorNormalizer.normalize(tx.description || '');

        return {
            ...tx,
            _amount:      amount,
            _isCredit:    isCredit,
            _isDebit:     !isCredit,
            _normalized:  normalized,
            _isRecurring: this._detectRecurring(tx, normalized, amount),
            _isRound:     (tx.amount_cents || 0) % 100 === 0,
        };
    }

    /**
     * Update transaction list used for recurring detection.
     * Call this whenever transactions are added/removed.
     */
    updateTransactionList(transactions) {
        this.allTransactions = transactions;
    }

    // ─── Signal: User Rule ───────────────────────────────────────────────────

    _signalUserRule(tx, rules, ruleEngine) {
        if (!rules?.length || !ruleEngine) return null;

        for (const rule of rules) {
            if (ruleEngine.matchesConditions(tx, rule.conditions, rule.logic)) {
                return {
                    type:       'userRule',
                    coa:        rule.action.coa_code,
                    confidence: 1.0,
                    weight:     WEIGHTS.userRule,
                    note:       `User rule: "${rule.name}"`,
                    ruleId:     rule.id,
                };
            }
        }
        return null;
    }

    // ─── Signal: Exact Vendor ────────────────────────────────────────────────

    _signalExactVendor(tx) {
        const key = tx._normalized.toLowerCase();

        // Exact lookup (O(1))
        if (this._vendorIndex[key]) {
            const entry = this._vendorIndex[key];
            return {
                type:       'exactVendor',
                coa:        String(entry['Account #']),
                confidence: 0.95,
                weight:     WEIGHTS.exactVendor,
                note:       `Vendor dictionary: "${entry.Vendor}"`,
            };
        }

        // Partial key match
        for (const [dictKey, entry] of Object.entries(this._vendorIndex)) {
            if (key.includes(dictKey) || dictKey.includes(key)) {
                const overlap = Math.min(key.length, dictKey.length) / Math.max(key.length, dictKey.length);
                if (overlap >= 0.5) {
                    return {
                        type:       'exactVendor',
                        coa:        String(entry['Account #']),
                        confidence: 0.75 + (0.15 * overlap),
                        weight:     WEIGHTS.exactVendor,
                        note:       `Vendor dictionary partial: "${entry.Vendor}"`,
                    };
                }
            }
        }
        return null;
    }

    // ─── Signal: Recurring ───────────────────────────────────────────────────

    _signalRecurring(tx) {
        if (!tx._isRecurring) return null;

        if (tx._isDebit && tx._amount < 300) {
            return {
                type:       'recurring',
                coa:        '6800',
                confidence: 0.78,
                weight:     WEIGHTS.recurring,
                note:       `Recurring monthly debit $${tx._amount.toFixed(2)} → subscription/service`,
            };
        }

        if (tx._isCredit && tx._amount >= 500) {
            return {
                type:       'recurring',
                coa:        '4000',
                confidence: 0.82,
                weight:     WEIGHTS.recurring,
                note:       `Recurring monthly credit $${tx._amount.toFixed(2)} → rental revenue`,
            };
        }

        return null;
    }

    // ─── Signal: Keyword ─────────────────────────────────────────────────────

    _signalKeyword(tx) {
        const desc = (tx.description || '').toLowerCase();
        const map  = tx._isCredit ? REVENUE_KEYWORDS : EXPENSE_KEYWORDS;

        for (const [coa, keywords] of Object.entries(map)) {
            for (const kw of keywords) {
                if (desc.includes(kw)) {
                    return {
                        type:       'keyword',
                        coa,
                        confidence: 0.78,
                        weight:     WEIGHTS.keyword,
                        note:       `Keyword match: "${kw}"`,
                    };
                }
            }
        }
        return null;
    }

    // ─── Signal: Fuzzy ML ────────────────────────────────────────────────────

    _signalFuzzyML(tx) {
        if (!this.fuzzyMatcher) return null;

        const match = this.fuzzyMatcher.match(tx.description);
        if (!match?.coa || match.confidence < 0.55) return null;

        return {
            type:       'fuzzyML',
            coa:        String(match.coa),
            confidence: match.confidence,
            weight:     WEIGHTS.fuzzyML,
            note:       `Fuzzy ML: "${match.matchedVendor || tx._normalized}" (${Math.round(match.confidence * 100)}%)`,
        };
    }

    // ─── Signal: Amount ──────────────────────────────────────────────────────

    _signalAmount(tx) {
        for (const rule of AMOUNT_RULES) {
            if (rule.test(tx._amount, tx._isCredit)) {
                if (!rule.coa) return null; // explicit skip rule
                return {
                    type:       'amount',
                    coa:        rule.coa,
                    confidence: rule.confidence,
                    weight:     WEIGHTS.amount,
                    note:       rule.note,
                };
            }
        }
        return null;
    }

    // ─── Signal: Polarity Fallback ───────────────────────────────────────────

    _signalPolarity(tx) {
        if (tx._isCredit) {
            return {
                type:       'polarity',
                coa:        '4001',
                confidence: 0.50,
                weight:     WEIGHTS.polarity,
                note:       'Credit polarity → Sales Revenue (fallback)',
            };
        }
        return null;
    }

    // ─── Fusion ──────────────────────────────────────────────────────────────

    _fuse(signals, tx) {
        if (signals.length === 0) {
            return {
                coa_code:    null,
                confidence:  0,
                method:      'fusion',
                signals:     [],
                explanation: 'No signals fired — manual review required',
                needsReview: true,
            };
        }

        // User rule always wins immediately
        const userRuleSig = signals.find(s => s.type === 'userRule');
        if (userRuleSig) {
            return {
                coa_code:    userRuleSig.coa,
                confidence:  1.0,
                method:      'fusion',
                signals,
                explanation: userRuleSig.note,
                needsReview: false,
                ruleId:      userRuleSig.ruleId,
            };
        }

        // Aggregate weighted scores by COA
        const scores     = {};
        const maxPossible = signals.reduce((sum, s) => sum + s.weight, 0);

        for (const sig of signals) {
            if (!scores[sig.coa]) scores[sig.coa] = 0;
            scores[sig.coa] += sig.weight * sig.confidence;
        }

        const ranked     = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const [winnerCoa, winnerScore] = ranked[0];
        const confidence = Math.min(winnerScore / maxPossible, 1.0);

        const winningSigs  = signals.filter(s => s.coa === winnerCoa);
        const explanation  = 'Categorized because: ' + winningSigs.map(s => s.note).join('; ');
        const alternatives = ranked.slice(1, 3).map(([coa, score]) => ({
            coa,
            confidence: Math.min(score / maxPossible, 1.0),
        }));

        return {
            coa_code:     winnerCoa,
            confidence,
            method:       'fusion',
            signals,
            explanation,
            needsReview:  confidence < REVIEW_THRESHOLD,
            alternatives,
        };
    }

    // ─── Polarity Guard ───────────────────────────────────────────────────────

    _polarityAllowed(coa, tx) {
        if (!coa) return false;
        const account = window.RoboLedger?.COA?.get(coa);
        if (!account) return true;

        if (tx._isCredit && (account.root === 'EXPENSE' || account.class === 'COGS')) return false;
        if (tx._isDebit  && account.root === 'REVENUE') return false;
        if (tx._isDebit  && tx._amount > 30 && ['7700', '8700', '8800'].includes(coa)) return false;

        return true;
    }

    // ─── Recurring Detection ─────────────────────────────────────────────────

    _detectRecurring(tx, normalized, amount) {
        if (!this.allTransactions?.length || !normalized) return false;

        const txDate = new Date(tx.date);
        const hits = this.allTransactions.filter(other => {
            if (other.tx_id === tx.tx_id) return false;
            const otherNorm   = VendorNormalizer.normalize(other.description || '');
            const otherAmount = Math.abs((other.amount_cents || 0) / 100);
            const daysDiff    = Math.abs((txDate - new Date(other.date)) / 86400000);
            return otherNorm === normalized
                && Math.abs(otherAmount - amount) / (amount || 1) < 0.05
                && daysDiff >= 25 && daysDiff <= 40;
        });

        return hits.length >= 1;
    }

    // ─── Vendor Index ────────────────────────────────────────────────────────

    _buildVendorIndex() {
        this._vendorIndex = {};
        for (const entry of this.vendorDictionary) {
            if (entry.Clean_Key) this._vendorIndex[entry.Clean_Key.toLowerCase()] = entry;
            if (entry.Vendor)    this._vendorIndex[entry.Vendor.toLowerCase()]    = entry;
        }
    }
}

// ─── UI Helper ───────────────────────────────────────────────────────────────

/**
 * Returns a UI-friendly confidence tier.
 *
 * Usage in your transaction row renderer:
 *   const tier = getConfidenceTier(result.confidence);
 *   <span style={{ color: tier.color }}>{tier.dot} {tier.label}</span>
 */
export function getConfidenceTier(confidence) {
    if (confidence >= AUTO_THRESHOLD)   return { label: 'Auto',   color: '#10b981', dot: '🟢', autoApply: true };
    if (confidence >= REVIEW_THRESHOLD) return { label: 'Review', color: '#f59e0b', dot: '🟡', autoApply: true };
    return                                     { label: 'Manual', color: '#ef4444', dot: '🔴', autoApply: false };
}

export { AUTO_THRESHOLD, REVIEW_THRESHOLD, WEIGHTS };
export default SignalFusionEngine;
