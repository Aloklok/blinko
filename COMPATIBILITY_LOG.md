# Monterey (Safari 15) 兼容性改造日志

本文档记录了本 Fork 仓库相对于官方上游仓库 (`blinkospace/blinko`) 所做的关键调整，旨在解决 macOS Monterey (12.x) / iOS 15 下的兼容性问题。

## 核心调整概览

| 调整领域 | 方案 | 类型 | 影响评估 |
| :--- | :--- | :--- | :--- |
| **CSS 样式** | `postcss-preset-env` | ✅ 无损 | 自动降级，视觉效果一致 |
| **JS API** | NPM Polyfills | ✅ 无损 | 补齐标准 API，无逻辑副作用 |
| **JS 正则** | `@vitejs/plugin-legacy` | ✅ 无损 | Babel 自动转译，语义等价 |
| **构建目标** | Target `esnext` + legacy 插件 | ✅ 无损 | 现代浏览器更小包体积，旧浏览器自动兼容 |
| **图标提取** | 自动化扫描 + Turbo 管道 | ✅ 无损 | 全自动同步，解决动态图标缺失 |
| **交互优化** | AI 润色集成 | ✅ 无损 | 复用现有编辑器，增加快捷入口 |

---

## 1. CSS 样式 (无损改造)

### 🔴 原版问题
官方使用了 `color-mix(in srgb, ...)` 等现代 CSS 语法。
在 Safari 15 下，浏览器无法解析此函数，导致：
*   所有用到该颜色的背景变成透明/白色。
*   文字颜色失效，某些按钮不可见。

### 🟢 我们的方案
*   **工具**: 引入 `postcss-preset-env`。
*   **原理**: 在构建打包时，自动计算出 `color-mix` 的最终颜色值，并生成 `rgba()` 格式的 Fallback 代码。
*   **差异**:
    ```css
    /* 源码 (不变) */
    background: color-mix(in srgb, var(--primary), transparent 90%);
    
    /* 构建产物 (自动生成) */
    background: rgba(var(--primary-rgb), 0.1); /* Safari 15 用这个 */
    background: color-mix(in srgb, var(--primary), transparent 90%); /* 现代浏览器用这个 */
    ```
*   **结论**: **完全无损**。在旧设备上看到的颜色可能与新设备有肉眼不可察觉的微小差异（计算精度问题），但不影响 UI。

---

## 2. JS API 运行时 (无损改造)

### 🔴 原版问题
应用启动时直接白屏或操作时崩溃，控制台报错：
*   `ReferenceError: Can't find variable: AbortSignal` (specifically `timeout` method)
*   `requestIdleCallback is not a function`

### 🟢 我们的方案
*   **工具**: 引入标准 Polyfill 包 `abort-controller-polyfill` 和 `requestidlecallback-polyfill`。
*   **原理**: 在 `main.tsx` 最顶层检测环境，如果浏览器缺失这些 API，则自动打补丁。
*   **差异**: 仅在全局对象上挂载了缺失的方法，完全符合 W3C 标准规范。
*   **结论**: **完全无损**。

---

## 3. JS 正则表达式 (无损改造)

### 🔴 原版问题
这是最棘手的问题。Safari 15 的 JS 引擎 (WebKit 605) **不支持** 正则 Lookbehind (反向断言 `(?<=...)`)。
一旦 JS 文件中包含这种语法（哪怕不执行），解析器也会直接抛出 `SyntaxError`，导致整个应用白屏。
主要来源是第三方库：`vditor` (Markdown编辑器), `prismjs` (代码高亮), `marked`, `mermaid` 等。

### 🟢 我们的方案
*   **工具**: 使用官方 `@vitejs/plugin-legacy` 插件。
*   **原理**: 在**生产构建**时，插件使用 Babel 自动转译所有不兼容的 ES2018+ 语法（包括正则后行断言），生成 Safari 15 兼容的代码。
*   **配置**:
    ```typescript
    // vite.config.ts
    import legacy from '@vitejs/plugin-legacy'
    
    export default defineConfig({
      plugins: [
        // Legacy: Only enabled in production build for Safari 15 compatibility
        ...(!isDev ? [
          legacy({
            targets: ['safari >= 15', 'ios >= 15'],
            modernPolyfills: true
          })
        ] : [])
      ]
    });
    ```
