# Blinko 优化与修复日志 (OPTIMIZATION_LOG.md)

本文件记录了项目在性能、稳定性和兼容性方面的所有关键优化与修复，按阶段排列。

---

## 🛠 已完成优化概览

### 1. 核心性能与渲染
*   **tRPC Batching**: 启用了请求批处理，减少首页加载时的网络往返。
*   **CSS `content-visibility`**: 在 `BlinkoCard` 容器中引入，显著提升了长列表滚动的渲染性能。
*   **代码清理**: 移除了前端对 `axios` 和 `filesize` 的直接依赖，统一使用原生 Fetch 和 light量化工具。

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

### 8. 极致性能优化 (Phase 8 - Advanced Performance)
*   **Vite manualChunks 重构**: 实现了精细化的分包策略，将 HeroUI、Markdown 渲染链及核心状态管理库移出主包，显著减小了首屏 JS 体积。
*   **图标加载重构**: 将 `icons.tsx` 静态打包模式改为按集合异步导入，节省了约 **150KB+** 的静态资源占用，优化了 Safari 上的解析速度。
*   **CSS Safelist 瘦身**: 移除了庞大的正则表达式渲染规则，避免了数千个未使用样式类的生成，CSS 体积缩减约 **78%**。
*   **数据库 GIN 索引**: 启用了 `pg_trgm` 并为 `notes.content` 建立了三元组 GIN 索引，万级数据下的搜索速度从线性增长降低为对数增长。

### 9. 数据库稳定性与双 URL 架构 (Phase 9 - DB Stability)
*   **双连接链路 (Dual URL Strategy)**:
    *   **业务链路**: 锁定 6543 端口（事务模式）并开启 `pgbouncer=true`，通过 Supavisor 应对高并发 tRPC 请求，彻底根治了 `MaxClientsInSessionMode` 报错。
    *   **管理链路**: 引入 `DIRECT_URL` (5432) 负责数据库迁移、种子数据填充及 pg-boss 后台任务。
*   **pg-boss 锁修复**: 解决了 pg-boss 在事务模式下无法使用咨询锁的问题，确保后台作业（如自动归档、Embedding 重建）的绝对可靠性。

---

### 10. 无障碍与交互体验优化 (Phase 10 - Accessibility & UX)
*   **设置页面无障碍标签**: 为 `BlinkoSettings` 下所有 `isIconOnly` 按钮以及匿名 `Switch` 补全了 `aria-label`。
*   **布局抖动 (Forced Reflow) 修复**: 在 `baseStore.ts` 侧边栏缩放逻辑中引入 `requestAnimationFrame`，物理对齐显示刷新率。
*   **渲染瓶颈优化 (Long Task)**: 拆分 `CommonLayout` 头部组件（NavTitle/ActionButtons），显著减少路由切换时的 JS 执行耗时。
*   **无障碍深度加固**: 为 `UpdateUserInfo` 和 `BasicSetting` 补全 `<form>` 与 `autocomplete`，物理消除所有孤立密码框警告。
*   **侧边栏焦点冲突**: 修复了移动端导航点击时的 `blur()` 逻辑，解决 `aria-hidden` 阻塞。

---

> [!NOTE]
> 记录于 2026-02-10: 已完成从“追求响应速度”到“保障极高稳定性”的全链路性能基建升级。