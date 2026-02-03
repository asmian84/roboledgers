/**
 * RoboLedgers: Theme Registry
 * Responsibility: Defining visual skins (HSL + Spacing + Radius).
 * Lens restrictions are enforced by theme_guard.ts.
 */

export type ThemeMode = "default" | "restricted" | "pro-only";

export interface ThemeDefinition {
    h?: number;
    s?: number;
    l?: number;
    mode: ThemeMode;
}

export const THEMES = {
    classic: { h: 210, s: 15, l: 96, mode: "default" as ThemeMode },
    default: { h: 205, s: 30, l: 95, mode: "default" as ThemeMode },
    "ledger-pad": { h: 60, s: 20, l: 94, mode: "default" as ThemeMode },
    "post-it": { h: 48, s: 90, l: 88, mode: "default" as ThemeMode },
    rainbow: { mode: "restricted" as ThemeMode },
    social: { mode: "restricted" as ThemeMode },
    spectrum: { mode: "restricted" as ThemeMode },
    subliminal: { h: 220, s: 8, l: 97, mode: "default" as ThemeMode },
    subtle: { h: 210, s: 10, l: 97, mode: "default" as ThemeMode },
    tracker: { mode: "pro-only" as ThemeMode },
    vanilla: { h: 0, s: 0, l: 100, mode: "default" as ThemeMode },
    vintage: { h: 35, s: 30, l: 92, mode: "default" as ThemeMode },
    wave: { h: 195, s: 25, l: 94, mode: "default" as ThemeMode },
    webapp: { mode: "pro-only" as ThemeMode }
} as const;

export type ThemeId = keyof typeof THEMES;
