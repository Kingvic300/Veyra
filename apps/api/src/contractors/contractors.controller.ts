import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { createContractorSchema, updateContractorSchema } from '@veyra/core';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { parse } from '../common/errors.js';
import { ContractorsService } from './contractors.service.js';

@Controller('organisations/:orgId/contractors')
export class ContractorsController {
  constructor(private readonly contractors: ContractorsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Query('archived') archived?: string) {
    return this.contractors.list(user.id, orgId, archived === 'true');
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Body() body: unknown) {
    return this.contractors.create(user.id, orgId, parse(createContractorSchema, body));
  }

  @Get(':contractorId')
  get(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('contractorId') id: string) {
    return this.contractors.get(user.id, orgId, id);
  }

  @Patch(':contractorId')
  update(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('contractorId') id: string, @Body() body: unknown) {
    return this.contractors.update(user.id, orgId, id, parse(updateContractorSchema, body));
  }

  /** Contractors are archived, never deleted, so historic batches stay intact. */
  @Delete(':contractorId')
  archive(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('contractorId') id: string) {
    return this.contractors.archive(user.id, orgId, id);
  }
}
