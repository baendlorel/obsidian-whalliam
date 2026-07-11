# Whalliam 复刻计划 — 分步任务

> 每个任务独立可验收。完成一个验收通过后再做下一个。

---

## 任务目录

| # | 任务 | 内容 | 依赖 |
|---|------|------|------|
| 1 | 构建系统 | package.json, tsconfig.json, esbuild, build-css | 无 |
| 2 | 目录结构 | 创建所有目录 + 空占位文件 | 1 |
| 3 | Core 类型 | `core/types/*` — 7 个类型文件 | 2 |
| 4 | Core 运行时 | `core/runtime/*` + `core/providers/*` + `core/storage/*` + `core/tools/*` | 2, 3 |
| 5 | CodeWhale Provider | `providers/codewhale/*` — ChatRuntime 实现 | 4 |
| 6 | Utils + 辅助模块 | `utils/*` + `core/auxiliary/*` + `core/prompt/*` + `core/commands/*` + `core/security/*` | 2, 3 |
| 7 | UI 层 | `features/*` + `shared/*` + `app/*` | 5, 6 |
| 8 | 样式 + i18n | `style/*` + `i18n/*` | 2 |
| 9 | main.ts 集成 | 插件入口 + 最终编译验证 | 7, 8 |

---

## 任务 1：构建系统

**目标：** 对齐 claudian 的构建配置，确保 `pnpm build` 可以执行。

**输入：** 现有 `package.json`, `tsconfig.json`, `esbuild.config.mjs`

**具体工作：**
1. 更新 `package.json`
   - 改名 `whalliam`、更新版本号
   - 添加依赖：`@anthropic-ai/claude-agent-sdk`（可能需要）、`smol-toml`、`tslib`
   - 添加 devDep：`@types/jest`、`eslint` 系列（后续可去除）、`typescript@^6.0.2`
   - 添加/更新 scripts：`build`, `build:css`, `dev`, `typecheck`, `test`
   - 对齐 `engines: node >=24`
2. 更新 `tsconfig.json`
   - 对齐 claudian：`module: ESNext`, `moduleResolution: bundler`, `target: ES6`
   - 添加 `paths: { "@/*": ["./src/*"] }`, `importHelpers: true`
   - `lib: ["DOM", "ES2022"]`, `rootDir: "."`
3. 更新 `esbuild.config.mjs`
   - 对齐 claudian：`format: cjs`, `target: es2018`, `treeShaking: true`
   - 添加 `external: ['obsidian', 'electron', '@codemirror/*', ...builtinModules]`
   - 添加 `patch-sdk-import-meta` 插件
   - 添加 `patch-renderer-unsafe-unref` 插件
   - 添加 `copy-to-obsidian` 插件
4. 创建 `scripts/build-css.mjs`（从 claudian 复制）
5. 创建 `scripts/build.mjs`（从 claudian 复制）
6. 创建 `scripts/rendererSafeUnref.js`（从 claudian 复制）
7. 创建 `scripts/run-jest.js`（从 claudian 复制，可选）
8. 创建 `scripts/sync-version.js`（从 claudian 复制，可选）
9. 创建 `scripts/postinstall.mjs`（从 claudian 复制，可选）
10. 创建 `claudian/scripts/rendererSafeUnref.js` → `scripts/rendererSafeUnref.js`（复制）

**输出：**
- 更新后的 `package.json`
- 更新后的 `tsconfig.json`
- 更新后的 `esbuild.config.mjs`
- 新增 `scripts/build-css.mjs`
- 新增 `scripts/build.mjs`

**验收：**
- `pnpm install` 成功
- `node scripts/build-css.mjs` 成功（初始 `styles.css` 可以为空）
- `node esbuild.config.mjs` 成功（`main.ts` 可为空占位）
- `pnpm build` 成功

---

## 任务 2：目录结构

**目标：** 创建完整的目录骨架，每个目录放 `.gitkeep` 标记。

**输入：** 任务 1 构建系统就绪

**具体工作：**

