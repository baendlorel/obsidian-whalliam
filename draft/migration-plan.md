# Whalliam 架构复刻计划

> 基于 claudian（v2.0.31）的一比一架构复刻，将 CodeWhale 作为唯一 provider 实现。

---

## 一、架构对比概览

### 1.1 claudian 核心架构

```
claudian/
├── src/
│   ├── main.ts                          # 插件入口（926 行）
│   ├── core/                            # 无 provider 依赖的基础设施
│   │   ├── types/                       # 共享类型定义
│   │   │   ├── index.ts                 # 统一导出
│   │   │   ├── chat.ts                  # 聊天类型（ChatMessage, Conversation, StreamChunk, UsageInfo）
│   │   │   ├── agent.ts                 # Agent 定义
│   │   │   ├── settings.ts              # 设置类型（ClaudianSettings, SlashCommand, PermissionMode）
│   │   │   ├── diff.ts                  # Diff 类型
│   │   │   ├── tools.ts                 # 工具类型
│   │   │   ├── provider.ts              # ProviderId 类型
│   │   │   ├── plugins.ts               # 插件类型
│   │   │   └── mcp.ts                   # MCP 类型
│   │   ├── providers/                   # Provider 注册与能力契约
│   │   │   ├── types.ts                 # 核心契约（590 行）
│   │   │   ├── ProviderRegistry.ts      # 聊天侧 provider 注册表
│   │   │   ├── ProviderWorkspaceRegistry.ts  # 工作区侧 provider 注册表
│   │   │   ├── ProviderSettingsCoordinator.ts # 设置协调器
│   │   │   ├── conversationModel.ts     # 对话模型解析
│   │   │   ├── modelRouting.ts          # 模型路由
│   │   │   ├── modelSelection.ts        # 模型选择
│   │   │   ├── providerConfig.ts        # Provider 配置
│   │   │   ├── providerEnvironment.ts   # 环境变量
│   │   │   └── reasoning.ts             # 推理控制
│   │   ├── runtime/                     # 聊天运行时接口
│   │   │   ├── ChatRuntime.ts           # ChatRuntime 接口（核心契约）
│   │   │   ├── QueuedTurn.ts            # 排队轮次
│   │   │   └── types.ts                 # 运行时类型
│   │   ├── bootstrap/                   # 存储启动
│   │   │   ├── storage.ts               # SharedAppStorage 接口
│   │   │   ├── SessionStorage.ts        # 会话存储
│   │   │   ├── StoragePaths.ts          # 存储路径
│   │   │   └── tabManagerState.ts       # 标签管理器状态
│   │   ├── auxiliary/                   # 辅助服务
│   │   │   ├── AuxQueryRunner.ts        # 辅助查询运行器
│   │   │   ├── QueryBackedInlineEditService.ts
│   │   │   ├── QueryBackedInstructionRefineService.ts
│   │   │   └── QueryBackedTitleGenerationService.ts
│   │   ├── storage/                     # 存储适配器
│   │   │   ├── VaultFileAdapter.ts      # Vault 文件适配器
│   │   │   └── HomeFileAdapter.ts       # Home 文件适配器
│   │   ├── mcp/                         # MCP 协调
│   │   │   ├── McpConfigParser.ts
│   │   │   ├── McpServerManager.ts
│   │   │   └── McpTester.ts
│   │   ├── tools/                       # 工具常量
│   │   │   ├── todo.ts
│   │   │   ├── toolIcons.ts
│   │   │   ├── toolInput.ts
│   │   │   ├── toolNames.ts
│   │   │   └── toolResultContent.ts
│   │   ├── prompt/                      # 提示模板
│   │   │   ├── mainAgent.ts
│   │   │   ├── inlineEdit.ts
│   │   │   ├── instructionRefine.ts
│   │   │   └── titleGeneration.ts
│   │   ├── commands/                    # 内置命令
│   │   │   └── builtInCommands.ts
│   │   └── security/                    # 安全
│   │       └── ApprovalManager.ts
│   ├── features/                        # UI 功能层
│   │   ├── chat/                        # 聊天功能（核心）
│   │   │   ├── ClaudianView.ts          # 主视图（792 行）
│   │   │   ├── constants.ts             # 常量
│   │   │   ├── rewind.ts                # 回退
│   │   │   ├── tabs/                    # 多标签系统
│   │   │   │   ├── types.ts             # TabData, TabId, TabLifecycleState
│   │   │   │   ├── Tab.ts               # 标签实现（1961 行）
│   │   │   │   ├── TabBar.ts            # 标签栏
│   │   │   │   ├── TabManager.ts        # 标签管理器
│   │   │   │   └── providerResolution.ts
│   │   │   ├── controllers/             # 控制器
│   │   │   │   ├── ConversationController.ts
│   │   │   │   ├── InputController.ts
│   │   │   │   ├── StreamController.ts
│   │   │   │   ├── NavigationController.ts
│   │   │   │   ├── SelectionController.ts
│   │   │   │   ├── BrowserSelectionController.ts
│   │   │   │   ├── CanvasSelectionController.ts
│   │   │   │   └── contextRowVisibility.ts
│   │   │   ├── rendering/               # 渲染器
│   │   │   │   ├── MessageRenderer.ts
│   │   │   │   ├── ThinkingBlockRenderer.ts
│   │   │   │   ├── ToolCallRenderer.ts
│   │   │   │   ├── DiffRenderer.ts
│   │   │   │   ├── WriteEditRenderer.ts
│   │   │   │   ├── TodoListRenderer.ts
│   │   │   │   ├── SubagentRenderer.ts
│   │   │   │   ├── InlineExitPlanMode.ts
│   │   │   │   ├── InlineAskUserQuestion.ts
│   │   │   │   ├── InlinePlanApproval.ts
│   │   │   │   ├── collapsible.ts
│   │   │   │   ├── subagentLifecycleResolution.ts
│   │   │   │   └── todoUtils.ts
│   │   │   ├── state/                   # 状态管理
│   │   │   │   ├── ChatState.ts         # 聊天状态（436 行）
│   │   │   │   └── types.ts             # 状态类型
│   │   │   ├── services/                # 服务
│   │   │   │   ├── BangBashService.ts
│   │   │   │   └── SubagentManager.ts
│   │   │   ├── ui/                      # UI 组件
│   │   │   │   ├── InputToolbar.ts
│   │   │   │   ├── StatusPanel.ts
│   │   │   │   ├── FileContext.ts
│   │   │   │   ├── ImageContext.ts
│   │   │   │   ├── NavigationSidebar.ts
│   │   │   │   ├── BangBashModeManager.ts
│   │   │   │   ├── InstructionModeManager.ts
│   │   │   │   ├── textareaResize.ts
│   │   │   │   └── file-context/
│   │   │   └── utils/                   # 工具
│   │   │       └── usageInfo.ts
│   │   ├── settings/                    # 设置功能
│   │   │   ├── ClaudianSettings.ts      # 设置标签页（672 行）
│   │   │   ├── keyboardNavigation.ts
│   │   │   └── ui/
│   │   │       └── EnvironmentSettingsSection.ts
│   │   └── inline-edit/                 # 内联编辑
│   │       └── ui/
│   │           └── InlineEditModal.ts
│   ├── providers/                       # 具体 provider 实现
│   │   ├── index.ts                     # 注册入口
│   │   ├── defaultProviderConfigs.ts    # 默认 provider 配置
│   │   ├── claude/                      # Claude provider
│   │   │   ├── registration.ts
│   │   │   └── app/ClaudeWorkspaceServices.ts
│   │   ├── codex/                       # Codex provider
│   │   │   ├── registration.ts
│   │   │   └── app/CodexWorkspaceServices.ts
│   │   ├── opencode/                    # OpenCode provider
│   │   │   ├── registration.ts
│   │   │   └── app/OpencodeWorkspaceServices.ts
│   │   └── pi/                          # Pi provider
│   │       ├── registration.ts
│   │       └── app/PiWorkspaceServices.ts
│   ├── app/                             # 应用层
│   │   ├── settings/
│   │   │   ├── ClaudianSettingsStorage.ts
│   │   │   └── defaultSettings.ts
│   │   └── storage/
│   │       └── SharedStorageService.ts
│   ├── shared/                          # 共享组件
│   │   ├── icons.ts
│   │   ├── components/
│   │   │   └── SlashCommandDropdown.ts
│   │   ├── modals/
│   │   └── mention/
│   ├── i18n/                            # 国际化（10 种语言）
│   │   ├── i18n.ts
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── locales/  (de, en, es, fr, ja, ko, pt, ru, zh-CN, zh-TW)
│   ├── style/                           # CSS 模块化系统
│   │   ├── index.css                    # 入口（@import 链）
│   │   ├── accessibility.css
│   │   ├── base/                        # 基础样式
│   │   │   ├── variables.css
│   │   │   ├── container.css
│   │   │   └── animations.css
│   │   ├── components/                  # 组件样式
│   │   │   ├── header.css
│   │   │   ├── tabs.css
│   │   │   ├── history.css
│   │   │   ├── messages.css
│   │   │   ├── nav-sidebar.css
│   │   │   ├── code.css
│   │   │   ├── thinking.css
│   │   │   ├── toolcalls.css
│   │   │   ├── status-panel.css
│   │   │   ├── subagent.css
│   │   │   ├── input.css
│   │   │   └── context-footer.css
│   │   ├── toolbar/                     # 工具栏样式
│   │   │   ├── model-selector.css
│   │   │   ├── mode-selector.css
│   │   │   ├── thinking-selector.css
│   │   │   ├── permission-toggle.css
│   │   │   ├── service-tier-toggle.css
│   │   │   ├── external-context.css
│   │   │   └── mcp-selector.css
│   │   ├── features/                    # 功能样式
│   │   │   ├── file-context.css
│   │   │   ├── file-link.css
│   │   │   ├── image-context.css
│   │   │   ├── image-embed.css
│   │   │   ├── image-modal.css
│   │   │   ├── inline-edit.css
│   │   │   ├── diff.css
│   │   │   ├── slash-commands.css
│   │   │   ├── resume-session.css
│   │   │   ├── ask-user-question.css
│   │   │   └── plan-mode.css
│   │   ├── modals/                      # 模态框样式
│   │   │   ├── instruction.css
│   │   │   ├── mcp-modal.css
│   │   │   └── fork-target.css
│   │   └── settings/                    # 设置样式
│   │       └── settings.css
│   ├── types/                           # 类型声明
│   │   └── smol-toml.d.ts
│   └── utils/                           # 工具函数（20+ 文件）
│       ├── agent.ts
│       ├── animationFrame.ts
│       ├── browser.ts
│       ├── canvas.ts
│       ├── cliBinaryLocator.ts
│       ├── context.ts
│       ├── contextMentionResolver.ts
│       ├── date.ts
│       ├── diff.ts
│       ├── editor.ts
│       ├── electronCompat.ts
│       ├── env.ts
│       ├── externalContext.ts
│       ├── externalContextScanner.ts
│       ├── fileLink.ts
│       ├── frontmatter.ts
│       ├── imageAttachment.ts
│       ├── imageEmbed.ts
│       ├── inlineEdit.ts
│       ├── interrupt.ts
│       ├── markdown.ts
│       ├── markdownMath.ts
│       ├── mcp.ts
│       ├── obsidianCompat.ts
│       ├── path.ts
│       ├── session.ts
│       ├── slashCommand.ts
│       ├── subagentJsonl.ts
│       └── windowsCmdShim.ts
```

