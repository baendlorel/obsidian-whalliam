import { PluginSettingTab, Setting } from 'obsidian';
import type WhalliamPlugin from './main.js';
import { t } from './i18n/index.js';

export class WhalliamSettingTab extends PluginSettingTab {
  private readonly plugin: WhalliamPlugin;

  constructor(plugin: WhalliamPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t('CodeWhale CLI 路径'))
      .setDesc(t('`codewhale` 命令名或可执行文件的完整路径。'))
      .addText((text) =>
        text
          .setPlaceholder('codewhale')
          .setValue(this.plugin.settings.cliPath)
          .onChange(async (value) => {
            this.plugin.settings.cliPath = value.trim() || 'codewhale';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t('app-server HTTP 端口'))
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.port))
          .onChange(async (value) => {
            const n = Number(value);
            if (n > 0 && n < 65536) {
              this.plugin.settings.port = n;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl).setName(t('认证令牌（留空则不启用鉴权）')).addText((text) =>
      text.setValue(this.plugin.settings.authToken).onChange(async (value) => {
        this.plugin.settings.authToken = value;
        await this.plugin.saveSettings();
      }),
    );

    new Setting(containerEl).setName(t('模型（留空则继承服务端配置）')).addText((text) =>
      text.setValue(this.plugin.settings.model).onChange(async (value) => {
        this.plugin.settings.model = value.trim();
        await this.plugin.saveSettings();
      }),
    );

    new Setting(containerEl).setName(t('工作模式')).addDropdown((dd) =>
      dd
        .addOption('agent', 'agent')
        .addOption('plan', 'plan')
        .setValue(this.plugin.settings.mode)
        .onChange(async (value) => {
          this.plugin.settings.mode = value;
          await this.plugin.saveSettings();
        }),
    );

    new Setting(containerEl).setName(t('推理力度')).addDropdown((dd) =>
      dd
        .addOption('low', t('低'))
        .addOption('medium', t('中'))
        .addOption('high', t('高'))
        .addOption('max', t('最高'))
        .setValue(this.plugin.settings.effort)
        .onChange(async (value) => {
          this.plugin.settings.effort = value;
          await this.plugin.saveSettings();
        }),
    );

    new Setting(containerEl).setName(t('加载时自动启动 CodeWhale 服务')).addToggle((tg) =>
      tg.setValue(this.plugin.settings.autoStart).onChange(async (value) => {
        this.plugin.settings.autoStart = value;
        await this.plugin.saveSettings();
      }),
    );
  }
}