```
src/
├── main.ts                          # 空占位（export default class WhalliamPlugin extends Plugin {}）
├── core/
│   ├── types/                       # 空 + .gitkeep → 任务 3 填充
│   ├── providers/                   # 空 → 任务 4 填充
│   ├── runtime/                     # 空 → 任务 4 填充
│   ├── bootstrap/                   # 空 → 任务 4 填充
│   ├── auxiliary/                   # 空 → 任务 6 填充
│   ├── storage/                     # 空 → 任务 4 填充
│   ├── mcp/                         # 空 → 任务 6 填充
│   ├── tools/                       # 空 → 任务 4 填充
│   ├── prompt/                      # 空 → 任务 6 填充
│   ├── commands/                    # 空 → 任务 6 填充
│   └── security/                    # 空 → 任务 6 填充
├── features/
│   ├── chat/
│   │   ├── tabs/                    # → 任务 7
│   │   ├── controllers/             # → 任务 7
│   │   ├── rendering/               # → 任务 7
│   │   ├── state/                   # → 任务 7
│   │   ├── services/                # → 任务 7
│   │   ├── ui/
│   │   │   └── file-context/        # → 任务 7
│   │   └── utils/                   # → 任务 7
│   ├── settings/                    # → 任务 7
│   │   └── ui/                      # → 任务 7
│   └── inline-edit/
│       └── ui/                      # → 任务 7
├── providers/
│   ├── index.ts                     # 空占位
│   ├── defaultProviderConfigs.ts    # 空占位
│   └── codewhale/
│       ├── registration.ts          # 空占位
│       ├── app/
│       │   └── CodewhaleWorkspaceServices.ts  # 空占位
│       └── runtime/
│           └── CodewhaleChatRuntime.ts  # 空占位 → 任务 5
├── app/
│   ├── settings/
│   │   ├── WhalliamSettingsStorage.ts  # → 任务 7
│   │   └── defaultSettings.ts          # → 任务 7
│   └── storage/
│       └── SharedStorageService.ts     # → 任务 7
├── shared/
│   ├── icons.ts                     # → 任务 7
│   ├── components/                  # → 任务 7
│   ├── modals/                      # → 任务 7
│   └── mention/                     # → 任务 7
├── i18n/
│   ├── i18n.ts                      # 从 claudian 复制（先不改翻译内容）
│   ├── types.ts                     # 从 claudian 复制
│   ├── constants.ts                 # 从 claudian 复制
│   └── locales/
│       ├── en.json                  # 从 claudian 复制（任务 8 裁剪）
│       └── zh-CN.json               # 从 claudian 复制（任务 8 裁剪）
├── style/
│   ├── index.css                    # 从 claudian 复制（任务 8 裁剪）
│   ├── accessibility.css            # 从 claudian 复制
│   ├── base/                        # 从 claudian 复制
│   ├── components/                  # 从 claudian 复制
│   ├── toolbar/                     # 从 claudian 复制
│   ├── features/                    # 从 claudian 复制
│   ├── modals/                      # 从 claudian 复制
│   └── settings/                    # 从 claudian 复制
├── types/
│   └── smol-toml.d.ts              # 从 claudian 复制
└── utils/                           # 空 → 任务 6 填充
```

**输出：** 完整的目录结构 + 空占位文件

**验收：**
- `ls -R src/` 显示所有目录已创建
- `pnpm build` 成功（空文件可编译）

---

## 任务 3：Core 类型

**目标：** 从 claudian 复制 `core/types/` 下 7 个类型文件，改名适配。

**输入：** 任务 2 目录结构

**具体工作：**

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `core/types/chat.ts` | `core/types/chat.ts` | `VIEW_TYPE_CLAUDIAN` → `VIEW_TYPE_WHALLIAM` |
| `core/types/agent.ts` | `core/types/agent.ts` | 不变 |
| `core/types/diff.ts` | `core/types/diff.ts` | 不变 |
| `core/types/tools.ts` | `core/types/tools.ts` | 不变 |
| `core/types/provider.ts` | `core/types/provider.ts` | 改用 `ProviderId = 'codewhale'` |
| `core/types/plugins.ts` | `core/types/plugins.ts` | 不变 |
| `core/types/mcp.ts` | `core/types/mcp.ts` | 不变 |
| `core/types/settings.ts` | `core/types/settings.ts` | `ClaudianSettings` → `WhalliamSettings`，简化字段 |
| `core/types/index.ts` | `core/types/index.ts` | 改名导出 |

