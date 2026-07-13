---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '7175e653-12d9-454f-9d96-8ca6bcb7f1a3'
  PropagateID: '7175e653-12d9-454f-9d96-8ca6bcb7f1a3'
  ReservedCode1: '262f3c08-3ad0-4519-9e46-3b397d649d9d'
  ReservedCode2: '262f3c08-3ad0-4519-9e46-3b397d649d9d'
---

# 运行时 API 与集成契约

`codewhale app-server` 是标准的本地运行时 API 和控制平面。
本地 SDK、移动端/远程控制客户端以及编辑器集成通过它与运行时通信，
而非截取终端输出。它提供完整的 HTTP/SSE 运行时 API（`/v1/*`）、
基于 stdio 的 JSON-RPC 控制传输，以及手机友好的移动控制页面。
`codewhale doctor --json` 提供机器可读的健康状态信息，
`codewhale serve --acp` 通过 stdio 执行 Agent Client Protocol，供 Zed 等编辑器使用。

`codewhale serve --http` / `serve --mobile` 作为 `codewhale app-server --http` / `--mobile` 的**兼容别名**保留；两者启动的是完全相同的服务器。新的集成应使用 `app-server`。

`codewhale exec` 是独立的单次无头工作器路径（stream-json、集群工作器子进程、CI 原语）。
它不属于本 API，但共享相同的运行时、供应商/模型解析、权限配置和事件词汇。

本文档是嵌入式 DeepSeek 引擎的原生工作台应用（及其他本地管理器）的稳定集成契约。

## 架构

```
本地管理器 / SDK / 自动化框架
        │
        ├─ codewhale app-server --http     → HTTP/SSE 运行时 API (/v1/*)         [标准]
        ├─ codewhale app-server --mobile   → 运行时 API + 移动控制页面
        ├─ codewhale app-server --stdio    → 基于 stdio 的 JSON-RPC 控制传输
        ├─ codewhale doctor --json         → 机器可读的健康状态与能力信息
        ├─ codewhale serve --acp           → ACP stdio 代理，供 Zed 等编辑器使用
        ├─ codewhale serve --mcp           → MCP stdio 服务器
        ├─ codewhale serve --http/--mobile → `app-server --http/--mobile` 的旧版别名
        └─ codewhale exec [args]           → 单次无头工作器 (stream-json)
```

引擎作为纯本地进程运行。所有 API 默认绑定到 `localhost`。无需托管中继，无供应商令牌托管，无密钥泄露。

关于已完成轮次的只读审计导出提案，参见[`docs/RECEIPTS.md`](RECEIPTS.md)。该文档为协议草案；回执 CLI/API 接口尚未实现。

## 运行时 API 入口

| 入口 | 传输方式 | 用途 |
|---|---|---|
| `codewhale app-server --http` | `127.0.0.1:7878` 上的 HTTP/SSE | 完整 `/v1/*` 运行时 API（标准） |
| `codewhale app-server --mobile` | `0.0.0.0:7878` 上的 HTTP/SSE + `/mobile` | 运行时 API + 手机控制页面 |
| `codewhale app-server --stdio` | 基于 stdio 的 JSON-RPC 2.0 | 本地 SDK / 控制探针（无监听器） |
| `codewhale app-server` | `127.0.0.1:8787` 上的 HTTP | 旧版进程内应用服务器（`/healthz`、`/thread`、`/app`、`/prompt`、`/tool`、`/jobs`） |
| `codewhale serve --http` / `--mobile` | 与 `app-server --http`/`--mobile` 相同的服务器 | 兼容别名 |

`app-server --http` 和 `--mobile` 启动的是同一个成熟的运行时 API 服务器（历史上通过 `serve --http` 访问）——路由或行为均未改变，因此下面文档中的每个端点在两种入口下完全一致。运行时 API 令牌依次从 `--auth-token`、`CODEWHALE_RUNTIME_TOKEN`、`DEEPSEEK_RUNTIME_TOKEN` 读取；仅在环回绑定时才可使用 `--insecure-no-auth`。`serve` 兼容别名的环回逃逸标志保持为 `--insecure`。
旧版进程内 `codewhale app-server` 在绑定非环回主机时同样需要显式的 `--auth-token` 或 `CODEWHALE_APP_SERVER_TOKEN`；其自动生成的一次性 `cwapp_*` 令牌仅限环回使用。

