import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { StatsService } from './stats.service.js';

@Controller('organisations/:orgId/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string) {
    return this.stats.stats(user.id, orgId);
  }
}
