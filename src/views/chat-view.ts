import { ItemView, MarkdownRenderer, type TFile, type WorkspaceLeaf } from 'obsidian';
import { CHAT_VIEW_TYPE, MAX_STREAM_RECONNECTS, STREAM_RECONNECT_MS } from '../consts.js';
import { t } from '../i18n/index.js';
import { dtm, escapeHtml } from '../utils.js';
import type { RuntimeEvent, ThreadItem } from '../types.js';
import type WhalliamPlugin from '../main.js';

type ConnState = 'off' | 'busy' | 'on' | 'error';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class ChatView extends ItemView {
  private readonly plugin: WhalliamPlugin;

  private threadId: string | null = null;
  private abortCtl: AbortController | null = null;
  private busy = false;
  private sendBtn!: HTMLButtonElement;

  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private statusDotEl!: HTMLElement;
  private statusTextEl!: HTMLElement;
  private contextBar!: HTMLElement;
  private contextFile: TFile | null = null;
  private contextActive = true;

  private assistantEl: HTMLElement | null = null;
  private assistantBody: HTMLElement | null = null;
  private assistantThinking = false;
  private assistantBuffer = '';
  private renderTimer: number | null = null;
  private reasoningEl: HTMLElement | null = null;
  private reasoningBody: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: WhalliamPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t('Whalliam');
  }

  getIcon(): string {
    return 'bot';
  }

  async onOpen(): Promise<void> {
    this.buildUi();
    this.setConn('off');
    this.registerEvent(this.app.workspace.on('file-open', (file) => this.refreshContext(file)));
    this.refreshContext();
    void this.connect();
  }

  async onClose(): Promise<void> {
    this.abortCtl?.abort();
  }

  // ----- UI construction -----

  private buildUi(): void {
    const root = this.contentEl.createDiv({ cls: 'whalliam-chat' });

    const toolbar = root.createDiv({ cls: 'whalliam-toolbar' });
    const status = toolbar.createDiv({ cls: 'whalliam-status' });
    this.statusDotEl = status.createDiv({ cls: 'whalliam-status-dot' });
    this.statusTextEl = status.createDiv({ cls: 'whalliam-status-text' });

    toolbar.createEl('button', { cls: 'whalliam-btn', text: t('新建对话') }, (btn) => {
      btn.addEventListener('click', () => void this.newChat());
    });

    this.messagesEl = root.createDiv({ cls: 'whalliam-messages' });
    this.showWelcome();

    this.contextBar = root.createDiv({ cls: 'whalliam-context-bar' });

    const composer = root.createDiv({ cls: 'whalliam-composer' });
    this.inputEl = composer.createEl('textarea', {
      cls: 'whalliam-input',
      attr: { rows: '2', placeholder: t('输入消息，Enter 发送，Shift+Enter 换行') },
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void this.sendMessage();
      }
    });

    this.sendBtn = composer.createEl('button', { cls: 'whalliam-send', text: t('发送') });
    this.sendBtn.addEventListener('click', () => this.onSendClick());
  }

  private showWelcome(): void {
    this.messagesEl.empty();
    this.messagesEl.createDiv({ cls: 'whalliam-welcome', text: t('Whalliam') });
  }

  // ----- connection -----

  private async connect(): Promise<void> {
    this.setConn('busy', t('正在启动服务…'));
    try {
      await this.plugin.bridge.ensureServer();
      if (!this.threadId) {
        this.threadId = (await this.plugin.bridge.createThread()).id;
      }
      this.setConn('on', t('已连接'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.setConn('error', msg.split('\n')[0]?.slice(0, 100) ?? t('连接失败，请检查设置'));
      console.error('[whalliam] connect failed', e);
    }
  }

  private async newChat(): Promise<void> {
    this.abortCtl?.abort();
    this.threadId = null;
    this.assistantEl = null;
    this.assistantBody = null;
    this.showWelcome();
    await this.connect();
  }

  private setConn(state: ConnState, text?: string): void {
    const defaults: Record<ConnState, string> = {
      off: t('未连接'),
      busy: '',
      on: t('已连接'),
      error: '',
    };
    this.statusDotEl.removeClass('is-off', 'is-busy', 'is-on', 'is-error');
    this.statusDotEl.addClass(`is-${state}`);
    this.statusTextEl.setText(text ?? defaults[state]);
  }

  // ----- sending -----

  private async sendMessage(): Promise<void> {
    if (this.busy) {
      return;
    }
    const text = this.inputEl.value.trim();
    if (!text) {
      return;
    }
    this.inputEl.value = '';
    this.appendUser(text);
    this.setBusy(true);

    try {
      await this.plugin.bridge.ensureServer();
      if (!this.threadId) {
        this.threadId = (await this.plugin.bridge.createThread()).id;
      }
      const prompt = await this.withNoteContext(text);
      const turn = await this.plugin.bridge.sendTurn(this.threadId, prompt);
      await this.streamTurn(turn.id);
    } catch (e) {
      this.appendError(e instanceof Error ? e.message : String(e));
    } finally {
      this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.inputEl.disabled = busy;
    this.sendBtn.setText(busy ? t('中止') : t('发送'));
  }

  /** Send button acts as send when idle, abort when busy. */
  private onSendClick(): void {
    if (this.busy) {
      this.abortCtl?.abort();
    } else {
      void this.sendMessage();
    }
  }

  /** Prepend the active note's content as context when its badge is active. */
  private async withNoteContext(message: string): Promise<string> {
    if (!this.contextActive || !this.contextFile) {
      return message;
    }
    const content = await this.app.vault.read(this.contextFile);
    if (!content.trim()) {
      return message;
    }
    return `<context file="${this.contextFile.path}">\n${content}\n</context>\n\n${message}`;
  }

  // ----- context badge -----

  private refreshContext(file?: TFile | null): void {
    const f = file !== undefined ? file : this.app.workspace.getActiveFile();
    this.contextFile = f && f.extension === 'md' ? f : null;
    this.renderContextBadge();
  }

  private renderContextBadge(): void {
    this.contextBar.empty();
    if (!this.contextFile) {
      return;
    }
    const badge = this.contextBar.createEl('span', { cls: 'whalliam-badge' });
    if (this.contextActive) {
      badge.addClass('is-active');
    }
    badge.createEl('span', { cls: 'whalliam-badge-icon', text: '📄' });
    badge.createEl('span', { cls: 'whalliam-badge-name', text: this.contextFile.basename });
    badge.title = this.contextActive ? t('点击取消上下文') : t('点击添加为上下文');
    badge.addEventListener('click', () => this.toggleContext());
  }

  private toggleContext(): void {
    this.contextActive = !this.contextActive;
    this.renderContextBadge();
  }

  /** Subscribe to the event stream and render events for the given turn. */
  private async streamTurn(turnId: string): Promise<void> {
    this.abortCtl?.abort();
    const ctl = new AbortController();
    this.abortCtl = ctl;
    this.startAssistant();

    const rendered = new Set<string>();
    let lastSeq = 0;
    let completed = false;
    try {
      for (let attempt = 0; attempt < MAX_STREAM_RECONNECTS && !completed; attempt += 1) {
        if (!this.threadId) {
          throw new Error('no active thread');
        }
        for await (const evt of this.plugin.bridge.events(this.threadId, ctl.signal)) {
          if (evt.seq <= lastSeq) {
            continue; // skip replayed events after a reconnect
          }
          lastSeq = evt.seq;
          await this.handleEvent(evt, turnId, rendered);
          if (evt.kind === 'turn.completed' && evt.turn_id === turnId) {
            completed = true;
            break;
          }
        }
        if (!completed && attempt < MAX_STREAM_RECONNECTS - 1) {
          console.warn('[whalliam] event stream ended early; reconnecting…');
          await sleep(STREAM_RECONNECT_MS);
        }
      }
      if (!completed) {
        this.appendError(t('响应超时，请重试'));
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        this.appendError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      ctl.abort();
      this.finishAssistant();
    }
  }

  private async handleEvent(evt: RuntimeEvent, turnId: string, rendered: Set<string>): Promise<void> {
    if (evt.turn_id && evt.turn_id !== turnId) {
      return; // ignore replayed history from earlier turns
    }
    const { kind } = evt;
    if (kind === 'item.started') {
      const { item } = evt.payload;
      if (item?.kind === 'agent_reasoning') {
        this.startReasoning();
      }
    } else if (kind === 'item.delta') {
      const { delta, kind: dk } = evt.payload;
      if (delta) {
        if (dk === 'agent_reasoning') {
          this.appendReasoning(delta);
        } else if (dk === 'agent_message') {
          this.appendAssistantDelta(delta);
        }
      }
    } else if (kind === 'item.completed' || kind === 'item.failed') {
      const { item } = evt.payload;
      if (item && !rendered.has(item.id)) {
        rendered.add(item.id);
        await this.renderItem(item);
      }
    }
  }

  // ----- rendering -----

  private appendUser(text: string): void {
    const row = this.messagesEl.createDiv({ cls: 'whalliam-msg is-user' });
    row.createDiv({ cls: 'whalliam-meta', text: `${t('你')} · ${dtm(Date.now())}` });
    row.createDiv({ cls: 'whalliam-bubble' }).innerHTML = `<p>${escapeHtml(text)}</p>`;
    this.clearWelcome();
    this.scrollToBottom();
  }

  private startAssistant(): void {
    this.reasoningEl = null;
    this.reasoningBody = null;
    this.assistantBuffer = '';
    this.cancelRender();
    this.assistantEl = this.messagesEl.createDiv({ cls: 'whalliam-msg is-assistant' });
    this.assistantEl.createDiv({ cls: 'whalliam-meta', text: `${t('助手')} · ${dtm(Date.now())}` });
    this.assistantBody = this.assistantEl.createDiv({ cls: 'whalliam-bubble markdown-rendered' });
    this.assistantThinking = true;
    this.assistantBody.createDiv({ cls: 'whalliam-thinking', text: `${t('正在思考')}…` });
    this.clearWelcome();
    this.scrollToBottom();
  }

  /** Create a collapsible reasoning panel above the reply bubble. */
  private startReasoning(): void {
    if (this.reasoningEl || !this.assistantEl || !this.assistantBody) {
      return;
    }
    const el = document.createElement('div');
    el.className = 'whalliam-reasoning';
    this.assistantEl.insertBefore(el, this.assistantBody);
    this.reasoningEl = el;
    const head = el.createDiv({ cls: 'whalliam-reasoning-head', text: `💭 ${t('思考过程')}` });
    head.addEventListener('click', () => this.toggleReasoning());
    this.reasoningBody = el.createDiv({ cls: 'whalliam-reasoning-body' });
    this.scrollToBottom();
  }

  private appendReasoning(delta: string): void {
    if (this.reasoningBody) {
      this.reasoningBody.appendText(delta);
      this.scrollToBottom();
    }
  }

  private appendAssistantDelta(delta: string): void {
    if (!this.assistantBody) {
      return;
    }
    if (this.assistantThinking) {
      this.assistantBody.empty();
      this.assistantThinking = false;
    }
    this.assistantBuffer += delta;
    this.scheduleRender();
  }

  /** Throttled re-render of the accumulated buffer as Markdown. */
  private scheduleRender(): void {
    if (this.renderTimer !== null) {
      return;
    }
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.renderAssistantBuffer();
    }, 600);
  }

  private cancelRender(): void {
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  private async renderAssistantBuffer(): Promise<void> {
    if (!this.assistantBody) {
      return;
    }
    this.assistantBody.empty();
    if (this.assistantBuffer) {
      await MarkdownRenderer.render(this.app, this.assistantBuffer, this.assistantBody, '', this);
    }
    this.scrollToBottom();
  }

  private toggleReasoning(): void {
    const el = this.reasoningEl;
    if (el) {
      el.toggleClass('is-collapsed', !el.hasClass('is-collapsed'));
    }
  }

  private finishAssistant(): void {
    if (this.reasoningEl) {
      this.reasoningEl.addClass('is-done');
    }
    if (this.assistantThinking && this.assistantBody) {
      // turn ended with no assistant text
      this.assistantBody.empty();
      this.assistantBody.createDiv({ cls: 'whalliam-muted', text: '—' });
    }
    this.cancelRender();
    this.assistantBuffer = '';
    this.assistantEl = null;
    this.assistantBody = null;
    this.reasoningEl = null;
    this.reasoningBody = null;
    this.assistantThinking = false;
    this.scrollToBottom();
  }

  private async renderItem(item: ThreadItem): Promise<void> {
    switch (item.kind) {
      case 'user_message':
        return; // already rendered via appendUser
      case 'agent_reasoning':
        return; // already streamed via item.delta
      case 'agent_message': {
        if (this.assistantBody) {
          this.assistantBuffer = item.detail || item.summary;
          this.assistantThinking = false;
          this.cancelRender();
          await this.renderAssistantBuffer();
        }
        break;
      }
      case 'tool_call':
      case 'tool_result': {
        const card = this.messagesEl.createDiv({ cls: 'whalliam-tool' });
        card.createDiv({ cls: 'whalliam-tool-label', text: `${t('工具调用')} · ${item.kind}` });
        card.createDiv({ cls: 'whalliam-tool-body', text: item.summary || item.detail });
        break;
      }
      case 'error': {
        this.appendError(item.detail || item.summary);
        break;
      }
      default: {
        if (item.summary) {
          this.messagesEl.createDiv({ cls: 'whalliam-muted', text: item.summary });
        }
      }
    }
    this.scrollToBottom();
  }

  private appendError(message: string): void {
    const row = this.messagesEl.createDiv({ cls: 'whalliam-msg is-error' });
    row.createDiv({ cls: 'whalliam-bubble', text: `${t('发生错误')}: ${message}` });
    this.scrollToBottom();
  }

  private clearWelcome(): void {
    this.messagesEl.querySelector('.whalliam-welcome')?.remove();
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
