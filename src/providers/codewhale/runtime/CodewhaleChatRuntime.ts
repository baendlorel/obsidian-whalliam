import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import type WhalliamPlugin from '../../../main';
import { getVaultPath } from '../../../utils/path';
import { getCodewhaleProviderSettings } from '../settings';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type { ProviderCapabilities } from '../../../core/providers/types';
import type {
  ChatMessage,
  Conversation,
  SlashCommand,
  StreamChunk,
  ToolCallInfo,
  UsageInfo,
} from '../../../core/types';
import type {
  ApprovalCallback,
  AskUserQuestionCallback,
  AutoTurnCallback,
  ChatRewindMode,
  ChatRewindResult,
  ChatRuntimeConversationState,
  ChatRuntimeEnsureReadyOptions,
  ChatRuntimeQueryOptions,
  ChatTurnMetadata,
  ChatTurnRequest,
  ExitPlanModeCallback,
  PreparedChatTurn,
  SessionUpdateResult,
  SubagentRuntimeState,
} from '../../../core/runtime/types';

// ---- Types for CodeWhale HTTP API ----

interface CodeWhaleThread {
  id: string;
  workspace: string;
  mode: string;
  model: string;
  allow_shell: boolean;
  trust_mode: boolean;
  auto_approve: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  latest_turn_id?: string;
}

interface CodeWhaleTurn {
  id: string;
  thread_id: string;
  status: string;
  input_summary: string;
  error?: string;
  item_ids: string[];
  created_at: string;
}

