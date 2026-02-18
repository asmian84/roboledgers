/**
 * SignalFusionEngine.js
 *
 * Parallel signal-fusion categorization engine for RoboLedger v5.1.
 *
 * All signals fire simultaneously and contribute a weighted confidence score.
 * The COA code with the highest total weighted score wins.
 *
 * Signal weights (tuned for Canadian small business / short-term rental):
 *   userRule       1.00  — explicit user-defined rules, always win
 *   exactVendor    0.95  — exact normalized vendor match from dictionary
 *   firmVendor     0.92  — firm's 79K-tx learned vendor → account mapping
 *   firmEntity     0.85  — entity register (client/vendor/intercompany roles)
 *   recurring      0.80  — same vendor, same amount, ~30-day cadence
 *   firmPattern    0.78  — pattern template match (etransfer, payment, etc.)
 *   keyword        0.75  — hardcoded keyword match against known patterns
 *   firmKeyword    0.72  — firm-learned keyword signals (200 keywords)
 *   fuzzyML        0.70  — FuzzyMatcher.match() result
 *   firmTransfer   0.68  — inter-account transfer detection from firm data
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

// ─── Import Categorization Brain (79,049 manually categorized transactions) ──
// Vite resolves JSON imports statically at build time — zero runtime parsing cost.
// The brain is bundled into the JS chunk and available immediately.

import BRAIN_DATA from '../data/categorization_brain.json';
const BRAIN = BRAIN_DATA?._meta ? BRAIN_DATA : null;
if (BRAIN) {
    console.log(`[SignalFusion] 🧠 Brain loaded: ${BRAIN._meta?.built_from || 'unknown'}`);
}

// ─── Context Brain (account-type-aware, human-verified SWIFT workpapers) ─────
// 2,369 type-specific + 403 universal rules extracted from human accountant files
import CONTEXT_BRAIN_DATA from '../data/context_brain.json';
const CONTEXT_BRAIN = CONTEXT_BRAIN_DATA?.metadata ? CONTEXT_BRAIN_DATA : null;
if (CONTEXT_BRAIN) {
    const m = CONTEXT_BRAIN.metadata;
    console.log(`[SignalFusion] 📚 Context brain loaded: ${m.rows_ingested} rows, ${m.total_rules} rules`);
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

const AUTO_THRESHOLD   = 0.82;  // >= this → auto-categorize, green dot
const REVIEW_THRESHOLD = 0.60;  // >= this → auto-categorize, yellow dot
                                  // < this  → leave uncategorized, red dot

// ─── Signal Weights ───────────────────────────────────────────────────────────

const WEIGHTS = {
    userRule:      1.00,
    refundMirror:  0.98,   // CC refund: mirrors same-vendor debit COA on same account (highest after userRule)
    contextBrain:  0.97,   // Human-verified SWIFT workpapers: (payee, account_type) → COA
    exactVendor:   0.95,
    firmVendor:    0.92,   // Firm's learned vendor mappings (4,317 vendors)
    firmEntity:    0.85,   // Entity register (231 entities with roles)
    recurring:     0.80,
    firmPattern:   0.78,   // Pattern templates (etransfer, payment, etc.)
    keyword:       0.75,
    firmKeyword:   0.72,   // Firm-learned keyword signals (200 keywords)
    fuzzyML:       0.70,
    firmTransfer:  0.68,   // Inter-account transfer detection
    amount:        0.60,
    polarity:      0.50,
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
    '4900': ['airbnb', 'vrbo', 'booking.com', 'rental income', 'rent received', 'e-transfer', 'interac', 'e-trf', 'autodeposit'],
    '4000': ['sales', 'invoice', 'payment received', 'consulting fee', 'service fee'],
};

// ─── Amount Heuristics ────────────────────────────────────────────────────────

const AMOUNT_RULES = [
    { test: (a, c) => !c && a < 6,                     coa: '8700', confidence: 0.65, note: 'Very small debit → likely bank fee' },
    { test: (a, c) => !c && a >= 9 && a <= 9.99,       coa: '6800', confidence: 0.55, note: '$9-10 recurring → subscription' },
    { test: (a, c) => !c && a >= 14 && a <= 16,        coa: '6800', confidence: 0.55, note: '$14-16 → subscription' },
    { test: (a, c) => !c && a >= 29 && a <= 31,        coa: '6800', confidence: 0.50, note: '$29-31 → subscription' },
    { test: (a, c) => !c && a >= 47 && a <= 50,        coa: '6800', confidence: 0.50, note: '$47-50 → subscription' },
    { test: (a, c) => !c && a >= 99 && a <= 100,       coa: '6800', confidence: 0.55, note: '$99-100 → annual subscription' },
    { test: (a, c) =>  c && a >= 500 && a <= 8000,     coa: '4900', confidence: 0.60, note: 'Large credit → likely rental revenue' },
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
        this._buildBrainIndices();
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
            this._signalRefundMirror(enriched),     // CC refunds: mirror same vendor's debit COA; cash back → 7700
            this._signalContextBrain(enriched),     // Context brain: human SWIFT workpapers (account-type-aware)
            this._signalExactVendor(enriched),
            this._signalFirmVendor(enriched),       // Brain: 4,317 learned vendor mappings
            this._signalFirmEntity(enriched),       // Brain: 231 entities with roles
            this._signalRecurring(enriched),
            this._signalFirmPattern(enriched),      // Brain: 11 pattern templates
            this._signalKeyword(enriched),
            this._signalFirmKeyword(enriched),      // Brain: 200 keyword signals
            this._signalFuzzyML(enriched),
            this._signalFirmTransfer(enriched),     // Brain: inter-account transfer detection
            this._signalAmount(enriched),
            this._signalPolarity(enriched),
        ].filter(Boolean);

        // Remove signals that violate polarity rules
        const safe = fired.filter(sig => this._polarityAllowed(sig.coa, enriched));

        const result = this._fuse(safe, enriched);

        // === POST-FUSE CC CREDIT GUARD ===
        // Final safety net: even after all signal filtering and polarity guards, a revenue code
        // must never be the outcome for a CC refund, cash-back, or rebate.
        // - Refund   → should be contra-expense (same COA as original debit); leave null for user if uncertain
        // - CashBack → should be 7700 (contra bank charges)
        // - Rebate   → should be 7700 (contra bank charges)
        const isNonPaymentCredit = enriched._isCredit && (
            (enriched._isCCAcct && !enriched._isCCPayment) || enriched._isBankRebate
        );
        if (result.coa_code && isNonPaymentCredit) {
            const winnerAcct = window.RoboLedger?.COA?.get(result.coa_code);
            if (winnerAcct?.root === 'REVENUE') {
                // If it's cash back or rebate, hard-route to 7700 instead of null
                const fallback = (enriched._isCashBack || enriched._isBankRebate) ? '7700' : null;
                const label = enriched._isCCRefund ? 'refund' : enriched._isCashBack ? 'cash back' : 'rebate';
                return {
                    ...result,
                    coa_code:    fallback,
                    confidence:  fallback ? 0.97 : 0,
                    needsReview: !fallback,
                    explanation: fallback
                        ? `[CC Guard] ${label} → 7700 (contra bank charges)`
                        : `[CC Guard] Revenue code ${result.coa_code} blocked on CC ${label} — reassign to contra-expense`,
                };
            }
        }

        return result;
    }

    /**
     * Enrich a raw transaction with pre-computed signals.
     * Store the enriched version to avoid re-computing for the same transaction.
     */
    enrichTransaction(tx) {
        const amount     = Math.abs((tx.amount_cents || 0) / 100);
        const isCredit   = tx.polarity === 'CREDIT';
        const normalized = VendorNormalizer.normalize(tx.description || '');

        // ── CC account detection ──────────────────────────────────────────────
        // Layer 1: inline metadata (brand, name regex)
        const meta = tx.metadata || {};
        const isCCByMeta = !!(meta.brand || meta.cardNetwork ||
                              /VISA|MC|AMEX|MASTERCARD|CREDIT/i.test(meta.name || '') ||
                              (meta.accountType || '').toLowerCase() === 'creditcard');
        // Layer 2: account registry lookup via account_id (most reliable path)
        const acctReg   = window.RoboLedger?.Accounts?.get(tx.account_id);
        const isCCByReg = !!(acctReg?.brand || acctReg?.cardNetwork ||
                              (acctReg?.accountType || '').toLowerCase() === 'creditcard' ||
                              /VISA|MC|AMEX|MASTERCARD|CREDIT/i.test(acctReg?.name || ''));
        const isCCAcct  = isCCByMeta || isCCByReg;

        // ── CC transaction sub-type classification ────────────────────────────
        // CREDIT CARD POLARITY RULE (permanent):
        //   On a CC account: CREDIT = charge (liability increases, money owed to card)
        //                    DEBIT  = payment (liability decreases, money paid to card)
        // This is OPPOSITE of a chequing/savings account.
        const rawDesc = (tx.raw_description || tx.description || '').toUpperCase();

        const isCCRefund = isCCAcct && isCredit && /\bREFUND\b/.test(rawDesc);
        const isCashBack = isCCAcct && isCredit && /CASH\s*BACK|CASHBACK|REWARD/i.test(rawDesc);
        const isBankRebate = isCredit && /\bREBATE\b/i.test(rawDesc);

        // CC PAYMENT = a DEBIT on a CC account (reduces liability) OR description match
        // NOT a credit — credits on CC are CHARGES (expenses), not payments
        const isCCPaymentDesc = /PAYMENT[- ]THANK\s*YOU|PAIEMENT[- ]MERCI|PAYMENT\s*RECEIVED|AUTOPAY|ONLINE\s*BANKING\s*PAYMENT/i.test(rawDesc);
        const isCCPayment = isCCAcct && (
            (!isCredit) ||                           // DEBIT on CC = payment
            (isCredit && isCCPaymentDesc)            // CREDIT with payment description (rare: error reversal)
        ) && !isCCRefund && !isCashBack && !isBankRebate;

        return {
            ...tx,
            _amount:       amount,
            _isCredit:     isCredit,
            _isDebit:      !isCredit,
            _normalized:   normalized,
            _isRecurring:  this._detectRecurring(tx, normalized, amount),
            _isRound:      (tx.amount_cents || 0) % 100 === 0,
            _isCCAcct:     isCCAcct,
            _isCCRefund:   isCCRefund,    // Vendor refund → contra-expense (same COA as original purchase)
            _isCashBack:   isCashBack,    // Cash back / reward → 7700
            _isBankRebate: isBankRebate,  // Fee rebate (any acct) → 7700
            _isCCPayment:  isCCPayment,   // DEBIT on CC = payment to card → 9971
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

    // ─── Signal: Refund Mirror ────────────────────────────────────────────────
    // For CC refunds: find the same vendor's most recent DEBIT on the same account
    // that has a confirmed (non-needs_review) expense category, and mirror it.
    // This implements the accounting rule: refund → contra-expense of original purchase.
    // Cash back / rewards → 7700 (bank charges contra), not a revenue account.

    _signalRefundMirror(tx) {
        // Cash back / rewards / rebates: always 7700 (contra bank fees / card charges)
        // Bank fee rebate, cash back reward, annual fee rebate → all reduce the cost of banking
        if (tx._isCashBack || tx._isBankRebate) {
            return {
                type:       'refundMirror',
                coa:        '7700',
                confidence: 0.97,
                weight:     WEIGHTS.refundMirror,
                note:       'Cash back/reward/rebate → 7700 (contra bank charges)',
            };
        }

        if (!tx._isCCRefund) return null;

        // Vendor refund: look up same vendor's debit transactions on same account
        const allTx = this.allTransactions;
        if (!allTx?.length) return null;

        const vendorNorm = tx._normalized;
        if (!vendorNorm) return null;

        // Find categorized DEBIT transactions from same vendor on same account
        // A "confirmed" category = anything that isn't needs_review with no code, or 9970/9971
        const matchingDebits = allTx.filter(other => {
            if (other.tx_id === tx.tx_id) return false;
            if (other.account_id !== tx.account_id) return false;
            if (other.polarity !== 'DEBIT') return false;
            if (!other.category) return false;
            if (['9970', '9971'].includes(other.category)) return false;
            const otherNorm = VendorNormalizer.normalize(other.description || '');
            return otherNorm === vendorNorm;
        });

        if (!matchingDebits.length) return null;

        // Sort by date descending — most recent match wins
        matchingDebits.sort((a, b) => new Date(b.date) - new Date(a.date));
        const bestMatch = matchingDebits[0];

        // Verify the mirrored code is an expense account (sanity check)
        const mirrorAcct = window.RoboLedger?.COA?.get(bestMatch.category);
        if (!mirrorAcct) return null;
        if (mirrorAcct.root === 'REVENUE' || mirrorAcct.root === 'LIABILITY') return null;

        return {
            type:       'refundMirror',
            coa:        bestMatch.category,
            confidence: 0.96,
            weight:     WEIGHTS.refundMirror,
            note:       `Refund mirror: ${vendorNorm} debit on ${bestMatch.date} used ${bestMatch.category} (${mirrorAcct.name})`,
        };
    }

    // ─── Signal: Context Brain (human-verified SWIFT workpapers) ─────────────
    // Highest-weight signal after user rules. Looks up (payee, account_type)
    // in the account-type-aware brain built from human bookkeeping files.
    // Falls back to universal rules (account-type-agnostic, n>=5, conf>=0.95).

    _signalContextBrain(tx) {
        if (!CONTEXT_BRAIN) return null;

        // Derive account type from transaction metadata
        const meta = tx.metadata?.source || '';
        const acctId = tx.account_id || '';
        let acctType = 'UNKNOWN';
        if (/AMEX|AMERICAN EXPRESS/i.test(meta + acctId))        acctType = 'CC_AMEX';
        else if (/MASTERCARD|MC\b/i.test(meta + acctId))         acctType = 'CC_MC';
        else if (/TD.*VISA|VISA.*TD/i.test(meta + acctId))       acctType = 'CC_TD_VISA';
        else if (/VISA/i.test(meta + acctId))                    acctType = 'CC_VISA';
        else if (/SAVINGS|SAV\b/i.test(meta + acctId))           acctType = 'SAVINGS';
        else if (/CHEQ|CHQ|CHECK/i.test(meta + acctId))          acctType = 'CHEQUING';
        else if (/CC|CREDIT.CARD/i.test(meta + acctId))          acctType = 'CC_GENERIC';

        const payeeClean = (tx._normalized || tx.description || '').toUpperCase().trim();
        if (!payeeClean) return null;

        const typeRules = CONTEXT_BRAIN.rules_by_type?.[acctType] || {};
        const universalRules = CONTEXT_BRAIN.universal_rules || {};

        // Exact match in type-specific rules
        const typeHit = typeRules[payeeClean];
        if (typeHit) {
            return {
                type:       'contextBrain',
                coa:        typeHit.code,
                confidence: typeHit.confidence,
                weight:     WEIGHTS.contextBrain,
                note:       `Context brain [${acctType}]: "${payeeClean}" n=${typeHit.n}`,
            };
        }

        // Partial match: check if any rule key is contained in payee or vice versa
        for (const [ruleKey, rule] of Object.entries(typeRules)) {
            if (ruleKey.length >= 5 && (payeeClean.includes(ruleKey) || ruleKey.includes(payeeClean))) {
                const overlap = Math.min(payeeClean.length, ruleKey.length) / Math.max(payeeClean.length, ruleKey.length);
                if (overlap >= 0.6) {
                    return {
                        type:       'contextBrain',
                        coa:        rule.code,
                        confidence: Math.min(rule.confidence, 0.90) * overlap,
                        weight:     WEIGHTS.contextBrain,
                        note:       `Context brain partial [${acctType}]: "${ruleKey}" n=${rule.n}`,
                    };
                }
            }
        }

        // Fall back to universal rules (confidence >= 0.95, n >= 5, account-type-agnostic)
        const universalHit = universalRules[payeeClean];
        if (universalHit) {
            return {
                type:       'contextBrain',
                coa:        universalHit.code,
                confidence: universalHit.confidence * 0.92, // slight discount for no type context
                weight:     WEIGHTS.contextBrain,
                note:       `Context brain [universal]: "${payeeClean}" n=${universalHit.n}`,
            };
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
            // CC ACCOUNTS: credits = charges (expenses/liabilities), NEVER revenue.
            // Return null so these fall through to needsReview rather than being force-coded to 4001.
            if (tx._isCCAcct) {
                return null;
            }
            // CHQ/SAV accounts: credit = deposit/income → suggest Sales Revenue as fallback
            return {
                type:       'polarity',
                coa:        '4001',
                confidence: 0.50,
                weight:     WEIGHTS.polarity,
                note:       'Credit polarity → Sales Revenue (fallback, bank/savings account)',
            };
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BRAIN-POWERED SIGNALS (learned from 79,049 firm-categorized transactions)
    // ═══════════════════════════════════════════════════════════════════════════

    // ─── Signal: Firm Vendor (4,317 learned vendor → account mappings) ─────

    _signalFirmVendor(tx) {
        if (!this._brainVendors) return null;
        const desc = (tx.description || '').toUpperCase().trim();
        if (!desc) return null;

        // 1. Exact match against brain vendor keys
        const exact = this._brainVendors[desc];
        if (exact && exact.c >= 0.75) {
            return {
                type:       'firmVendor',
                coa:        exact.a,
                confidence: exact.c,
                weight:     WEIGHTS.firmVendor,
                note:       `Firm vendor (exact): "${desc}" → ${exact.a} (${exact.n} historical)`,
            };
        }

        // 2. Progressive substring match — try shrinking the description
        //    "TIM HORTONS #1234 CALGARY AB" → "TIM HORTONS #1234 CALGARY" → "TIM HORTONS #1234" → "TIM HORTONS"
        const words = desc.split(/\s+/);
        for (let len = Math.min(words.length - 1, 6); len >= 2; len--) {
            const partial = words.slice(0, len).join(' ');
            const match = this._brainVendors[partial];
            if (match && match.c >= 0.75 && match.n >= 3) {
                // Discount confidence slightly for partial matches
                const discount = 0.90 + (0.10 * (len / words.length));
                return {
                    type:       'firmVendor',
                    coa:        match.a,
                    confidence: Math.min(match.c * discount, 0.95),
                    weight:     WEIGHTS.firmVendor,
                    note:       `Firm vendor (partial): "${partial}" → ${match.a} (${match.n} historical)`,
                };
            }
        }

        // 3. Check if any brain vendor key is a substring of the description
        //    Handles "POS PURCHASE - TIM HORTONS #1234" matching "TIM HORTONS"
        if (desc.length > 10) {
            for (const [vendorKey, entry] of this._brainVendorEntries) {
                if (vendorKey.length >= 4 && entry.n >= 5 && entry.c >= 0.80) {
                    if (desc.includes(vendorKey)) {
                        const overlap = vendorKey.length / desc.length;
                        if (overlap >= 0.3) {
                            return {
                                type:       'firmVendor',
                                coa:        entry.a,
                                confidence: Math.min(entry.c * (0.80 + 0.15 * overlap), 0.90),
                                weight:     WEIGHTS.firmVendor,
                                note:       `Firm vendor (contains): "${vendorKey}" in "${desc.substring(0, 40)}" → ${entry.a}`,
                            };
                        }
                    }
                }
            }
        }

        return null;
    }

    // ─── Signal: Firm Entity (231 entities with roles) ─────────────────────

    _signalFirmEntity(tx) {
        if (!this._brainEntities) return null;
        const desc = (tx.description || '').toUpperCase().trim();
        if (!desc) return null;

        // Check if any known entity name appears in the description
        for (const [entityName, entity] of this._brainEntityEntries) {
            if (entityName.length < 3) continue;  // Skip very short entity names

            if (desc.includes(entityName)) {
                // Entity role determines the account suggestion
                const account = entity.default_account;
                if (!account || account === '9970') continue;  // Skip uncategorized

                // Confidence based on entity's historical consistency
                const confidence = Math.min(entity.confidence * 0.95, 0.92);

                return {
                    type:       'firmEntity',
                    coa:        account,
                    confidence,
                    weight:     WEIGHTS.firmEntity,
                    note:       `Firm entity (${entity.role}): "${entityName}" → ${account} (${entity.total_interactions} interactions)`,
                };
            }
        }
        return null;
    }

    // ─── Signal: Firm Pattern Templates (11 transaction types) ─────────────

    _signalFirmPattern(tx) {
        if (!this._brainPatterns?.length) return null;
        const desc = (tx.description || '').toUpperCase();

        // Pattern detection rules (order matters — more specific first)
        const patternTests = [
            { type: 'etransfer',      test: /E-TRANSFER|E-TRF|INTERAC.*(?:SENT|RECEIVED|AUTO)/i },
            { type: 'payroll',        test: /PAYROLL|PAY STUB|SALARY|WAGES/i },
            { type: 'insurance',      test: /INSURANCE|INSUR(?:ANCE)?|INTACT|AVIVA|WAWANESA|DESJARDINS INS/i },
            { type: 'bill_payment',   test: /BILL PAYMENT|BILL PAY|PREAUTHORIZED/i },
            { type: 'bank_fee',       test: /(?:SERVICE|MONTHLY|OVERLIMIT|NSF|OVERDRAFT)\s*(?:FEE|CHARGE)|INTEREST\s*CHARGE|PURCHASE INTEREST/i },
            { type: 'online_banking', test: /ONLINE\s*(?:TRANSFER|BANKING|PAYMENT)|INTERNET\s*(?:TRANSFER|BANKING)/i },
            { type: 'transfer',       test: /TRSF\s*(?:FROM|TO)|TRANSFER\s*(?:FROM|TO|BETWEEN)|PAYMENT\s*(?:ATB|VISA|MASTERCARD|ROYAL|TD|BMO|CIBC|SCOTIABANK)/i },
            { type: 'pos_purchase',   test: /^POS\s|POS\s*PURCHASE|PURCHASE\s*-/i },
            { type: 'withdrawal',     test: /^(?:ATM\s)?WITHDRAWAL|CASH\s*WITHDRAWAL|ABM\s*WITHDRAWAL/i },
            { type: 'misc_payment',   test: /^MISC\s*PAYMENT|MISCELLANEOUS/i },
            { type: 'payment',        test: /^PAYMENT\s*-|PAYMENT\s*THANK\s*YOU|PAIEMENT/i },
        ];

        for (const { type, test } of patternTests) {
            if (!test.test(desc)) continue;

            // Find the matching pattern template in the brain
            const template = this._brainPatterns.find(p => p.type === type);
            if (!template) continue;

            // Get the top account from the template's distribution
            const accounts = template.accounts;
            if (!accounts || typeof accounts !== 'object') continue;

            // Find best account — but respect polarity
            const sortedAccts = Object.entries(accounts)
                .sort((a, b) => (b[1].count || b[1]) - (a[1].count || a[1]));

            for (const [acctCode, stats] of sortedAccts) {
                if (acctCode === '9970') continue;  // Skip uncategorized

                const count = typeof stats === 'object' ? stats.count : stats;
                const pct = typeof stats === 'object' ? (stats.pct || 0) : 0;

                // Only suggest if this account handles >25% of this pattern type
                if (pct < 25 && count < 50) continue;

                // Confidence based on how dominant this account is for the pattern
                const confidence = Math.min(0.65 + (pct / 200), 0.88);

                return {
                    type:       'firmPattern',
                    coa:        acctCode,
                    confidence,
                    weight:     WEIGHTS.firmPattern,
                    note:       `Firm pattern (${type}): ${pct.toFixed(0)}% of ${template.total_transactions} → ${acctCode}`,
                };
            }
        }

        return null;
    }

    // ─── Signal: Firm Keyword (200 learned keyword signals) ────────────────

    _signalFirmKeyword(tx) {
        if (!this._brainKeywords) return null;
        const desc = (tx.description || '').toUpperCase();
        if (!desc) return null;

        // Extract words from description
        const words = desc.match(/[A-Z]{3,}/g);
        if (!words) return null;

        // Find the best keyword match (highest occurrence count wins)
        let bestMatch = null;
        let bestScore = 0;

        for (const word of words) {
            const kw = this._brainKeywords[word];
            if (!kw || kw.a === '9970') continue;  // Skip uncategorized

            // Score = occurrences * confidence (favors common, consistent keywords)
            const score = kw.n * kw.c;
            if (score > bestScore && kw.c >= 0.65) {
                bestScore = score;
                bestMatch = { keyword: word, ...kw };
            }
        }

        if (!bestMatch) return null;

        return {
            type:       'firmKeyword',
            coa:        bestMatch.a,
            confidence: Math.min(bestMatch.c, 0.88),
            weight:     WEIGHTS.firmKeyword,
            note:       `Firm keyword: "${bestMatch.keyword}" → ${bestMatch.a} (${bestMatch.n} occurrences, ${Math.round(bestMatch.c * 100)}% conf)`,
        };
    }

    // ─── Signal: Firm Transfer Detection ──────────────────────────────────

    _signalFirmTransfer(tx) {
        if (!this._brainTransfers) return null;
        const desc = (tx.description || '').toUpperCase();
        if (!desc) return null;

        // Check against transfer indicator patterns
        for (const indicator of this._brainTransfers) {
            const pattern = indicator.pattern;
            if (!pattern) continue;

            if (desc.includes(pattern)) {
                const account = indicator.account;
                if (!account || account === '9970') continue;

                return {
                    type:       'firmTransfer',
                    coa:        account,
                    confidence: Math.min(indicator.confidence || 0.85, 0.92),
                    weight:     WEIGHTS.firmTransfer,
                    note:       `Firm transfer: "${pattern}" → ${account} (${indicator.occurrences || 0} historical)`,
                };
            }
        }

        // Check against transfer keywords
        if (this._brainTransferKeywords) {
            for (const keyword of this._brainTransferKeywords) {
                if (desc.includes(keyword)) {
                    // Transfer keyword matched but no specific account — use transfer accounts
                    const commonAcct = this._brainTransferCommonAccount;
                    if (commonAcct) {
                        return {
                            type:       'firmTransfer',
                            coa:        commonAcct,
                            confidence: 0.65,
                            weight:     WEIGHTS.firmTransfer,
                            note:       `Firm transfer keyword: "${keyword}" → ${commonAcct}`,
                        };
                    }
                }
            }
        }

        return null;
    }

    // ─── Brain Index Builder ──────────────────────────────────────────────

    _buildBrainIndices() {
        if (!BRAIN) {
            this._brainVendors = null;
            this._brainVendorEntries = [];
            this._brainEntities = null;
            this._brainEntityEntries = [];
            this._brainPatterns = [];
            this._brainKeywords = null;
            this._brainTransfers = [];
            this._brainTransferKeywords = [];
            this._brainTransferCommonAccount = null;
            return;
        }

        // Layer 1: Exact vendors — already a flat dict, use directly
        this._brainVendors = BRAIN.exact_vendors || {};

        // Pre-sort vendor entries by occurrence count (descending) for substring matching
        // Only include entries with sufficient confidence and occurrences
        this._brainVendorEntries = Object.entries(this._brainVendors)
            .filter(([_, v]) => v.n >= 5 && v.c >= 0.75)
            .sort((a, b) => b[1].n - a[1].n)
            .slice(0, 500);  // Top 500 vendors for substring search (performance guard)

        // Layer 2: Entity register
        this._brainEntities = BRAIN.entity_register || {};
        this._brainEntityEntries = Object.entries(this._brainEntities)
            .filter(([name, e]) => name.length >= 3 && e.total_interactions >= 3)
            .sort((a, b) => b[0].length - a[0].length);  // Longest names first (greedy match)

        // Layer 3: Pattern templates
        this._brainPatterns = BRAIN.pattern_templates || [];

        // Layer 4: Keyword signals
        this._brainKeywords = BRAIN.keyword_signals || {};

        // Layer 5: Transfer patterns
        const transfers = BRAIN.transfer_patterns || {};
        this._brainTransfers = transfers.indicators || [];
        this._brainTransferKeywords = transfers.keywords || [];

        // Find most common non-9970 transfer account
        const commonAccounts = transfers.common_accounts || {};
        const sortedTransferAccounts = Object.entries(commonAccounts)
            .filter(([code]) => code !== '9970')
            .sort((a, b) => b[1] - a[1]);
        this._brainTransferCommonAccount = sortedTransferAccounts[0]?.[0] || '2650';

        const vendorCount = Object.keys(this._brainVendors).length;
        const entityCount = this._brainEntityEntries.length;
        const kwCount = Object.keys(this._brainKeywords).length;
        const transferCount = this._brainTransfers.length;
        console.log(`[SignalFusion] 🧠 Brain indices built: ${vendorCount} vendors, ${entityCount} entities, ${this._brainPatterns.length} patterns, ${kwCount} keywords, ${transferCount} transfer indicators`);
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

        // ── CC ACCOUNT RULES ──────────────────────────────────────────────────
        // CC CHARGES = CREDIT polarity → EXPENSE accounts (this is correct and expected)
        // CC PAYMENTS = DEBIT polarity → 9971 or liability accounts
        // CC REFUNDS  = CREDIT polarity → contra-EXPENSE (same COA as original charge)
        if (tx._isCCAcct) {
            // CC credits going to EXPENSE → ALWAYS allowed (charges ARE expenses)
            if (tx._isCredit && (account.root === 'EXPENSE' || account.class === 'COGS')) {
                return true;
            }
            // CC credits going to REVENUE → NEVER allowed (CC charges are not revenue)
            if (tx._isCredit && account.root === 'REVENUE') return false;
            // CC debits going to REVENUE → NEVER allowed
            if (tx._isDebit && account.root === 'REVENUE') return false;
            return true;
        }

        // ── BANK / SAVINGS ACCOUNT RULES ─────────────────────────────────────
        // CC refunds are CREDIT polarity but legitimately hit EXPENSE accounts (contra-expense).
        // Allow CREDIT → EXPENSE only for refunds; block for everything else.
        if (tx._isCredit && (account.root === 'EXPENSE' || account.class === 'COGS')) {
            if (tx._isCCRefund) return true; // Contra-expense: Costco refund → 8600, CDN Tire refund → 5350, etc.
            return false;
        }

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
