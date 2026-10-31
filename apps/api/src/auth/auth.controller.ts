import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, updateProfileSchema } from '@veyra/core';
import { InvitationsService } from '../organisations/invitations.service.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { forbidden, parse } from '../common/errors.js';
import { AuthService, SESSION_TTL_SECONDS } from './auth.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { SESSION_COOKIE } from './auth.guard.js';
import { CurrentUser, Public, type AuthUser } from './decorators.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly resets: PasswordResetService,
    private readonly invitations: InvitationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Always 202, whether or not the email has an account. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(202)
  async forgot(@Body() body: unknown, @Req() req: Request) {
    await this.resets.request(parse(forgotPasswordSchema, body).email, req.ip ?? null);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(204)
  async reset(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    await this.resets.reset(parse(resetPasswordSchema, body));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  /**
   * Change password; signs out every other session. Returns a fresh token (and
   * cookie) so the caller stays signed in, whether it uses cookies or a bearer token.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/change')
  @HttpCode(200)
  async change(@CurrentUser() user: AuthUser, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const sessionVersion = await this.resets.change(user.id, parse(changePasswordSchema, body));
    const token = await this.auth.issue(user.id, user.email, sessionVersion);
    this.setCookie(res, token);
    return { token };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = parse(registerSchema, body);
    if (input.inviteToken) {
      // Check the link before creating the account, so a bad link fails cleanly.
      const invite = await this.invitations.preview(input.inviteToken);
      if (invite.email !== input.email) throw forbidden('Sign up with the email address the invitation was sent to.');
    }
    const result = await this.auth.register(input);
    const joinedOrganisationId = input.inviteToken ? await this.invitations.accept(result.user, input.inviteToken) : undefined;
    this.setCookie(res, result.token);
    return { ...result, joinedOrganisationId };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(parse(loginSchema, body));
    this.setCookie(res, result.token);
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.auth.updateProfile(user.id, parse(updateProfileSchema, body));
  }

  /** Sign out on every device, this one included. */
  @Post('sessions/revoke')
  @HttpCode(204)
  async signOutEverywhere(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.signOutEverywhere(user.id);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  private setCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.env === 'production',
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: '/',
    });
  }
}
