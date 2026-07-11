import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
import { CHAT_VIEW_TYPE, DEFAULT_SETTINGS } from './consts.js';
import { t } from './i18n/index.js';
import { CodeWhaleBridge } from './bridge/index.js';
import { ChatView } from './views/chat-view.js';
import { WhalliamSettingTab } from './settings.js';
import type { WhalliamSettings } from './types.js';

export default class WhalliamPlugin extends Plugin {
  settings: WhalliamSettings = DEFAULT_SETTINGS;
  bridge!: CodeWhaleBridge;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.bridge = new CodeWhaleBridge({
      getSettings: () => this.settings,
      events: {
        onStderr: (line) => console.debug('[whalliam]', line),
        onError: (err) => console.error('[whalliam] process error', err),
      },
    });

    this.addSettingTab(new WhalliamSettingTab(this));
    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));

    this.addRibbonIcon('bot', t('Whalliam'), () => void this.openChat());
    this.addCommand({
      id: 'open-chat',
      name: t('打开 Whalliam 聊天面板'),
      callback: () => void this.openChat(),
    });

    if (this.settings.autoStart) {
      this.bridge.ensureServer().catch((err) => {
        new Notice(`${t('连接失败，请检查设置')}: ${err instanceof Error ? err.message : err}`);
      });
    }
  }

  async onunload(): Promise<void> {
    await this.bridge.stop();
  }

  async openChat(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(CHAT_VIEW_TYPE);
    let leaf: WorkspaceLeaf | null = existing.length > 0 ? existing[0] : null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) {
        return;
      }
      await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<WhalliamSettings>;
    this.settings = { ...DEFAULT_SETTINGS, ...data };
    // Guard against a persisted empty model (older default) that providers reject.
    if (!this.settings.model.trim()) {
      this.settings.model = DEFAULT_SETTINGS.model;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
