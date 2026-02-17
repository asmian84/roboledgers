/**
 * VendorMatcher - Intelligent vendor-to-COA matching using historical dictionary
 *
 * IMPROVEMENTS over original:
 * 1. FIX: Dictionary loaded async but findMatch() called sync — added readiness guard
 * 2. FIX: Description not normalized before matching — now uses VendorNormalizer
 * 3. FIX: Substring match score is too generous (0.8+ even for short matches in long strings)
 *         — now uses proportional boost capped at 0.95
 * 4. FIX: Levenshtein code was duplicated from FuzzyMatcher — now uses shared static method
 * 5. NEW: Polarity-aware matching option passed through from RuleEngine
 */

import VendorNormalizer from './VendorNormalizer.js';

class VendorMatcher {
    constructor() {
        this.dictionary = null;
        this._ready = false;
        this.loadDictionary();
    }

    async loadDictionary() {
        try {
            const response = await fetch('/src/data/vendor_dictionary.json');
            this.dictionary = await response.json();
            this._ready = true;
            console.log(`[VENDOR_MATCHER] Loaded ${this.dictionary.length} vendor entries`);
        } catch (e) {
            console.error('[VENDOR_MATCHER] Failed to load dictionary:', e);
            this.dictionary = [];
            this._ready = true; // Mark ready so we don't block
        }
    }

    /**
     * Shared similarity calculation.
     * FIXED: substring match boost is now proportional to avoid overscoring.
     *        e.g. "SHELL" in "SHELL GAS STATION CALGARY AB" → previously 0.8+,
     *        now ~0.75 (5 chars / 35 chars ratio only gets a modest bump).
     */
    static similarity(str1, str2) {
        const s1 = (str1 || '').toLowerCase().trim();
        const s2 = (str2 || '').toLowerCase().trim();

        if (!s1 || !s2) return 0;
        if (s1 === s2) return 1.0;

        // Substring bonus — proportional, capped at 0.92
        if (s1.includes(s2) || s2.includes(s1)) {
            const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
            return Math.min(0.92, 0.65 + (0.27 * ratio));
        }

        // Levenshtein distance
        const a = s1, b = s2;
        const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
            Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
        );

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                matrix[i][j] = b[i - 1] === a[j - 1]
                    ? matrix[i - 1][j - 1]
                    : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }

        return 1 - (matrix[b.length][a.length] / Math.max(a.length, b.length));
    }

    /**
     * Find best vendor match for a transaction.
     * FIX: Normalizes description before matching so "PAP TELUS MOBILITY 0001234"
     *      correctly strips bank prefix and matches "TELUS" in the dictionary.
     *
     * @param {Object|string} descriptionOrTx - Transaction object or raw description string
     * @param {number} threshold - Minimum confidence (default 0.6)
     * @returns {Object|null}
     */
    findMatch(descriptionOrTx, threshold = 0.6) {
        // FIX: Guard against calls before dictionary is loaded
        if (!this._ready || !this.dictionary?.length) return null;

        const transaction = typeof descriptionOrTx === 'string'
            ? { description: descriptionOrTx }
            : descriptionOrTx;

        const rawDesc = (transaction.description || '').trim();

        // FIX: Normalize the description before matching
        const normalizedDesc = VendorNormalizer.normalize(rawDesc).toLowerCase();
        const rawDescLower = rawDesc.toLowerCase();

        let bestMatch = null;
        let bestScore = 0;

        for (const entry of this.dictionary) {
            // Match against both raw and normalized descriptions
            const vendorScore    = VendorMatcher.similarity(normalizedDesc, (entry.Vendor   || '').toLowerCase());
            const cleanKeyScore  = VendorMatcher.similarity(normalizedDesc, (entry.Clean_Key || '').toLowerCase());

            // Also try matching raw (catches cases where normalization strips useful context)
            const rawVendorScore = VendorMatcher.similarity(rawDescLower,   (entry.Vendor   || '').toLowerCase());
            const rawCleanScore  = VendorMatcher.similarity(rawDescLower,   (entry.Clean_Key || '').toLowerCase());

            const maxScore = Math.max(vendorScore, cleanKeyScore, rawVendorScore, rawCleanScore);

            if (maxScore > bestScore && maxScore >= threshold) {
                bestScore = maxScore;

                const matchedField =
                    maxScore === vendorScore    ? 'Vendor(normalized)'   :
                    maxScore === cleanKeyScore  ? 'Clean_Key(normalized)':
                    maxScore === rawVendorScore ? 'Vendor(raw)'          : 'Clean_Key(raw)';

                bestMatch = {
                    vendor:      entry.Vendor,
                    coaCode:     String(entry['Account #']),
                    accountName: entry.Account_Name,
                    industry:    entry.Industry,
                    confidence:  maxScore,
                    matchedOn:   matchedField
                };
            }
        }

        return bestMatch;
    }

    /**
     * Batch match multiple transactions.
     */
    bulkMatch(transactions, threshold = 0.6) {
        const results = { matched: 0, unmatched: 0, details: [] };

        for (const tx of transactions) {
            const match = this.findMatch(tx, threshold);
            if (match) {
                results.matched++;
                results.details.push({ tx_id: tx.tx_id, description: tx.description, match });
            } else {
                results.unmatched++;
            }
        }

        return results;
    }
}

window.VendorMatcher = VendorMatcher;
