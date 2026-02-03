import { runLedgerCoreTests } from '../tests/ledger_core.test.ts';
import { runFirewallTests } from '../tests/firewall.test.ts';
import { runCOACoreTests } from '../tests/coa_core.test.ts';
import { runCOAGateTests } from '../tests/coa_gate.test.ts';
import { runTCVTests } from '../tests/brain_tcv.test.ts';
import { runScoringTests } from '../tests/brain_scoring.test.ts';
import { runBrainGateTests } from '../tests/brain_gate.test.ts';
import { runStateTests } from '../tests/brain_state.test.ts';
import { runTraceTests } from '../tests/brain_trace.test.ts';
import {
    runBankMathTests,
    runCCMathTests
} from '../tests/recon_math.test.ts';
import {
    runTransferTests,
    runProofRequiredTests
} from '../tests/recon_logic.test.ts';
import { runRBACEnforcementTests } from '../tests/rbac_enforcement.test.ts';
import { runAuthorityLifecycleTests } from '../tests/authority_lifecycle.test.ts';
import { runAJETests } from '../tests/aje_invariants.test.ts';

/**
 * RoboLedgers: Master Test Runner
 * Orchestrates the execution of all invariant-led test suites.
 */

async function runAllTests() {
    console.log('==========================================');
    console.log('   ROBOLEDGERS MASTER INVARIANT TESTS     ');
    console.log('==========================================');

    let success = true;

    try {
        await runLedgerCoreTests();
        await runFirewallTests();
        await runCOACoreTests();
        await runCOAGateTests();
        await runTCVTests();
        await runScoringTests();
        await runBrainGateTests();
        await runStateTests();
        await runTraceTests();
        await runBankMathTests();
        await runCCMathTests();
        await runTransferTests();
        await runProofRequiredTests();
        await runRBACEnforcementTests();
        await runAuthorityLifecycleTests();
        await runAJETests();

        console.log('\n==========================================');
        console.log('   ALL INVARIANT TESTS PASSED SUCCESS    ');
        console.log('==========================================');
    } catch (err: any) {
        console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('   FATAL: INVARIANT TEST SUITE FAILED     ');
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error(err.stack);
        success = false;
    }

    if (!success) {
        process.exit(1);
    }
}

runAllTests();
