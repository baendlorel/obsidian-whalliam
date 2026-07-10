# obsidian-whalliam 项目计划

> 一个将 CodeWhale AI 编码代理嵌入 Obsidian 的插件，实现在 Obsidian 图形界面中直接使用 CodeWhale 的效果，功能对标社区著名插件 Claudian。

---

## 一、项目概述

### 1.1 目标

将本地安装的 CodeWhale CLI 嵌入 Obsidian，通过侧边栏聊天界面让用户直接在 Obsidian 内与 CodeWhale 对话。CodeWhale 以当前 vault 为工作目录，具备完整的代理能力：文件读写、搜索、shell 命令执行、多步骤工作流。

### 1.2 对标产品

**Claudian**（Obsidian 社区插件，>10k stars）— 将 Claude Code / Codex / Opencode / Pi 等 AI 编码代理嵌入 Obsidian 侧边栏。

### 1.3 核心差异化

| 维度 | Claudian | obsidian-whalliam |
|------|----------|-------------------|
| 后端代理 | Claude Code / Codex / Opencode / Pi | **CodeWhale**（DeepSeek 驱动） |
| 提供商 | Anthropic / OpenAI 生态 | **DeepSeek 生态**（及兼容提供商） |
| 技术栈 | React + 自定义构建 | **纯 TypeScript + esbuild**（与 obsidian-secret-notes 同栈） |
| 许可证 | MIT | MIT |

---

## 二、参考技术栈（来自 obsidian-secret-notes）

### 2.1 构建与开发

| 项目 | 版本/配置 |
|------|-----------|
| 语言 | TypeScript 6.x |
| 编译目标 | ES2020 |
| 模块系统 | ESNext (Bundler resolution) |
| 打包 | esbuild 0.25.x |
| 包管理 | pnpm |
| Lint | oxlint 1.72.x |
| 脚本运行 | tsx 4.x |
| Obsidian API | obsidian 1.12.x |
| Node 类型 | @types/node 25.x |

### 2.2 关键配置文件

```
.
├── .gitignore
├── .oxlintrc.json          # oxlint 规则
├── esbuild.config.mjs      # esbuild 构建配置
├── manifest.json           # Obsidian 插件清单
├── package.json            # 依赖和脚本
├── pnpm-lock.yaml          # 锁文件
├── tsconfig.json           # TypeScript 配置
├── src/
│   ├── main.ts             # 插件入口
│   ├── styles.css          # 样式
│   ├── types.ts            # 类型定义
│   ├── consts.ts           # 常量
│   ├── settings.ts         # 设置面板
│   ├── utils.ts            # 工具函数
│   └── i18n/               # 国际化
└── scripts/                # 构建脚本
```

### 2.3 package.json 脚本参考

```json
{
  "scripts": {
    "check": "tsc --noEmit",
    "lint": "oxlint -c .oxlintrc.json . --tsconfig tsconfig.json",
    "lint:fix": "oxlint ... --fix",
    "build": "node esbuild.config.mjs",
    "dev": "node esbuild.config.mjs --watch"
  }
}
```

---

## 三、CodeWhale 集成分析

### 3.1 CodeWhale CLI 可用接口

经调研，CodeWhale 提供三种可用于插件集成的接口：

#### 方案 A：HTTP Runtime API（推荐 ⭐）

```bash
codewhale app-server --http --port 7878
```

- 提供完整的 `/v1/*` REST API
- 支持 SSE 事件流（实时 token 输出、工具调用通知）
- 会话管理、审批流程、fleet 任务管理
- 需要插件管理 CodeWhale 进程生命周期

#### 方案 B：JSON-RPC over stdio

```bash
codewhale app-server --stdio
```

- 通过子进程 stdin/stdout 进行 JSON-RPC 通信
- 无需端口管理，更安全
- 适合深度集成的 SDK 场景

#### 方案 C：非交互式 exec

```bash
codewhale exec --auto --output-format stream-json "prompt"
```

- 单次调用，流式 JSON 输出
- 简单但有状态管理限制
- 不适合多轮对话场景

