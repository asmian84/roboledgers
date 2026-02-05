import { assert, assertThrows } from './assertions.ts';
import { PeriodLifecycleController } from '../src/authority/period_state.ts';
import { CertificationService } from '../src/authority/certification.ts';
import { Role } from '../src/authority/roles.ts';
import type { User } from '../src/authority/guard.ts';

export async function runAuthorityLifecycleTests() {
    console.log('\n--- Running Authority Lifecycle Tests ---');

    PeriodLifecycleController.clear();
    CertificationService.clear();

    const accountant: User = { id: 'acc_01', role: Role.ACCOUNTANT, allowed_entities: ['*'] };
    const zen: User = { id: 'zen_01', role: Role.ZEN, allowed_entities: ['*'] };
    const validProof = { variance_cents: 0, proof_hash: 'hash123' } as any;

    // 1. Valid Lock
    PeriodLifecycleController.lock('P1', accountant, validProof);
    assert(PeriodLifecycleController.getStatus('P1') === 'LOCKED', 'Period should be LOCKED');

    // 2. Unauthorized Lock Rejection
    assertThrows(() => {
        PeriodLifecycleController.lock('P2', zen, validProof);
    }, 'INVARIANT_VIOLATION_UNAUTHORIZED');

    // 3. Lock Without Proof (Variance) Rejection
    const invalidProof = { variance_cents: 1 } as any;
    assertThrows(() => {
        PeriodLifecycleController.lock('P3', accountant, invalidProof);
    }, 'PERIOD_LOCK_VARIANCE_ERROR');

    // 4. Valid Certification
    CertificationService.certify(accountant, 'P1', 'hash123');
    const certs = CertificationService.getCertifications('P1');
    assert(certs.length === 1, 'Certification should be recordable');

    // 5. Certification Without Proof Rejection
    assertThrows(() => {
        CertificationService.certify(accountant, 'P1', '');
    }, 'CERTIFICATION_MISSING_PROOF');

    console.log('[PASS] Authority Lifecycle Tests');
}
