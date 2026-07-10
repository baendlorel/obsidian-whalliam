import { spawn, type ChildProcess } from 'node:child_process';
import type { WhalliamSettings } from '../types.js';
import type { ProcessEvents } from './types.js';

/**
 * Owns the lifetime of a `codewhale app-server --http` child process.
 *
 * `shell: true` is used so that a bare `codewhale` command resolves through the
 * user's PATH; the only arguments ever passed are static server flags, so there
 * is no injection surface.
 */
export class ProcessManager {
  private proc: ChildProcess | null = null;
  private alive = false;
  private readonly events: ProcessEvents;

  constructor(events: ProcessEvents = {}) {
    this.events = events;
  }

  get running(): boolean {
    return this.alive;
  }

  start(settings: WhalliamSettings): ChildProcess {
    if (this.proc) {
      return this.proc;
    }
    const args = ['app-server', '--http', '--port', String(settings.port)];
    if (settings.authToken.trim()) {
      args.push('--auth-token', settings.authToken.trim());
    } else {
      args.push('--insecure-no-auth');
    }

    const proc = spawn(settings.cliPath, args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.proc = proc;
    this.alive = true;

    proc.on('error', (err: Error) => {
      this.alive = false;
      this.events.onError?.(err);
    });
    proc.on('exit', (code, signal) => {
      this.alive = false;
      this.proc = null;
      this.events.onExit?.(code, signal);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      this.events.onStderr?.(chunk.toString());
    });
    return proc;
  }

  /** Gracefully terminate the process, escalating to SIGKILL after 3s. */
  async stop(): Promise<void> {
    const { proc } = this;
    if (!proc) {
      this.alive = false;
      return;
    }
    this.proc = null;
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      proc.once('exit', finish);
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
        finish();
      }, 3000);
    });
  }
}