**关键修改：**
- `VIEW_TYPE_CLAUDIAN = 'claudian-view'` → `VIEW_TYPE_WHALLIAM = 'whalliam-view'`
- `ClaudianSettings` → `WhalliamSettings`（去掉多 provider 字段）
- `ProviderId = 'claude' | 'codex' | 'opencode' | 'pi'` → `ProviderId = 'codewhale'`
- `DEFAULT_CHAT_PROVIDER_ID = 'codewhale'`

**输出：** 8 个类型文件（放在 `src/core/types/`）

**验收：**
- `pnpm typecheck` 通过（类型定义无依赖，可独立编译）

---

## 任务 4：Core 运行时 + Provider 契约

**目标：** 复制 `core/runtime/`、`core/providers/`、`core/bootstrap/`、`core/storage/`、`core/tools/`

**输入：** 任务 3 类型系统就绪

**具体工作：**

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `core/runtime/ChatRuntime.ts` | `core/runtime/ChatRuntime.ts` | 不变 |
| `core/runtime/types.ts` | `core/runtime/types.ts` | 改名引用 |
| `core/runtime/QueuedTurn.ts` | `core/runtime/QueuedTurn.ts` | 改名引用 |
| `core/providers/types.ts` | `core/providers/types.ts` | `ClaudianPlugin` → `WhalliamPlugin`, `DEFAULT_CHAT_PROVIDER_ID='codewhale'` |
| `core/providers/ProviderRegistry.ts` | `core/providers/ProviderRegistry.ts` | 改名引用 |
| `core/providers/ProviderWorkspaceRegistry.ts` | `core/providers/ProviderWorkspaceRegistry.ts` | 改名引用 |
| `core/providers/ProviderSettingsCoordinator.ts` | `core/providers/ProviderSettingsCoordinator.ts` | 改名引用 |
| `core/providers/conversationModel.ts` | `core/providers/conversationModel.ts` | 改名引用 |
| `core/providers/modelRouting.ts` | `core/providers/modelRouting.ts` | 改名引用 |
| `core/providers/modelSelection.ts` | `core/providers/modelSelection.ts` | 改名引用 |
| `core/providers/providerConfig.ts` | `core/providers/providerConfig.ts` | 改名引用 |
| `core/providers/providerEnvironment.ts` | `core/providers/providerEnvironment.ts` | 改名引用 |
| `core/providers/reasoning.ts` | `core/providers/reasoning.ts` | 改名引用 |
| `core/bootstrap/storage.ts` | `core/bootstrap/storage.ts` | 改名引用 |
| `core/bootstrap/SessionStorage.ts` | `core/bootstrap/SessionStorage.ts` | 改名引用 |
| `core/bootstrap/StoragePaths.ts` | `core/bootstrap/StoragePaths.ts` | `.claudian` → `.whalliam` |
| `core/bootstrap/tabManagerState.ts` | `core/bootstrap/tabManagerState.ts` | 改名引用 |
| `core/storage/VaultFileAdapter.ts` | `core/storage/VaultFileAdapter.ts` | 不变 |
| `core/storage/HomeFileAdapter.ts` | `core/storage/HomeFileAdapter.ts` | 不变 |
| `core/tools/todo.ts` | `core/tools/todo.ts` | 不变 |
| `core/tools/toolIcons.ts` | `core/tools/toolIcons.ts` | 不变 |
| `core/tools/toolInput.ts` | `core/tools/toolInput.ts` | 不变 |
| `core/tools/toolNames.ts` | `core/tools/toolNames.ts` | 不变 |
| `core/tools/toolResultContent.ts` | `core/tools/toolResultContent.ts` | 不变 |

**输出：** 24 个 core 文件

**验收：**
- `pnpm typecheck` 通过
- `pnpm build` 成功（可能因为缺少 provider 实现会有运行时错误，但编译期 OK）

---

## 任务 5：CodeWhale Provider

**目标：** 实现 CodeWhale provider 的 `ProviderRegistration` 和 `ChatRuntime`

**输入：** 任务 4 core 契约就绪

