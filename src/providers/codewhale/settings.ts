import { getProviderConfig } from '../../core/providers/providerConfig';

export interface CodewhaleProviderSettings {
  cliPath: string;
  port: number;
  authToken: string;
  model: string;
  mode: string;
  effort: string;
  skillsDir: string;
  customModels: string;
  environmentVariables: string;
}

export const DEFAULT_CODEWHALE_PROVIDER_SETTINGS: Readonly<CodewhaleProviderSettings> = Object.freeze({
  cliPath: 'codewhale',
  port: 7878,
  authToken: '',
  model: 'glm-5.2',
  mode: 'yolo',
  effort: 'high',
  skillsDir: '',
  customModels: '',
  environmentVariables: '',
});

export function getCodewhaleProviderSettings(
  settings: Record<string, unknown>,
): CodewhaleProviderSettings {
  const config = getProviderConfig(settings, 'codewhale');

  return {
    cliPath: (config.cliPath as string | undefined)
      ?? (settings.codewhaleCliPath as string | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.cliPath,
    port: (config.port as number | undefined)
      ?? (settings.codewhalePort as number | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.port,
    authToken: (config.authToken as string | undefined)
      ?? (settings.codewhaleAuthToken as string | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.authToken,
    model: (config.model as string | undefined)
      ?? (settings.model as string | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.model,
    mode: (config.mode as string | undefined)
      ?? (settings.mode as string | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.mode,
    effort: (config.effort as string | undefined)
      ?? (settings.effort as string | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.effort,
    skillsDir: (config.skillsDir as string | undefined)
      ?? (settings.codewhaleSkillsDir as string | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.skillsDir,
    customModels: (config.customModels as string | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.customModels,
    environmentVariables: (config.environmentVariables as string | undefined)
      ?? DEFAULT_CODEWHALE_PROVIDER_SETTINGS.environmentVariables,
  };
}