import { describe, expect, it } from 'vitest';
import { assertBatchTransition, assertPaymentTransition, canTransition, InvalidTransitionError, isTerminal } from '../src/batch';

describe('batch state machine', () => {
  it('allows the happy path', () => {
    expect(() => {
      assertBatchTransition('DRAFT', 'PENDING_APPROVAL');
      assertBatchTransition('PENDING_APPROVAL', 'APPROVED');
      assertBatchTransition('APPROVED', 'EXECUTING');
      assertBatchTransition('EXECUTING', 'COMPLETED');
    }).not.toThrow();
  });

  it('allows retry after failure', () => {
    expect(canTransition('EXECUTING', 'FAILED')).toBe(true);
    expect(canTransition('FAILED', 'EXECUTING')).toBe(true);
  });

  it('blocks skipping approval and leaving terminal states', () => {
    expect(() => assertBatchTransition('DRAFT', 'EXECUTING')).toThrow(InvalidTransitionError);
    expect(() => assertBatchTransition('COMPLETED', 'EXECUTING')).toThrow(InvalidTransitionError);
    expect(() => assertBatchTransition('EXECUTING', 'CANCELLED')).toThrow(InvalidTransitionError);
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
  });

  it('prevents paying a confirmed payment again', () => {
    expect(() => assertPaymentTransition('CONFIRMED', 'SUBMITTED')).toThrow(InvalidTransitionError);
  });
});
