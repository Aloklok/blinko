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
*   **图标 Ref 转发修复**: 修复了 `@iconify/react` 组件在 React 18 / HeroUI 环境下由于缺失 `forwardRef` 导致的 `Function components cannot be given refs` 控制台报错。通过重构全局 `Icon` 组件引入 `forwardRef` 解决了该遗留问题。
*   **标签颜色冲突**: 修复了自定义主题色（如 Rose）时标签背景变纯色的问题。通过引入 `--primary-rgb` 变量并为 `color-mix` 提供 `rgba` 降级方案，确保了在所有现代浏览器中标签背景维持 10% 的透明度。同时合并清理了 `globals.css` 中的冗余定义。
*   **卡片图片显示与缩放**: 修复了卡片中图片显示不出的问题，并随后解决了缩放尺寸回归的问题。
*   **麦克风资源泄露**: 修复了录音结束后麦克风占用仍不释放的问题。

### 4. 资源加载与网络优化 (Phase 5)
*   **图片体积缩减**: 将首页核心图片 (`logo`, `home.png`) 转换为 **WebP** 格式，体积缩减 **80-92%**。
*   **字体 CDN 迁移**: 将字体镜像源替换为 **Loli.net**，解决了大陆访问加载阻塞导致的白屏问题。
*   **Markdown 图片持久化**: 
    *   **前端注入**：在编辑器插入附件时，自动在 URL 后附加当前用户的身份令牌 (`?token=...`)，解决了部分图片引用在非会话环境下的渲染失败问题。
    *   **后端增强**：重写了 `noteRouter` 中的图片匹配正则，使其能够精准识别并解析带有查询参数的附件路径，确保了元数据提取的一致性。

---

### 5. 数据库与后端性能 (Phase 6)
*   **Prisma 连接池优化**: 修复了 `DATABASE_URL` 环境变量中因符号冗余导致的 `connection_limit` 解析失败问题。将默认连接数从 **1** 提升至 **15**，彻底解决了高并发（如查看资源页）时导致的 `PrismaClientInitializationError` 以及前端 `Unexpected token '<'` (HTML 误刷) 报错。
*   **JWT 密钥内存缓存**: 在 `helper.ts` 中为 `JWT_SECRET` 引入了 **Promise 单例模式内存缓存**。
    *   **优化点**：避免了每次鉴权（包括缩略图请求）都去 Supabase 查询 Config 表，减少了约 **90%** 的鉴权数据库 IO。
    *   **预热机制**：在服务器启动阶段自动完成 Secret 加载，确保高并发请求到达时内存已就绪。
*   **S3 资源加载增强**: 针对 Bun 运行时优化了 S3 流读取逻辑，引入了 `transformToByteArray` 的可靠性检查与 0 字节文件自动跳过机制，解决了 `sharp` 库在处理损坏/空文件时的崩溃风险。
*   **鉴权中间件升级**: 统一改用 `getUserFromRequest`，同时支持 Cookie Session 与 URL Token 两种认证模式，显著增强了跨域附件访问的稳定性。

---

### 6. AI 基础设施升级 (Phase 7)
*   **Mastra 改构**: 将 AI Vision 核心 `ImageEmbeddingAgent` 迁移至 **Mastra 架构**，实现了更纯粹的 Agent 定义。
*   **模型感知增强**: 引入了更严谨的 Vision 能力探测逻辑，确保模型在不支持图片输入时能优雅退回，并优化了多步推导的 Instructions。

---

> [!NOTE]
> 记录于 2026-02-10: 已完成全链路连接稳定性、缓存优化及 AI 模型架构升级。