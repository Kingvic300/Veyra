export const ROLES = ['OWNER', 'ADMIN', 'APPROVER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'org:read',
  'org:manage',
  'members:manage',
  'contractors:read',
  'contractors:write',
  'batches:read',
  'batches:write',
  'batches:approve',
  'batches:execute',
  'treasury:read',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ_BASE: Permission[] = ['org:read', 'batches:read', 'treasury:read', 'audit:read'];

/**
 * Role-based permissions. VIEWER deliberately cannot read contractor records
 * (identity and payout details) – selective disclosure by role.
 */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  ADMIN: new Set<Permission>([
    ...READ_BASE,
    'org:manage',
    'members:manage',
    'contractors:read',
    'contractors:write',
    'batches:write',
    'batches:approve',
    'batches:execute',
  ]),
  APPROVER: new Set<Permission>([...READ_BASE, 'contractors:read', 'batches:approve']),
  VIEWER: new Set<Permission>(READ_BASE),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsFor(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/** Whether `actor` may assign `target` role to someone. Only owners create owners. */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (!can(actor, 'members:manage')) return false;
  if (target === 'OWNER') return actor === 'OWNER';
  return true;
}

/** Roles whose members count towards batch approval. */
export function isApprovingRole(role: Role): boolean {
  return can(role, 'batches:approve');
}