*   **结论**: **完全无损**。Babel 处理的转译是语义等价的，不会改变正则的匹配行为。

> [!IMPORTANT]
> **2026-02-07 紧急更新**:
> 由于该插件生成了大量 Legacy Chunks (冗余代码)，导致移动端首屏加载严重受阻（5MB+）。
> **已暂时移除** 此插件以优先保障加载性能。Safari 15 兼容性修复已移至待办清单。

---

## 4. 构建目标 (已简化)

### 🔴 原版配置
*   `target`: 默认为 `modules` (通常是近年来主流浏览器)。

### 🟢 我们的方案
*   `target`: 设置为 `esnext`，让现代浏览器使用最新语法以减小包体积。
*   **Safari 15 兼容性**: 由 `@vitejs/plugin-legacy` 自动处理（见第 3 节）。
*   **结论**: 现代浏览器获得更小的包体积，旧浏览器通过 legacy chunk 获得兼容代码。

> [!IMPORTANT]
> **2026-02-07 紧急更新**: 
> 随 Legacy 插件一同移除。当前 `build.target` 为 `es2020`。

---

## 5. 个性化定制 (DIY)

> 个性化 UI/UX 定制内容已拆分至 **[DIY_CUSTOMIZATIONS.md](./DIY_CUSTOMIZATIONS.md)**。
> 
> 包含：交互简化、Flomo 风格排版、移动端编辑器重构、构建流优化、卡片交互优化等。

---

## 6. AI 自动标签去重 (Deduplication)

### 🔴 原版问题
当启用 AI 后处理自动生成标签时，系统会无差别地将建议标签追加到笔记末尾。如果笔记已手动打过相同标签（或多次触发后处理），会导致笔记末尾堆叠大量重复的标签（例如：`#tag1 #tag1 #tag1`），严重影响视觉美观和搜索效率。

### 🟢 我们的方案
在后端 `AiService.postProcessNote` 逻辑中注入了**幂等去重层**：
1.  **加载现状**: 在调用 AI 之前，先提取笔记已有的所有标签名。
2.  **正向过滤**: 对 AI 返回的列表进行清洗，仅保留当前笔记中**尚不存在**的标签。
3.  **上限控制**: 强制限制单次追加的标签数量（当前为 5 个），防止标签爆炸。

### 🔵 兼容性收益
*   **数据纯净**: 彻底杜绝了笔记正文被重复标签污染的问题。
*   **无需干预**: 用户不再需要手动删除 AI 多次触发产生的垃圾数据。

---

## 7. 图标提取系统 (Icon Extraction Automation)

### 🔴 原版问题
官方使用了 Iconify 的动态图标加载。在旧版构建环境或某些离线部署中，由于扫描脚本 `buildIcons.js` 的正则匹配范围过窄（仅限固定属性赋值），导致动态生成的图标（如三元表达式 `collapsed ? 'right' : 'left'`）无法被正确提取至本地 `icons.tsx`，产生 `Local icon not found` 错误。

### 🟢 我们的方案
*   **全量扫描**: 重构 `buildIcons.js` 为健壮的全局扫描机制，能够识别代码中任何位置的 `prefix:name` 图标字符串。
*   **合法性校验**: 引入 `@iconify/json` 本地校验，自动过滤无效匹配。
*   **全链路自动化 (Pipeline)**:
    *   **Turbo 管道**: 在 `turbo.json` 中建立依赖，确保 `build:web` (网页/Docker) 始终自动运行图标构建。
    *   **GitHub Actions**: 补全了客户端自动构建 (`app-release.yml`) 缺失的图标生成步骤。
    *   **本地开发**: 修改根目录 `dev` 脚本，实现“启动即自动扫描更新”。

### 🔵 兼容性收益
*   **稳定性**: 彻底解决了图标缺失警告，确保桌面端产物和 Docker 镜像的图标资产完整。
*   **零维护**: 移除了所有手动补丁清单，实现“一次配置，全自动同步”。

---

## 8. AI 润色功能 (AI Polish Integration)

