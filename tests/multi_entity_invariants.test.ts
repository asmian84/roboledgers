import { assert, assertThrows } from './assertions.ts';
import { EntityService } from '../src/core/entity_service.ts';
import { EntityType } from '../src/types/entity.ts';
import { AuthorityGuard } from '../src/authority/guard.ts';
import { Role } from '../src/authority/roles.ts';
import { COAService } from '../src/core/coa.ts';
import { AccountRootClass, CanonicalAccountClass, NormalBalance, FinancialStatement } from '../src/types/coa.ts';
import { ProjectionService } from '../src/ui/projection_service.ts';

/**
 * RoboLedgers: Multi-Entity Invariant Tests
 * Phase 14A: Isolation & Consolidation Foundation
 */

export async function runMultiEntityInvariantTests() {
    console.log('\n--- Running Multi-Entity Invariant Tests ---');

    EntityService.clear();
    COAService.clear();

    // 1. Entity Registry
    const parentId = 'E1_PARENT';
    const childId = 'E2_SUBSIDIARY';

    EntityService.register({
        id: parentId,
        legal_name: 'RoboCorp Holdings',
        type: EntityType.HOLDCO,
        currency: 'USD'
    });

    EntityService.register({
        id: childId,
        legal_name: 'RoboSystems OpCo',
        type: EntityType.OPCO,
        currency: 'CAD',
        parent_id: parentId
    });

    assert(EntityService.getAll().length === 2, 'Should register 2 entities');

    // 2. Account-Entity Binding
    COAService.register({
        account_code: '1000',
        entity_id: childId,
        name: 'OpCo Operating Bank',
        metadata: {
            canonical_class: CanonicalAccountClass.CASH_LIQ,
            root_class: AccountRootClass.ASSET,
            normal_balance: NormalBalance.DEBIT,
            statement: FinancialStatement.BS,
            is_reconcilable: true,
            allows_aje: false,
            requires_authority: false
        }
    });

    const account = COAService.get('1000', childId);
    assert(account.entity_id === childId, 'Account should be bound to Subsidiary');

    // 3. Authority Isolation (RBAC)
    const restrictedUser = {
        id: 'usr_limit',
        role: Role.BOOKKEEPER,
        allowed_entities: [childId] // Only Subsidiary
    };

    const adminUser = {
        id: 'usr_admin',
        role: Role.ACCOUNTANT,
        allowed_entities: ['*'] // All
    };

    // Test Access
    AuthorityGuard.assertEntityAccess(restrictedUser, childId);
    AuthorityGuard.assertEntityAccess(adminUser, childId);
    AuthorityGuard.assertEntityAccess(adminUser, parentId);

    assertThrows(() => {
        AuthorityGuard.assertEntityAccess(restrictedUser, parentId);
    }, 'INVARIANT_VIOLATION_ENTITY_ACCESS_DENIED');

    // 4. Ledger Isolation (Conceptual)
    // In a real post, we check if the user has access to account.entity_id
    const targetAccount = COAService.get('1000', childId);
    AuthorityGuard.assertEntityAccess(restrictedUser, targetAccount.entity_id);

    // 5. Consolidated Projection
    testConsolidation(childId, parentId);

    console.log('[PASS] Multi-Entity Invariant Tests');
}

function testConsolidation(childId: string, parentId: string) {

    // Register another account in Parent
    COAService.register({
        account_code: '1000', // SHARED CODE
        entity_id: parentId,
        name: 'Parent Operating Bank',
        metadata: {
            canonical_class: CanonicalAccountClass.CASH_LIQ,
            root_class: AccountRootClass.ASSET,
            normal_balance: NormalBalance.DEBIT,
            statement: FinancialStatement.BS,
            is_reconcilable: true,
            allows_aje: false,
            requires_authority: false
        }
    });

    const consolidatedRows = ProjectionService.projectConsolidatedTrialBalance([childId, parentId]);

    // We expect 1 row for code '1000' because it's consolidated by code
    assert(consolidatedRows.length === 1, 'Consolidation should merge by account code');
    assert(consolidatedRows[0].debit === '$2,000.00', 'Consolidation should sum balances');
}
