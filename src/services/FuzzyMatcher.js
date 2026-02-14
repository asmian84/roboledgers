import VendorNormalizer from './VendorNormalizer.js';

/**
 * FuzzyMatcher - Matches transaction descriptions to COA codes using fuzzy matching
 * Uses training data from manually categorized transactions
 */
class FuzzyMatcher {
    constructor(trainingData) {
        this.trainingData = trainingData || {};
        this.vendorList = Object.keys(this.trainingData);
        console.log(`🧠 FuzzyMatcher initialized with ${this.vendorList.length} vendors`);
    }

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} a - First string
     * @param {string} b -Second string
     * @returns {number} - Edit distance
     */
    static levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    /**
     * Calculate similarity score between two strings (0-1)
     * Combines Levenshtein distance with word overlap
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} - Similarity score (0-1)
     */
    static similarity(a, b) {
        if (a === b) return 1.0;
        if (!a || !b) return 0.0;

        // Levenshtein-based similarity
        const maxLen = Math.max(a.length, b.length);
        const distance = this.levenshteinDistance(a, b);
        const levScore = 1 - (distance / maxLen);

        // Word overlap (Jaccard similarity)
        const wordsA = new Set(a.split(' '));
        const wordsB = new Set(b.split(' '));
        const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
        const union = new Set([...wordsA, ...wordsB]);
        const jaccardScore = intersection.size / union.size;

        // Weighted combination (favor exact word matches)
        return (levScore * 0.4) + (jaccardScore * 0.6);
    }

    /**
     * Find best COA match for a transaction description
     * @param {string} description - Transaction description
     * @param {number} topN - Number of candidates to consider
     * @returns {Object} - { coa, confidence, alternatives }
     */
    match(description, topN = 5) {
        if (!description) {
            return { coa: null, confidence: 0, alternatives: [] };
        }

        // Normalize the description
        const normalized = VendorNormalizer.normalize(description);

        // Try exact match first
        if (this.trainingData[normalized]) {
            const data = this.trainingData[normalized];
            return {
                coa: data.coa,
                confidence: data.confidence,
                count: data.count,
                matchType: 'exact',
                alternatives: data.alternatives || []
            };
        }

        // Fuzzy match
        const candidates = this.findSimilar(normalized, topN);

        if (candidates.length === 0) {
            return { coa: null, confidence: 0, alternatives: [] };
        }

        const best = candidates[0];

        return {
            coa: best.coa,
            confidence: best.score * best.trainingConfidence, // Combine match score with training confidence
            count: best.count,
            matchType: 'fuzzy',
            matchedVendor: best.vendor,
            similarityScore: best.score,
            alternatives: candidates.slice(1, 3).map(c => ({
                coa: c.coa,
                vendor: c.vendor,
                score: c.score
            }))
        };
    }

    /**
     * Find similar vendors by fuzzy matching
     * @param {string} text - Normalized vendor text
     * @param {number} limit - Number of candidates to return
     * @returns {Array} - Sorted array of matches
     */
    findSimilar(text, limit = 5) {
        const scores = [];

        for (const vendor of this.vendorList) {
            const similarity = FuzzyMatcher.similarity(text, vendor);

            // Skip very low similarity matches
            if (similarity < 0.3) continue;

            const data = this.trainingData[vendor];

            // Boost score based on training data frequency (more common vendors rank higher)
            const frequencyBoost = 1 + Math.log(data.count + 1) / 20;
            const finalScore = similarity * frequencyBoost;

            scores.push({
                vendor,
                coa: data.coa,
                score: similarity,
                weightedScore: finalScore,
                count: data.count,
                trainingConfidence: data.confidence
            });
        }

        // Sort by weighted score
        scores.sort((a, b) => b.weightedScore - a.weightedScore);

        return scores.slice(0, limit);
    }

    /**
     * Batch match multiple descriptions
     * @param {string[]} descriptions - Array of descriptions
     * @returns {Array} - Array of match results
     */
    matchBatch(descriptions) {
        return descriptions.map(desc => this.match(desc));
    }

    /**
     * Get statistics about the training data
     * @returns {Object} - Statistics
     */
    getStats() {
        const vendors = Object.values(this.trainingData);

        return {
            totalVendors: this.vendorList.length,
            highConfidence: vendors.filter(v => v.confidence > 0.9).length,
            mediumConfidence: vendors.filter(v => v.confidence >= 0.7 && v.confidence <= 0.9).length,
            lowConfidence: vendors.filter(v => v.confidence < 0.7).length,
            totalTransactions: vendors.reduce((sum, v) => sum + v.count, 0)
        };
    }
}

export default FuzzyMatcher;