### 3.2 推荐方案

**阶段一（MVP）**：使用方案 C（`exec --auto --output-format stream-json`）实现基本聊天功能。

**阶段二（完整版）**：迁移到方案 A（`app-server --http`），实现完整的会话管理、多标签、历史记录等功能。

**阶段三（高级版）**：同时支持方案 B（`--stdio`），提供更低延迟的 JSON-RPC 通信。

---

## 四、功能规划

### 4.1 MVP（v0.1.0）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 侧边栏聊天 | 通过 ribbon 图标或命令面板打开聊天面板 | P0 |
| 基本对话 | 输入文本，发送到 CodeWhale，流式显示回复 | P0 |
| 设置面板 | 配置 CodeWhale CLI 路径、模型等 | P0 |
| 国际化 | 中文 / 英文双语支持 | P0 |

### 4.2 v0.2.0

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 会话管理 | 多轮对话上下文保持 | P1 |
| 对话历史 | 查看、恢复历史对话 | P1 |
| Markdown 渲染 | 回复内容支持 Markdown/代码高亮 | P1 |
| 工具调用可视化 | 展示 CodeWhale 的工具调用过程 | P1 |

### 4.3 v0.3.0+

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 多标签对话 | 多个并行聊天标签 | P2 |
| 内联编辑 | 选中文本 + 热键直接编辑笔记 | P2 |
| Slash 命令 | `/` 触发可复用提示模板 | P2 |
| @mention | `@` 提及 vault 文件 | P2 |
| Plan 模式 | 先规划后执行的审批流程 | P3 |
| MCP 支持 | 连接外部 MCP 工具 | P3 |
| 自定义指令 | `#` 添加自定义系统指令 | P3 |

---

## 五、架构设计

### 5.1 整体架构

```
┌──────────────────────────────────────────────────┐
│                    Obsidian                        │
│  ┌──────────────────────────────────────────────┐ │
│  │            obsidian-whalliam                   │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ 侧边栏视图│ │ 设置面板 │ │ 命令注册     │  │ │
│  │  │ (ChatView)│ │(Settings)│ │ (Commands)   │  │ │
│  │  └────┬─────┘ └──────────┘ └──────────────┘  │ │
│  │       │                                        │ │
│  │  ┌────┴─────────────────────────────────────┐ │ │
│  │  │         CodeWhale Bridge                  │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │ │
│  │  │  │ 进程管理  │ │ HTTP/SSE │ │ JSON-RPC │ │ │ │
│  │  │  │ (spawn)  │ │ Client   │ │ Client   │ │ │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘ │ │ │
│  │  └────────────────────┬────────────────────┘ │ │
│  └───────────────────────┼──────────────────────┘ │
└──────────────────────────┼───────────────────────┘
                           │
                   ┌───────┴───────┐
                   │  CodeWhale    │
                   │  CLI Process  │
                   │  (app-server  │
                   │   or exec)    │
                   └───────────────┘
```

### 5.2 源码目录结构

```
src/
├── main.ts                  # 插件入口（Plugin 类）
├── consts.ts                # 常量与默认配置
├── types.ts                 # 类型定义
├── settings.ts              # 设置面板（PluginSettingTab）
├── utils.ts                 # 工具函数
├── styles.css               # 全局样式
│
├── i18n/                    # 国际化
│   ├── index.ts             # t() 函数
│   └── dict.ts              # 翻译字典
│
├── bridge/                  # CodeWhale 通信层
│   ├── index.ts             # 统一导出
│   ├── types.ts             # Bridge 接口定义
│   ├── child-process.ts     # 子进程管理（spawn/kill/restart）
│   ├── exec-client.ts       # exec --auto 模式客户端（MVP）
│   └── http-client.ts       # HTTP/SSE 客户端（阶段二）
│
├── views/                   # 视图组件
│   ├── chat-view.ts         # 侧边栏聊天视图（ItemView）
│   ├── chat-input.ts        # 输入区域组件
│   ├── chat-message.ts      # 消息渲染组件
│   ├── chat-history.ts      # 历史记录面板
│   └── inline-edit.ts       # 内联编辑模态框（阶段二）
│
└── assets/                  # 静态资源
    └── icon.svg             # Ribbon 图标
```

