/**
 * UserCorrections - Tracks manual categorization corrections for continuous learning
 *
 * IMPROVEMENTS over original:
 * 1. FIX: Broken notification path — original used window.RoboLedger.RuleEngine.fuzzyMatcher
 *         but RuleEngine is exported as window.RuleEngine (not window.RoboLedger.RuleEngine)
 * 2. NEW: exportJSON() helper to download corrections as a backup file
 * 3. NEW: Conflict detection — warns when a vendor has been mapped to multiple COA codes
 *         with similar frequency (suggests ambiguous transactions)
 */

import VendorNormalizer from './VendorNormalizer.js';

class UserCorrections {
    constructor() {
        this.STORAGE_KEY = 'roboledger_user_corrections';
        this.corrections = this.load();
        console.log(`[USER_CORRECTIONS] Loaded ${Object.keys(this.corrections).length} vendor corrections`);
    }

    load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('[USER_CORRECTIONS] Failed to load:', e);
            return {};
        }
    }

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
     * Record a user correction.
     * @param {string} description - Raw transaction description
     * @param {number|string} coaCode - COA code the user selected
     */
    addCorrection(description, coaCode) {
        if (!description || !coaCode) return;

        const normalized = VendorNormalizer.normalize(description);

        if (!this.corrections[normalized]) {
            this.corrections[normalized] = {};
        }

        this.corrections[normalized][coaCode] =
            (this.corrections[normalized][coaCode] || 0) + 1;

        this.save();

        console.log(`[USER_CORRECTIONS] Learned: "${normalized}" → COA ${coaCode}`);

        // FIX: Corrected notification path — was window.RoboLedger.RuleEngine.fuzzyMatcher
        //      (window.RoboLedger.RuleEngine doesn't exist; the singleton is window.RuleEngine)
        const fuzzyMatcher = window.RuleEngine?.fuzzyMatcher;
        if (fuzzyMatcher) {
            fuzzyMatcher.updateUserCorrections(this.corrections);
        }
    }

    getCorrections() { return this.corrections; }

    /**
     * Get the best known correction for a specific vendor.
     * @param {string} vendor - Raw or normalized vendor name
     * @returns {{ coa: number, count: number, confidence: number } | null}
     */
    getCorrection(vendor) {
        const normalized = VendorNormalizer.normalize(vendor);
        const coaCounts = this.corrections[normalized];
        if (!coaCounts) return null;

        const total = Object.values(coaCounts).reduce((sum, c) => sum + c, 0);
        const [bestCoa, bestCount] = Object.entries(coaCounts)
            .sort((a, b) => b[1] - a[1])[0];

        return { coa: parseInt(bestCoa), count: total, confidence: bestCount / total };
    }

    /**
     * NEW: Detect vendors with conflicting categorizations.
     * Useful for surfacing transactions that are genuinely ambiguous
     * (e.g., Amazon used for both office supplies and software).
     * @returns {Array} vendors where top two COA codes are within 30% of each other
     */
    getConflicts() {
        const conflicts = [];

        for (const [vendor, coaCounts] of Object.entries(this.corrections)) {
            const sorted = Object.entries(coaCounts).sort((a, b) => b[1] - a[1]);
            if (sorted.length < 2) continue;

            const [top, second] = sorted;
            const ratio = second[1] / top[1];

            // If second-most-common is >40% as frequent as the top — that's a conflict
            if (ratio >= 0.4) {
                conflicts.push({
                    vendor,
                    topCoa: parseInt(top[0]),
                    topCount: top[1],
                    secondCoa: parseInt(second[0]),
                    secondCount: second[1],
                    conflictRatio: Math.round(ratio * 100)
                });
            }
        }

        return conflicts;
    }

    export() {
        const trainingFormat = {};
        for (const [vendor, coaCounts] of Object.entries(this.corrections)) {
            const total = Object.values(coaCounts).reduce((sum, c) => sum + c, 0);
            const [bestCoa, bestCount] = Object.entries(coaCounts)
                .sort((a, b) => b[1] - a[1])[0];

            trainingFormat[vendor] = {
                coa: parseInt(bestCoa),
                count: total,
                confidence: bestCount / total,
                source: 'user_corrections',
                alternatives: Object.entries(coaCounts)
                    .filter(([coa]) => coa !== bestCoa)
                    .map(([coa, count]) => ({ coa: parseInt(coa), count }))
            };
        }
        return trainingFormat;
    }

    /**
     * NEW: Export corrections as a downloadable JSON backup.
     * Call this from a UI "Backup Corrections" button.
     */
    exportJSON() {
        const data = JSON.stringify(this.export(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `roboledger-corrections-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    import(importData) {
        for (const [vendor, data] of Object.entries(importData)) {
            if (!this.corrections[vendor]) this.corrections[vendor] = {};
            this.corrections[vendor][data.coa] =
                (this.corrections[vendor][data.coa] || 0) + data.count;

            for (const alt of data.alternatives || []) {
                this.corrections[vendor][alt.coa] =
                    (this.corrections[vendor][alt.coa] || 0) + alt.count;
            }
        }
        this.save();
        console.log(`[USER_CORRECTIONS] Imported ${Object.keys(importData).length} corrections`);
    }

    clear() {
        this.corrections = {};
        this.save();
        console.log('[USER_CORRECTIONS] Cleared all corrections');
    }

    getStats() {
        const vendors = Object.keys(this.corrections).length;
        const totalCorrections = Object.values(this.corrections)
            .reduce((sum, coaCounts) =>
                sum + Object.values(coaCounts).reduce((s, c) => s + c, 0), 0);
        return {
            vendors,
            totalCorrections,
            avgCorrectionsPerVendor: vendors > 0
                ? Math.round(totalCorrections / vendors * 10) / 10 : 0
        };
    }
}

export default UserCorrections;
