import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { RPC_URL_DEFAULT } from './constants.js';

/**
 * Resolve the Sui RPC URL.
 * Browser: read `import.meta.env.VITE_SUI_RPC_URL` if Vite injected it.
 * Node:    read `process.env.SUI_RPC_URL`.
 * Either:  fall back to mainnet fullnode.
 */
export function rpcUrl(): string {
  // Vite-injected env (browser).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viteEnv = (import.meta as any)?.env;
  if (viteEnv?.VITE_SUI_RPC_URL) return viteEnv.VITE_SUI_RPC_URL as string;

  // Node env.
  if (typeof process !== 'undefined' && process.env?.SUI_RPC_URL) {
    return process.env.SUI_RPC_URL;
  }

  return RPC_URL_DEFAULT ?? getFullnodeUrl('mainnet');
}

let _client: SuiClient | null = null;

/** Lazy singleton. Use `makeClient(url)` if you need a custom URL. */
export function getClient(): SuiClient {
  if (!_client) _client = new SuiClient({ url: rpcUrl() });
  return _client;
}

export function makeClient(url: string): SuiClient {
  return new SuiClient({ url });
}
