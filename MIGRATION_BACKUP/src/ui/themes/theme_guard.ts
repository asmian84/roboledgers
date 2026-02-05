import { THEMES } from './theme_registry.ts';

/**
 * RoboLedgers: Theme Guard
 * Responsibility: Enforce lens-based restrictions for UI themes.
 * Prevents psychological leakage or audit ambiguity.
 */
export function assertThemeAllowed(theme: string, lens: "zen" | "bookkeeper" | "accountant"): void {
    const t = (THEMES as any)[theme];
    if (!t) {
        throw new Error(`THEME_NOT_FOUND: ${theme}`);
    }

    // 1. Zen Mode Restrictions
    if (lens === "zen" && (t.mode === "restricted" || t.mode === "pro-only")) {
        throw new Error(`THEME_FORBIDDEN_IN_ZEN: ${theme}`);
    }

    // 2. Accountant / Auditor Restrictions (Neutrality Mandate)
    if (lens === "accountant" && theme !== "classic" && theme !== "vanilla") {
        throw new Error(`THEME_FORBIDDEN_FOR_AUDIT: ${theme} - Accountants require neutral presets.`);
    }

    // 3. Pro-Only (Bookkeeper/Accountant)
    if (lens === "bookkeeper" && t.mode === "restricted") {
        throw new Error(`THEME_FORBIDDEN_FOR_BOOKKEEPER: ${theme}`);
    }
}
