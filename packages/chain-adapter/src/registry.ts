import type { ChainId, ExecutionMode } from '@veyra/core';
import { ChainAdapterError, type ChainAdapter } from './types';

export interface AdapterKey {
  chain: ChainId;
  network: string;
  executionMode: ExecutionMode;
}

export type AdapterFactory = (key: AdapterKey) => ChainAdapter;

/**
 * Resolves the adapter for an organisation's chain configuration. Adapters are
 * created once per (chain, network, mode) and reused.
 */
export class AdapterRegistry {
  private readonly factories = new Map<ChainId, AdapterFactory>();
  private readonly instances = new Map<string, ChainAdapter>();

  register(chain: ChainId, factory: AdapterFactory): this {
    this.factories.set(chain, factory);
    return this;
  }

  supports(chain: ChainId): boolean {
    return this.factories.has(chain);
  }

  get(key: AdapterKey): ChainAdapter {
    const id = `${key.chain}:${key.network}:${key.executionMode}`;
    const cached = this.instances.get(id);
    if (cached) return cached;
    const factory = this.factories.get(key.chain);
    if (!factory) throw new ChainAdapterError('UNSUPPORTED', `Chain ${key.chain} is not enabled on this server`);
    const adapter = factory(key);
    const caps = adapter.getCapabilities();
    if (caps.executionMode !== key.executionMode) {
      throw new ChainAdapterError('UNSUPPORTED', `Chain ${key.chain} does not support execution mode ${key.executionMode}`);
    }
    this.instances.set(id, adapter);
    return adapter;
  }
}