### 5.3 核心类设计

```
WhalliamPlugin (extends Plugin)
├── settings: WhalliamSettings
├── bridge: CodeWhaleBridge
├── chatView: ChatView | null
│
├── onload()
│   ├── loadSettings()
│   ├── addSettingTab(WhalliamSettingTab)
│   ├── registerView(CHAT_VIEW_TYPE, ChatView)
│   ├── addRibbonIcon(...)
│   ├── addCommand(open-chat)
│   └── addCommand(send-inline)
│
└── onunload()
    ├── bridge.shutdown()
    └── cleanup

ChatView (extends ItemView)
├── bridge: CodeWhaleBridge
├── messages: ChatMessage[]
├── inputEl: HTMLTextAreaElement
│
├── getViewType(): string
├── getDisplayText(): string
├── getIcon(): string
├── onOpen(): void
├── onClose(): void
│
├── sendMessage(text: string): Promise<void>
├── renderMessage(msg: ChatMessage): void
├── scrollToBottom(): void
└── handleStreamChunk(chunk: string): void

CodeWhaleBridge
├── config: BridgeConfig
├── process: ChildProcess | null
│
├── start(): Promise<void>
├── stop(): Promise<void>
├── restart(): Promise<void>
├── send(prompt: string, options: SendOptions): AsyncIterable<StreamEvent>
└── healthCheck(): Promise<boolean>
```

### 5.4 数据流

```
用户输入文本
    │
    ▼
ChatView.sendMessage()
    │
    ▼
CodeWhaleBridge.send(prompt, { cwd: vaultPath })
    │
    ▼
spawn("codewhale", ["exec", "--auto", "--output-format", "stream-json", prompt])
    │
    ▼
stdout 流式解析（逐行 JSON）
    │
    ├── { type: "assistant", content: "..." }  → 追加文本到消息
    ├── { type: "tool_use", name: "...", input: {...} }  → 显示工具调用
    ├── { type: "tool_result", ... }  → 显示工具结果
    └── { type: "result", ... }  → 完成
    │
    ▼
ChatView.renderMessage() → DOM 更新
```

---

## 六、开发阶段

### 阶段 0：项目初始化（预计 1-2 天）

- [ ] 从 obsidian-secret-notes 复制构建配置（package.json、tsconfig.json、esbuild.config.mjs、.oxlintrc.json、.gitignore）
- [ ] 修改包名、版本号、描述
- [ ] 创建 manifest.json
- [ ] 安装依赖（pnpm install）
- [ ] 验证 `pnpm build` 和 `pnpm dev` 可正常执行
- [ ] 创建基本源码结构

### 阶段 1：MVP 核心功能（预计 3-5 天）

- [ ] 实现 `types.ts` — 定义 `WhalliamSettings` 等核心类型
- [ ] 实现 `consts.ts` — 默认设置
- [ ] 实现 `i18n/` — 中英文双语支持
- [ ] 实现 `settings.ts` — 设置面板（CLI 路径、模型选择、默认参数）
- [ ] 实现 `bridge/child-process.ts` — CodeWhale 子进程管理
- [ ] 实现 `bridge/exec-client.ts` — 基于 `exec --auto --output-format stream-json` 的通信
- [ ] 实现 `views/chat-view.ts` — 侧边栏聊天视图（基本的输入/输出）
- [ ] 实现 `views/chat-message.ts` — 消息渲染
- [ ] 实现 `main.ts` — 插件入口，注册 view、ribbon、commands
- [ ] 编写 `styles.css` — 聊天界面样式
- [ ] 手动测试：基本对话、流式输出、错误处理

### 阶段 2：会话与体验优化（预计 3-5 天）