### 1.2 whalliam 当前架构

```
src/
├── main.ts                  # 插件入口（简单）
├── consts.ts                # 常量与默认设置
├── types.ts                 # 类型定义
├── settings.ts              # 设置标签页
├── utils.ts                 # 工具函数
├── styles.css               # 单文件样式
├── i18n/
│   ├── index.ts             # t() 函数
│   └── dict.ts              # 翻译字典
├── bridge/                  # CodeWhale 通信层
│   ├── index.ts             # CodeWhaleBridge
│   ├── types.ts             # 类型
│   ├── http-client.ts       # HTTP/SSE 客户端
│   └── process-manager.ts   # 子进程管理
└── views/
    └── chat-view.ts         # 侧边栏聊天视图（727 行）
```

### 1.3 复刻策略

**核心原则：保留 claudian 的架构骨架，用 CodeWhale 替换所有 provider 实现。**

| 层级 | 策略 | 说明 |
|------|------|------|
| `core/` | 保留结构 | 类型、runtime 接口、provider 注册表等保持不变 |
| `features/` | 保留结构 | 聊天视图、多标签、设置、渲染器全部保留 |
| `providers/` | 只保留 codewhale | 删除 claude/codex/opencode/pi，只实现 CodeWhale provider |
| `style/` | 简化但保留结构 | 保留 CSS 模块化系统，去除不相关的功能样式 |
| `i18n/` | 简化 | 只保留 en + zh-CN |
| `utils/` | 按需保留 | 去掉 provider 特定工具，保留通用工具 |
| `app/` | 保留结构 | 设置存储、默认设置 |
| `shared/` | 按需保留 | 图标、下拉组件 |

