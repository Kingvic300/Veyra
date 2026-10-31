import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC = 'veyra:isPublic';
/** Skip authentication for a route. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthedRequest = Request & { user?: AuthUser };

/** Inject the authenticated user. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new Error('CurrentUser used on a public route');
  return req.user;
});
