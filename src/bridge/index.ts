import { runtimeBase, SERVER_BOOT_TIMEOUT_MS, SERVER_POLL_INTERVAL_MS } from '../consts.js';
import type { RuntimeEvent, ThreadDetail, ThreadInfo, TurnInfo, WhalliamSettings } from '../types.js';
import { HttpClient } from './http-client.js';
import { ProcessManager } from './process-manager.js';
import type { ProcessEvents } from './types.js';

export interface BridgeOptions {
  getSettings: () => WhalliamSettings;
  events?: ProcessEvents;
}

/** Unified facade over process management and the HTTP runtime API. */
export class CodeWhaleBridge {
  private readonly getSettings: () => WhalliamSettings;
  readonly process: ProcessManager;
  readonly client: HttpClient;

  constructor(opts: BridgeOptions) {
    this.getSettings = opts.getSettings;
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
    }
    throw new Error('CodeWhale server did not become healthy in time');
  }

  async stop(): Promise<void> {
    await this.process.stop();
  }

  createThread(): Promise<ThreadInfo> {
    const s = this.getSettings();
    return this.client.createThread({ mode: s.mode, model: s.model });
  }

  sendTurn(threadId: string, prompt: string): Promise<TurnInfo> {
    return this.client.sendTurn(threadId, prompt);
  }

  getThread(threadId: string): Promise<ThreadDetail> {
    return this.client.getThread(threadId);
  }

  events(threadId: string, signal: AbortSignal): AsyncGenerator<RuntimeEvent> {
    return this.client.events(threadId, signal);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