---

## 二、新 whalliam 目录结构

```
src/
├── main.ts                          # 插件入口（对标 claudian/src/main.ts）
├── core/                            # 无 provider 依赖的基础设施
│   ├── types/                       # 共享类型定义
│   │   ├── index.ts                 # 统一导出
│   │   ├── chat.ts                  # ChatMessage, Conversation, StreamChunk, UsageInfo
│   │   ├── agent.ts                 # Agent 定义
│   │   ├── settings.ts              # WhalliamSettings, SlashCommand, PermissionMode
│   │   ├── diff.ts                  # Diff 类型
│   │   ├── tools.ts                 # 工具类型
│   │   ├── provider.ts              # ProviderId（只保留 'codewhale'）
│   │   ├── plugins.ts               # 插件类型
│   │   └── mcp.ts                   # MCP 类型
│   ├── providers/                   # Provider 注册与能力契约
│   │   ├── types.ts                 # 核心契约（简化，只保留必要接口）
│   │   ├── ProviderRegistry.ts      # 聊天侧 provider 注册表
│   │   ├── ProviderWorkspaceRegistry.ts  # 工作区侧 provider 注册表
│   │   ├── ProviderSettingsCoordinator.ts
│   │   ├── conversationModel.ts
│   │   ├── modelRouting.ts
│   │   ├── modelSelection.ts
│   │   ├── providerConfig.ts
│   │   ├── providerEnvironment.ts
│   │   └── reasoning.ts
│   ├── runtime/                     # 聊天运行时接口
│   │   ├── ChatRuntime.ts           # ChatRuntime 接口
│   │   ├── QueuedTurn.ts
│   │   └── types.ts
│   ├── bootstrap/                   # 存储启动
│   │   ├── storage.ts               # SharedAppStorage 接口
│   │   ├── SessionStorage.ts
│   │   ├── StoragePaths.ts
│   │   └── tabManagerState.ts
│   ├── auxiliary/                   # 辅助服务
│   │   ├── AuxQueryRunner.ts
│   │   ├── QueryBackedInlineEditService.ts
│   │   ├── QueryBackedInstructionRefineService.ts
│   │   └── QueryBackedTitleGenerationService.ts
│   ├── storage/                     # 存储适配器
│   │   ├── VaultFileAdapter.ts
│   │   └── HomeFileAdapter.ts
│   ├── mcp/                         # MCP 协调
│   │   ├── McpConfigParser.ts
│   │   ├── McpServerManager.ts
│   │   └── McpTester.ts
│   ├── tools/                       # 工具常量
│   │   ├── todo.ts
│   │   ├── toolIcons.ts
│   │   ├── toolInput.ts
│   │   ├── toolNames.ts
│   │   └── toolResultContent.ts
│   ├── prompt/                      # 提示模板
│   │   ├── mainAgent.ts
│   │   ├── inlineEdit.ts
│   │   ├── instructionRefine.ts
│   │   └── titleGeneration.ts
│   ├── commands/                    # 内置命令
│   │   └── builtInCommands.ts
│   └── security/                    # 安全
│       └── ApprovalManager.ts
├── features/                        # UI 功能层
│   ├── chat/                        # 聊天功能
│   │   ├── WhalliamView.ts          # 主视图（对标 ClaudianView.ts）
│   │   ├── constants.ts             # 常量
│   │   ├── rewind.ts
│   │   ├── tabs/                    # 多标签系统
│   │   │   ├── types.ts             # TabData, TabId, TabLifecycleState
│   │   │   ├── Tab.ts               # 标签实现（核心）
│   │   │   ├── TabBar.ts
│   │   │   ├── TabManager.ts
│   │   │   └── providerResolution.ts
│   │   ├── controllers/
│   │   │   ├── ConversationController.ts
│   │   │   ├── InputController.ts
│   │   │   ├── StreamController.ts
│   │   │   ├── NavigationController.ts
│   │   │   ├── SelectionController.ts
│   │   │   └── contextRowVisibility.ts
│   │   ├── rendering/
│   │   │   ├── MessageRenderer.ts
│   │   │   ├── ThinkingBlockRenderer.ts
│   │   │   ├── ToolCallRenderer.ts
│   │   │   ├── DiffRenderer.ts
│   │   │   ├── WriteEditRenderer.ts
│   │   │   ├── TodoListRenderer.ts
│   │   │   ├── SubagentRenderer.ts
│   │   │   ├── collapsible.ts
│   │   │   └── todoUtils.ts
│   │   ├── state/
│   │   │   ├── ChatState.ts
│   │   │   └── types.ts
│   │   ├── services/
│   │   │   └── SubagentManager.ts
│   │   ├── ui/
│   │   │   ├── InputToolbar.ts
│   │   │   ├── StatusPanel.ts
│   │   │   ├── FileContext.ts
│   │   │   ├── ImageContext.ts
│   │   │   ├── NavigationSidebar.ts
│   │   │   ├── textareaResize.ts
│   │   │   └── file-context/
│   │   └── utils/
│   │       └── usageInfo.ts
│   ├── settings/                    # 设置功能
│   │   ├── WhalliamSettings.ts      # 设置标签页
│   │   └── keyboardNavigation.ts
│   └── inline-edit/                 # 内联编辑
│       └── ui/
│           └── InlineEditModal.ts
├── providers/                       # 具体 provider 实现
│   ├── index.ts                     # 注册入口
│   ├── defaultProviderConfigs.ts
│   └── codewhale/                   # CodeWhale provider（唯一）
│       ├── registration.ts          # ProviderRegistration
│       ├── app/
│       │   └── CodewhaleWorkspaceServices.ts  # ProviderWorkspaceServices
│       └── runtime/
│           └── CodewhaleChatRuntime.ts        # ChatRuntime 实现
├── app/                             # 应用层
│   ├── settings/
│   │   ├── WhalliamSettingsStorage.ts
│   │   └── defaultSettings.ts
│   └── storage/
│       └── SharedStorageService.ts
├── shared/                          # 共享组件
│   ├── icons.ts
│   ├── components/
│   │   └── SlashCommandDropdown.ts
│   └── modals/
├── i18n/                            # 国际化
│   ├── i18n.ts                      # 对标 claudian 的 i18n.ts
│   ├── types.ts
│   ├── constants.ts
│   └── locales/
│       ├── en.json
│       └── zh-CN.json
├── style/                           # CSS 模块化系统
│   ├── index.css                    # 入口
│   ├── accessibility.css
│   ├── base/
│   │   ├── variables.css
│   │   ├── container.css
│   │   └── animations.css
│   ├── components/
│   │   ├── header.css
│   │   ├── tabs.css
│   │   ├── history.css
│   │   ├── messages.css
│   │   ├── code.css
│   │   ├── thinking.css
│   │   ├── toolcalls.css
│   │   ├── status-panel.css
│   │   ├── subagent.css
│   │   └── input.css
│   ├── toolbar/
│   │   ├── model-selector.css
│   │   ├── mode-selector.css
│   │   ├── thinking-selector.css
│   │   └── permission-toggle.css
│   ├── features/
│   │   ├── file-context.css
│   │   ├── file-link.css
│   │   ├── image-context.css
│   │   ├── image-embed.css
│   │   ├── inline-edit.css
│   │   ├── diff.css
│   │   └── slash-commands.css
│   ├── modals/
│   │   └── instruction.css
│   └── settings/
│       └── settings.css
├── types/                           # 类型声明
│   └── smol-toml.d.ts
└── utils/                           # 工具函数
    ├── animationFrame.ts
    ├── context.ts
    ├── date.ts
    ├── diff.ts
    ├── editor.ts
    ├── electronCompat.ts
    ├── env.ts
    ├── externalContext.ts
    ├── externalContextScanner.ts
    ├── fileLink.ts
    ├── frontmatter.ts
    ├── imageAttachment.ts
    ├── imageEmbed.ts
    ├── inlineEdit.ts
    ├── markdown.ts
    ├── markdownMath.ts
    ├── obsidianCompat.ts
    └── path.ts
```

