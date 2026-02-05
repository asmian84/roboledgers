/**
 * RoboLedgers: Invariant Violation Exceptions
 * Reference: docs/canonical_specifications/01_accounting_invariants.md (Section 7)
 */

export class RoboLedgersError extends Error {
    public code: string;
    public metadata: any;

    constructor(code: string, message: string, metadata: any = {}) {
        super(`${code}: ${message}`);
        this.code = code;
        this.metadata = metadata;
        this.name = 'RoboLedgersError';
    }
}

export class InvariantViolationError extends RoboLedgersError {
    constructor(code: string, message: string, metadata: any = {}) {
        super(`INVARIANT_VIOLATION_${code}`, message, metadata);
    }
}

export class PolarityError extends RoboLedgersError {
    constructor(message: string, metadata: any = {}) {
        super('POLARITY_ERROR_UNDEFINED', message, metadata);
    }
}