为了提升笔记的快速优化体验，我们在卡片列表页集成了 AI 润色入口。

*   **功能**: 在卡片 "More" 菜单 (及右键菜单) 中新增 "AI Polish" 选项。
*   **流程优化**:
    *   **静默处理**: 点击后在后台流式请求 AI 润色，界面仅显示 Loading 状态。
    *   **安全预览**: 仅当 AI 成功返回完整结果后，才会弹出编辑器并自动填入润色后的内容。
    *   **无损交互**: 用户可在编辑器中对比确认，满意则保存，取消则原笔记不受任何影响。
*   **异常熔断**: 若 AI 请求失败（网络波动或模型错误），直接提示失败而不弹出编辑器，避免用户面对空白内容不知所措。

---

## 9. 插件系统与 AI 官方接口 (Plugin System & AI Bridge)

为了支持高性能、可扩展的 AI 插件功能，我们对基座与插件的通信层进行了深度解耦与标准化重构。

### 13.1 官方流式接口封装 (`streamApi`)
*   **🔴 问题**: 插件系统以往通过手动 `fetch` 模拟 TRPC 请求，由于缺少 SuperJSON 序列化支持和正确的 Batching 协议头，频繁导致 **HTTP 415 不支持的媒体类型** 错误。
*   **🟢 方案**: 在基座层将官方生产环境使用的 `streamApi` 直接挂载至 `window.Blinko`。
*   **收益**: 插件可直接调用官方同步的流式 AI 客户端，无需关心底层协议与序列化细节，彻底杜绝了 415 报错。

### 13.2 原生编辑器桥接 (`openEditor`)
*   **🔴 问题**: 插件在美化/修改笔记后，无法弹出基座原生的编辑器模态框，只能使用自定义的简易弹窗，导致丢失了附件管理、多格式支持等原生编辑体验。
*   **🟢 方案**: 实现 `Blinko.openEditor(note, content?)` 桥接函数，授权插件安全调用基座内部的 `ShowEditBlinkoModel`。
*   **收益**: 实现了“插件处理 -> 原生预览 -> 用户确认”的无缝闭环。AI 处理结果会自动填入标准编辑器，用户可立即进行二次审查与保存。

### 13.3 插件加载幂等性修复
*   **优化**: 修复了 HMR (热更新) 模式下重复注册侧边栏图标和右键菜单的 Bug，引入了基于名称的 Hook 覆盖机制，确保插件系统无论如何加载都能保持 UI 状态的唯一性。

### 13.4 插件持久化配置管理 (`updateConfig`)
*   **🔴 问题**: 插件无法保存用户的个性化设置（如自定义 Prompt），导致每次刷新页面都会重置。手动操作数据库对非技术用户不友好。
*   **🟢 方案**: 在基座层实现了 `updateConfig` 和 `config` 注入机制。基座在插件初始化时自动从 `plugin_config` 表读取数据，并为插件实例注入异步持久化方法。
*   **收益**: 插件现在具备了真正的“状态保持”能力，支持用户在 UI 界面直接修改并持久化 Prompt 等关键参数。

### 13.5 设置面板上下文修复 (Context Binding)
*   **🔴 问题**: 插件设置面板 (`renderSettingPanel`) 由基座 React 组件调用时，由于丢失了 `this` 上下文，导致无法读取插件配置，按钮点击失效且由于 JS 报错导致白屏。
*   **🟢 方案**: 确立了插件开发的 Context 安全规范，基座支持从实例层级准确分发配置，同时插件推荐使用箭头函数定义渲染逻辑，实现了复杂的配置面板在 React 模态框中的稳健渲染。

### 13.6 AI 生成交互闭环 (Streaming UX)
*   **🔴 问题**: AI 美化期间，初始的 `success` 提示会自动消失，导致长达 10s+ 的生成过程中界面无任何反馈（交互真空期）。
*   **🟢 方案**: 系统性将插件提示逻辑升级为 `Blinko.toast.loading`。提示框将持续显示旋转动画，直到 AI 响应结束、报错或弹出预览编辑器时才会被精准销毁 (`dismiss`)。
*   **收益**: 用户对 AI 的运行进度有了明确且持续的视觉感知，消除了由于“等待焦虑”导致的重复点击或误操作。

