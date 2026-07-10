import type { WhalliamSettings } from './types.js';

export const DEFAULT_SETTINGS: WhalliamSettings = {
  cliPath: 'codewhale',
  port: 7878,
  autoStart: false,
  authToken: '',
  model: '',
  mode: 'agent',
};

/** Obsidian ItemView type registered for the chat panel. */
export const CHAT_VIEW_TYPE = 'whalliam-chat';

/** Polling budget while waiting for the HTTP server to accept connections. */
export const SERVER_BOOT_TIMEOUT_MS = 30_000;
export const SERVER_POLL_INTERVAL_MS = 400;

/** Base URL for the runtime API. */
export const runtimeBase = (port: number): string => `http://127.0.0.1:${port}`;
