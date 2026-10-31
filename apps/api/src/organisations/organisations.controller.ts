import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { acceptInvitationSchema, addMemberSchema, createOrganisationSchema, updateMemberSchema, updateOrganisationSchema } from '@veyra/core';
import { CurrentUser, Public, type AuthUser } from '../auth/decorators.js';
import { parse } from '../common/errors.js';
import { GoLiveService } from './go-live.service.js';
import { InvitationsService } from './invitations.service.js';
import { OrganisationsService } from './organisations.service.js';

@Controller()
export class OrganisationsController {
  constructor(
    private readonly orgs: OrganisationsService,
    private readonly invitations: InvitationsService,
    private readonly goLiveService: GoLiveService,
  ) {}

  /** Create a real-money copy of a practice company: team, rules and people. */
  @Post('organisations/:orgId/go-live')
  goLive(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Body() body: unknown) {
    return this.goLiveService.goLive(user.id, orgId, parse(createOrganisationSchema, body));
  }

  /** Add someone by email: existing accounts join now, everyone else gets an invitation email. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('organisations/:orgId/invitations')
  invite(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Body() body: unknown) {
    return this.invitations.invite(user.id, orgId, parse(addMemberSchema, body));
  }

  @Get('organisations/:orgId/invitations')
  listInvitations(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string) {
    return this.invitations.list(user.id, orgId);
  }

  @Delete('organisations/:orgId/invitations/:invitationId')
  @HttpCode(204)
  revokeInvitation(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('invitationId') invitationId: string) {
    return this.invitations.revoke(user.id, orgId, invitationId);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('invitations/:token')
  previewInvitation(@Param('token') token: string) {
    return this.invitations.preview(parse(acceptInvitationSchema, { token }).token);
  }

  @Post('invitations/accept')
  @HttpCode(200)
  async acceptInvitation(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return { organisationId: await this.invitations.accept(user, parse(acceptInvitationSchema, body).token) };
  }

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