## 10. 卡片摘要渲染优化 (Card Summary Rendering)
*   **🔴 问题**: 用户在使用引用格式 (`> Title`) 美化笔记标题时，卡片缩略图（Blog 模式）会直接显示 `>` 符号，因为摘要生成逻辑仅进行了简单的纯文本截断，未过滤 Blockquote 标记。
*   **🟢 方案**: 更新 `CardBlogBox` 的文本处理管道，在剔除 `#` (标题) 和 `*` (加粗) 的基础上，新增了对 `>` (引用符) 的正则表达式过滤。
*   **收益**: 此后用户在卡片中使用引用样式作为装饰性标题时，摘要视图将保持整洁的纯文本显示，不再出现 Markdown 源码符号泄漏。

## 11. 语音转文字功能集成 (Voice-to-Text Integration)

为录音笔记提供自动转录能力，提升语音输入的实用性。

### 15.1 核心功能实现
*   **上传时转录**: 在 `server/routerExpress/file/upload.ts` 中，当检测到用户录音 (`isUserVoiceRecording`) 时，自动调用 `AiService.transcribeAudio` 进行转录。
*   **S3 兼容**: 对于 S3 存储的文件，通过 `FileService.getFile` 下载到临时目录进行处理，处理完成后自动清理。
*   **前端集成**: 在 `editorStore.tsx` 的 `uploadFiles` 方法中，接收后端返回的 `transcription` 并自动插入编辑器。

### 15.2 音频元数据传递修复
*   **🔴 问题**: 首页列表中的录音显示时长为 `0:00`，因为 `HandleFileType` 函数在转换 `Attachment` 为 `FileType` 时丢失了 `metadata` 字段。
*   **🟢 方案**: 修改 `app/src/components/Common/Editor/editorUtils.tsx`，在返回对象中保留 `metadata` 字段。
*   **收益**: 录音的时长、大小等元数据能够正确传递到渲染组件。

### 15.3 S3 文件读取优化
*   **🔴 问题**: `musicMetadata` TRPC 程序通过 `fetch` 请求 `/api/s3file/...` 获取音频元数据，导致 `401 Unauthorized` 错误。
*   **🟢 方案**: 修改 `server/routerTrpc/public.ts`，使用 `FileService.getFileBuffer` 直接通过 S3 SDK 读取文件，绕过 HTTP 权限检查。
*   **收益**: 更高效、更安全的服务端文件访问。

### 15.4 重复转录问题修复
*   **🔴 问题**: 用户录音在上传时转录一次，保存笔记时又尝试转录一次，导致 `ENOENT` 错误（临时文件已被清理）。
*   **🟢 方案**: 修改 `server/routerTrpc/note.ts`，在音频附件过滤逻辑中跳过 `my_recording_` 前缀的文件。
*   **收益**: 避免无效的重复转录请求。

### 15.5 Blob URL Token 拼接修复
*   **🔴 问题**: 录音上传过程中，前端尝试在 `blob:` URL 上拼接 token，导致 `ERR_FILE_NOT_FOUND` 错误。
*   **🟢 方案**: 修改 `app/src/components/Common/AttachmentRender/audioRender.tsx`，仅对非 `blob:` URL 拼接 token。
*   **收益**: 消除控制台错误，改善开发体验。

### 15.6 音频/视频文件 Embedding 跳过
*   **🔴 问题**: Embedding 功能尝试使用 `UnstructuredLoader` 解析 `.webm` 音频文件，导致 `ECONNRESET` 错误。
*   **🟢 方案**: 修改 `server/aiServer/index.ts` 的 `loadFileContent` 函数，对音频和视频文件直接返回空字符串。
*   **收益**: 避免无效的外部 API 调用。

---

## 12. AI 后处理逻辑优化 (AI Post-Processing Fix)

修复 AI 后处理模式判断不正确和标签重复创建的问题。

