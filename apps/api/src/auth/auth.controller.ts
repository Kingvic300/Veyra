import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { loginSchema, registerSchema } from '@veyra/core';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { parse } from '../common/errors.js';
import { AuthService, SESSION_TTL_SECONDS } from './auth.service.js';
import { SESSION_COOKIE } from './auth.guard.js';
import { CurrentUser, Public, type AuthUser } from './decorators.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(parse(registerSchema, body));
    this.setCookie(res, result.token);
    return result;
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
