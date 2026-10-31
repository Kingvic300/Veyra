import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { forbidden, unauthorised } from '../common/errors.js';
import { IS_PUBLIC, type AuthedRequest } from './decorators.js';

export const SESSION_COOKIE = 'veyra_session';
export const CSRF_HEADER = 'x-veyra-csrf';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * Accepts `Authorization: Bearer <jwt>` (SDK, scripts) or the httpOnly session
 * cookie (dashboard). Cookie-authenticated writes must also send the
 * `x-veyra-csrf` header, which a cross-site form cannot set.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookie = readCookie(req.headers.cookie, SESSION_COOKIE);
    const token = bearer ?? cookie;
    if (!token) throw unauthorised();
    if (!bearer && !SAFE_METHODS.has(req.method) && req.headers[CSRF_HEADER] !== '1') {
      throw forbidden('Missing CSRF header');
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
      req.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw unauthorised('Session expired or invalid');
    }
  }
}
