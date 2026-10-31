import { describe, expect, it } from 'vitest';
import { BREVO_SEND_URL, MailDeliveryError, MailService } from '../src/mail/mail.service.js';
import { testConfig } from './helpers.js';

const message = { to: 'ada@acme.dev', subject: 'Hello', text: 'plain', html: '<p>html</p>' };

function brevoMail(status: number, body: unknown) {
  const mail = new MailService(testConfig({ BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'Veyra Payroll <payroll@acme.dev>' }));
  const calls: { url: string; init: RequestInit }[] = [];
  mail.fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { mail, calls };
}

describe('MailService with Brevo', () => {
  it('posts the message to the Brevo transactional API', async () => {
    const { mail, calls } = brevoMail(201, { messageId: '<abc@smtp-relay.mailin.fr>' });
    await mail.send(message);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(BREVO_SEND_URL);
    expect((calls[0]!.init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      sender: { name: 'Veyra Payroll', email: 'payroll@acme.dev' },
      to: [{ email: 'ada@acme.dev' }],
      subject: 'Hello',
      textContent: 'plain',
      htmlContent: '<p>html</p>',
    });
    expect(mail.outbox).toHaveLength(0);
  });

  it('throws a MailDeliveryError without the API key when Brevo rejects the email', async () => {
    const { mail } = brevoMail(400, { code: 'invalid_parameter', message: 'sender is not valid' });
    const err = await mail.send(message).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MailDeliveryError);
    expect((err as Error).message).toContain('sender is not valid');
    expect((err as Error).message).not.toContain('xkeysib-test');
  });

  it('logs to the outbox when no API key is set', async () => {
    const mail = new MailService(testConfig());
    await mail.send(message);
    expect(mail.outbox).toEqual([message]);
  });
});

describe('MAIL_FROM', () => {
  it('accepts a bare address or "Name <address>" and rejects anything else', () => {
    expect(testConfig({ MAIL_FROM: 'hi@acme.dev' }).mailFrom).toEqual({ name: undefined, email: 'hi@acme.dev' });
    expect(testConfig({ MAIL_FROM: 'Acme <hi@acme.dev>' }).mailFrom).toEqual({ name: 'Acme', email: 'hi@acme.dev' });
    expect(() => testConfig({ MAIL_FROM: 'not an email' })).toThrow();
  });
});
