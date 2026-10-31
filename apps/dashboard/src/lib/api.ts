import { VeyraApiError, VeyraClient } from '@veyra/sdk';

export const API_URL = process.env.NEXT_PUBLIC_VEYRA_API_URL ?? 'http://localhost:4000/v1';

/** Browser client: the API sets an httpOnly session cookie; no token in JS. */
export const api = new VeyraClient({ baseUrl: API_URL, useCookies: true });

export function errorMessage(err: unknown): string {
  if (err instanceof VeyraApiError) {
    if (Array.isArray(err.details) && err.details.length > 0) {
      const first = err.details[0] as { message?: string; path?: string };
      if (first?.message) return `${err.message}: ${first.path ? `${first.path} ` : ''}${first.message}`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

export { VeyraApiError };
