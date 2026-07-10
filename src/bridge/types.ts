import type { WhalliamSettings } from '../types.js';

/** Lifecycle snapshot surfaced to the UI. */
export interface BridgeStatus {
  /** The child process is alive. */
  running: boolean;
  /** The HTTP runtime API responds. */
  healthy: boolean;
}

/** Callbacks delivered from the managed child process. */
export interface ProcessEvents {
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  onError?: (err: Error) => void;
  onStderr?: (line: string) => void;
}

export type { WhalliamSettings };