---

## 三、核心改造点

### 3.1 Provider 系统简化

claudian 有 4 个 provider（claude, codex, opencode, pi），每个有独立的 SDK。whalliam 只需要一个 CodeWhale provider。

**改造方案：**

```
claudian/src/providers/          →  whalliam/src/providers/
├── claude/                      →  （删除）
├── codex/                       →  （删除）
├── opencode/                    →  （删除）
├── pi/                          →  （删除）
├── index.ts                     →  index.ts（只注册 codewhale）
├── defaultProviderConfigs.ts    →  defaultProviderConfigs.ts（只有 codewhale 配置）
└── codewhale/                   →  codewhale/（新增）
    ├── registration.ts          →  ProviderRegistration
    ├── app/
    │   └── CodewhaleWorkspaceServices.ts
    └── runtime/
        └── CodewhaleChatRuntime.ts  ← 核心！ChatRuntime 实现
```

**CodewhaleChatRuntime 需要实现 ChatRuntime 接口的所有方法：**

```typescript
// 核心流程
prepareTurn(request) → PreparedChatTurn
query(turn, history, options) → AsyncGenerator<StreamChunk>
// 生命周期
ensureReady() → Promise<boolean>
cancel(), resetSession(), cleanup()
// 能力
getCapabilities(), getSessionId(), isReady()
// 会话管理
rewind(), buildSessionUpdates(), resolveSessionIdForFork()
// 回调
setApprovalCallback(), setAskUserQuestionCallback(), setExitPlanModeCallback()
```

