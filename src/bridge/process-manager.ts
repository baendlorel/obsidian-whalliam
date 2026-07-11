import { spawn, execSync, type ChildProcess } from 'node:child_process';
import type { WhalliamSettings } from '../types.js';
import type { ProcessEvents } from './types.js';

/** Fallback origin when the renderer origin cannot be determined. */
const SELF_ORIGIN_FALLBACK = 'app://obsidian.md';

/**
 * The renderer origin that will appear on the plugin's own fetch requests.
 * Passed to the server as `--cors-origin` so the browser CORS check passes.
 */
const getSelfOrigin = (): string => {
  const { origin } = window.location;
  return origin && origin !== 'null' ? origin : SELF_ORIGIN_FALLBACK;
};

const MAX_LOG_LINES = 60;
const STDIO: ['ignore', 'pipe', 'pipe'] = ['ignore', 'pipe', 'pipe'];

const isWindows = (): boolean =>
  typeof process !== 'undefined' && typeof process.platform === 'string' && process.platform === 'win32';

/** Single-quote a token for safe inclusion in a shell command line. */
const shellQuote = (token: string): string => `'${token.replace(/'/g, "'\\''")}'`;

/**
 * Shell initialization prefix that loads common version managers (nvm, cargo,
 * asdf). GUI applications inherit a minimal PATH that lacks the entries those
 * managers add during interactive shell startup.
 */
const SHELL_INIT =
  '[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" 2>/dev/null; ' +
  '[ -s "$HOME/.cargo/env" ] && . "$HOME/.cargo/env" 2>/dev/null; ' +
  '[ -f "$HOME/.asdf/asdf.sh" ] && . "$HOME/.asdf/asdf.sh" 2>/dev/null;';

/**
 * Owns the lifetime of a `codewhale app-server --http` child process.
 */
export class ProcessManager {
  private proc: ChildProcess | null = null;
  private alive = false;
  private readonly events: ProcessEvents;
  private readonly logLines: string[] = [];
  private lastExitCode: number | null = null;
  /** Cached absolute path to the codewhale binary, once resolved. */
  private resolvedCli: string | null = null;

  constructor(events: ProcessEvents = {}) {
    this.events = events;
  }

  get running(): boolean {
    return this.alive;
  }

  /** Exit code of the last process, once it has terminated. */
  get exitCode(): number | null {
    return this.lastExitCode;
  }

  /** Recent stdout/stderr output, for surfacing startup failures. */
  recentLog(): string {
    return this.logLines.join('');
  }

  start(settings: WhalliamSettings): ChildProcess {
    if (this.proc) {
      return this.proc;
    }
    this.logLines.length = 0;
    this.lastExitCode = null;

    console.log(
      '[whalliam] platform:',
      typeof process !== 'undefined' ? process.platform : '?',
      typeof process !== 'undefined' ? process.arch : '?',
      '| home:',
      typeof process !== 'undefined' && process.env ? process.env.HOME ?? '(unset)' : '?',
    );

    const serverArgs = [
      'app-server',
      '--http',
      '--port',
      String(settings.port),
      '--cors-origin',
      getSelfOrigin(),
    ];
    if (settings.authToken.trim()) {
      serverArgs.push('--auth-token', settings.authToken.trim());
    } else {
      serverArgs.push('--insecure-no-auth');
    }

    const proc = this.spawnServer(settings.cliPath, serverArgs, isWindows());

    this.proc = proc;
    this.alive = true;
    console.log('[whalliam] process pid:', proc.pid);

    proc.on('error', (err: Error) => {
      this.alive = false;
      const msg = `[spawn error] ${err.message}`;
      this.pushLog(`${msg}\n`);
      console.error('[whalliam]', msg);
      this.events.onError?.(err);
    });
    proc.on('exit', (code, signal) => {
      this.alive = false;
      this.lastExitCode = code;
      this.proc = null;
      console.log('[whalliam] process exit: code=', code, 'signal=', signal);
      this.events.onExit?.(code, signal);
    });
    const onChunk = (chunk: Buffer): void => {
      const text = chunk.toString();
      this.pushLog(text);
      console.debug('[whalliam] proc:', text.trimEnd());
      this.events.onStderr?.(text);
    };
    proc.stderr?.on('data', onChunk);
    proc.stdout?.on('data', onChunk);
    return proc;
  }

  /**
   * Resolve a bare command name to an absolute path by sourcing version-manager
   * init scripts (nvm etc.) in a one-shot bash call. Returns the original input
   * if resolution is not applicable or fails.
   */
  private resolveBinary(cliPath: string): string {
    if (cliPath.startsWith('/') || isWindows()) {
      return cliPath;
    }
    if (this.resolvedCli) {
      return this.resolvedCli;
    }
    try {
      const out = execSync(`${SHELL_INIT} command -v ${shellQuote(cliPath)}`, {
        encoding: 'utf-8',
        timeout: 8000,
        stdio: ['ignore', 'pipe', 'ignore'],
        shell: 'bash',
      });
      const [resolved = ''] = out.trim().split('\n');
      if (resolved.startsWith('/')) {
        console.log('[whalliam] resolved codewhale ->', resolved);
        this.resolvedCli = resolved;
        return resolved;
      }
    } catch (e) {
      console.warn('[whalliam] resolve codewhale failed:', e instanceof Error ? e.message : e);
    }
    return cliPath;
  }

  /**
   * Build the child process. Prefers spawning the resolved absolute path
   * directly (no shell wrapper) for clean signal handling and reliability.
   */
  private spawnServer(cliPath: string, serverArgs: string[], win: boolean): ChildProcess {
    if (win) {
      console.log('[whalliam] spawn (win):', cliPath, serverArgs.join(' '));
      return spawn(cliPath, serverArgs, { shell: true, stdio: STDIO, windowsHide: true });
    }
    const resolved = this.resolveBinary(cliPath);
    if (resolved.startsWith('/')) {
      console.log('[whalliam] spawn (direct):', resolved, serverArgs.join(' '));
      return spawn(resolved, serverArgs, { stdio: STDIO, windowsHide: true });
    }
    const cmdLine = `${SHELL_INIT} exec ${shellQuote(cliPath)} ${serverArgs.map(shellQuote).join(' ')}`;
    console.log('[whalliam] spawn (bash -c):', cmdLine);
    return spawn('bash', ['-c', cmdLine], { stdio: STDIO, windowsHide: true });
  }

  private pushLog(text: string): void {
    this.logLines.push(text);
    if (this.logLines.length > MAX_LOG_LINES) {
      this.logLines.shift();
    }
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
