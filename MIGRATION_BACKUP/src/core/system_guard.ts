import { InvariantViolationError } from './errors.ts';

/**
 * RoboLedgers: System Guard (Hardening Layer)
 * Responsibility: Manage global kill-switches and safe degradation states.
 * MANDATE: Centralized control for emergency lockdown.
 */
export const SystemSafetyState = {
    FULLY_OPERATIONAL: 'FULLY_OPERATIONAL',
    READ_ONLY_LOCKDOWN: 'READ_ONLY_LOCKDOWN',
    BRAIN_DISABLED: 'BRAIN_DISABLED', // AI Categorization disabled
    MAINTENANCE_MODE: 'MAINTENANCE_MODE'
} as const;

export type SystemSafetyState = typeof SystemSafetyState[keyof typeof SystemSafetyState];

export class SystemGuard {
    private static safetyState: SystemSafetyState = SystemSafetyState.FULLY_OPERATIONAL;
    private static killSwitches: Map<string, boolean> = new Map();

    /**
     * Sets the global safety state.
     */
    static setSafetyState(state: SystemSafetyState): void {
        this.safetyState = state;
        console.log(`[HARDENING] System state changed to: ${state}`);
    }

    static getSafetyState(): SystemSafetyState {
        return this.safetyState;
    }

    /**
     * Enforces that the system is currently writable.
     */
    static assertWritable(): void {
        if (this.safetyState === SystemSafetyState.READ_ONLY_LOCKDOWN ||
            this.safetyState === SystemSafetyState.MAINTENANCE_MODE) {
            throw new InvariantViolationError(
                'SYSTEM_READ_ONLY_LOCKDOWN',
                'The system is currently in READ-ONLY mode. No mutations allowed.'
            );
        }
    }

    /**
     * Checks if the Brain (AI) is enabled.
     */
    static isBrainEnabled(): boolean {
        if (this.safetyState === SystemSafetyState.BRAIN_DISABLED) return false;
        if (this.safetyState === SystemSafetyState.MAINTENANCE_MODE) return false;
        return !this.killSwitches.get('BRAIN_KILL_SWITCH');
    }

    /**
     * Activates a specific kill switch.
     */
    static activateKillSwitch(key: string): void {
        this.killSwitches.set(key, true);
        console.warn(`[HARDENING] KILL-SWITCH ACTIVATED: ${key}`);
    }

    static deactivateKillSwitch(key: string): void {
        this.killSwitches.set(key, false);
    }
}
