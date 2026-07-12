// Must run before any SDK imports to patch Electron/Node.js realm incompatibility
import { patchSetMaxListenersForElectron } from './utils/electronCompat';
patchSetMaxListenersForElectron();

import './providers';

import type { Editor, WorkspaceLeaf } from 'obsidian';
import { MarkdownView, Notice, Plugin } from 'obsidian';

import { DEFAULT_WHALLIAM_SETTINGS } from './app/settings/defaultSettings';
import { SharedStorageService } from './app/storage/SharedStorageService';
import type { SharedAppStorage } from './core/bootstrap/storage';
import {
  normalizeProviderModelSelection,
  resolveConversationModel,
} from './core/providers/conversationModel';
import {
  getEnvironmentVariablesForScope as getScopedEnvironmentVariables,
  getRuntimeEnvironmentText,
  setEnvironmentVariablesForScope,
} from './core/providers/providerEnvironment';
import { ProviderRegistry } from './core/providers/ProviderRegistry';
import { ProviderSettingsCoordinator } from './core/providers/ProviderSettingsCoordinator';
import { ProviderWorkspaceRegistry } from './core/providers/ProviderWorkspaceRegistry';
import type {
  ProviderCliResolutionContext,
  ProviderConversationSessionAvailability,
  ProviderId,
} from './core/providers/types';
import type { AppTabManagerState } from './core/providers/types';
import { DEFAULT_CHAT_PROVIDER_ID } from './core/providers/types';
import type {
  WhalliamSettings,
  Conversation,
  ConversationMeta,
} from './core/types';
import {
  VIEW_TYPE_WHALLIAM,
} from './core/types';
import type { ChatViewPlacement, EnvironmentScope } from './core/types/settings';
import { WhalliamView } from './features/chat/WhalliamView';
import { type InlineEditContext, InlineEditModal } from './features/inline-edit/ui/InlineEditModal';
import { WhalliamSettingTab } from './features/settings/WhalliamSettings';
import { setLocale } from './i18n/i18n';
import type { Locale } from './i18n/types';
import { extractUserDisplayContent } from './utils/context';
import { buildCursorContext } from './utils/editor';
import { revealWorkspaceLeaf } from './utils/obsidianCompat';
import { getVaultPath } from './utils/path';

function isWhalliamView(value: unknown): value is WhalliamView {
  return !!value
    && typeof value === 'object'
    && typeof (value as { getTabManager?: unknown }).getTabManager === 'function';
}

export default class WhalliamPlugin extends Plugin {
  settings!: WhalliamSettings;
  storage!: SharedAppStorage;
  private conversations: Conversation[] = [];
  private lastKnownTabManagerState: AppTabManagerState | null = null;

