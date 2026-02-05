import type { User } from './guard.ts';
import { AuthorityGuard } from './guard.ts';
import { Capability } from './capabilities.ts';
import { InvariantViolationError } from '../core/errors.ts';

/**
 * RoboLedgers: Certification System
 * Provides accountant sign-off records tied to Proof Objects.
 */
export interface CertificationRecord {
    readonly certifier_id: string;
    readonly role_asserted: string;
    readonly period_id: string;
    readonly proof_hash: string;
    readonly timestamp: string;
}

export class CertificationService {
    private static registry: CertificationRecord[] = [];

    /**
     * Certifies a financial period.
     * Mandates CAP_CERTIFY_REPORTS and a proof hash.
     */
    static certify(actor: User, periodId: string, proofHash: string): void {
        // 1. Authority Check
        AuthorityGuard.assertCapability(actor, Capability.CAP_CERTIFY_REPORTS, `certifying period ${periodId}`);

        // 2. Proof Linkage (Mandatory hash)
        if (!proofHash) {
            throw new InvariantViolationError(
                'CERTIFICATION_MISSING_PROOF',
                `Cannot certify period ${periodId} without a valid proof manifest hash.`
            );
        }

        const record: CertificationRecord = {
            certifier_id: actor.id,
            role_asserted: actor.role,
            period_id: periodId,
            proof_hash: proofHash,
            timestamp: new Date().toISOString()
        };

        this.registry.push(Object.freeze(record));
        console.log(`[GOVERNANCE] PERIOD CERTIFIED: ${periodId} by ${actor.id} | Proof: ${proofHash.substring(0, 8)}...`);
    }

    static getCertifications(periodId: string): CertificationRecord[] {
        return this.registry.filter(r => r.period_id === periodId);
    }

    static clear(): void {
        this.registry = [];
    }
}
