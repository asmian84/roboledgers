import { assert, assertThrows } from './assertions.ts';
import { assertThemeAllowed } from '../src/ui/themes/theme_guard.ts';

/**
 * RoboLedgers: Theme Invariant Tests
 * Verifies that visual personality never overrides accounting or psychological safety.
 */

export async function runThemeInvariantTests() {
    console.log('\n--- Running Theme Invariant Tests ---');

    // 1. Zen Mode Gating
    assertThemeAllowed('vintage', 'zen'); // Allowed
    assertThrows(
        () => assertThemeAllowed('rainbow', 'zen'),
        'THEME_FORBIDDEN_IN_ZEN'
    );
    assertThrows(
        () => assertThemeAllowed('tracker', 'zen'),
        'THEME_FORBIDDEN_IN_ZEN'
    );

    // 2. Accountant Neutrality Mandate
    assertThemeAllowed('classic', 'accountant'); // Allowed
    assertThemeAllowed('vanilla', 'accountant'); // Allowed
    assertThrows(
        () => assertThemeAllowed('vintage', 'accountant'),
        'THEME_FORBIDDEN_FOR_AUDIT'
    );

    // 3. Bookkeeper Access
    assertThemeAllowed('tracker', 'bookkeeper'); // Allowed
    assertThrows(
        () => assertThemeAllowed('social', 'bookkeeper'),
        'THEME_FORBIDDEN_FOR_BOOKKEEPER'
    );

    console.log('[PASS] Theme Invariant Tests');
}
