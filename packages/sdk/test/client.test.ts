import { describe, expect, it } from 'vitest';
import { VeyraApiError, VeyraClient } from '../src';

function fakeFetch(handler: (url: string, init: RequestInit) => { status: number; body?: unknown; text?: string }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = handler(url, init);
    const isJson = r.body !== undefined;
    return new Response(r.status === 204 ? null : isJson ? JSON.stringify(r.body) : (r.text ?? ''), {
      status: r.status,
      headers: { 'content-type': isJson ? 'application/json' : 'text/csv' },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('VeyraClient', () => {
  it('stores the bearer token after login and sends it', async () => {
    const f = fakeFetch((url) =>
      url.endsWith('/auth/login') ? { status: 200, body: { user: { id: 'u' }, token: 'jwt-1' } } : { status: 200, body: [] },
    );
    const c = new VeyraClient({ baseUrl: 'http://api/v1/', fetch: f.impl });
    await c.auth.login({ email: 'a@b.co', password: 'x' });
    await c.organisations.list();
    expect(f.calls[1]!.url).toBe('http://api/v1/organisations');
    expect((f.calls[1]!.init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1');
  });

  it('uses cookies and the csrf header in browser mode', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { user: { id: 'u' }, token: 'jwt' } }));
    const c = new VeyraClient({ baseUrl: 'http://api/v1', fetch: f.impl, useCookies: true });
    await c.auth.login({ email: 'a@b.co', password: 'x' });
    await c.batches.approve('o', 'b');
    const init = f.calls[1]!.init;
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['x-veyra-csrf']).toBe('1');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(f.calls[1]!.url).toBe('http://api/v1/organisations/o/batches/b/approvals');
  });

  it('raises typed API errors', async () => {
    const f = fakeFetch(() => ({ status: 409, body: { error: { code: 'ALREADY_APPROVED', message: 'nope' } } }));
    const c = new VeyraClient({ baseUrl: 'http://api/v1', fetch: f.impl, token: 't' });
    const err = await c.batches.approve('o', 'b', '0x1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VeyraApiError);
    expect(err).toMatchObject({ status: 409, code: 'ALREADY_APPROVED' });
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual({ txHash: '0x1' });
  });

  it('handles 204 and text responses', async () => {
    const f = fakeFetch((url) => (url.endsWith('.csv') ? { status: 200, text: 'a,b\n' } : { status: 204 }));
    const c = new VeyraClient({ baseUrl: 'http://api/v1', fetch: f.impl, token: 't' });
    expect(await c.members.remove('o', 'm')).toBeUndefined();
    expect(await c.batches.receiptCsv('o', 'b')).toBe('a,b\n');
  });

  it('builds audit query strings', async () => {
    const f = fakeFetch(() => ({ status: 200, body: [] }));
    const c = new VeyraClient({ baseUrl: 'http://api/v1', fetch: f.impl, token: 't' });
    await c.audit.list('o', { limit: 20, before: 100 });
    expect(f.calls[0]!.url).toBe('http://api/v1/organisations/o/audit?limit=20&before=100');
  });
});