interface CodeWhaleEvent {
  seq: number;
  event: string;
  kind: string;
  thread_id: string;
  turn_id: string | null;
  item_id: string | null;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ---- Constants ----

const ORIGIN_FALLBACK = 'app://obsidian.md';
const MAX_LOG_LINES = 60;
const STDIO = ['ignore', 'pipe', 'pipe'] as const;
const BOOT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 400;

// ---- Helpers ----

function getSelfOrigin(): string {
  try {
    const { origin } = window.location;
    return origin && origin !== 'null' ? origin : ORIGIN_FALLBACK;
  } catch {
    return ORIGIN_FALLBACK;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- CodewhaleChatRuntime ----

export class CodewhaleChatRuntime implements ChatRuntime {
  readonly providerId = 'codewhale' as const;

  private plugin: WhalliamPlugin;
  private httpBase: string = '';
  private authToken: string = '';
  private threadId: string | null = null;
  private ready = false;

  // Process management
  private proc: ChildProcess | null = null;
  private alive = false;
  private logLines: string[] = [];

  // Stream control
  private abortController: AbortController | null = null;

  // Turn metadata
  private turnMetadata: ChatTurnMetadata = {};

  // Callbacks
  private approvalCallback: ApprovalCallback | null = null;
  private askUserCallback: AskUserQuestionCallback | null = null;
  private exitPlanModeCallback: ExitPlanModeCallback | null = null;

  constructor(plugin: WhalliamPlugin) {
    this.plugin = plugin;
    const s = getCodewhaleProviderSettings(plugin.settings as Record<string, unknown>);
    this.httpBase = `http://127.0.0.1:${s.port}`;
    this.authToken = s.authToken;
  }

  // ---- Capabilities ----

  getCapabilities(): Readonly<ProviderCapabilities> {
    return {
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
  }

  // ---- Turn Preparation ----

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn {
    const text = request.text ?? '';
    return {
      request,
      persistedContent: text,
      prompt: text,
      isCompact: false,
      mcpMentions: new Set(),
    };
  }

  // ---- Ready State ----

  onReadyStateChange(_listener: (ready: boolean) => void): () => void {
    return () => {};
  }

  setResumeCheckpoint(_checkpointId: string | undefined): void {}

  syncConversationState(conversation: ChatRuntimeConversationState | null, _externalContextPaths?: string[]): void {
    if (conversation?.sessionId) {
      this.threadId = conversation.sessionId;
    }
  }

  async reloadMcpServers(): Promise<void> {}

  async ensureReady(_options?: ChatRuntimeEnsureReadyOptions): Promise<boolean> {
    try {
      await this.ensureServer();
      this.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  // ---- Query ----

  async *query(
    turn: PreparedChatTurn,
    conversationHistory?: ChatMessage[],
    _queryOptions?: ChatRuntimeQueryOptions,
  ): AsyncGenerator<StreamChunk> {
    this.turnMetadata = { wasSent: false };

    await this.ensureServer();

    if (!this.threadId) {
      const thread = await this.createThread();
      this.threadId = thread.id;
    }

    // Emit user_message_start
    yield {
      type: 'user_message_start',
      content: turn.prompt,
    };

    // Send the turn
    const codewhaleTurn = await this.sendTurn(this.threadId, turn.prompt);
    this.turnMetadata.wasSent = true;
    this.turnMetadata.userMessageId = codewhaleTurn.id;

    // Emit assistant_message_start
    yield { type: 'assistant_message_start' };

    // Stream events
    const currentTurnId = codewhaleTurn.id;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const eventStream = this.streamEvents(this.threadId, signal, currentTurnId);
      for await (const chunk of eventStream) {
        yield chunk;
        if (chunk.type === 'done') {
          this.abortController.abort();
          break;
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        yield { type: 'done' };
        return;
      }
      yield {
        type: 'error',
        content: err instanceof Error ? err.message : String(err),
      };
    }
  }

  cancel(): void {
    this.abortController?.abort();
    this.threadId = null;
  }

  resetSession(): void {
    this.threadId = null;
  }

  getSessionId(): string | null {
    return this.threadId;
  }

  consumeSessionInvalidation(): boolean {
    return false;
  }

  async getSupportedCommands(): Promise<SlashCommand[]> {
    return [];
  }

  /** Count skills loaded from the skills directory. */
  getSkillCount(): number {
    try {
      const s = getCodewhaleProviderSettings(this.plugin.settings as Record<string, unknown>);
      let skillsDir = s.skillsDir.trim();
      if (!skillsDir) {
        const home = process.env.USERPROFILE || process.env.HOME || '';
        skillsDir = `${home}/.codewhale/skills`;
      }
      if (!existsSync(skillsDir)) return 0;
      return readdirSync(skillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .length;
    } catch {
      return 0;
    }
  }

  getAuxiliaryModel(): string | null {
    const count = this.getSkillCount();
    return count > 0 ? `Skills: ${count} loaded` : null;
  }

  cleanup(): void {
    this.cancel();
  }

  // ---- Rewind ----

  async rewind(
    _userMessageId: string,
    _assistantMessageId: string | undefined,
    _mode?: ChatRewindMode,
  ): Promise<ChatRewindResult> {
    return { canRewind: false };
  }

  // ---- Callbacks ----

  setApprovalCallback(callback: ApprovalCallback | null): void {
    this.approvalCallback = callback;
  }

  setApprovalDismisser(_dismisser: (() => void) | null): void {}

  setAskUserQuestionCallback(callback: AskUserQuestionCallback | null): void {
    this.askUserCallback = callback;
  }

  setExitPlanModeCallback(callback: ExitPlanModeCallback | null): void {
    this.exitPlanModeCallback = callback;
  }

  setPermissionModeSyncCallback(_callback: ((sdkMode: string) => void) | null): void {}

  setSubagentHookProvider(_getState: () => SubagentRuntimeState): void {}

  setAutoTurnCallback(_callback: AutoTurnCallback | null): void {}

  consumeTurnMetadata(): ChatTurnMetadata {
    const meta = { ...this.turnMetadata };
    this.turnMetadata = {};
    return meta;
  }

  // ---- Session Updates ----

  buildSessionUpdates(params: { conversation: Conversation | null; sessionInvalidated: boolean }): SessionUpdateResult {
    const updates: Partial<Conversation> = {};
    if (this.threadId) {
      updates.sessionId = this.threadId;
    }
    if (params.sessionInvalidated) {
      updates.sessionId = null;
    }
    return { updates };
  }

  resolveSessionIdForFork(_conversation: Conversation | null): string | null {
    return this.threadId;
  }

  // ---- HTTP Client ----

  private get headers(): Record<string, string> {
    const token = this.authToken.trim();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.httpBase}${path}`;
    const hasBody = init?.body != null;
    return fetch(url, {
      ...init,
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...this.headers,
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });
  }

  private async createThread(): Promise<CodeWhaleThread> {
    const s = getCodewhaleProviderSettings(this.plugin.settings as Record<string, unknown>);
    const workspace = getVaultPath(this.plugin.app);
    const body: Record<string, unknown> = {};
    // Essential: allow shell execution so skills can run scripts (liuyao, etc.)
    body.allow_shell = true;
    // YOLO mode: auto-approve tool calls so agent doesn't block on permission
    body.auto_approve = this.plugin.settings.permissionMode === 'yolo';
    if (s.mode) body.mode = s.mode;
    if (s.model) body.model = s.model;
    if (s.effort) body.effort = s.effort;
    if (workspace) body.workspace = workspace;
    // Pass system prompt from plugin settings (custom instructions, skills reference, etc.)
    const systemPrompt = (this.plugin.settings as Record<string, unknown>).systemPrompt as string;
    if (systemPrompt?.trim()) {
      body.system_prompt = systemPrompt.trim();
    }

    const res = await this.apiFetch('/v1/threads', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as CodeWhaleThread;
  }

  private async sendTurn(threadId: string, prompt: string): Promise<CodeWhaleTurn> {
    const res = await this.apiFetch(`/v1/threads/${threadId}/turns`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { turn: CodeWhaleTurn };
    return data.turn;
  }

  private async *streamEvents(
    threadId: string,
    signal: AbortSignal,
    currentTurnId: string,
  ): AsyncGenerator<StreamChunk> {
    const res = await this.apiFetch(`/v1/threads/${threadId}/events`, {
      signal,
      headers: { Accept: 'text/event-stream' },
    } as RequestInit);
    if (!res.ok || !res.body) {
      throw new Error(`events HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          yield { type: 'done' };
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let sep = buffer.indexOf('\n\n');
        while (sep >= 0) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const evt = this.parseEvent(raw);
          if (evt) {
            const chunks = this.mapEventToChunks(evt, currentTurnId);
            for (const chunk of chunks) {
              yield chunk;
            }
          }
          sep = buffer.indexOf('\n\n');
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseEvent(raw: string): CodeWhaleEvent | null {
    const dataLines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length === 0) return null;
    try {
      return JSON.parse(dataLines.join('\n')) as CodeWhaleEvent;
    } catch {
      return null;
    }
  }

  private mapEventToChunks(evt: CodeWhaleEvent, currentTurnId: string): StreamChunk[] {
    const chunks: StreamChunk[] = [];
    const { event, payload } = evt;

    // Only emit done for the current turn, not historical ones from SSE replay
    const isCurrentTurn = evt.turn_id === currentTurnId;

    // Skip events from other turns (SSE history replay)
    if (evt.turn_id != null && evt.turn_id !== currentTurnId) {
      return chunks;
    }

    switch (event) {
      case 'item.started': {
        const item = (payload.item as Record<string, unknown>) ?? payload;
        const itemKind = ((item.kind as string) ?? '').toLowerCase();
        if (itemKind === 'tool_call' || itemKind === 'command_execution' || itemKind === 'file_change') {
          const toolName = (item.tool_name as string) ?? (item.summary as string)?.split('(')[0] ?? itemKind;
          chunks.push({
            type: 'tool_use',
            id: (item.id as string) ?? evt.item_id!,
            name: toolName,
            input: (item.input as Record<string, unknown>) ?? (item.detail as Record<string, unknown>) ?? {},
          });
        }
        break;
      }

      case 'item.completed': {
        const item = (payload.item as Record<string, unknown>) ?? payload;
        const itemKind = ((item.kind as string) ?? '').toLowerCase();
        if (itemKind === 'tool_call' || itemKind === 'command_execution' || itemKind === 'file_change') {
          chunks.push({
            type: 'tool_result',
            id: (item.id as string) ?? evt.item_id!,
            content: (item.summary as string) ?? (item.result as string) ?? '',
          });
        }
        break;
      }

      case 'item.failed':
      case 'item.interrupted': {
        const item = (payload.item as Record<string, unknown>) ?? payload;
        chunks.push({
          type: 'tool_result',
          id: (item.id as string) ?? evt.item_id!,
          content: `Failed: ${(item.error as string) ?? (payload.detail as string) ?? 'unknown error'}`,
        });
        break;
      }

      case 'tool_call': {
        const item = payload.item as Record<string, unknown> | undefined;
        if (item) {
          chunks.push({
            type: 'tool_use',
            id: (item.id as string) ?? evt.item_id!,
            name: (item.summary as string)?.split('(')[0] ?? 'unknown',
            input: (item.detail as Record<string, unknown> | undefined) ?? {},
          });
        }
        break;
      }

      case 'item.delta': {
        const kind = (payload.kind as string) ?? '';
        const delta = (payload.delta as string) ?? '';
        if (kind === 'agent_reasoning' || kind === 'thinking' || kind === 'reasoning') {
          chunks.push({ type: 'thinking', content: delta });
        } else if (kind === 'agent_message' || kind === 'text') {
          chunks.push({ type: 'text', content: delta });
        } else if (kind === 'tool_output') {
          chunks.push({ type: 'tool_output', id: evt.item_id!, content: delta });
        }
        break;
      }

      case 'tool_result': {
        const item = payload.item as Record<string, unknown> | undefined;
        if (item) {
          chunks.push({
            type: 'tool_result',
            id: (item.id as string) ?? '',
            content: (item.summary as string) ?? (item.detail as string) ?? '',
          });
        }
        break;
      }

      case 'context_compacted': {
        chunks.push({ type: 'context_compacted' });
        break;
      }

      case 'turn.completed': {
        if (isCurrentTurn) {
          chunks.push({ type: 'done' });
        }
        break;
      }

      case 'turn.status': {
        if (isCurrentTurn) {
          const status = (payload.status as string) ?? '';
          if (status === 'completed' || status === 'failed') {
            chunks.push({ type: 'done' });
          }
          if (status === 'failed') {
            chunks.push({
              type: 'error',
              content: (payload.error as string) ?? 'Turn failed',
            });
          }
        }
        break;
      }

      case 'turn.failed':
      case 'error': {
        chunks.push({
          type: 'error',
          content: (payload.detail as string) ?? (payload.error as string) ?? 'Unknown error',
        });
        chunks.push({ type: 'done' });
        break;
      }
    }

    // Context usage
    if (payload.context_usage !== undefined) {
      const pct = (payload.context_usage as number) ?? 0;
      const usage: UsageInfo = {
        inputTokens: 0,
        contextWindow: 131072,
        contextTokens: Math.round(pct * 1310.72),
        percentage: pct,
      };
      chunks.push({ type: 'usage', usage });
    }

    return chunks;
  }

  // ---- Process Management ----

  private async ensureServer(): Promise<void> {
    const s = getCodewhaleProviderSettings(this.plugin.settings as Record<string, unknown>);
    this.httpBase = `http://127.0.0.1:${s.port}`;
    this.authToken = s.authToken;

    try {
      const res = await fetch(`${this.httpBase}/v1/config`, { headers: this.headers });
      if (res.ok) return;
    } catch {
      // Server not running, start it
    }

    if (!this.alive) {
      this.startProcess(s.cliPath, s.port, s.authToken);
    }

    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      try {
        const res = await fetch(`${this.httpBase}/v1/config`, { headers: this.headers });
        if (res.ok) return;
      } catch {
        // Still starting
      }
      if (!this.alive) {
        const log = this.logLines.join('').trim();
        throw new Error(`CodeWhale exited before becoming ready.${log ? `\n${log}` : ''}`);
      }
    }
    throw new Error('CodeWhale server did not become healthy in time');
  }

  private startProcess(cliPath: string, port: number, token: string): ChildProcess {
    const s = getCodewhaleProviderSettings(this.plugin.settings as Record<string, unknown>);
    this.logLines.length = 0;
    const origin = getSelfOrigin();
    const serverArgs = ['app-server', '--http', '--port', String(port), '--cors-origin', origin];
    if (token.trim()) {
      serverArgs.push('--auth-token', token.trim());
    } else {
      serverArgs.push('--insecure-no-auth');
    }
    // Inject skills directory for skill discovery (liuyao, etc.)
    let skillsDir = s.skillsDir.trim();
    if (!skillsDir) {
      // Auto-detect: %USERPROFILE%\.codewhale\skills on Windows, ~/.codewhale/skills on Linux
      const home = process.env.USERPROFILE || process.env.HOME || '';
      if (home) {
        skillsDir = `${home}/.codewhale/skills`;
      }
    }
    if (skillsDir) {
      serverArgs.push('--skills-dir', skillsDir);
    }

    const isWin = process.platform === 'win32';
    let proc: ChildProcess;

    const spawnEnv = { ...process.env };
    if (skillsDir) {
      spawnEnv.CODEWHALE_HOME = skillsDir;
    }

    if (isWin) {
      proc = spawn(cliPath, serverArgs, {
        shell: true, stdio: STDIO as any, windowsHide: true,
        env: spawnEnv,
      });
    } else {
      const resolved = this.resolveBinary(cliPath);
      if (resolved.startsWith('/')) {
        proc = spawn(resolved, serverArgs, { stdio: STDIO, env: spawnEnv } as any);
      } else {
        const cmdLine = [
          '[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" 2>/dev/null;',
          '[ -s "$HOME/.cargo/env" ] && . "$HOME/.cargo/env" 2>/dev/null;',
          `exec '${cliPath.replace(/'/g, "'\\''")}' `,
          serverArgs.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' '),
        ].join(' ');
        proc = spawn('bash', ['-c', cmdLine], { stdio: STDIO, env: spawnEnv } as any);
      }
    }

    this.proc = proc;
    this.alive = true;

    proc.on('error', (err) => {
      this.alive = false;
      this.logLines.push(`[spawn error] ${err.message}\n`);
    });
    proc.on('exit', (code, signal) => {
      this.alive = false;
      this.proc = null;
    });
    const onChunk = (chunk: Buffer) => {
      const text = chunk.toString();
      this.logLines.push(text);
      if (this.logLines.length > MAX_LOG_LINES) this.logLines.shift();
    };
    proc.stderr?.on('data', onChunk);
    proc.stdout?.on('data', onChunk);

    return proc;
  }

  private resolveBinary(cliPath: string): string {
    if (cliPath.startsWith('/') || process.platform === 'win32') return cliPath;
    try {
      const out = execSync(`command -v '${cliPath.replace(/'/g, "'\\''")}'`, {
        encoding: 'utf-8',
        timeout: 8000,
        stdio: ['ignore', 'pipe', 'ignore'],
        shell: 'bash',
      });
      const [resolved = ''] = out.trim().split('\n');
      if (resolved.startsWith('/')) return resolved;
    } catch {
      /* fall through */
    }
    return cliPath;
  }
}
