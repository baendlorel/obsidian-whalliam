import { ProviderRegistry } from '../core/providers/ProviderRegistry';
import { ProviderWorkspaceRegistry } from '../core/providers/ProviderWorkspaceRegistry';
import { codewhaleWorkspaceRegistration } from './codewhale/app/CodewhaleWorkspaceServices';
import { codewhaleProviderRegistration } from './codewhale/registration';

let builtInProvidersRegistered = false;

export function registerBuiltInProviders(): void {
  if (builtInProvidersRegistered) {
    return;
  }

  ProviderRegistry.register('codewhale', codewhaleProviderRegistration);
  ProviderWorkspaceRegistry.register('codewhale', codewhaleWorkspaceRegistration);
  builtInProvidersRegistered = true;
}

registerBuiltInProviders();