**具体工作：**

1. **`providers/index.ts`** — 注册 codewhale provider
2. **`providers/defaultProviderConfigs.ts`** — 只有 codewhale 的默认配置
3. **`providers/codewhale/registration.ts`** — 实现 `ProviderRegistration` 接口
4. **`providers/codewhale/app/CodewhaleWorkspaceServices.ts`** — 实现 `ProviderWorkspaceServices`（CLI 解析、命令加载等）
5. **`providers/codewhale/runtime/CodewhaleChatRuntime.ts`** — 核心！实现 `ChatRuntime` 接口

**ProviderRegistration 关键字段：**
```typescript
{
  displayName: 'CodeWhale',
  blankTabOrder: 1,
  isEnabled: (settings) => true,
  capabilities: {
    providerId: 'codewhale',
    supportsPersistentRuntime: true,
    supportsNativeHistory: true,
    supportsPlanMode: true,
    supportsRewind: false,     // CodeWhale API 可能不支持
    supportsFork: false,
    supportsProviderCommands: true,
    supportsImageAttachments: false,
    supportsInstructionMode: false,
    supportsMcpTools: false,
    supportsTurnSteer: false,
    reasoningControl: 'effort',
  },
  chatUIConfig: { /* 模型选项、推理选项、上下文窗口 */ },
  settingsReconciler: { /* 模型与环境协调 */ },
  createRuntime: (opts) => new CodewhaleChatRuntime(opts),
  createTitleGenerationService: (plugin) => ...,
  createInstructionRefineService: (plugin) => ...,
  createInlineEditService: (plugin) => ...,
  historyService: { /* 会话历史服务 */ },
  taskResultInterpreter: { /* 任务结果解释 */ },
}
```

**CodewhaleChatRuntime 核心流程：**
```
prepareTurn(request)
  → 构建 HTTP request body（system prompt, user message, tools 等）
  
query(turn, history)
  → POST /v1/threads/{id}/turns (创建 turn)
  → GET /v1/threads/{id}/events (SSE 流)
  → 解析 SSE 事件映射为 StreamChunk
  → yield StreamChunk

ensureReady()
  → 确保 CodeWhale 进程运行 + HTTP API 健康检查

cancel()
  → 通过 HTTP API 取消 turn（如果 API 支持）
  或 → 断开 SSE 连接

getSessionId()
  → 返回 threadId

resetSession()
  → 创建新 thread

rewind()
  → 通过 resumeAtMessageId 在创建 thread 时恢复
```

**从现有 bridge 迁移的代码：**
- `bridge/http-client.ts` → `providers/codewhale/runtime/http-client.ts`
- `bridge/process-manager.ts` → `providers/codewhale/runtime/process-manager.ts`

**输出：**
- `providers/index.ts`
- `providers/defaultProviderConfigs.ts`
- `providers/codewhale/registration.ts`
- `providers/codewhale/app/CodewhaleWorkspaceServices.ts`
- `providers/codewhale/runtime/CodewhaleChatRuntime.ts`
- `providers/codewhale/runtime/http-client.ts`
- `providers/codewhale/runtime/process-manager.ts`

**验收：**
- `pnpm typecheck` 通过
- `pnpm build` 成功
- ChatRuntime 接口所有方法有实现

---

## 任务 6：Utils + 辅助模块

**目标：** 复制 claudian 的工具函数和辅助模块

**输入：** 任务 2 目录结构 + 任务 3 类型

**具体工作：**

### Utils（约 20 个文件，从 claudian 复制）

