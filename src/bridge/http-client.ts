import type {
  CreateTurnResponse,
  RuntimeEvent,
  ThreadDetail,
  ThreadInfo,
  TurnInfo,
} from '../types.js';

/** Thin HTTP + SSE client for the `/v1/*` runtime API. */
export class HttpClient {
  private readonly getBase: () => string;
  private readonly getToken: () => string;

  constructor(getBase: () => string, getToken: () => string) {
    this.getBase = getBase;
    this.getToken = getToken;
  }

  private get headers(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.getBase()}/v1/config`, { headers: this.headers });
      return res.ok;
    } catch {
      return false;
    }
  }

  async createThread(opts: { mode?: string; model?: string; effort?: string; workspace?: string } = {}): Promise<ThreadInfo> {
    const body: Record<string, unknown> = {};
    if (opts.mode) {
      body.mode = opts.mode;
    }
    if (opts.model) {
      body.model = opts.model;
    }
    if (opts.effort) {
      body.effort = opts.effort;
    }
    if (opts.workspace) {
      body.workspace = opts.workspace;
    }
    const res = await fetch(`${this.getBase()}/v1/threads`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return (await res.json()) as ThreadInfo;
  }

  async listThreads(opts: { archived?: boolean } = {}): Promise<ThreadInfo[]> {
    const params = new URLSearchParams();
    if (opts.archived !== undefined) {
      params.set('archived', String(opts.archived));
    }
    const qs = params.toString();
    const url = `${this.getBase()}/v1/threads${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return (await res.json()) as ThreadInfo[];
  }

  async sendTurn(threadId: string, prompt: string): Promise<TurnInfo> {
    const res = await fetch(`${this.getBase()}/v1/threads/${threadId}/turns`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const data = (await res.json()) as CreateTurnResponse;
    return data.turn;
  }

  async getThread(threadId: string): Promise<ThreadDetail> {
    const res = await fetch(`${this.getBase()}/v1/threads/${threadId}`, { headers: this.headers });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return (await res.json()) as ThreadDetail;
  }

  /**
   * Subscribe to a thread's event stream. The runtime replays history before
   * emitting live events; callers decide which events to act on.
   */
  async *events(threadId: string, signal: AbortSignal): AsyncGenerator<RuntimeEvent> {
    const res = await fetch(`${this.getBase()}/v1/threads/${threadId}/events`, {
      headers: { ...this.headers, Accept: 'text/event-stream' },
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`events HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf('\n\n');
      while (sep >= 0) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const evt = parseSse(raw);
        if (evt) {
          yield evt;
        }
        sep = buffer.indexOf('\n\n');
      }
    }
  }
}

/** Parse one SSE block (`event: ...\ndata: {...}`) into a runtime envelope. */
const parseSse = (raw: string): RuntimeEvent | null => {
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) {
      continue; // comment / keepalive
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  try {
    return JSON.parse(dataLines.join('\n')) as RuntimeEvent;
  } catch {
    return null;
  }
};