**关键映射：CodeWhale HTTP API → ChatRuntime StreamChunk**

| CodeWhale SSE 事件 | StreamChunk 类型 |
|---------------------|------------------|
| `user_message` 创建 | `user_message_start` |
| `assistant_text` 创建 | `assistant_message_start` |
| `item.delta` (kind=agent_reasoning) | `thinking` |
| `item.delta` (kind=agent_message) | `text` |
| `tool_call` 创建 | `tool_use` |
| `tool_result` 创建 | `tool_result` |
| `item.delta` (tool 输出) | `tool_output` |
| `context_usage` 更新 | `usage` |
| `context_compacted` | `context_compacted` |
| turn completed | `done` |
| error | `error` |

### 3.2 多标签系统

claudian 的多标签系统是核心特性，需要完整保留。每个标签有独立的：
- ChatRuntime 实例
- ChatState（消息、流式状态）
- Controllers（输入、流、导航、选择）
- UI 组件（模型选择器、工具栏等）

### 3.3 CodeWhale 进程管理

**关键差异：** claudian 的每个 provider 通过 SDK 创建独立的运行时实例。whalliam 使用单一的 CodeWhale HTTP 服务器，所有标签共享同一个进程。

**方案：**
- `CodewhaleChatRuntime` 内部使用现有的 `HttpClient` 与 CodeWhale HTTP API 通信
- 每个标签创建独立的 thread（通过 `POST /v1/threads`）
- 流式响应通过 SSE（`GET /v1/threads/{id}/events`）获取
- 进程管理保留在 `main.ts` 级别（对标 claudian 的 provider 进程管理）