| 文件名 | 用途 | 修改 |
|--------|------|------|
| `animationFrame.ts` | requestAnimationFrame 封装 | 不变 |
| `browser.ts` | 浏览器交互 | 去掉 provider 特定逻辑 |
| `canvas.ts` | Canvas 交互 | 不变 |
| `context.ts` | 上下文提取 | 改名引用 |
| `contextMentionResolver.ts` | @mention 解析 | 改名引用 |
| `date.ts` | 日期工具 | 不变 |
| `diff.ts` | Diff 工具 | 不变 |
| `editor.ts` | 编辑器工具（buildCursorContext） | 不变 |
| `electronCompat.ts` | Electron 兼容补丁 | 不变 |
| `env.ts` | 环境变量解析 | 不变 |
| `externalContext.ts` | 外部上下文 | 改名引用 |
| `externalContextScanner.ts` | 外部上下文扫描 | 改名引用 |
| `fileLink.ts` | 文件链接 | 不变 |
| `frontmatter.ts` | frontmatter 解析 | 不变 |
| `imageAttachment.ts` | 图片附件 | 不变 |
| `imageEmbed.ts` | 图片嵌入 | 不变 |
| `inlineEdit.ts` | 内联编辑工具 | 不变 |
| `markdown.ts` | Markdown 工具 | 不变 |
| `markdownMath.ts` | Math 渲染 | 不变 |
| `obsidianCompat.ts` | Obsidian API 兼容 | 不变 |
| `path.ts` | 路径工具（getVaultPath） | 不变 |

**不复制（provider 特定）：**
- `agent.ts`（多 provider agent）
- `cliBinaryLocator.ts`（已迁移到 codewhale/provider）
- `interrupt.ts`
- `mcp.ts`（MCP 暂不支持）
- `session.ts`
- `slashCommand.ts`
- `subagentJsonl.ts`
- `windowsCmdShim.ts`

### 辅助模块（从 claudian 复制）

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `core/auxiliary/AuxQueryRunner.ts` | `core/auxiliary/AuxQueryRunner.ts` | 改名引用 |
| `core/auxiliary/QueryBacked*.ts` (3个) | `core/auxiliary/QueryBacked*.ts` | 改名引用 |
| `core/prompt/mainAgent.ts` | `core/prompt/mainAgent.ts` | 改名引用 |
| `core/prompt/inlineEdit.ts` | `core/prompt/inlineEdit.ts` | 不变 |
| `core/prompt/instructionRefine.ts` | `core/prompt/instructionRefine.ts` | 不变 |
| `core/prompt/titleGeneration.ts` | `core/prompt/titleGeneration.ts` | 不变 |
| `core/commands/builtInCommands.ts` | `core/commands/builtInCommands.ts` | 改名引用 |
| `core/security/ApprovalManager.ts` | `core/security/ApprovalManager.ts` | 不变 |

**输出：** ~30 个文件

**验收：**
- `pnpm typecheck` 通过
- utils 文件中的导入路径全部指向 whalliam 的模块

---

## 任务 7：UI 层

**目标：** 实现 features/ 下所有 UI 模块

**输入：** 任务 5 Provider + 任务 6 Utils 就绪

**具体工作：**

### 7a. State（状态管理）

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/chat/state/ChatState.ts` | `features/chat/state/ChatState.ts` | 改名引用 |
| `features/chat/state/types.ts` | `features/chat/state/types.ts` | 改名引用 |

### 7b. Controllers（控制器）

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/chat/controllers/ConversationController.ts` | `features/chat/controllers/ConversationController.ts` | 改名引用 |
| `features/chat/controllers/InputController.ts` | `features/chat/controllers/InputController.ts` | 改名引用 |
| `features/chat/controllers/StreamController.ts` | `features/chat/controllers/StreamController.ts` | 改名引用 |
| `features/chat/controllers/NavigationController.ts` | `features/chat/controllers/NavigationController.ts` | 改名引用 |
| `features/chat/controllers/SelectionController.ts` | `features/chat/controllers/SelectionController.ts` | 改名引用 |
| `features/chat/controllers/contextRowVisibility.ts` | `features/chat/controllers/contextRowVisibility.ts` | 不变 |

**不复制：** `BrowserSelectionController.ts`, `CanvasSelectionController.ts`（暂不需要）

