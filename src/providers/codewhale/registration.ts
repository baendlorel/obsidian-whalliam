import type {
  ProviderCapabilities,
  ProviderChatUIConfig,
  ProviderRegistration,
  ProviderUIOption,
  ProviderReasoningOption,
  ProviderSettingsReconciler,
  ProviderConversationHistoryService,
  ProviderTaskResultInterpreter,
  ProviderTaskTerminalStatus,
  TitleGenerationService,
  TitleGenerationCallback,
  InstructionRefineService,
  InlineEditService,
  InlineEditRequest,
  InlineEditResult,
  RefineProgressCallback,
} from '../../core/providers/types';
import type { Conversation, InstructionRefineResult } from '../../core/types';
import { CodewhaleChatRuntime } from './runtime/CodewhaleChatRuntime';

const CODEWHALE_CAPABILITIES: ProviderCapabilities = {
  providerId: 'codewhale',
  supportsPersistentRuntime: true,
  supportsNativeHistory: true,
  supportsPlanMode: false,
  supportsRewind: false,
  supportsFork: false,
  supportsProviderCommands: false,
  supportsImageAttachments: false,
  supportsInstructionMode: false,
  supportsMcpTools: false,
  supportsTurnSteer: false,
  reasoningControl: 'effort',
};

const REASONING_OPTIONS: ProviderReasoningOption[] = [
  { value: 'low', label: 'Low', description: 'Minimal reasoning' },
  { value: 'medium', label: 'Medium', description: 'Balanced reasoning' },
  { value: 'high', label: 'High', description: 'Deep reasoning' },
  { value: 'max', label: 'Max', description: 'Maximum reasoning' },
];

const MODEL_OPTIONS: ProviderUIOption[] = [
  { value: 'glm-5.2', label: 'GLM 5.2', description: 'Default model' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: 'Advanced reasoning' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast model' },
];

const CODEWHALE_UI_CONFIG: ProviderChatUIConfig = {
  getModelOptions: () => MODEL_OPTIONS,
  getDefaultModel: () => 'glm-5.2',
  ownsModel: (model) => MODEL_OPTIONS.some(m => m.value === model),
  isAdaptiveReasoningModel: () => true,
  getReasoningOptions: () => REASONING_OPTIONS,
  getDefaultReasoningValue: () => 'high',
  getContextWindowSize: () => 131072,
  isDefaultModel: (model) => ['glm-5.2', 'deepseek-v4-pro', 'deepseek-v4-flash'].includes(model),
  applyModelDefaults: (model, settings) => {
    const s = settings as Record<string, unknown>;
    s.model = model;
  },
  normalizeModelVariant: (model) => model,
  getCustomModelIds: (_envVars) => new Set<string>(),
};

const CODEWHALE_SETTINGS_RECONCILER: ProviderSettingsReconciler = {
  reconcileModelWithEnvironment: (_settings, _conversations) => ({
    changed: false,
    invalidatedConversations: [],
  }),
  normalizeModelVariantSettings: () => false,
};

class CodewhaleConversationHistoryService implements ProviderConversationHistoryService {
  async hydrateConversationHistory(_conv: Conversation, _vaultPath: string | null): Promise<void> {}
  async deleteConversationSession(_conv: Conversation, _vaultPath: string | null): Promise<void> {}
  resolveSessionIdForConversation(conv: Conversation | null): string | null {
    return conv?.sessionId ?? null;
  }
  isPendingForkConversation(_conv: Conversation): boolean { return false; }
  buildForkProviderState(_sourceSessionId: string, _resumeAt: string, _sourceProviderState?: Record<string, unknown>): Record<string, unknown> {
    return {};
  }
}

class CodewhaleTaskResultInterpreter implements ProviderTaskResultInterpreter {
  hasAsyncLaunchMarker(_toolUseResult: unknown): boolean { return false; }
  extractAgentId(_toolUseResult: unknown): string | null { return null; }
  extractStructuredResult(_toolUseResult: unknown): string | null { return null; }
  resolveTerminalStatus(_toolUseResult: unknown, fallbackStatus: ProviderTaskTerminalStatus): ProviderTaskTerminalStatus { return fallbackStatus; }
  extractTagValue(_payload: string, _tagName: string): string | null { return null; }
}

class CodewhaleTitleGenerationService implements TitleGenerationService {
  async generateTitle(_conversationId: string, _userMessage: string, callback: TitleGenerationCallback): Promise<void> {
    await callback(_conversationId, { success: true, title: 'Chat' });
  }
  cancel(): void {}
}

class CodewhaleInstructionRefineService implements InstructionRefineService {
  resetConversation(): void {}
  async refineInstruction(
    _rawInstruction: string,
    _existingInstructions: string,
    _onProgress?: RefineProgressCallback,
  ): Promise<InstructionRefineResult> {
    return { success: false, error: 'Not implemented' };
  }
  async continueConversation(
    _message: string,
    _onProgress?: RefineProgressCallback,
  ): Promise<InstructionRefineResult> {
    return { success: false, error: 'Not implemented' };
  }
  cancel(): void {}
}

class CodewhaleInlineEditService implements InlineEditService {
  resetConversation(): void {}
  async editText(_request: InlineEditRequest): Promise<InlineEditResult> {
    return { success: false, error: 'Not implemented' };
  }
  async continueConversation(_message: string, _contextFiles?: string[]): Promise<InlineEditResult> {
    return { success: false, error: 'Not implemented' };
  }
  cancel(): void {}
}

export const codewhaleProviderRegistration: ProviderRegistration = {
  displayName: 'CodeWhale',
  blankTabOrder: 1,
  isEnabled: () => true,
  capabilities: CODEWHALE_CAPABILITIES,
  chatUIConfig: CODEWHALE_UI_CONFIG,
  settingsReconciler: CODEWHALE_SETTINGS_RECONCILER,
  createRuntime: ({ plugin }) => new CodewhaleChatRuntime(plugin),
  createTitleGenerationService: () => new CodewhaleTitleGenerationService(),
  createInstructionRefineService: () => new CodewhaleInstructionRefineService(),
  createInlineEditService: () => new CodewhaleInlineEditService(),
  historyService: new CodewhaleConversationHistoryService(),
  taskResultInterpreter: new CodewhaleTaskResultInterpreter(),
};