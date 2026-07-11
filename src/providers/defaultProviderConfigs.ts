import type { ProviderConfigMap } from '../core/types/settings';
import { DEFAULT_CODEWHALE_PROVIDER_SETTINGS } from './codewhale/settings';

export function getBuiltInProviderDefaultConfigs(): ProviderConfigMap {
  return {
    codewhale: { ...DEFAULT_CODEWHALE_PROVIDER_SETTINGS },
  };
}

export { DEFAULT_CODEWHALE_PROVIDER_SETTINGS };