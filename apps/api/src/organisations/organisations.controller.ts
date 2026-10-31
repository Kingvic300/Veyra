import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { addMemberSchema, createOrganisationSchema, updateMemberSchema, updateOrganisationSchema } from '@veyra/core';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { parse } from '../common/errors.js';
import { OrganisationsService } from './organisations.service.js';

@Controller()
export class OrganisationsController {
  constructor(private readonly orgs: OrganisationsService) {}

  @Get('networks')
  networks() {
    return this.orgs.networks();
  }

  @Get('organisations')
  list(@CurrentUser() user: AuthUser) {
    return this.orgs.list(user.id);
  }

  @Post('organisations')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.orgs.create(user.id, parse(createOrganisationSchema, body));
  }

  @Get('organisations/:orgId')
  get(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string) {
    return this.orgs.get(user.id, orgId);
  }

  @Patch('organisations/:orgId')
  update(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Body() body: unknown) {
    return this.orgs.update(user.id, orgId, parse(updateOrganisationSchema, body));
  }

  @Get('organisations/:orgId/capabilities')
  capabilities(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string) {
    return this.orgs.capabilities(user.id, orgId);
  }

  @Get('organisations/:orgId/treasury')
  treasury(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string) {
    return this.orgs.treasury(user.id, orgId);
  }

  @Get('organisations/:orgId/members')
  members(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string) {
    return this.orgs.listMembers(user.id, orgId);
  }

  @Post('organisations/:orgId/members')
  addMember(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Body() body: unknown) {
    return this.orgs.addMember(user.id, orgId, parse(addMemberSchema, body));
  }

  @Patch('organisations/:orgId/members/:memberId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
  ) {
    return this.orgs.updateMember(user.id, orgId, memberId, parse(updateMemberSchema, body));
  }

  @Delete('organisations/:orgId/members/:memberId')
  @HttpCode(204)
  removeMember(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('memberId') memberId: string) {
    return this.orgs.removeMember(user.id, orgId, memberId);
  }
}
