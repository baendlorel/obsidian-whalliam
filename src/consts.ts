import type { WhalliamSettings } from './types.js';

export const DEFAULT_SETTINGS: WhalliamSettings = {
  cliPath: 'codewhale',
  port: 7878,
  autoStart: false,
  authToken: '',
  // The codewhale server's built-in default model is not accepted by every
  // provider, so we default to a widely-available one. Adjust in settings if
  // your provider expects a different model code.
  model: 'glm-5.2',
  mode: 'agent',
};

/** Obsidian ItemView type registered for the chat panel. */
export const CHAT_VIEW_TYPE = 'whalliam-chat';

/** Polling budget while waiting for the HTTP server to accept connections. */
export const SERVER_BOOT_TIMEOUT_MS = 30_000;
export const SERVER_POLL_INTERVAL_MS = 400;

/** Base URL for the runtime API. */
export const runtimeBase = (port: number): string => `http://127.0.0.1:${port}`;

/** Reconnect delay and cap when the SSE stream drops before a turn completes. */
export const STREAM_RECONNECT_MS = 1500;
export const MAX_STREAM_RECONNECTS = 40;
