import type { ProviderConfig, ProviderId } from './core';
import { PROVIDERS } from './core';

const KEY = 'collab_ai_provider_v1';

export function loadProviderConfig(): ProviderConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ProviderConfig;
    if (!p || !PROVIDERS.some((x) => x.id === (p.provider as ProviderId))) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProviderConfig(cfg: ProviderConfig | null) {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
    else localStorage.removeItem(KEY);
  } catch {}
}