### 7c. Rendering（渲染器）

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/chat/rendering/MessageRenderer.ts` | `features/chat/rendering/MessageRenderer.ts` | 改名引用 |
| `features/chat/rendering/ThinkingBlockRenderer.ts` | `features/chat/rendering/ThinkingBlockRenderer.ts` | 改名引用 |
| `features/chat/rendering/ToolCallRenderer.ts` | `features/chat/rendering/ToolCallRenderer.ts` | 改名引用 |
| `features/chat/rendering/DiffRenderer.ts` | `features/chat/rendering/DiffRenderer.ts` | 改名引用 |
| `features/chat/rendering/WriteEditRenderer.ts` | `features/chat/rendering/WriteEditRenderer.ts` | 改名引用 |
| `features/chat/rendering/TodoListRenderer.ts` | `features/chat/rendering/TodoListRenderer.ts` | 改名引用 |
| `features/chat/rendering/SubagentRenderer.ts` | `features/chat/rendering/SubagentRenderer.ts` | 改名引用 |
| `features/chat/rendering/collapsible.ts` | `features/chat/rendering/collapsible.ts` | 不变 |
| `features/chat/rendering/todoUtils.ts` | `features/chat/rendering/todoUtils.ts` | 不变 |

### 7d. UI 组件

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/chat/ui/InputToolbar.ts` | `features/chat/ui/InputToolbar.ts` | 改名引用 |
| `features/chat/ui/StatusPanel.ts` | `features/chat/ui/StatusPanel.ts` | 改名引用 |
| `features/chat/ui/FileContext.ts` | `features/chat/ui/FileContext.ts` | 改名引用 |
| `features/chat/ui/ImageContext.ts` | `features/chat/ui/ImageContext.ts` | 改名引用 |
| `features/chat/ui/NavigationSidebar.ts` | `features/chat/ui/NavigationSidebar.ts` | 改名引用 |
| `features/chat/ui/textareaResize.ts` | `features/chat/ui/textareaResize.ts` | 不变 |
| `features/chat/ui/file-context/*` | `features/chat/ui/file-context/*` | 不变 |

**不复制：** `BangBashModeManager.ts`, `InstructionModeManager.ts`（CodeWhale 暂不需要）

### 7e. Services

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/chat/services/SubagentManager.ts` | `features/chat/services/SubagentManager.ts` | 改名引用 |

### 7f. Tabs（多标签系统）

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/chat/tabs/types.ts` | `features/chat/tabs/types.ts` | 改名引用 |
| `features/chat/tabs/Tab.ts` | `features/chat/tabs/Tab.ts` | 改名引用（核心！~1961 行） |
| `features/chat/tabs/TabBar.ts` | `features/chat/tabs/TabBar.ts` | 改名引用 |
| `features/chat/tabs/TabManager.ts` | `features/chat/tabs/TabManager.ts` | 改名引用 |
| `features/chat/tabs/providerResolution.ts` | `features/chat/tabs/providerResolution.ts` | 改名引用 |

### 7g. View + Rewind + Constants

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/chat/ClaudianView.ts` | `features/chat/WhalliamView.ts` | 改名，去掉多 provider 路由 |
| `features/chat/rewind.ts` | `features/chat/rewind.ts` | 改名引用 |
| `features/chat/constants.ts` | `features/chat/constants.ts` | 不变 |
| `features/chat/utils/usageInfo.ts` | `features/chat/utils/usageInfo.ts` | 改名引用 |

### 7h. Settings

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/settings/ClaudianSettings.ts` | `features/settings/WhalliamSettings.ts` | 改名引用，简化 provider 部分 |
| `features/settings/keyboardNavigation.ts` | `features/settings/keyboardNavigation.ts` | 不变 |

### 7i. Inline Edit

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `features/inline-edit/ui/InlineEditModal.ts` | `features/inline-edit/ui/InlineEditModal.ts` | 改名引用 |

### 7j. App + Shared

| claudian 源 | whalliam 目标 | 修改 |
|------------|--------------|------|
| `app/settings/defaultSettings.ts` | `app/settings/defaultSettings.ts` | 改名 + 简化 |
| `app/settings/ClaudianSettingsStorage.ts` | `app/settings/WhalliamSettingsStorage.ts` | 改名 |
| `app/storage/SharedStorageService.ts` | `app/storage/SharedStorageService.ts` | 改名引用 |
| `shared/icons.ts` | `shared/icons.ts` | 只保留 codewhale 图标 |
| `shared/components/SlashCommandDropdown.ts` | `shared/components/SlashCommandDropdown.ts` | 改名引用 |

**输出：** ~50 个文件

**验收：**
- `pnpm typecheck` 通过
- `pnpm build` 成功