  async onload() {
    await this.loadSettings();
    await ProviderWorkspaceRegistry.initializeAll(this);

    this.registerView(
      VIEW_TYPE_WHALLIAM,
      (leaf) => new WhalliamView(leaf, this)
    );

    this.addRibbonIcon('bot', 'Open Whalliam', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open-view',
      name: 'Open chat view',
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: 'inline-edit',
      name: 'Inline edit',
      editorCallback: async (editor: Editor, ctx) => {
        const view = ctx instanceof MarkdownView
          ? ctx
          : this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
          new Notice('Inline edit unavailable: could not access the active Markdown view.');
          return;
        }

        const selectedText = editor.getSelection();
        const notePath = view.file?.path || 'unknown';

        let editContext: InlineEditContext;
        if (selectedText.trim()) {
          editContext = { mode: 'selection', selectedText };
        } else {
          const cursor = editor.getCursor();
          const cursorContext = buildCursorContext(
            (line) => editor.getLine(line),
            editor.lineCount(),
            cursor.line,
            cursor.ch
          );
          editContext = { mode: 'cursor', cursorContext };
        }

        const modal = new InlineEditModal(
          this.app,
          this,
          editor,
          view,
          editContext,
          notePath,
          () => this.getView()?.getActiveTab()?.ui.externalContextSelector?.getExternalContexts() ?? []
        );
        const result = await modal.openAndWait();

        if (result.decision === 'accept' && result.editedText !== undefined) {
          new Notice(editContext.mode === 'cursor' ? 'Inserted' : 'Edit applied');
        }
      },
    });

    this.addCommand({
      id: 'new-tab',
      name: 'New tab',
      checkCallback: (checking: boolean) => {
        if (!this.canCreateNewTab()) return false;

        if (!checking) {
          void this.openNewTab();
        }
        return true;
      },
    });

    this.addCommand({
      id: 'new-session',
      name: 'New session (in current tab)',
      checkCallback: (checking: boolean) => {
        const view = this.getView();
        if (!view) return false;

        const tabManager = view.getTabManager();
        if (!tabManager) return false;

        const activeTab = tabManager.getActiveTab();
        if (!activeTab) return false;

        if (activeTab.state.isStreaming) return false;

        if (!checking) {
          void tabManager.createNewConversation();
        }
        return true;
      },
    });

    this.addCommand({
      id: 'close-current-tab',
      name: 'Close current tab',
      checkCallback: (checking: boolean) => {
        const view = this.getView();
        if (!view) return false;

        const tabManager = view.getTabManager();
        if (!tabManager) return false;

        if (!checking) {
          const activeTabId = tabManager.getActiveTabId();
          if (activeTabId) {
            void tabManager.closeTab(activeTabId);
          }
        }
        return true;
      },
    });

    this.addSettingTab(new WhalliamSettingTab(this.app, this));
  }

  onunload(): void {
    void this.persistOpenTabStates();
  }

  private async persistOpenTabStates(): Promise<void> {
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (tabManager) {
        const state = tabManager.getPersistedState();
        await this.persistTabManagerState(state);
      }
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_WHALLIAM)[0];

    if (!leaf) {
      const newLeaf = this.getLeafForPlacement(this.settings.chatViewPlacement);
      if (newLeaf) {
        await newLeaf.setViewState({
          type: VIEW_TYPE_WHALLIAM,
          active: true,
        });
        leaf = newLeaf;
      }
    }

    if (leaf) {
      await revealWorkspaceLeaf(workspace, leaf);
    }
  }

  private getLeafForPlacement(placement: ChatViewPlacement): WorkspaceLeaf | null {
    const { workspace } = this.app;
    switch (placement) {
      case 'main-tab':
        return workspace.getLeaf('tab');
      case 'left-sidebar':
        return workspace.getLeftLeaf(false);
      case 'right-sidebar':
        return workspace.getRightLeaf(false);
    }
  }

  private canCreateNewTab(): boolean {
    const hasLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_WHALLIAM).length > 0;
    const view = this.getView();
    const tabManager = view?.getTabManager();

    if (tabManager) {
      return tabManager.canCreateTab();
    }

    if (hasLeaf) {
      return false;
    }

    return this.getLastKnownOpenTabCount() < this.getMaxTabsLimit();
  }

  private async ensureViewOpen(): Promise<WhalliamView | null> {
    const existingView = this.getView();
    if (existingView) {
      return existingView;
    }

    await this.activateView();
    return this.getView();
  }

  private async openNewTab(): Promise<void> {
    const existingView = this.getView();
    if (existingView) {
      await existingView.createNewTab();
      return;
    }

    const restoredTabCount = this.getLastKnownOpenTabCount();
    const view = await this.ensureViewOpen();
    if (!view) {
      return;
    }

    if (restoredTabCount === 0) {
      return;
    }

    await view.createNewTab();
  }

  async loadSettings() {
    this.storage = new SharedStorageService(this);
    const { whalliam } = await this.storage.initialize();
    this.lastKnownTabManagerState = await this.storage.getTabManagerState();

    this.settings = {
      ...DEFAULT_WHALLIAM_SETTINGS,
      ...whalliam,
    };

    if (this.settings.permissionMode === 'plan') {
      this.settings.permissionMode = 'normal';
    }

    const didNormalizeProviderSelection = ProviderSettingsCoordinator.normalizeProviderSelection(
      this.settings,
    );
    const didNormalizeModelVariants = this.normalizeModelVariantSettings();

    const allMetadata = await this.storage.sessions.listMetadata();
    this.conversations = allMetadata.map(meta => {
      const resumeSessionId = meta.sessionId !== undefined ? meta.sessionId : meta.id;

      return {
        id: meta.id,
        providerId: meta.providerId ?? DEFAULT_CHAT_PROVIDER_ID,
        title: meta.title,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        lastResponseAt: meta.lastResponseAt,
        sessionId: resumeSessionId,
        selectedModel: meta.selectedModel,
        providerState: meta.providerState,
        messages: [],
        currentNote: meta.currentNote,
        externalContextPaths: meta.externalContextPaths,
        enabledMcpServers: meta.enabledMcpServers,
        usage: meta.usage,
        titleGenerationStatus: meta.titleGenerationStatus,
        resumeAtMessageId: meta.resumeAtMessageId,
      };
    }).sort(
      (a, b) => (b.lastResponseAt ?? b.updatedAt) - (a.lastResponseAt ?? a.updatedAt)
    );
    setLocale(this.settings.locale as Locale);

    const backfilledConversations = this.backfillConversationResponseTimestamps();

    ProviderSettingsCoordinator.projectActiveProviderState(
      this.settings,
    );

    if (didNormalizeModelVariants || didNormalizeProviderSelection) {
      await this.saveSettings();
    }

    const conversationsToSave = new Set([...backfilledConversations]);
    for (const conv of conversationsToSave) {
      await this.storage.sessions.saveMetadata(
        this.storage.sessions.toSessionMetadata(conv)
      );
    }
  }

  async saveSettings() {
    ProviderSettingsCoordinator.normalizeProviderSelection(
      this.settings,
    );
    ProviderSettingsCoordinator.persistProjectedProviderState(
      this.settings,
    );

    await this.storage.saveWhalliamSettings(this.settings);
  }

  async applyEnvironmentVariables(scope: EnvironmentScope, envText: string): Promise<void> {
    await this.applyEnvironmentVariablesBatch([{ scope, envText }]);
  }

  async applyEnvironmentVariablesBatch(
    updates: Array<{ scope: EnvironmentScope; envText: string }>,
  ): Promise<void> {
    const settingsBag = this.settings as unknown as Record<string, unknown>;
    for (const update of updates) {
      setEnvironmentVariablesForScope(settingsBag, update.scope, update.envText);
    }

    await this.saveSettings();
    new Notice('Environment variables applied.');
  }

  getActiveEnvironmentVariables(
    providerId: ProviderId = ProviderRegistry.resolveSettingsProviderId(
      this.settings,
    ),
  ): string {
    return getRuntimeEnvironmentText(
      this.settings,
      providerId,
    );
  }

  getEnvironmentVariablesForScope(scope: EnvironmentScope): string {
    return getScopedEnvironmentVariables(
      this.settings,
      scope,
    );
  }

  getResolvedProviderCliPath(
    providerId: ProviderId,
    context?: ProviderCliResolutionContext,
  ): string | null {
    const cliResolver = ProviderWorkspaceRegistry.getCliResolver(providerId);
    if (!cliResolver) {
      return null;
    }

    return cliResolver.resolveFromSettings(this.settings, context);
  }

  normalizeModelVariantSettings(): boolean {
    return ProviderSettingsCoordinator.normalizeAllModelVariants(
      this.settings,
    );
  }

  // ---- View management ----

  getView(): WhalliamView | null {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_WHALLIAM)) {
      if (leaf.view && isWhalliamView(leaf.view)) {
        return leaf.view;
      }
    }
    return null;
  }

  getAllViews(): WhalliamView[] {
    const views: WhalliamView[] = [];
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_WHALLIAM)) {
      if (leaf.view && isWhalliamView(leaf.view)) {
        views.push(leaf.view);
      }
    }
    return views;
  }

  // ---- Conversation management ----

  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateDefaultTitle(): string {
    const now = new Date();
    return now.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getConversationSync(id: string): Conversation | null {
    return this.conversations.find(c => c.id === id) ?? null;
  }

  getConversationById(id: string): Conversation | null {
    return this.conversations.find(c => c.id === id) ?? null;
  }

  getConversationList(): Conversation[] {
    return [...this.conversations];
  }

  findConversationAcrossViews(conversationId: string): { view: WhalliamView; tabId: string } | null {
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      const tabs = tabManager.getAllTabs();
      for (const tab of tabs) {
        if (tab.conversationId === conversationId) {
          return { view, tabId: tab.id };
        }
      }
    }
    return null;
  }

  async createConversation(options?: {
    providerId?: ProviderId;
    sessionId?: string;
    selectedModel?: string;
  }): Promise<Conversation> {
    const providerId = options?.providerId ?? DEFAULT_CHAT_PROVIDER_ID;
    const sessionId = options?.sessionId;
    const conversationId = sessionId ?? this.generateConversationId();
    const conversation: Conversation = {
      id: conversationId,
      providerId,
      title: this.generateDefaultTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: sessionId ?? null,
      selectedModel: options?.selectedModel,
      messages: [],
    };

    this.conversations.unshift(conversation);
    await this.storage.sessions.saveMetadata(
      this.storage.sessions.toSessionMetadata(conversation)
    );

    return conversation;
  }

  async switchConversation(id: string): Promise<Conversation | null> {
    const conversation = this.conversations.find(c => c.id === id);
    if (!conversation) return null;

    return conversation;
  }

  async renameConversation(
    id: string,
    title: string,
  ): Promise<void> {
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    conv.title = title;
    conv.updatedAt = Date.now();
    await this.storage.sessions.saveMetadata(
      this.storage.sessions.toSessionMetadata(conv)
    );
  }

  async handleMissingProviderSession(
    id: string,
    _missingProviderSessionId?: string,
  ): Promise<'deleted' | 'reset' | 'preserved' | 'not_found'> {
    const conv = this.conversations.find(item => item.id === id);
    if (!conv) return 'not_found';
    return 'preserved';
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
    conversation?: Conversation,
  ): Promise<void> {
    const conv = conversation ?? this.conversations.find(c => c.id === id);
    if (!conv) return;

    Object.assign(conv, updates);
    conv.updatedAt = Date.now();

    await this.storage.sessions.saveMetadata(
      this.storage.sessions.toSessionMetadata(conv)
    );
  }

  async deleteConversation(
    id: string,
    _options: { deleteProviderSession?: boolean } = {},
  ): Promise<void> {
    const index = this.conversations.findIndex(c => c.id === id);
    if (index === -1) return;

    this.conversations.splice(index, 1);
    await this.storage.sessions.deleteMetadata(id);

    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      for (const tab of tabManager.getAllTabs()) {
        if (tab.conversationId === id) {
          tab.controllers.inputController?.cancelStreaming();
          await tab.controllers.conversationController?.createNew({ force: true });
        }
      }
    }
  }

  // ---- Tab manager state ----

  async persistTabManagerState(state: AppTabManagerState): Promise<void> {
    this.lastKnownTabManagerState = state;
    await this.storage.setTabManagerState(state);
  }

  getLastKnownOpenTabCount(): number {
    return this.lastKnownTabManagerState?.openTabs?.length ?? 0;
  }

  getMaxTabsLimit(): number {
    return this.settings.maxTabs ?? 3;
  }

  private backfillConversationResponseTimestamps(): Conversation[] {
    const updated: Conversation[] = [];
    for (const conv of this.conversations) {
      if (conv.lastResponseAt != null) continue;
      if (!conv.messages || conv.messages.length === 0) continue;

      for (let i = conv.messages.length - 1; i >= 0; i--) {
        const msg = conv.messages[i];
        if (msg.role === 'assistant') {
          conv.lastResponseAt = msg.timestamp;
          updated.push(conv);
          break;
        }
      }
    }
    return updated;
  }
}