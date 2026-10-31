import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config.js';

export type ChainJobKind = 'proposal' | 'approval' | 'execution';

export interface ChainJob {
  kind: ChainJobKind;
  /** batch id (proposal), approval id or execution id. */
  id: string;
}

/** `retry`: transaction not final yet, check again later. */
export type ChainJobOutcome = 'done' | 'retry';
export type ChainJobHandler = (job: ChainJob) => Promise<ChainJobOutcome>;

/**
 * Watches submitted transactions until they are final. Two implementations:
 * BullMQ (Redis, survives restarts, multiple workers) and in-process timers
 * (development and tests). Pending work is also re-enqueued on startup by the
 * reconciler, so the in-process mode stays correct across restarts.
 */
export abstract class TxMonitor {
  protected handler: ChainJobHandler | null = null;

  setHandler(handler: ChainJobHandler) {
    this.handler = handler;
  }

  abstract enqueue(job: ChainJob, delayMs?: number): Promise<void>;
  abstract close(): Promise<void>;
}

class RetryLater extends Error {
  constructor() {
    super('Transaction not final yet');
  }
}

@Injectable()
export class InlineTxMonitor extends TxMonitor implements OnApplicationShutdown {
  private readonly logger = new Logger('InlineTxMonitor');
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly started = new Map<string, number>();
  private closed = false;
  private running = 0;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  async enqueue(job: ChainJob, delayMs = 0): Promise<void> {
    const key = `${job.kind}-${job.id}`;
    if (this.closed || this.timers.has(key)) return;
    if (!this.started.has(key)) this.started.set(key, Date.now());
    const timer = setTimeout(() => void this.run(key, job), delayMs);
    timer.unref?.();
    this.timers.set(key, timer);
  }

  /** Resolve once no job is scheduled (used by tests). */
  async idle(timeoutMs = 10_000): Promise<void> {
    const start = Date.now();
    while (this.timers.size > 0 || this.running > 0) {
      if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for chain jobs');
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  private async run(key: string, job: ChainJob) {
    this.timers.delete(key);
    if (!this.handler || this.closed) return;
    this.running += 1;
    try {
      await this.runOnce(key, job);
    } finally {
      this.running -= 1;
    }
  }

  private async runOnce(key: string, job: ChainJob) {
    if (!this.handler) return;
    try {
      const outcome = await this.handler(job);
      if (outcome === 'retry') {
        if (Date.now() - (this.started.get(key) ?? Date.now()) > this.config.txPollTimeoutMs) {
          this.logger.warn(`Stopped polling ${key}: timeout. Use reconcile to check again.`);
          this.started.delete(key);
          return;
        }
        await this.enqueue(job, this.config.txPollIntervalMs);
        return;
      }
    } catch (err) {
      this.logger.error(`Chain job ${key} failed: ${err instanceof Error ? err.message : String(err)}`);
      await this.enqueue(job, this.config.txPollIntervalMs);
      return;
    }
    this.started.delete(key);
  }

  async close() {
    this.closed = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  async onApplicationShutdown() {
    await this.close();
  }
}

export const QUEUE_NAME = 'veyra-chain-tx';

@Injectable()
export class BullTxMonitor extends TxMonitor implements OnApplicationShutdown {
  private readonly logger = new Logger('BullTxMonitor');
  private readonly queue: Queue<ChainJob>;
  private worker: Worker<ChainJob> | null = null;
  private readonly connections: Redis[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
    this.queue = new Queue<ChainJob>(QUEUE_NAME, { connection: this.redis() });
  }

  /** BullMQ needs its own ioredis client per queue/worker in ESM. */
  private redis(): Redis {
    const client = new Redis(this.config.redisUrl!, { maxRetriesPerRequest: null });
    this.connections.push(client);
    return client;
  }

  override setHandler(handler: ChainJobHandler) {
    super.setHandler(handler);
    if (this.worker) return;
    this.worker = new Worker<ChainJob>(
      QUEUE_NAME,
      async (job: Job<ChainJob>) => {
        const outcome = await handler(job.data);
        if (outcome === 'retry') throw new RetryLater();
      },
      { connection: this.redis(), concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => {
      if (!(err instanceof RetryLater)) this.logger.error(`Chain job ${job?.id} error: ${err.message}`);
      else if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        this.logger.warn(`Stopped polling ${job.id}: timeout. Use reconcile to check again.`);
      }
    });
  }

  async enqueue(job: ChainJob, delayMs = 0): Promise<void> {
    const attempts = Math.max(1, Math.ceil(this.config.txPollTimeoutMs / this.config.txPollIntervalMs));
    await this.queue.add(`${job.kind}`, job, {
      // Deterministic id: enqueuing the same transaction twice is a no-op.
      jobId: `${job.kind}-${job.id}`,
      delay: delayMs,
      attempts,
      backoff: { type: 'fixed', delay: this.config.txPollIntervalMs },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  async close() {
    await this.worker?.close();
    await this.queue.close();
    await Promise.all(this.connections.map((c) => c.quit().catch(() => undefined)));
  }

  async onApplicationShutdown() {
    await this.close();
  }
}
