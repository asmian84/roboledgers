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
    readonly allowed_entities: string[];
}

export class AuthorityGuard {
    /**
     * Asserts that a user has a specific capability.
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

    /**
     * Asserts that a user has access to a specific entity.
     */
    static assertEntityAccess(user: User, entityId: string): void {
        if (!user.allowed_entities.includes(entityId) && !user.allowed_entities.includes('*')) {
            throw new InvariantViolationError(
                'INVARIANT_VIOLATION_ENTITY_ACCESS_DENIED',
                `User ${user.id} is not authorized to access Entity ${entityId}.`
            );
        }
    }
}
