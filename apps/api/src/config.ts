import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: optionalUrl,
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  VEYRA_MASTER_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'VEYRA_MASTER_KEY must be 32 bytes, base64-encoded'),
  DASHBOARD_ORIGIN: z.string().default('http://localhost:3000'),
  ENABLE_SIMULATED_CHAIN: bool,
  ENABLE_STRK20: bool,
  STARKNET_RPC_SEPOLIA: optionalUrl,
  STARKNET_RPC_MAINNET: optionalUrl,
  STARKNET_RPC_DEVNET: optionalUrl,
  /** Public dashboard URL used in emails. Defaults to the first DASHBOARD_ORIGIN. */
  APP_URL: optionalUrl,
  /** Brevo API key (Settings, SMTP & API, API keys). Unset logs emails instead. */
  BREVO_API_KEY: optionalUrl,
  /** Sender, as `Name <address>` or a bare address. Must be a verified sender in Brevo. */
  MAIL_FROM: z
    .string()
    .default('Veyra <no-reply@veyra.example>')
    .transform((v, ctx) => {
      const m = v.trim().match(/^(?:(.*?)\s*<([^<>\s]+@[^<>\s]+)>|([^<>\s]+@[^<>\s]+))$/);
      if (!m) {
        ctx.addIssue({ code: 'custom', message: 'MAIL_FROM must be "Name <address>" or an email address' });
        return z.NEVER;
      }
      return { name: m[1]?.trim() || undefined, email: (m[2] ?? m[3])! };
    }),
  TX_POLL_INTERVAL_SECONDS: z.coerce.number().positive().default(5),
  /** Give up automatic polling after this many minutes; reconcile manually afterwards. */
  TX_POLL_TIMEOUT_MINUTES: z.coerce.number().positive().default(30),
});

export type AppConfig = {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string | undefined;
  jwtSecret: string;
  masterKey: Buffer;
  dashboardOrigin: string[];
  enableSimulatedChain: boolean;
  enableStrk20: boolean;
  starknetRpc: Record<string, string>;
  txPollIntervalMs: number;
  txPollTimeoutMs: number;
  appUrl: string;
  brevoApiKey: string | undefined;
  mailFrom: { name?: string; email: string };
};

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production' && e.ENABLE_SIMULATED_CHAIN) {
    throw new Error('ENABLE_SIMULATED_CHAIN must be false in production');
  }
  const starknetRpc: Record<string, string> = {};
  if (e.STARKNET_RPC_SEPOLIA) starknetRpc.sepolia = e.STARKNET_RPC_SEPOLIA;
  if (e.STARKNET_RPC_MAINNET) starknetRpc.mainnet = e.STARKNET_RPC_MAINNET;
  if (e.STARKNET_RPC_DEVNET) starknetRpc.devnet = e.STARKNET_RPC_DEVNET;
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    jwtSecret: e.JWT_SECRET,
    masterKey: Buffer.from(e.VEYRA_MASTER_KEY, 'base64'),
    dashboardOrigin: e.DASHBOARD_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    enableSimulatedChain: e.ENABLE_SIMULATED_CHAIN,
    enableStrk20: e.ENABLE_STRK20,
    starknetRpc,
    appUrl: (e.APP_URL ?? e.DASHBOARD_ORIGIN.split(',')[0]!.trim()).replace(/\/+$/, ''),
    brevoApiKey: e.BREVO_API_KEY,
    mailFrom: e.MAIL_FROM,
    txPollIntervalMs: e.TX_POLL_INTERVAL_SECONDS * 1000,
    txPollTimeoutMs: e.TX_POLL_TIMEOUT_MINUTES * 60_000,
  };
}