- [ ] 实现多轮对话上下文保持
- [ ] 实现对话历史存储与恢复
- [ ] 实现 Markdown 渲染（复用 Obsidian 内置 Markdown 渲染器）
- [ ] 实现代码块语法高亮
- [ ] 实现工具调用可视化
- [ ] 优化流式响应性能
- [ ] 添加快捷键支持（发送消息、关闭面板等）

### 阶段 3：高级功能（预计 5-10 天）

- [ ] 迁移到 HTTP Runtime API（`app-server --http`）
- [ ] 实现多标签对话
- [ ] 实现内联编辑功能
- [ ] 实现 Slash 命令系统
- [ ] 实现 @mention 文件引用
- [ ] 实现 Plan 模式
- [ ] MCP 服务器集成

### 阶段 4：发布准备（预计 1-2 天）

- [ ] 编写 README.md + README.zh.md
- [ ] 制作截图/GIF 演示
- [ ] 创建 GitHub Release workflow
- [ ] 提交 Obsidian Community Plugins 审核

---

## 七、关键决策与风险

### 7.1 已确定决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 构建工具 | esbuild | 与参考项目一致，快速、简洁 |
| 前端框架 | 无框架（原生 DOM） | 与参考项目一致，轻量，避免额外依赖 |
| 模块格式 | CommonJS (CJS) | Obsidian 插件要求 CJS |
| 外部依赖 | obsidian, electron, @codemirror/* | 打包时 external，由 Obsidian 运行时提供 |
| 包管理 | pnpm | 与参考项目一致 |
| Lint | oxlint | 与参考项目一致，极速 |

### 7.2 待研究问题

| 问题 | 影响 | 调研方式 |
|------|------|----------|
| `exec --output-format stream-json` 的精确输出模式 | 决定流式解析逻辑 | 运行测试命令观察输出格式 |
| `app-server --http` 的完整 API 文档 | HTTP 客户端实现 | 查阅 `docs/RUNTIME_API.md` |
| Obsidian 移动端兼容性 | `isDesktopOnly` 设置 | 测试移动端子进程能力 |
| CodeWhale 进程的优雅关闭 | 资源泄漏风险 | 测试信号处理 |

### 7.3 风险与缓解

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|----------|
| CodeWhale CLI 路径检测失败 | 中 | 高 | 提供手动配置路径的设置项；使用 `which codewhale` 自动检测 |
| 流式输出解析不完整 | 中 | 中 | 实现缓冲区拼接；参考 Claudian 的流式处理逻辑 |
| 大 vault 导致性能问题 | 低 | 中 | 限制上下文窗口；支持 compact 操作 |
| Obsidian API 版本兼容 | 低 | 低 | 设置 `minAppVersion: "1.7.2"`，与 Claudian 保持一致 |

---

## 八、配置文件清单

### manifest.json

```json
{
  "id": "whalliam",
  "name": "Whalliam",
  "version": "0.1.0",
  "minAppVersion": "1.7.2",
  "description": "Embed CodeWhale AI agent as a sidebar chat interface in Obsidian.",
  "author": "Your Name",
  "authorUrl": "https://github.com/yourname",
  "isDesktopOnly": true
}
```

### 关键 package.json 字段

```json
{
  "name": "whalliam",
  "version": "0.1.0",
  "description": "An Obsidian plugin that embeds CodeWhale AI agent in your vault.",
  "scripts": {
    "check": "tsc --noEmit",
    "lint": "oxlint -c .oxlintrc.json . --tsconfig tsconfig.json",
    "lint:fix": "oxlint -c .oxlintrc.json . --tsconfig tsconfig.json --fix",
    "build": "node esbuild.config.mjs",
    "dev": "node esbuild.config.mjs --watch"
  }
}
```

---

## 九、下一步行动

1. **立即**：从 obsidian-secret-notes 复制配置文件骨架
2. **立即**：修改 package.json / manifest.json 的包名和描述
3. **实施**：按阶段 1 顺序开始编码
4. **调研**：运行 `codewhale exec --auto --output-format stream-json "hello"` 观察输出格式

---

> **编写日期**：2026-07-10
> **状态**：草案 v1
