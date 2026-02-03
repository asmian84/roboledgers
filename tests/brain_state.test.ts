import { assert, assertThrows } from './assertions.ts';
import { DecisionStateMachine } from '../src/brain/state.ts';
import { TransactionStatus } from '../src/types/transaction.ts';

export async function runStateTests() {
    console.log('\n--- Running State Machine Tests ---');

    // 1. Valid Progress
    DecisionStateMachine.validateTransition(TransactionStatus.RAW, TransactionStatus.PREDICTED);
    DecisionStateMachine.validateTransition(TransactionStatus.PREDICTED, TransactionStatus.CONFIRMED);
    DecisionStateMachine.validateTransition(TransactionStatus.CONFIRMED, TransactionStatus.LOCKED);

    // 2. Backward Transition Rejection
    assertThrows(() => {
        DecisionStateMachine.validateTransition(TransactionStatus.CONFIRMED, TransactionStatus.PREDICTED);
    }, 'STATE_BACKWARD_TRANSITION');

    // 3. Terminal Locked Check
    assertThrows(() => {
        DecisionStateMachine.validateTransition(TransactionStatus.LOCKED, TransactionStatus.RAW);
    }, 'STATE_LOCKED_IS_TERMINAL');

    // 4. Skip Confirmation Rejection
    assertThrows(() => {
        DecisionStateMachine.validateTransition(TransactionStatus.PREDICTED, TransactionStatus.LOCKED);
    }, 'STATE_SKIP_CONFIRMATION');

    console.log('[PASS] State Machine Tests');
}
