import type { Capability } from './capabilities.ts';
import { Role, RoleCapabilities } from './roles.ts';
import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: Authority Guard
 * Domain-level service for enforcing capability-based access control.
 */
export interface User {
    readonly id: string;
    readonly role: Role;
}

export class AuthorityGuard {
    /**
     * Asserts that a user has a specific capability.
     * Throws INVARIANT_VIOLATION_UNAUTHORIZED if check fails.
     */
    static assertCapability(user: User, capability: Capability, context?: string): void {
        const caps = RoleCapabilities[user.role];

        if (!caps || !caps.has(capability)) {
            throw new InvariantViolationError(
                'INVARIANT_VIOLATION_UNAUTHORIZED',
                `User ${user.id} (${user.role}) lacks required capability: ${capability}${context ? ` for ${context}` : ''}.`
            );
        }
    }
}
