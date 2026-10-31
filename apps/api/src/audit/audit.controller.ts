import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { AccessService } from '../access/access.service.js';
import { AuditService } from './audit.service.js';

@Controller('organisations/:orgId/audit')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Param('orgId') orgId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('entityId') entityId?: string,
  ) {
    await this.access.require(user.id, orgId, 'audit:read');
    const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.audit.list(orgId, { limit: n, beforeSeq: before ? Number(before) : undefined, entityId });
  }

  /** Recompute the hash chain to prove the log was not altered. */
  @Get('verify')
  async verify(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string) {
    await this.access.require(user.id, orgId, 'audit:read');
    return this.audit.verify(orgId);
  }
}
