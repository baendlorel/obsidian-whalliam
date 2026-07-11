import {
  WHALLIAM_SETTINGS_PATH,
  LEGACY_WHALLIAM_SETTINGS_PATH,
} from '../../core/bootstrap/StoragePaths';
import {
  normalizeHiddenCommandList,
  normalizeHiddenProviderCommands,
} from '../../core/providers/commands/hiddenCommands';
import { setProviderConfig } from '../../core/providers/providerConfig';
import {
  getSharedEnvironmentVariables,
  inferEnvironmentSnippetScope,
  resolveEnvironmentSnippetScope,
} from '../../core/providers/providerEnvironment';
import type { VaultFileAdapter } from '../../core/storage/VaultFileAdapter';
import {
  CHAT_VIEW_PLACEMENTS,
  type ChatViewPlacement,
  type WhalliamSettings,
  type EnvironmentScope,
  type EnvSnippet,
  type HiddenProviderCommands,
  type ProviderConfigMap,
} from '../../core/types/settings';
import { getCodewhaleProviderSettings } from '../../providers/codewhale/settings';
import { DEFAULT_WHALLIAM_SETTINGS } from './defaultSettings';

export {
  WHALLIAM_SETTINGS_PATH,
  LEGACY_WHALLIAM_SETTINGS_PATH,
};

export type StoredWhalliamSettings = WhalliamSettings;

const LEGACY_STRIPPED_SETTING_FIELDS = [
  'activeConversationId',
  'show1MModel',
  'hiddenSlashCommands',
  'slashCommands',
  'allowExternalAccess',
  'allowedExportPaths',
  'enableBlocklist',
  'blockedCommands',
  'openInMainTab',
] as const;

function stripLegacyFields(settings: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...settings };
  for (const key of LEGACY_STRIPPED_SETTING_FIELDS) {
    delete cleaned[key];
  }
  return cleaned;
}

function isChatViewPlacement(value: unknown): value is ChatViewPlacement {
  return typeof value === 'string'
    && (CHAT_VIEW_PLACEMENTS as readonly string[]).includes(value);
}

function normalizeChatViewPlacement(
  value: unknown,
  legacyOpenInMainTab: unknown,
): ChatViewPlacement {
  if (isChatViewPlacement(value)) {
    return value;
  }

  if (typeof legacyOpenInMainTab === 'boolean') {
    return legacyOpenInMainTab ? 'main-tab' : 'right-sidebar';
  }

  return DEFAULT_WHALLIAM_SETTINGS.chatViewPlacement;
}

function normalizeProviderConfigs(value: unknown): ProviderConfigMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: ProviderConfigMap = {};
  for (const [providerId, config] of Object.entries(value as Record<string, unknown>)) {
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      result[providerId] = { ...(config as Record<string, unknown>) };
    }
  }
  return result;
}

function normalizeContextLimits(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' && Number.isFinite(entry) && entry > 0) {
      result[key] = entry;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeModelAliases(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, alias] of Object.entries(value)) {
    if (typeof alias !== 'string') {
      continue;
    }

    const modelId = key.trim();
    const normalizedAlias = alias.trim();
    if (modelId && normalizedAlias) {
      result[modelId] = normalizedAlias;
    }
  }

  return result;
}

function normalizeEnvSnippets(value: unknown): EnvSnippet[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const snippets: EnvSnippet[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string'
      || typeof candidate.name !== 'string'
      || typeof candidate.description !== 'string'
      || typeof candidate.envVars !== 'string'
    ) {
      continue;
    }

    const modelAliases = 'modelAliases' in candidate
      ? normalizeModelAliases(candidate.modelAliases)
      : undefined;

    snippets.push({
      id: candidate.id,
      name: candidate.name,
      description: candidate.description,
      envVars: candidate.envVars,
      scope: resolveEnvironmentSnippetScope(
        candidate.envVars,
        isEnvironmentScope(candidate.scope)
          ? candidate.scope
          : inferEnvironmentSnippetScope(candidate.envVars),
      ),
      contextLimits: normalizeContextLimits(candidate.contextLimits),
      modelAliases,
    });
  }

  return snippets;
}

function isEnvironmentScope(value: unknown): value is EnvironmentScope {
  return value === 'shared' || (typeof value === 'string' && value.startsWith('provider:'));
}

export class WhalliamSettingsStorage {
  constructor(private adapter: VaultFileAdapter) {}

  async load(): Promise<StoredWhalliamSettings> {
    const settingsPath = await this.getLoadPath();
    if (!settingsPath) {
      return this.getDefaults();
    }

    const content = await this.adapter.read(settingsPath);
    const stored = JSON.parse(content) as Record<string, unknown>;
    const hiddenProviderCommands = normalizeHiddenProviderCommands(stored.hiddenProviderCommands);
    const envSnippets = normalizeEnvSnippets(stored.envSnippets);
    const customModelAliases = normalizeModelAliases(stored.customModelAliases);
    const providerConfigs = normalizeProviderConfigs(stored.providerConfigs);
    const chatViewPlacement = normalizeChatViewPlacement(
      stored.chatViewPlacement,
      stored.openInMainTab,
    );

    const legacyNormalized = {
      ...stored,
      sharedEnvironmentVariables: getSharedEnvironmentVariables(
        stored as Record<string, unknown>,
      ),
      envSnippets,
      customModelAliases,
      hiddenProviderCommands,
      providerConfigs,
      chatViewPlacement,
    };

    const merged = {
      ...this.getDefaults(),
      ...legacyNormalized,
    };

    await this.save(merged);

    return merged;
  }

  async save(settings: StoredWhalliamSettings): Promise<void> {
    const content = JSON.stringify(
      stripLegacyFields({
        ...settings,
      }),
      null,
      2,
    );
    await this.adapter.write(WHALLIAM_SETTINGS_PATH, content);
    await this.deleteLegacyFileIfPresent();
  }

  async exists(): Promise<boolean> {
    if (await this.adapter.exists(WHALLIAM_SETTINGS_PATH)) {
      return true;
    }

    return this.adapter.exists(LEGACY_WHALLIAM_SETTINGS_PATH);
  }

  async update(updates: Partial<StoredWhalliamSettings>): Promise<void> {
    const current = await this.load();
    await this.save({ ...current, ...updates });
  }

  async setLastModel(model: string, _isCustom: boolean): Promise<void> {
    const current = await this.load();
    current.model = model;
    await this.save(current);
  }

  async setLastEnvHash(_hash: string): Promise<void> {
    // No-op for codewhale
  }

  private getDefaults(): StoredWhalliamSettings {
    return DEFAULT_WHALLIAM_SETTINGS;
  }

  private async getLoadPath(): Promise<string | null> {
    if (await this.adapter.exists(WHALLIAM_SETTINGS_PATH)) {
      return WHALLIAM_SETTINGS_PATH;
    }

    if (await this.adapter.exists(LEGACY_WHALLIAM_SETTINGS_PATH)) {
      return LEGACY_WHALLIAM_SETTINGS_PATH;
    }

    return null;
  }

  private async deleteLegacyFileIfPresent(): Promise<void> {
    if (await this.adapter.exists(LEGACY_WHALLIAM_SETTINGS_PATH)) {
      await this.adapter.delete(LEGACY_WHALLIAM_SETTINGS_PATH);
    }
  }
}