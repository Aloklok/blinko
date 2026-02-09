# Blinko 优化与修复日志 (OPTIMIZATION_LOG.md)

本文件记录了项目在性能、稳定性和兼容性方面的所有关键优化与修复，按阶段排列。

---

## 🛠 已完成优化概览

### 1. 核心性能与渲染
*   **tRPC Batching**: 启用了请求批处理，减少首页加载时的网络往返。
*   **CSS `content-visibility`**: 在 `BlinkoCard` 容器中引入，显著提升了长列表滚动的渲染性能。
*   **代码清理**: 移除了前端对 `axios` 和 `filesize` 的直接依赖，统一使用原生 Fetch 和轻量化工具。

### 2. 构建与环境兼容性
*   **Lodash 优化**: 修复了多个由于 Lodash 引用路径不规范导致在 Docker/Bun 环境下构建失败的问题。
*   **DND 迁移**: 完成了资源管理器 (`resources.tsx`) 从 `@hello-pangea/dnd` 到 `@dnd-kit/core` 的全面迁移。
*   **Vditor 适配**: 修复了 Safari 下 Vditor 初始化 ID 冲突的问题，支持多实例稳定运行；引入了“异步初始化竞态拦截器”解决卸载后的报错；通过 **Scoped Monkey Patch** 强制开启 `passive: true` 解决了 52+ 个触摸/滚动事件监听器的性能警告。

### 3. UI 健壮性修复
*   **图标 Ref 警告**: 修复了 HeroIcons 在 React 18 下由于缺失 `forwardRef` 导致的控制台报错。
*   **标签颜色冲突**: 修复了自定义主题色（如 Rose）时标签背景变纯色的问题。通过引入 `--primary-rgb` 变量并为 `color-mix` 提供 `rgba` 降级方案，确保了在所有现代浏览器中标签背景维持 10% 的透明度。同时合并清理了 `globals.css` 中的冗余定义。
*   **卡片图片显示与缩放**: 修复了卡片中图片显示不出的问题，并随后解决了缩放尺寸回归的问题（Phase 42 & 44）。通过以下方式优化：1. 修正 `HandleFileType` 状态逻辑；2. 恢复并锁定卡片预览图为 100x100px 固定尺寸 + `object-cover` 裁剪模式，确保长图在正方形容器内完美填充且无黑边。
*   **麦克风资源泄露**: 修复了录音结束后麦克风占用仍不释放的问题（Phase 43）。通过以下方式解决：1. 使用 `useRef` 治理定时器避免闭包失效；2. 增加 `isMounted` 守卫防止异步操作导致的“孤儿”资源启动；3. 在 Safari/Mac 下增加 `AudioContext` 挂起逻辑并显式禁用全部物理轨道 (`enabled = false`)。
*   **Vditor 初始化竞态**: 修复了组件卸载后异步资源加载完成导致的 "Failed to get element by id" 报错。通过引入 `canceled` 标志位，确保在组件卸载后中断初始化流程，提升了快速切换路由时的稳定性。
*   **AI 标签生成与账号隔离**: 重构了 AI 标签自动生成逻辑。1. 通过将 `TagAgent` 切换为 **JSON 模式**（返回字符串数组），彻底解决了因 AI 随机输出格式（空格/换行）导致的解析重复问题；2. 增加 **混合解析兜底**，若用户设置了自定义 Prompt 禁止 JSON，系统会自动退回正则提取模式，确保依然能精准去重；3. 引入了“全路径标准化比对”算法，能够识别并去重各种格式差异（如空格、大小写）的层级标签；4. 在底层 `getAllPathTags` 中强制引入 `accountId` 过滤，确保用户标签数据的物理隔离，防止跨账号建议。
*   **Prisma 6 打包修复**: 修复了在 Docker/生产环境下使用 `esbuild` 打包时，Prisma Client 内部引擎无法正确加载导致的 `Cannot read properties of undefined (reading 'bind')` 报错。通过在 `server/esbuild.config.ts` 中将 `@prisma/client` 和 `.prisma/client` 设为 **external** 依赖，解决了该生产环境稳定性问题。

---

### 4. 资源加载与网络优化 (Phase 5)
*   **图片体积缩减**: 将首页核心图片 (`logo`, `home.png`) 转换为 **WebP** 格式，体积缩减 **80-92%**。
*   **字体 CDN 迁移**: 鉴于 `fonts.cdnfonts.com` 在中国大陆的访问延迟/阻断问题，将 `prisma/defaultFonts.ts` 中所有 20+ 款西方字体（如 Inter, Open Sans, JetBrains Mono）的源替换为 **Loli.net (Google Fonts Mirror)**。此举彻底消除了因单一字体加载阻塞导致页面白屏或卡顿的现象。

---

> [!NOTE]
> 记录于 2026-02-09: 已完成全链路性能补强与构建稳定性修复。