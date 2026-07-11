// ===== Plugin settings =====
export interface WhalliamSettings {
  /** Path or command name of the `codewhale` CLI executable. */
  cliPath: string;
  /** HTTP port for `codewhale app-server --http`. */
  port: number;
  /** Start the CodeWhale service automatically when the plugin loads. */
  autoStart: boolean;
  /** Optional auth token; when empty the server is started with --insecure-no-auth. */
  authToken: string;
  /** Optional model override; when empty the server default is used. */
  model: string;
  /** Working mode passed when creating a thread. */
  mode: string;
}

// ===== CodeWhale Runtime API response types =====
// Verified against `codewhale app-server --http` (see draft/plan.md, scheme A).

export interface ThreadInfo {
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

export type TurnStatus = 'in_progress' | 'completed' | 'failed' | string;

export interface TurnInfo {
  id: string;
  thread_id: string;
  status: TurnStatus;
  input_summary: string;
  error?: string;
  item_ids: string[];
  created_at: string;
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
}

export type ItemKind =
  | 'user_message'
  | 'assistant_text'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | string;

export interface ThreadItem {
  id: string;
  turn_id: string;
  kind: ItemKind;
  status: string;
  summary: string;
  detail: string;
  artifact_refs: unknown[];
  started_at?: string;
  ended_at?: string;
}

export interface ThreadDetail {
  thread: ThreadInfo;
  turns: TurnInfo[];
  items: ThreadItem[];
}

export interface CreateTurnResponse {
  thread: ThreadInfo;
  turn: TurnInfo;
}

/** SSE envelope emitted by `GET /v1/threads/{id}/events`. */
export interface RuntimeEvent {
  seq: number;
  event: string;
  kind: string;
  thread_id: string;
  turn_id: string | null;
  item_id: string | null;
  timestamp: string;
  payload: RuntimeEventPayload;
}

export interface RuntimeEventPayload {
  thread?: ThreadInfo;
  turn?: TurnInfo;
  item?: ThreadItem;
  status?: TurnStatus;
  /** Incremental text carried by `item.delta` events. */
  delta?: string;
  /** The item kind a delta belongs to (agent_reasoning / agent_message). */
  kind?: string;
}

/** Discriminated helper: the item carried by an item.* event, if any. */
export interface ItemEvent extends RuntimeEvent {
  item_id: string;
  payload: { item: ThreadItem; [k: string]: unknown };
}