### 16.1 CommentAgent 无条件调用修复
*   **🔴 问题**: 即使用户选择 `tags` (自动添加标签) 模式，`CommentAgent` 仍然会被调用，浪费 AI 调用次数。
*   **🟢 方案**: 修改 `server/aiServer/index.ts`，将 `CommentAgent` 调用移入 `if (processingMode === 'comment' || processingMode === 'both')` 条件块内。
*   **收益**: 仅在需要时调用 CommentAgent，节省 AI 资源。

### 16.2 标签关联唯一约束冲突修复
*   **🔴 问题**: AI 添加标签后调用 `caller.notes.upsert` 会再次触发笔记更新，导致 `Unique constraint failed on (noteId, tagId)` 错误日志。
*   **🟢 方案**: 修改 `server/routerTrpc/note.ts`，将 `prisma.tagsToNote.create()` + try-catch 替换为 `prisma.tagsToNote.upsert()`。
*   **收益**: 消除 Prisma 错误日志，代码更干净优雅。

---

## 13. 移动端编辑器工具栏重构 (Mobile Toolbar Redesign)

针对移动端小屏幕设备，对编辑器底部工具栏进行了结构性重构，以解决按钮拥挤、溢出和不可见的问题。

### 17.1 双行布局架构 (Dual-Row Layout)
*   **🔴 问题**: 随着插件和 AI 功能的增加，单行工具栏在 iPhone SE 等设备上严重溢出，导致发送按钮被挤出屏幕或与插件图标堆叠。
*   **🟢 方案**: 将底部工具栏升级为双行布局：
    *   **第一行（核心区）**: 放置 [笔记类型]、[标签]、[上传]、[录音]，右侧固定 [全屏] 和 [发送]。
    *   **第二行（扩展区）**: 放置 [引用]、[AI 写作] 以及所有通过插件机制添加的自定义按钮（如 AI 美化）。
*   **视觉隔离**: 在两行之间添加了 `1px` 的极细分割线，使功能分区更加清晰。

### 17.2 触控人体工学优化 (Touch Targets)
*   **44px 标准**: 遵循 Apple/Google 规范，将所有底部按钮的点击容器提升至 **44px**（原 40px），图标放大至 **26px**。
*   **发送按钮扁平化**: 为了优化垂直节奏，将发送按钮调整为 **56x36px** 的扁平椭圆状，既保留了大触控面积，又增加了与分割线之间的视觉呼吸感，防止上下按钮显得过于拥挤。

---

## 14. 音频加载性能优化 (Audio Loading Optimization)

优化了笔记列表页中大量录音文件的加载策略，减少不必要的网络请求和后端日志冗余。

### 18.1 冗余元数据请求拦截
*   **🔴 问题**: 每次打开包含多条录音的笔记时，后端会密集打印 `fullPath!!` 日志。这是因为前端 `AudioRender` 针对每个音频文件都会调用一次 `musicMetadata` TRPC 接口去解析 ID3 信息，即便对于录音文件来说这些信息已在 `metadata` 中。
*   **🟢 方案**: 在前端 `AudioRender` 挂载逻辑中注入拦截判断：`if (!isUserVoiceRecording(file)) { getMetadata(file); }`。
*   **收益**: 
    *   **零冗余**: 录音文件直接复用附件已有的 `metadata` 数据，不再发起 TRPC 请求。
    *   **后端减负**: 彻底消除了后端因解析录音元数据而产生的重复磁盘/S3 读取日志。
    *   **加载加速**: 录音消息的渲染不再受限于网络回调，大幅提升了首屏滚动流畅度。

---

## 📌 已知问题与待办项目 (Known Issues / TODO)

### 15.1 Safari 15.x 正则解析错误
*   **🔴 问题**: 在 Safari 15 (macOS Monterey) 环境下启动时报错 `SyntaxError: Invalid regular expression: invalid group specifier name`。
*   **分析**: 
    1.  Safari 15.0-16.3 不支持正则反向断言 (Lookbehind) `(?<=...)` 或某些具名捕获组语法。
    2.  由于当前 `build.target` 为 `esnext`，现代构建包保留了库源码中的现代正则。
*   **备选方案**: 将 `vite.config.ts` 中的 `build.target` 降低至 `es2018` 或更低，强制 esbuild 转译这些正则。
*   **状态**: **待修复** (用户建议暂缓，担心引入新问题)。