---

## 任务 8：样式 + 国际化

**目标：** 完成 CSS 模块和双语翻译

**输入：** 任务 2 目录结构

**具体工作：**

### 样式

从 claudian `src/style/` 复制全部 CSS 文件，修改类名前缀 `claudian-` → `whalliam-`。

**去除的样式模块：**
- `toolbar/external-context.css`（暂不需要）
- `toolbar/mcp-selector.css`（暂不需要）
- `features/image-modal.css`（暂不需要）
- `features/resume-session.css`
- `features/ask-user-question.css`
- `features/plan-mode.css`
- `modals/mcp-modal.css`
- `modals/fork-target.css`

### 国际化

从 claudian 复制 `i18n/` 完整架构：
- `i18n/i18n.ts`, `i18n/types.ts`, `i18n/constants.ts`
- `i18n/locales/en.json` — 保留
- `i18n/locales/zh-CN.json` — 保留

**删除** de, es, fr, ja, ko, pt, ru, zh-TW 的 locale 文件。

翻译内容后续可调整，此任务只需结构和编译通过。

**输出：** ~35 个 CSS 文件 + 5 个 i18n 文件

**验收：**
- `node scripts/build-css.mjs` 成功生成 `styles.css`
- `pnpm build` 成功

---

## 任务 9：main.ts 入口集成

**目标：** 实现 `main.ts` 插件入口，串联所有模块

**输入：** 任务 7 UI + 任务 8 样式就绪

**具体工作：**

1. **实现 `main.ts`** — 对标 claudian/src/main.ts，但简化：
   - `import './providers'` — 注册 codewhale provider
   - `import { patchSetMaxListenersForElectron }` — Electron 兼容
   - `WhalliamPlugin extends Plugin` — 实现 onload/onunload
   - `registerView(VIEW_TYPE_WHALLIAM, WhalliamView)`
   - `addRibbonIcon`, `addCommand`（open-view, inline-edit, new-tab, new-session, close-current-tab）
   - `addSettingTab(WhalliamSettingTab)`
   - `loadSettings()` — 从 storage 加载
   - `saveSettings()` — 持久化
   - `activateView()` — 打开/恢复聊天视图
   - CodeWhale 进程管理（确保 app-server 运行）
   - 环境变量管理

2. **删除旧的 `src/bridge/` 目录**（代码已迁移到 `providers/codewhale/runtime/`）

3. **删除旧的 `src/views/chat-view.ts`**（已替换为 `features/chat/WhalliamView.ts`）

4. **清理不再需要的旧文件**：
   - `src/consts.ts`（替换为 `core/types/` + `app/settings/defaultSettings.ts`）
   - `src/types.ts`（替换为 `core/types/`）
   - `src/settings.ts`（替换为 `features/settings/WhalliamSettings.ts`）
   - `src/i18n/`（替换为新的 `i18n/` 目录结构）
   - `src/utils.ts`（替换为 `utils/` 目录）

**输出：** 完整的、可工作的插件

**验收（最终验收）：**
- `pnpm typecheck` 通过（零错误）
- `pnpm build` 成功
- `pnpm lint` 通过
- 生成的 `main.js` + `styles.css` + `manifest.json` 构成完整插件

---

## 附录：符号改名速查表

| claudian 原名 | whalliam 新名 |
|-------------|--------------|
| `ClaudianPlugin` | `WhalliamPlugin` |
| `ClaudianView` | `WhalliamView` |
| `ClaudianSettingTab` | `WhalliamSettingTab` |
| `ClaudianSettings` | `WhalliamSettings` |
| `VIEW_TYPE_CLAUDIAN` | `VIEW_TYPE_WHALLIAM` |
| `'claudian-view'` | `'whalliam-view'` |
| `DEFAULT_CLAUDIAN_SETTINGS` | `DEFAULT_WHALLIAM_SETTINGS` |
| `ClaudianSettingsStorage` | `WhalliamSettingsStorage` |
| `.claudian/` | `.whalliam/` |
| `DEFAULT_CHAT_PROVIDER_ID` | `'codewhale'` |
| CSS 类前缀 `claudian-` | `whalliam-` |