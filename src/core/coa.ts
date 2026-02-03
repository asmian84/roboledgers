import type {
    ChartOfAccountEntry,
    CanonicalAccountClass,
    AccountRootClass,
    NormalBalance,
    FinancialStatement
} from '../types/coa.ts';
import { InvariantViolationError } from './errors.ts';

/**
 * RoboLedgers: COA Service (The Account Register)
 * Responsible for maintaining the list of accounts and their metadata truth.
 */
export class COAService {
    private static registry: Map<string, ChartOfAccountEntry> = new Map();

    /**
     * Registers a new account entry in the COA.
     * Enforces numeric range (1000-9999) and entity-scoped uniqueness.
     */
    static register(entry: ChartOfAccountEntry): void {
        const codeNum = parseInt(entry.account_code, 10);
        const entity_id = entry.entity_id || 'ENTITY_ROOT';

        // 1. Numeric Range Enforcement (Prompt 2, Eq 9)
        if (isNaN(codeNum) || codeNum < 1000 || codeNum > 9999) {
            throw new InvariantViolationError(
                'COA_INVALID_RANGE',
                `Account code "${entry.account_code}" is outside the legal range 1000-9999.`
            );
        }

        const compositeKey = `${entity_id}:${entry.account_code}`;

        // 2. Prevent Duplicates within same Entity
        if (this.registry.has(compositeKey)) {
            throw new InvariantViolationError(
                'COA_DUPLICATE_ACCOUNT',
                `Account code "${entry.account_code}" is already registered for Entity ${entity_id}.`
            );
        }

        const normalized: ChartOfAccountEntry = {
            ...entry,
            entity_id
        };

        this.registry.set(compositeKey, normalized);
    }

    /**
     * Retrieves an account entry by code.
     * Use getForEntity if multi-entity context is known.
     */
    static get(code: string, entityId: string = 'ENTITY_ROOT'): ChartOfAccountEntry {
        const entry = this.registry.get(`${entityId}:${code}`);
        if (!entry) {
            throw new InvariantViolationError(
                'DESIGN_INCOMPLETE_COA_ERROR',
                `Account string "${code}" is not explicitly mapped for Entity ${entityId}.`
            );
        }
        return entry;
    }

    /**
     * Resets the registry (Useful for tests)
     */
    static clear(): void {
        this.registry.clear();
    }

    /**
     * Returns all registered accounts.
     */
    static getAll(): ChartOfAccountEntry[] {
        return Array.from(this.registry.values());
    }
}
