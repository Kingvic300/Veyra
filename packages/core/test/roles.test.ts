import { describe, expect, it } from 'vitest';
import { can, canAssignRole, isApprovingRole } from '../src/roles';

describe('roles', () => {
  it('limits viewers to non-sensitive reads', () => {
    expect(can('VIEWER', 'batches:read')).toBe(true);
    expect(can('VIEWER', 'contractors:read')).toBe(false);
    expect(can('VIEWER', 'batches:approve')).toBe(false);
  });

  it('lets approvers approve but not execute or edit', () => {
    expect(can('APPROVER', 'batches:approve')).toBe(true);
    expect(can('APPROVER', 'batches:execute')).toBe(false);
    expect(can('APPROVER', 'batches:write')).toBe(false);
  });

  it('only owners create owners', () => {
    expect(canAssignRole('ADMIN', 'OWNER')).toBe(false);
    expect(canAssignRole('OWNER', 'OWNER')).toBe(true);
    expect(canAssignRole('ADMIN', 'APPROVER')).toBe(true);
    expect(canAssignRole('APPROVER', 'VIEWER')).toBe(false);
  });

  it('marks approving roles', () => {
    expect(isApprovingRole('OWNER')).toBe(true);
    expect(isApprovingRole('VIEWER')).toBe(false);
  });
});
