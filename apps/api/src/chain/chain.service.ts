import { Inject, Injectable } from '@nestjs/common';
import type { ChainId, ExecutionMode } from '@veyra/core';
import {
  AdapterRegistry,
  ChainAdapterError,
  SimulatedAdapter,
  type ChainAdapter,
  type ChainCapabilities,
} from '@veyra/chain-adapter';
import { createStarknetAdapter } from '@veyra/starknet-adapter';
import { APP_CONFIG, type AppConfig } from '../config.js';

export interface NetworkOption {
  chain: ChainId;
  network: string;
  executionModes: ExecutionMode[];
}

/** Builds and caches chain adapters from server configuration. */
@Injectable()
export class ChainService {
  readonly registry = new AdapterRegistry();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    if (config.enableSimulatedChain) {
      this.registry.register('simulated', (key) => new SimulatedAdapter({ network: key.network }));
    }
    if (Object.keys(config.starknetRpc).length > 0) {
      this.registry.register('starknet', (key) => {
        const rpcUrl = config.starknetRpc[key.network];
        if (!rpcUrl) throw new ChainAdapterError('UNSUPPORTED', `Starknet network ${key.network} is not configured on this server`);
        if (key.executionMode === 'strk20-private' && !config.enableStrk20) {
          throw new ChainAdapterError('UNSUPPORTED', 'STRK20 private execution is disabled on this server');
        }
        return createStarknetAdapter(key.executionMode, { network: key.network, rpcUrl });
      });
    }
  }

  adapter(org: { chain: string; network: string; executionMode: string }): ChainAdapter {
    return this.registry.get({
      chain: org.chain as ChainId,
      network: org.network,
      executionMode: org.executionMode as ExecutionMode,
    });
  }

  capabilities(org: { chain: string; network: string; executionMode: string }): ChainCapabilities {
    return this.adapter(org).getCapabilities();
  }

  /** Networks and execution modes this server can serve. */
  networks(): NetworkOption[] {
    const out: NetworkOption[] = [];
    if (this.config.enableSimulatedChain) out.push({ chain: 'simulated', network: 'local', executionModes: ['simulated'] });
    for (const network of Object.keys(this.config.starknetRpc)) {
      const modes: ExecutionMode[] = ['vault'];
      if (this.config.enableStrk20 && network !== 'devnet') modes.push('strk20-private');
      out.push({ chain: 'starknet', network, executionModes: modes });
    }
    return out;
  }

  assertSupported(chain: ChainId, network: string, mode: ExecutionMode): void {
    const ok = this.networks().some((n) => n.chain === chain && n.network === network && n.executionModes.includes(mode));
    if (!ok) throw new ChainAdapterError('UNSUPPORTED', `${chain}/${network} with mode ${mode} is not available on this server`);
  }
}
