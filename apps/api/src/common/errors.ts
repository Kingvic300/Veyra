import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import type { ZodType } from 'zod';
import { AmountError, InvalidTransitionError } from '@veyra/core';
import { ChainAdapterError } from '@veyra/chain-adapter';

/** Application error with a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details);
export const unauthorised = (message = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission for this action') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);

/** Validate untrusted input against a shared zod schema. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    throw badRequest(
      'VALIDATION_FAILED',
      'Request validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

const CHAIN_STATUS: Record<ChainAdapterError['code'], number> = {
  UNSUPPORTED: 400,
  INVALID_ADDRESS: 400,
  INSUFFICIENT_FUNDS: 409,
  BATCH_TOO_LARGE: 400,
  NOT_FOUND: 404,
  MISCONFIGURED: 409,
  NETWORK: 502,
};

interface PgError {
  code?: string;
  constraint?: string;
}

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(status).json({ error: body });
  }

  private toResponse(e: unknown): { status: number; body: { code: string; message: string; details?: unknown } } {
    if (e instanceof AppError) return { status: e.status, body: { code: e.code, message: e.message, details: e.details } };
    if (e instanceof InvalidTransitionError) return { status: 409, body: { code: 'INVALID_STATE', message: e.message } };
    if (e instanceof AmountError) return { status: 400, body: { code: 'INVALID_AMOUNT', message: e.message } };
    if (e instanceof ChainAdapterError) {
      return { status: CHAIN_STATUS[e.code], body: { code: `CHAIN_${e.code}`, message: e.message } };
    }
    if (e instanceof ThrottlerException) {
      return { status: 429, body: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } };
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      return { status, body: { code: HttpStatus[status] ?? 'HTTP_ERROR', message: e.message } };
    }
    // Drizzle wraps driver errors; the Postgres error is the cause.
    const pg = ((e as { cause?: PgError })?.cause ?? e) as PgError;
    if (pg && pg.code === '23505') {
      return { status: 409, body: { code: 'CONFLICT', message: 'A conflicting record already exists', details: pg.constraint } };
    }
    return { status: 500, body: { code: 'INTERNAL', message: 'Internal server error' } };
  }
}