`--stdio` 控制传输使用换行分隔的 JSON-RPC 2.0。无需消耗模型令牌即可探查：

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"healthz"}' \
  '{"jsonrpc":"2.0","id":2,"method":"capabilities"}' \
  '{"jsonrpc":"2.0","id":3,"method":"shutdown"}' \
  | codewhale app-server --stdio
```

`capabilities` 返回已声明的方法族（`thread/*`、`app/*`、`prompt/*`）和完整方法列表；`thread/capabilities`、`app/capabilities` 和 `prompt/capabilities` 按族限定范围。方法集由 `crates/app-server/src/lib.rs` 中的漂移测试锁定，因此 SDK 和本地集成客户端可以确信其不会静默变更。

## SDK 契约

应用服务器的存在是为了让外部 SDK 无需抓取 TUI 输出即可获取——运行了哪条路由、生效的供应商/模型/推理/权限配置是什么、发生了哪些事件、消耗了多少令牌、运行如何结束。持久的 Thread/Turn/Item 数据模型已经承载了大部分信息；下表将每个集成需求映射到本地客户端的读取来源。

| 集成需求 | 来源 | 状态 |
|---|---|---|
| 路由 / 生效模型 | `TurnRecord` + 线程 `model`；每次运行的 `--provider`/`--model` 覆盖 | 可用 |
| 权限 / 沙箱 / 审批配置 | 线程 `auto_approve`，沙箱 + 审批策略 | 可用 |
| 运行 / 线程 / 轮次 ID | `thread_id`、`turn_id`，SSE 事件信封 | 可用 |
| 事件流 | `GET /v1/threads/{id}/events`（回放 + 实时 SSE） | 可用 |
| 轮次状态 / 终态分类 | `TurnRecord.status` + 错误摘要 | 可用 |
| 令牌用量 | `TurnRecord.usage`；通过 `GET /v1/usage` 汇总 | 可用 |
| 单次读取运行回执（路由 + 用量 + 费用） | `GET /v1/threads/{id}/turns/{turn_id}/receipt` | 提案中 ([RECEIPTS.md](RECEIPTS.md)) |

对于单次/无头自动化，推荐使用 `codewhale exec` 并指定 `--provider <id> --model <id>`，这样失败时可以定位到确切的供应商/模型对。当本地集成需要启动、恢复、引导或中断轮次，列出模型/能力，跟踪事件流或读取用量时，使用 `app-server`。两种路径共享相同的运行时，因此路由生效的模型解析和事件词汇一致。

### 发布冒烟测试

`scripts/release/app-server-smoke.sh` 是已提交的发布前检查：

```bash
scripts/release/app-server-smoke.sh                 # stdio 健康/能力探查（无需令牌）
scripts/release/app-server-smoke.sh --matrix        # + 打印已配置的供应商/模型矩阵
scripts/release/app-server-smoke.sh --matrix --real # + 每个供应商执行一次廉价哨兵调用
```

stdio 探针对一次性配置运行，不会读取真实密钥。矩阵从 `codewhale auth list` 发现已配置的供应商，跳过未配置的供应商，仅在供应商有内置廉价默认模型时才映射。内置集合刻意保守（目前为 `deepseek`、`zai`、`moonshot` 和 `openai`）；其他所有供应商——包括 `arcee`、`openrouter`、`xiaomi-mimo` 和 `openai-codex`——故意不映射，必须通过 `SMOKE_MODEL_<SLUG>` 为每次运行指定模型，而非猜测默认值 (#3205)。任何已配置但未映射的供应商在 `--real` 模式下会明确报错。`auth list` 仅报告存在标志，exec 输出经过脱敏处理，因此密钥永远不会被打印。解析器通过 `scripts/release/app-server-smoke.test.sh` 对伪造的 `codewhale` 二进制文件进行测试覆盖。

## ACP stdio 适配器：`codewhale serve --acp`

`codewhale serve --acp` 通过换行分隔的 stdio 执行 JSON-RPC 2.0，供 ACP 兼容的编辑器客户端使用。初始适配器实现了 ACP 基线功能：

- `initialize`
- `session/new`
- `session/prompt`
- `session/cancel`

Prompt 请求通过已配置的 DeepSeek 客户端和当前默认模型进行路由。响应以 `session/update` 代理消息块的形式发出，随后是 `stopReason: "end_turn"` 的 `session/prompt` 响应。

适配器有意保持保守：它尚未通过 ACP 暴露 shell 工具、文件写入工具、检查点回放或会话加载。如需完整的本地运行时 API，请使用 `codewhale serve --http`；如需将 DeepSeek 的工具作为 MCP 工具供其他客户端使用，请使用 `codewhale serve --mcp`。

## 能力端点：`codewhale doctor --json`

返回描述当前安装就绪状态的 JSON 对象。适用于 macOS 工作台的健康检查轮询。

```bash
codewhale doctor --json
```

### 响应模式（关键字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `version` | string | 已安装版本（如 `"0.8.9"`） |
| `config_path` | string | 解析后的配置文件路径 |
| `config_present` | bool | 配置文件是否存在 |
| `workspace` | string | 默认工作区目录 |
| `legacy_state.primary_root` | string | 已检查的 CodeWhale 主状态根目录 |
| `legacy_state.legacy_root` | string | 已检查的旧版 `.deepseek` 状态根目录 |
| `legacy_state.needs_attention` | bool | 已知的 `~/.deepseek` 状态路径是否未迁移或同时存在于 `~/.codewhale` 旁 |
| `legacy_state.legacy_only_count` | number | 仅存在于旧版根目录下的已知状态路径数量 |
| `legacy_state.dual_present_count` | number | 同时存在于主根目录和旧版根目录下的已知状态路径数量 |
| `legacy_state.entries` | array | 每条路径的迁移状态：`{name, primary_present, legacy_present, status}` |
| `api_key.source` | string | `env`、`config` 或 `missing` |
| `base_url` | string | API 基础 URL |
| `default_text_model` | string | 默认模型 |
| `memory.enabled` | bool | 记忆功能是否开启 |
| `memory.path` | string | 记忆文件路径 |
| `memory.file_present` | bool | 记忆文件是否存在 |
| `mcp.config_path` | string | MCP 配置文件路径 |
| `mcp.present` | bool | MCP 配置是否存在 |
| `mcp.servers` | array | 每个服务器的健康状态：`{name, enabled, status, detail}` |
| `skills.selected` | string | 已解析的技能目录 |
| `skills.global.path` / `.present` / `.count` | — | CodeWhale 全局技能目录（`~/.codewhale/skills`，兼容旧版 `~/.deepseek/skills`） |
| `skills.agents.path` / `.present` / `.count` | — | 工作区 `.agents/skills/` 目录 |
| `skills.agents_global.path` / `.present` / `.count` | — | agentskills.io 全局技能目录（`~/.agents/skills`） |
| `skills.local.path` / `.present` / `.count` | — | `skills/` 目录 |
| `skills.opencode.path` / `.present` / `.count` | — | `.opencode/skills/` 目录 |
| `skills.claude.path` / `.present` / `.count` | — | `.claude/skills/` 目录 |
| `tools.path` / `.present` / `.count` | — | 全局工具目录 |
| `plugins.path` / `.present` / `.count` | — | 全局插件目录 |
| `sandbox.available` | bool | 此操作系统是否支持沙箱 |
| `sandbox.kind` | string 或 null | 沙箱类型（如 `"macos_seatbelt"`） |
| `storage.spillover.path` / `.present` / `.count` | — | 工具输出溢出目录 |
| `storage.stash.path` / `.present` / `.count` | — | Composer 暂存目录 |

### 示例

```json
{
  "version": "0.8.9",
  "config_path": "/Users/you/.codewhale/config.toml",
  "config_present": true,
  "workspace": "/Users/you/projects/codewhale-tui",
  "api_key": {
    "source": "env"
  },
  "base_url": "https://api.deepseek.com/beta",
  "default_text_model": "deepseek-v4-pro",
  "memory": {
    "enabled": false,
    "path": "/Users/you/.codewhale/memory.md",
    "file_present": true
  },
  "mcp": {
    "config_path": "/Users/you/.codewhale/mcp.json",
    "present": true,
    "servers": [
      {"name": "filesystem", "enabled": true, "status": "ok", "detail": "ready"}
    ]
  },
  "sandbox": {
    "available": true,
    "kind": "macos_seatbelt"
  }
}
```

## HTTP/SSE 运行时 API：`codewhale app-server --http`

```bash
codewhale app-server --http [--host 127.0.0.1] [--port 7878] [--workers 2] [--auth-token TOKEN] [--insecure-no-auth]
codewhale app-server --mobile [--host 0.0.0.0] [--port 7878] [--auth-token TOKEN]
codewhale app-server --mobile --host 127.0.0.1 [--port 7878] [--insecure-no-auth]

# 兼容别名 — 相同的服务器，使用 serve 的标志名：
codewhale serve --http   [...] [--insecure]
codewhale serve --mobile [...] [--insecure]
```

默认值：主机 `127.0.0.1`，端口 `7878`，2 个工作器（限制范围 1–8）。

服务器默认绑定到 `localhost`。配置通过 CLI 标志完成——没有 `[app_server]` 配置段。

`/v1/*` 路由需要持有者令牌，除非 `codewhale app-server` 以 `--insecure-no-auth` 启动且绑定为环回地址（如 `127.0.0.1`）。请勿将无认证模式与 `--mobile` 默认主机 `0.0.0.0` 混合使用；LAN 移动端访问请使用令牌，或添加 `--host 127.0.0.1` 以进行仅限本地的无认证测试。`codewhale serve` 兼容别名使用 `--insecure` 作为等效的环回逃逸标志。
在启动服务器前传入 `--auth-token TOKEN` 或设置 `DEEPSEEK_RUNTIME_TOKEN=TOKEN`。如果两者均未设置，进程将生成一次性令牌并在启动时打印。`/health` 和 `/v1/runtime/info` 保持公开，供本地监控和引导使用。移动模式禁用时 `/mobile` 返回 404；移动模式启用且认证启用时，如果请求未提供运行时令牌，`/mobile` 返回 401。

已认证客户端可通过 `Authorization: Bearer TOKEN`、`X-DeepSeek-Runtime-Token: TOKEN` 或 `?token=TOKEN`（适用于无法设置自定义头部的 EventSource 客户端）提供令牌。

### 移动控制页面

`codewhale serve --mobile` 启动相同的 HTTP/SSE 运行时 API，并在 `/mobile` 提供手机友好的控制页面。当绑定主机保持默认时，移动模式绑定到 `0.0.0.0`，打印警告并输出本地/LAN URL。传入 `--host 127.0.0.1` 可将移动页面限制为仅环回访问。如果生成或提供了运行时令牌，打印的移动 URL 会将其作为查询参数包含在内；页面将其本地存储并从地址栏移除。静态 HTML 页面不包含密钥，但认证启用时仍受令牌门控，以防止未认证的 LAN 客户端探测移动界面。

移动页面可列出/创建线程、发送 prompt、跟踪实时 SSE 事件、引导或中断活跃轮次，以及通过 `POST /v1/approvals/{approval_id}` 处理普通工具审批。它仍然是本地/LAN 便利界面：请勿在未配置 TLS 和可信前端代理层的情况下将其直接暴露于公网。

### 端点

**健康检查**
- `GET /health`

**会话**（旧版会话管理器）
- `GET /v1/sessions?limit=50&search=<substring>`
- `GET /v1/sessions/{id}`
- `DELETE /v1/sessions/{id}`
- `POST /v1/sessions/{id}/resume-thread`

**线程**（持久运行时数据模型）
- `GET /v1/threads?limit=50&include_archived=false&archived_only=false`
- `GET /v1/threads/summary?limit=50&search=<optional>&include_archived=false&archived_only=false`
- `POST /v1/threads`
- `GET /v1/threads/{id}`
- `PATCH /v1/threads/{id}`（见下方请求体结构）
- `POST /v1/threads/{id}/resume`
- `POST /v1/threads/{id}/fork`

`GET /v1/threads/summary` 是 VS Code Agent View 使用的只读摘要界面。每条记录包含 `id`、`title`、`preview`、`model`、`mode`、`archived`、`updated_at`、`latest_turn_id`、`latest_turn_status`，以及工作区元数据：

```json
{
  "id": "thread_...",
  "title": "Implement MCP status count",
  "preview": "The TUI footer should count project MCP servers...",
  "model": "deepseek-v4-pro",
  "mode": "agent",
  "branch": "feature/runtime-api",
  "head": "abc1234",
  "dirty": false,
  "workspace": "/Users/you/projects/codewhale",
  "archived": false,
  "updated_at": "2026-06-06T05:43:00Z",
  "latest_turn_id": "turn_...",
  "latest_turn_status": "completed"
}
```

`branch` 在请求时从线程工作区解析，当工作区不是 Git 仓库或分支无法读取时可能为 `null`。`head` 是该工作区当前短 Git 提交（可用时）。`dirty` 在工作区有已暂存、未暂存或未跟踪的更改时为 true。包含 `workspace` 以便编辑器客户端判断代理通道是否在当前 VS Code 文件夹之外工作。

线程分叉是同级的运行时线程，而非就地树形投影。`thread.forked` 事件包含 `source_thread_id`；内部回溯感知分叉还可能包含 `backtrack_depth_from_tail` 和 `dropped_turn_id`。v0.8.40 中线程列表和摘要响应仍为扁平结构，因此需要图结构的客户端应从事件重建，而非假设列表顺序构成完整树。

`archived_only=true` 仅返回已归档线程（与 `include_archived` 互斥覆盖）。默认行为不变：`include_archived=false` 且 `archived_only=false` 返回活跃线程。v0.8.10 新增 (#563)。

`PATCH /v1/threads/{id}` 请求体——每个字段均可选，缺失表示"不修改"。至少需提供一个字段。`title` 和 `system_prompt` 接受空字符串以清除先前设置的值。v0.8.10 新增 (#562)：

```json
{
  "archived": true,
  "allow_shell": false,
  "trust_mode": false,
  "auto_approve": false,
  "model": "deepseek-v4-pro",
  "mode": "agent",
  "title": "User-set thread title",
  "system_prompt": "You are a useful assistant."
}
```

**轮次**（线程内）
- `POST /v1/threads/{id}/turns`
- `POST /v1/threads/{id}/turns/{turn_id}/steer`
- `POST /v1/threads/{id}/turns/{turn_id}/interrupt`
- `POST /v1/threads/{id}/compact`（手动压缩）

**审批**
- `POST /v1/approvals/{approval_id}`，请求体为
  `{ "decision": "allow" | "deny", "remember": false }`

**事件**（SSE 回放 + 实时流）
- `GET /v1/threads/{id}/events?since_seq=<u64>`

**快照**（只读 side-git 还原点列表）
- `GET /v1/snapshots?limit=20`

`/v1/snapshots` 列出运行时工作区最近的 side-git 还原点。该端点为只读，不会还原文件。`limit` 默认为 `20`，必须在 `1` 到 `100` 之间。

```json
[
  {
    "id": "snap_...",
    "label": "post-turn:1",
    "timestamp": 1780730580
  }
]
```

运行时 API 的还原/重试/撤销/编辑器应用等变更端点被有意推迟。GUI 客户端应将线程摘要和快照视为检查界面，直到原子文件系统 + 对话状态变更语义被定义和测试。

**回执**（未来只读审计导出）
- 仅提案：`GET /v1/threads/{thread_id}/turns/{turn_id}/receipt`

**兼容流**（单次，向后兼容）
- `POST /v1/stream`

**任务**（持久后台工作）
- `GET /v1/tasks`
- `POST /v1/tasks`
- `GET /v1/tasks/{id}`
- `POST /v1/tasks/{id}/cancel`

**自动化**（定时周期工作）
- `GET /v1/automations`
- `POST /v1/automations`
- `GET /v1/automations/{id}`
- `PATCH /v1/automations/{id}`
- `DELETE /v1/automations/{id}`
- `POST /v1/automations/{id}/run`
- `POST /v1/automations/{id}/pause`
- `POST /v1/automations/{id}/resume`
- `GET /v1/automations/{id}/runs?limit=20`

**内省**
- `GET /v1/workspace/status`
- `GET /v1/skills`
- `GET /v1/apps/mcp/servers`
- `GET /v1/apps/mcp/tools?server=<optional>`

**用量**（跨线程的令牌/费用聚合）
- `GET /v1/usage?since=<rfc3339>&until=<rfc3339>&group_by=<day|model|provider|thread>`

`since` / `until` 为包含边界的 RFC 3339 时间戳，可省略（无边界）。`group_by` 默认为 `day`。分桶按键升序排列。空时间范围产生空的 `buckets`（永不会返回 404）。费用通过模型→定价映射计算；模型没有定价条目的轮次贡献令牌数但费用为 `0.0`。v0.8.10 新增 (#564)。

```json
{
  "since": "2026-04-01T00:00:00Z",
  "until": "2026-04-30T23:59:59Z",
  "group_by": "day",
  "totals": {
    "input_tokens": 12345,
    "output_tokens": 6789,
    "cached_tokens": 0,
    "reasoning_tokens": 0,
    "cost_usd": 0.012,
    "turns": 42
  },
  "buckets": [
    {
      "key": "2026-04-30",
      "input_tokens": 1234,
      "output_tokens": 678,
      "cached_tokens": 0,
      "reasoning_tokens": 0,
      "cost_usd": 0.001,
      "turns": 3
    }
  ]
}
```

## 运行时数据模型

运行时使用持久的 Thread/Turn/Item 生命周期。

- **ThreadRecord** — `id`、`created_at`、`updated_at`、`model`、`workspace`、`mode`、`task_id`、`system_prompt`、`latest_turn_id`、`latest_response_bookmark`、`archived`
- **TurnRecord** — `id`、`thread_id`、`status`（`queued|in_progress|completed|failed|interrupted|canceled`），时间戳、持续时间、用量、错误摘要
- **TurnItemRecord** — `id`、`turn_id`、`kind`（`user_message|agent_message|tool_call|file_change|command_execution|context_compaction|status|error`），生命周期 `status`、`metadata`

事件为仅追加模式，带有全局单调递增的 `seq`，用于回放/恢复。

### 重启语义

- 如果进程重启时某个轮次或条目处于 `queued` 或 `in_progress` 状态，恢复后的记录被标记为 `interrupted`，附带 `"Interrupted by process restart"` 错误。
- 任务执行在同一持久化线程/轮次存储之上执行自身的恢复。

### 审批模型

- `auto_approve` 标志应用于运行时审批桥和引擎工具上下文。为线程/轮次/任务启用时，需要审批的工具在非交互式运行时路径中自动获批，shell 安全检查以自动审批模式运行，生成的子代理继承该设置。
- 省略时，`auto_approve` 默认为 `false`。

### SSE 事件流

`/v1/threads/{id}/events` 的 SSE 事件负载结构：

```json
{
  "schema_version": 1,
  "seq": 42,
  "event": "item.delta",
  "kind": "item.delta",
  "thread_id": "thr_1234abcd",
  "turn_id": "turn_5678efgh",
  "item_id": "item_90ab12cd",
  "timestamp": "2026-02-11T20:18:49.123Z",
  "created_at": "2026-02-11T20:18:49.123Z",
  "payload": {
    "delta": "partial output",
    "kind": "agent_message"
  }
}
```

兼容性说明：

- `schema_version` 是 HTTP/SSE 信封的 schema 版本，与持久化线程/轮次/事件记录使用的运行时存储 schema 无关。
- `event` 保留为现有客户端中的 SSE 事件名称；原样保留。
- `kind` 在稳定信封中镜像 `event`，供类型化客户端使用。
- `thread.started`、`turn.started` 和 `turn.completed` 作为 SSE 事件名称照常发出。
- `timestamp` 仍为 schema 版本 1 的规范事件时间。`created_at` 是等效别名，供在其他地方使用 `created_at` 命名的客户端使用；不要要求两个字段必须同时存在。

常见事件名称：`thread.started`、`thread.forked`、`turn.started`、`turn.lifecycle`、`turn.steered`、`turn.interrupt_requested`、`turn.completed`、`item.started`、`item.delta`、`item.completed`、`item.failed`、`item.interrupted`、`approval.required`、`approval.decided`、`approval.timeout`、`sandbox.denied`。

`approval.required` 事件在执行策略规则触发提示时可能包含 `matched_rule` 字符串。此字段为客户端的解释性元数据，不授予或持久化权限。

## 安全边界

- **默认本地绑定**。服务器默认绑定到 `127.0.0.1`。`--mobile` 未指定主机时绑定到 `0.0.0.0`，以便局域网内的手机可以访问，CLI 会为此重新绑定打印警告。传入 `--host 127.0.0.1` 可将移动页面限制为仅环回访问。仅在信任网络路径或有反向代理 / VPN 进行认证时才设置非环回主机。运行时不提供用户隔离或 TLS。
- **可选令牌守卫**。`--auth-token` 或 `DEEPSEEK_RUNTIME_TOKEN` 要求 `/v1/*` 路由提供匹配的持有者令牌。这是本地的便利守卫，不是公网上 TLS、VPN 或可信反向代理的替代方案。
- **无供应商令牌托管**。服务器永不返回 API 密钥。`api_key.source` 能力字段报告 `env`、`config` 或 `missing`——永远不报告密钥本身。
- **无托管中继**。应用服务器是用户控制下的本地进程，没有云组件。
- **能力响应**永不泄露密钥、文件内容或会话消息体。它们仅报告*元数据*：存在性、计数、状态标志。

### CORS 白名单

运行时 API 内置开发源白名单：
`http://localhost:3000`、`http://127.0.0.1:3000`、`http://localhost:1420`、
`http://127.0.0.1:1420`、`tauri://localhost`。要添加额外的源（例如在 Vite 默认 `:5173` 上开发 UI 时），可使用以下任一方式：

- CLI 标志（可重复）：`codewhale serve --http --cors-origin http://localhost:5173`
- 环境变量（逗号分隔）：`DEEPSEEK_CORS_ORIGINS="http://localhost:5173,http://localhost:8080"`
- 配置文件（`~/.codewhale/config.toml`）：
  ```toml
  [runtime_api]
  cors_origins = ["http://localhost:5173"]
  ```

用户提供的源**叠加在**内置默认值之上，而非替换。不支持通配符源——保留显式白名单模型。v0.8.10 新增 (#561)。

## 运行时 SDK 集群辅助工具

v0.8.60 运行时 SDK 固件位于 `npm/runtime-sdk`，以 `@codewhale/runtime-sdk` workspace 包的形式暴露。它刻意保持精简：每个辅助函数都调用本地 Rust 运行时 API，因此无法绕过 CodeWhale 的沙箱、审批提示、供应商配置或集群账本权限。

```js
import { createRuntimeClient } from "@codewhale/runtime-sdk";

const client = createRuntimeClient({
  baseUrl: "http://127.0.0.1:7878",
  token: process.env.CODEWHALE_RUNTIME_TOKEN,
});

const { runs } = await client.listFleetRuns();
const workers = await client.listFleetWorkers(runs[0].id);
await client.restartWorker(workers.workers[0].worker_id);
```

集群辅助工具覆盖 v0.8.60 HTTP 接口：

| 辅助函数 | 运行时 API 路由 |
|---|---|
| `listFleetRuns()` | `GET /v1/fleet/runs` |
| `getFleetRun(runId)` | `GET /v1/fleet/runs/{run_id}` |
| `listFleetWorkers(runId)` | `GET /v1/fleet/runs/{run_id}/workers` |
| `getFleetWorker(workerId)` | `GET /v1/fleet/workers/{worker_id}` |
| `interruptWorker(workerId)` | `POST /v1/fleet/workers/{worker_id}/interrupt` |
| `restartWorker(workerId)` | `POST /v1/fleet/workers/{worker_id}/restart` |
| `stopFleetRun(runId)` | `POST /v1/fleet/runs/{run_id}/stop` |

`createFleetRun(spec)` 和 `fleetEvents(runId)` 已提前针对当前 Rust 路由进行了类型定义，以便编辑器/Web 客户端可以按照预期的 SDK 契约编写代码。在运行时 API 暴露 `POST /v1/fleet/runs` 和集群事件流之前，SDK 会抛出带有稳定能力字符串（`fleet_run_create`、`fleet_event_stream`）的 `RuntimeCapabilityError`，而非将这些缺口暴露为通用的 fetch 失败。

验证：

```bash
npm test --workspace @codewhale/runtime-sdk
```

## 代理运行回执

子代理通道将紧凑运行回执持久化在 `.codewhale/state/subagents.v1.json` 中。运行时 API 将这些回执作为只读检查界面暴露：

| 操作 | 端点 |
|---|---|
| 列出已持久化的代理运行 | `GET /v1/agent-runs` |
| 查看某次运行 | `GET /v1/agent-runs/{run_id}` |

响应与 `agent` 回执暴露的相同工作器记录结构：`spec.run_id`、`actor_kind`、生命周期 `status`、有界 `events`、`follow_up`、`takeover`、`artifacts`、`usage` 和 `verification`。`run_id` 对较旧记录回退为工作器 ID，`{run_id}` 可以是运行 ID 或工作器 ID。

这些端点不会启动、取消或引导子代理。该 API 接口的存在是为了让应用/编辑器/无头客户端能检查 TUI 和父模型所看到的相同交接回执。

## 会话生命周期（原生 UI 监控）

| 操作 | 端点 |
|---|---|
| 列出会话 | `GET /v1/sessions` |
| 获取会话 | `GET /v1/sessions/{id}` |
| 删除会话 | `DELETE /v1/sessions/{id}` |
| 恢复到线程 | `POST /v1/sessions/{id}/resume-thread` |
| 创建线程 | `POST /v1/threads` |
| 列出线程 | `GET /v1/threads` |
| 附加到事件 | `GET /v1/threads/{id}/events?since_seq=0` |
| 发送消息 | `POST /v1/threads/{id}/turns` |
| 引导 | `POST /v1/threads/{id}/turns/{turn_id}/steer` |
| 中断 | `POST /v1/threads/{id}/turns/{turn_id}/interrupt` |
| 压缩 | `POST /v1/threads/{id}/compact` |

## 兼容性测试

契约快照位于 `crates/protocol/tests/`。运行：

```bash
cargo test -p codewhale-protocol --test parity_protocol --locked
```

此测试验证应用服务器的事件 schema 未偏离已文档化的契约。CI 在每次推送到 `main` 及发布标签时运行此测试。

应用服务器的 stdio 控制界面有自己的漂移守护——已声明的 `capabilities` 方法集在 `crates/app-server/src/lib.rs` 中锁定：

```bash
cargo test -p codewhale-app-server capabilities
```

发布前，运行无头冒烟测试（stdio 探查 + 可选供应商矩阵，不泄露密钥）：

```bash
scripts/release/app-server-smoke.sh --matrix        # 干跑计划
bash scripts/release/app-server-smoke.test.sh       # 解析器自检（伪造二进制）
```

> AI生成