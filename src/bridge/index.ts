import { runtimeBase, SERVER_BOOT_TIMEOUT_MS, SERVER_POLL_INTERVAL_MS } from '../consts.js';
import type { RuntimeEvent, ThreadDetail, ThreadInfo, TurnInfo, WhalliamSettings } from '../types.js';
import { HttpClient } from './http-client.js';
import { ProcessManager } from './process-manager.js';
import type { ProcessEvents } from './types.js';

export interface BridgeOptions {
  getSettings: () => WhalliamSettings;
  /** Vault root directory to pass as the thread workspace. */
  getWorkspace?: () => string;
  events?: ProcessEvents;
}

/** Unified facade over process management and the HTTP runtime API. */
export class CodeWhaleBridge {
  private readonly getSettings: () => WhalliamSettings;
  private readonly getWorkspace: (() => string) | undefined;
  readonly process: ProcessManager;
  readonly client: HttpClient;

  constructor(opts: BridgeOptions) {
    this.getSettings = opts.getSettings;
    this.getWorkspace = opts.getWorkspace;
    this.process = new ProcessManager(opts.events ?? {});
    this.client = new HttpClient(
      () => runtimeBase(this.getSettings().port),
      () => this.getSettings().authToken.trim(),
    );
  }

  get running(): boolean {
    return this.process.running;
  }

  /** Start the child process (if needed) and wait for the HTTP API to respond. */
  async ensureServer(): Promise<void> {
    if (await this.client.health()) {
      return;
    }
    if (!this.process.running) {
      this.process.start(this.getSettings());
    }
    const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(SERVER_POLL_INTERVAL_MS);
      if (await this.client.health()) {
        return;
      }
      if (!this.process.running) {
        const log = this.process.recentLog().trim();
        throw new Error(
          `CodeWhale exited (code ${this.process.exitCode}) before becoming ready.${log ? `\n${log}` : ''}`,
        );
      }
    }
    throw new Error('CodeWhale server did not become healthy in time');
  }

  async stop(): Promise<void> {
    await this.process.stop();
  }

  createThread(): Promise<ThreadInfo> {
    const s = this.getSettings();
    const workspace = this.getWorkspace?.();
    return this.client.createThread({ mode: s.mode, model: s.model, effort: s.effort, workspace });
  }

  sendTurn(threadId: string, prompt: string): Promise<TurnInfo> {
    return this.client.sendTurn(threadId, prompt);
  }

  getThread(threadId: string): Promise<ThreadDetail> {
    return this.client.getThread(threadId);
  }

  listThreads(opts?: { archived?: boolean }): Promise<ThreadInfo[]> {
    return this.client.listThreads(opts);
  }

  events(threadId: string, signal: AbortSignal): AsyncGenerator<RuntimeEvent> {
    return this.client.events(threadId, signal);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
