/**
 * RoboLedgers: Bare-bones Assertion Utility
 * Used for invariant testing without external dependencies.
 */

export function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`ASSERTION_FAILED: ${message}`);
    }
}

export function assertThrows(fn: () => void, errorCode: string) {
    try {
        fn();
        throw new Error(`ASSERTION_FAILED: Expected error code ${errorCode} but no error was thrown.`);
    } catch (err: any) {
        if (!err.message.includes(errorCode)) {
            throw new Error(`ASSERTION_FAILED: Expected error containing ${errorCode}, but got: ${err.message}`);
        }
    }
}

export async function runTest(name: string, fn: () => void | Promise<void>) {
    try {
        await fn();
        console.log(`[PASS] ${name}`);
        return true;
    } catch (err: any) {
        console.error(`[FAIL] ${name}\n       ${err.message}`);
        return false;
    }
}
