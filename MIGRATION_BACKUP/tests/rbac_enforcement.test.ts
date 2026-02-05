import { assert, assertThrows } from './assertions.ts';
import { AuthorityGuard, type User } from '../src/authority/guard.ts';
import { Capability } from '../src/authority/capabilities.ts';
import { Role } from '../src/authority/roles.ts';

export async function runRBACEnforcementTests() {
    console.log('\n--- Running RBAC Enforcement Tests ---');

    const zen: User = { id: 'u1', role: Role.ZEN, allowed_entities: ['*'] };
    const accountant: User = { id: 'u2', role: Role.ACCOUNTANT, allowed_entities: ['*'] };

    // 1. Authorized Action
    AuthorityGuard.assertCapability(accountant, Capability.CAP_LOCK_PERIOD);

    // 2. Unauthorized Action Rejection
    assertThrows(() => {
        AuthorityGuard.assertCapability(zen, Capability.CAP_LOCK_PERIOD);
    }, 'INVARIANT_VIOLATION_UNAUTHORIZED');

    console.log('[PASS] RBAC Enforcement Tests');
}
