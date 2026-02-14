import VendorNormalizer from './VendorNormalizer.js';

/**
 * UserCorrections - Tracks manual categorization corrections for continuous learning
 * Stores corrections in localStorage and feeds them back to FuzzyMatcher
 */
class UserCorrections {
    constructor() {
        this.STORAGE_KEY = 'roboledger_user_corrections';
        this.corrections = this.load();
        console.log(`[USER_CORRECTIONS] Loaded ${Object.keys(this.corrections).length} vendor corrections`);
    }

    /**
     * Load corrections from localStorage
     */
    load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('[USER_CORRECTIONS] Failed to load:', e);
            return {};
        }
    }

    /**
     * Save corrections to localStorage
     */
    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.corrections));
            return true;
        } catch (e) {
            console.error('[USER_CORRECTIONS] Failed to save:', e);
            return false;
        }
    }

    /**
     * Add a user correction
     * @param {string} description - Transaction description
     * @param {number} coaCode - COA code user selected
     */
    addCorrection(description, coaCode) {
        if (!description || !coaCode) return;

        const normalized = VendorNormalizer.normalize(description);

        if (!this.corrections[normalized]) {
            this.corrections[normalized] = {};
        }

        // Increment count for this COA
        this.corrections[normalized][coaCode] =
            (this.corrections[normalized][coaCode] || 0) + 1;

        this.save();

        console.log(`[USER_CORRECTIONS] Learned: "${normalized}" → COA ${coaCode}`);

        // Notify FuzzyMatcher to reload
        if (window.RoboLedger?.RuleEngine?.fuzzyMatcher) {
            window.RoboLedger.RuleEngine.fuzzyMatcher.updateUserCorrections(this.corrections);
        }
    }

    /**
     * Get all corrections
     */
    getCorrections() {
        return this.corrections;
    }

    /**
     * Get correction for specific vendor
     * @param {string} vendor - Vendor name (normalized)
     * @returns {Object|null} - {coa, count, confidence}
     */
    getCorrection(vendor) {
        const normalized = VendorNormalizer.normalize(vendor);
        const coaCounts = this.corrections[normalized];

        if (!coaCounts) return null;

        const total = Object.values(coaCounts).reduce((sum, c) => sum + c, 0);
        const mostCommon = Object.entries(coaCounts)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            coa: parseInt(mostCommon[0]),
            count: total,
            confidence: mostCommon[1] / total
        };
    }

    /**
     * Export corrections in training data format
     * @returns {Object} - Training data format
     */
    export() {
        const trainingFormat = {};

        for (const [vendor, coaCounts] of Object.entries(this.corrections)) {
            const total = Object.values(coaCounts).reduce((sum, c) => sum + c, 0);
            const mostCommon = Object.entries(coaCounts)
                .sort((a, b) => b[1] - a[1])[0];

            trainingFormat[vendor] = {
                coa: parseInt(mostCommon[0]),
                count: total,
                confidence: mostCommon[1] / total,
                source: 'user_corrections',
                alternatives: Object.entries(coaCounts)
                    .filter(([coa]) => coa !== mostCommon[0])
                    .map(([coa, count]) => ({ coa: parseInt(coa), count }))
            };
        }

        return trainingFormat;
    }

    /**
     * Import corrections (merge with existing)
     * @param {Object} importData - Corrections to import
     */
    import(importData) {
        for (const [vendor, data] of Object.entries(importData)) {
            if (!this.corrections[vendor]) {
                this.corrections[vendor] = {};
            }

            // Merge counts
            this.corrections[vendor][data.coa] =
                (this.corrections[vendor][data.coa] || 0) + data.count;

            // Merge alternatives
            if (data.alternatives) {
                for (const alt of data.alternatives) {
                    this.corrections[vendor][alt.coa] =
                        (this.corrections[vendor][alt.coa] || 0) + alt.count;
                }
            }
        }

        this.save();
        console.log(`[USER_CORRECTIONS] Imported ${Object.keys(importData).length} corrections`);
    }

    /**
     * Clear all corrections
     */
    clear() {
        this.corrections = {};
        this.save();
        console.log('[USER_CORRECTIONS] Cleared all corrections');
    }

    /**
     * Get statistics
     */
    getStats() {
        const vendors = Object.keys(this.corrections).length;
        const totalCorrections = Object.values(this.corrections)
            .reduce((sum, coaCounts) => sum + Object.values(coaCounts).reduce((s, c) => s + c, 0), 0);

        return {
            vendors,
            totalCorrections,
            avgCorrectionsPerVendor: vendors > 0 ? Math.round(totalCorrections / vendors * 10) / 10 : 0
        };
    }
}

export default UserCorrections;
