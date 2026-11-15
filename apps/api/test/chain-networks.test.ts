import { describe, expect, it } from 'vitest';
import { ChainService } from '../src/chain/chain.service.js';
import type { AppConfig } from '../src/config.js';

const service = (over: Partial<AppConfig>) =>
  new ChainService({
    enableSimulatedChain: false,
    enableStrk20: true,
    enableMainnetVault: false,
    starknetRpc: { sepolia: 'https://sepolia.example', mainnet: 'https://mainnet.example' },
    ...over,
  } as AppConfig);

describe('ChainService.networks', () => {
  it('keeps the unaudited vault off mainnet by default', () => {
    const nets = service({}).networks();
    expect(nets.find((n) => n.network === 'mainnet')?.executionModes).toEqual(['wallet', 'strk20-private']);
    expect(nets.find((n) => n.network === 'sepolia')?.executionModes).toEqual(['wallet', 'vault', 'strk20-private']);
  });

  it('offers the vault on mainnet when explicitly enabled', () => {
    const mainnet = service({ enableMainnetVault: true }).networks().find((n) => n.network === 'mainnet');
    expect(mainnet?.executionModes).toContain('vault');
  });
});