### 3.4 会话存储

claudian 使用 `SharedAppStorage` → `SessionStorage` 持久化会话元数据，provider 管理自己的消息存储。

whalliam 中 CodeWhale 服务端管理完整会话（threads），插件只需要存储 UI 元数据：
- threadId 映射
- 标题
- 时间戳
- 最后响应时间

### 3.5 设置系统

claudian 有复杂的设置系统（多 provider 配置、环境变量、snippet 等）。

whalliam 简化：
- 保留核心设置（model、thinking budget、permission mode）
- 保留环境变量设置（pass-through 到 CodeWhale）
- 保留 UI 设置（chatViewPlacement、maxTabs）
- 去除 provider-specific 设置（claude CLI path、codex CLI path 等）

### 3.6 样式系统

claudian 使用模块化 CSS（`@import` 在 `index.css` 中），构建时由 `build-css.mjs` 拼接。

whalliam 保留相同的 CSS 模块化系统，但只保留相关的样式模块：
- 保留：base、components、toolbar、features/diff、features/file-context、features/slash-commands
- 去除：多 provider 相关的样式、MCP 相关、plan-mode 特定样式

### 3.7 国际化

claudian 有 10 种语言，whalliam 只保留 en + zh-CN。

**方案：**
- 保留 claudian 的 `i18n/i18n.ts` 架构（`t()` 函数 + JSON 字典）
- 从 claudian 的 `en.json` 和 `zh-CN.json` 提取所有翻译键
- 翻译键的值需要根据 whalliam 的文案调整

---

## 四、实施阶段

### 阶段 1：基础设施搭建

**目标：** 建立完整的目录结构和构建系统，确保可以编译。

**任务清单：**

1. **更新构建配置**
   - 更新 `package.json`（版本号、依赖、脚本）
   - 更新 `tsconfig.json`（对齐 claudian 的配置）
   - 更新 `esbuild.config.mjs`（对齐 claudian 的 esbuild 配置）
   - 创建 `scripts/build-css.mjs`（CSS 构建脚本）
   - 创建 `scripts/build.mjs`（组合构建脚本）

2. **创建目录结构**
   - 创建 `src/core/` 及其子目录
   - 创建 `src/features/` 及其子目录
   - 创建 `src/providers/codewhale/` 及其子目录
   - 创建 `src/app/` 及其子目录
   - 创建 `src/shared/` 及其子目录
   - 创建 `src/style/` 及其子目录
   - 创建 `src/i18n/locales/`

