import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const SEND_TIMEOUT_MS = 10_000;

export class MailDeliveryError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MailDeliveryError';
  }
}

/**
 * Outbound email. With BREVO_API_KEY set, mail goes through Brevo's
 * transactional email API. Without it the message is written to the server
 * log (development) and kept in `outbox` so tests can read it. Never run
 * without a key in production.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  /** Last messages sent in log mode, newest last (tests and local development). */
  readonly outbox: MailMessage[] = [];
  /** Replaced in tests. */
  fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    if (!config.brevoApiKey && config.env === 'production') {
      this.logger.warn('BREVO_API_KEY is not set: password reset emails will only be logged');
    }
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.config.brevoApiKey) {
      this.outbox.push(message);
      if (this.outbox.length > 50) this.outbox.shift();
      if (this.config.env !== 'test') {
        this.logger.log(`Email to ${message.to}: ${message.subject}\n${message.text}`);
      }
      return;
    }

    const res = await this.fetchImpl(BREVO_SEND_URL, {
      method: 'POST',
      headers: { 'api-key': this.config.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: this.config.mailFrom,
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Brevo errors look like { code, message }; never include the API key.
      const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
      throw new MailDeliveryError(res.status, `Brevo rejected the email (${res.status} ${body?.code ?? ''}): ${body?.message ?? res.statusText}`);
    }
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
