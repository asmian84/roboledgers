/**
 * VendorMatcher - Intelligent vendor-to-COA matching using historical dictionary
 * 
 * Uses fuzzy string matching to categorize transactions based on a vendor dictionary.
 * Dictionary format: { Vendor, Account_Name, "Account #", Clean_Key, Industry }
 */

class VendorMatcher {
    constructor() {
        this.dictionary = null;
        this.loadDictionary();
    }

    /**
     * Load vendor dictionary from JSON
     */
    async loadDictionary() {
        try {
            const response = await fetch('/src/data/vendor_dictionary.json');
            this.dictionary = await response.json();
            console.log(`[VENDOR_MATCHER] Loaded ${this.dictionary.length} vendor entries`);
            return this.dictionary;
        } catch (e) {
            console.error('[VENDOR_MATCHER] Failed to load dictionary:', e);
            this.dictionary = [];
            return [];
        }
    }

    /**
     * Fuzzy string similarity (0-1)
     * Uses Levenshtein distance normalized
     */
    similarity(str1, str2) {
        const s1 = (str1 || '').toLowerCase().trim();
        const s2 = (str2 || '').toLowerCase().trim();

        if (s1 === s2) return 1.0;
        if (s1.length === 0 || s2.length === 0) return 0;

        // Quick substring match
        if (s1.includes(s2) || s2.includes(s1)) {
            return 0.8 + (0.2 * (Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)));
        }

        // Levenshtein distance
        const matrix = [];
        for (let i = 0; i <= s2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    );
                }
            }
        }

        const maxLen = Math.max(s1.length, s2.length);
        return 1 - (matrix[s2.length][s1.length] / maxLen);
    }

    /**
     * Find best vendor match for a transaction description
     * Returns: { vendor, coaCode, accountName, industry, confidence }
     */
    findMatch(descriptionOrTx, threshold = 0.6) {
        if (!this.dictionary || this.dictionary.length === 0) {
            return null;
        }

        // Handle both string description and transaction object
        const transaction = typeof descriptionOrTx === 'string'
            ? { description: descriptionOrTx }
            : descriptionOrTx;


        let bestMatch = null;
        let bestScore = 0;

        const desc = (transaction.description || '').toLowerCase().trim();

        for (const entry of this.dictionary) {
            // Try matching against multiple fields
            const vendorScore = this.similarity(desc, entry.Vendor);
            const cleanKeyScore = this.similarity(desc, entry.Clean_Key);

            const maxScore = Math.max(vendorScore, cleanKeyScore);

            if (maxScore > bestScore && maxScore >= threshold) {
                bestScore = maxScore;
                bestMatch = {
                    vendor: entry.Vendor,
                    coaCode: String(entry['Account #']),
                    accountName: entry.Account_Name,
                    industry: entry.Industry,
                    confidence: maxScore,
                    matchedOn: vendorScore > cleanKeyScore ? 'Vendor' : 'Clean_Key'
                };
            }
        }

        return bestMatch;
    }

    /**
     * Batch match multiple transactions
     */
    bulkMatch(transactions, threshold = 0.6) {
        const results = {
            matched: 0,
            unmatched: 0,
            details: []
        };

        for (const tx of transactions) {
            const match = this.findMatch(tx.description, threshold);

            if (match) {
                results.matched++;
                results.details.push({
                    tx_id: tx.tx_id,
                    description: tx.description,
                    match: match
                });
            } else {
                results.unmatched++;
            }
        }

        return results;
    }
}

// Export for use in RuleEngine
window.VendorMatcher = VendorMatcher;