3. **复制 core/ 基础设施**
   - `core/types/` 全部文件（chat.ts, agent.ts, settings.ts, diff.ts, tools.ts, provider.ts, plugins.ts, mcp.ts, index.ts）
   - `core/providers/` 全部文件（types.ts, ProviderRegistry.ts, ProviderWorkspaceRegistry.ts, ProviderSettingsCoordinator.ts, conversationModel.ts, modelRouting.ts, modelSelection.ts, providerConfig.ts, providerEnvironment.ts, reasoning.ts）
   - `core/runtime/` 全部文件（ChatRuntime.ts, types.ts, QueuedTurn.ts）
   - `core/bootstrap/` 全部文件
   - `core/auxiliary/` 全部文件
   - `core/storage/` 全部文件
   - `core/tools/` 全部文件
   - `core/prompt/` 全部文件
   - `core/commands/` 全部文件
   - `core/security/` 全部文件

4. **复制 utils/**
   - 复制所有通用工具文件（约 20 个）
   - 去除 provider 专属工具（如 `cliBinaryLocator.ts` 中非 CodeWhale 的部分）

5. **复制 app/ 和 shared/**
   - `app/settings/` — 修改适配 whalliam
   - `app/storage/` — 修改适配 whalliam
   - `shared/icons.ts`

### 阶段 2：CodeWhale Provider 实现

**目标：** 实现 `CodewhaleChatRuntime`，让 CodeWhale HTTP API 适配 ChatRuntime 接口。

**核心文件：**
- `providers/codewhale/registration.ts` — ProviderRegistration
- `providers/codewhale/app/CodewhaleWorkspaceServices.ts` — ProviderWorkspaceServices
- `providers/codewhale/runtime/CodewhaleChatRuntime.ts` — ChatRuntime 实现

**关键逻辑：**
- `prepareTurn()` — 构建 system prompt、用户消息、工具列表
- `query()` — 通过 HTTP API 发送 turn，通过 SSE 流式接收事件，映射为 StreamChunk
- `ensureReady()` — 确保 CodeWhale 服务运行
- `cancel()` — 通过 HTTP API 取消正在进行的 turn
- `rewind()` — 通过 HTTP API 回退到指定消息

### 阶段 3：UI 层实现

**目标：** 实现 WhalliamView、Tab、TabManager、渲染器、控制器。

**核心文件：**
- `features/chat/WhalliamView.ts` — 对标 ClaudianView.ts
- `features/chat/tabs/Tab.ts` — 核心标签实现
- `features/chat/tabs/TabManager.ts` — 标签管理
- `features/chat/tabs/TabBar.ts` — 标签栏
- `features/chat/state/ChatState.ts` — 状态管理
- `features/chat/controllers/` — 所有控制器
- `features/chat/rendering/` — 所有渲染器
- `features/chat/ui/` — 所有 UI 组件
- `features/settings/WhalliamSettings.ts` — 设置标签页

### 阶段 4：样式与国际化

**目标：** 完成 CSS 模块和国际化翻译。

**核心文件：**
- `style/` 目录下所有 CSS 文件
- `i18n/locales/en.json` — 英文翻译
- `i18n/locales/zh-CN.json` — 中文翻译

### 阶段 5：入口与集成

**目标：** 实现 `main.ts`，集成所有模块。

**关键逻辑：**
- 加载设置
- 注册 CodeWhale provider
- 注册 WhalliamView
- 注册命令
- 进程生命周期管理

---

## 五、文件迁移清单（按照 Claude 项目的命名与组织方式）

### 5.1 直接复制（仅改名/改路径引用）

| claudian 源文件 | whalliam 目标文件 | 修改内容 |
|-----------------|-------------------|----------|
| `src/core/types/*` | `src/core/types/*` | 改名 Claudian→Whalliam，VIEW_TYPE_CLAUDIAN→VIEW_TYPE_WHALLIAM |
| `src/core/providers/*` | `src/core/providers/*` | 改名 DEFAULT_CHAT_PROVIDER_ID='codewhale' |
| `src/core/runtime/*` | `src/core/runtime/*` | 不变 |
| `src/core/bootstrap/*` | `src/core/bootstrap/*` | 改名 .claudian→.whalliam |
| `src/core/auxiliary/*` | `src/core/auxiliary/*` | 改名 plugin 类型引用 |
| `src/core/storage/*` | `src/core/storage/*` | 不变 |
| `src/core/tools/*` | `src/core/tools/*` | 不变 |
| `src/core/prompt/*` | `src/core/prompt/*` | 改名引用 |
| `src/core/commands/*` | `src/core/commands/*` | 不变 |
| `src/core/security/*` | `src/core/security/*` | 不变 |
| `src/utils/*` | `src/utils/*` | 改名引用 |

### 5.2 适配修改

| claudian 源文件 | whalliam 目标文件 | 修改内容 |
|-----------------|-------------------|----------|
| `src/main.ts` | `src/main.ts` | 大幅简化，只注册 codewhale provider |
| `src/app/settings/defaultSettings.ts` | `src/app/settings/defaultSettings.ts` | 简化设置 |
| `src/app/settings/ClaudianSettingsStorage.ts` | `src/app/settings/WhalliamSettingsStorage.ts` | 改名 |
| `src/app/storage/SharedStorageService.ts` | `src/app/storage/SharedStorageService.ts` | 改名 |
| `src/features/chat/ClaudianView.ts` | `src/features/chat/WhalliamView.ts` | 改名 |
| `src/features/chat/*` | `src/features/chat/*` | 改名引用 |
| `src/features/settings/ClaudianSettings.ts` | `src/features/settings/WhalliamSettings.ts` | 改名 |
| `src/features/inline-edit/*` | `src/features/inline-edit/*` | 改名引用 |
| `src/i18n/*` | `src/i18n/*` | 只保留 en+zh-CN，更新翻译 |
| `src/shared/icons.ts` | `src/shared/icons.ts` | 只保留 codewhale 图标 |
| `src/style/*` | `src/style/*` | 去除不相关样式 |

### 5.3 新增文件

| 新文件 | 说明 |
|--------|------|
| `src/providers/codewhale/registration.ts` | CodeWhale provider 注册 |
| `src/providers/codewhale/app/CodewhaleWorkspaceServices.ts` | 工作区服务 |
| `src/providers/codewhale/runtime/CodewhaleChatRuntime.ts` | ChatRuntime 实现 |
| `src/providers/codewhale/runtime/http-client.ts` | 从现有 bridge/http-client.ts 迁移 |
| `src/providers/codewhale/runtime/process-manager.ts` | 从现有 bridge/process-manager.ts 迁移 |
| `src/providers/codewhale/runtime/sse-parser.ts` | SSE 事件解析器 |

---

## 六、关键风险与注意事项

### 6.1 接口适配风险

claudian 的 ChatRuntime 接口是为 SDK 设计的（如 `prepareTurn`、`query`、`rewind`），而 CodeWhale 的接口是 HTTP API。需要仔细映射：

- **prepareTurn**: CodeWhale 的 system prompt 通过 HTTP header 或 thread 配置传递
- **query**: 映射到 `POST /v1/threads/{id}/turns` + `GET /v1/threads/{id}/events`
- **rewind**: CodeWhale 可能不原生支持，需要通过 `resumeAtMessageId` 实现
- **cancel**: 映射到 HTTP 取消 API（如果存在）

### 6.2 多标签 vs 单进程

claudian 每个标签有独立的 SDK 会话。whalliam 所有标签共享一个 CodeWhale 进程，但每个标签有独立的 thread。

需要确保：
- 进程管理在 `main.ts` 级别
- 每个 thread 的 SSE 流互不干扰
- 取消操作只影响目标 thread

### 6.3 import 写法

按照项目 CLAUDE.md 要求：使用 `nodenext` 模块解析 + `.js` 扩展名。

### 6.4 构建工具

claudian 使用 `esbuild` + `scripts/build-css.mjs` 构建 CSS。whalliam 需要添加相同的 CSS 构建流程。

---

## 七、预计工作量

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| 阶段 1 | 基础设施搭建 | 2-3 天 |
| 阶段 2 | CodeWhale Provider 实现 | 3-5 天 |
| 阶段 3 | UI 层实现 | 3-5 天 |
| 阶段 4 | 样式与国际化 | 1-2 天 |
| 阶段 5 | 入口与集成 | 1-2 天 |
| **总计** | | **10-17 天** |

---

## 八、审批检查点

请审核以下决策：

1. ✅ 是否保留 claudian 的多标签系统？
2. ✅ 是否只实现 CodeWhale 作为唯一 provider？
3. ✅ 是否保留 CSS 模块化系统？
4. ✅ 是否只保留 en + zh-CN 两种语言？
5. ✅ 是否保留 ChatRuntime 接口（适配 HTTP API）？
6. ⚠️ 是否需要保留 `rewind`、`fork`、`plan mode`、`MCP` 等高级功能？还是先做 MVP 再逐步添加？