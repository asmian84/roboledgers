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
     * Enforces numeric range (1000-9999) and metadata completeness.
     */
    static register(entry: ChartOfAccountEntry): void {
        const code = parseInt(entry.account_code, 10);

        // 1. Numeric Range Enforcement (Prompt 2, Eq 9)
        if (isNaN(code) || code < 1000 || code > 9999) {
            throw new InvariantViolationError(
                'COA_INVALID_RANGE',
                `Account code "${entry.account_code}" is outside the legal range 1000-9999.`
            );
        }

        // 2. Prevent Duplicates
        if (this.registry.has(entry.account_code)) {
            throw new InvariantViolationError(
                'COA_DUPLICATE_ACCOUNT',
                `Account code "${entry.account_code}" is already registered.`
            );
        }

        this.registry.set(entry.account_code, entry);
    }

    /**
     * Retrieves an account entry by code.
     */
    static get(code: string): ChartOfAccountEntry {
        const entry = this.registry.get(code);
        if (!entry) {
            throw new InvariantViolationError(
                'DESIGN_INCOMPLETE_COA_ERROR',
                `Account string "${code}" is not explicitly mapped in the COA.`
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
