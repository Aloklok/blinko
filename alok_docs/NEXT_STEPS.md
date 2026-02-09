# Blinko 下一阶段性能优化路线图 (NEXT_STEPS.md)

基于对 `localhost.har` 的深度解析及代码审查，我们已经通过“补全索引”解决了数据库层的慢查询（8s -> 35ms），并实施了 GIN 三元组索引支持百万级模糊搜索。同时，完成了 CSS Safelist 瘦身与图标系统异步化重构。然而，当前系统仍存在**请求排队阻塞 (Blocked)** 与 **启动初始化压力大** 的瓶颈。以下是建议的极致优化路线图。

---

## 1. tRPC 链路与批处理策略优化 (tRPC Link Strategy)
*   **痛点**: 目前所有请求共用一个 batch 链路，导致插件初始化等低优先级任务阻塞了 `notes.list` 等核心渲染请求。单个 Batch 体积（30KB+）触发了浏览器队列等待。
*   **优化方案**:
    *   **限制批处理规模**: 在 `trpc.ts` 的 `httpBatchLink` 中设置 `maxBatchSize: 10`，避免生成超大 HTTP 数据包。
    *   **请求分级**: 为 `notes.list` 和 `noteDetail` 添加 `skipBatch: true` 标记，确保核心数据走独立、即时的 `httpLink`。
    *   **注入 `AbortSignal`**: 全量应用超时中断（目前已在 `getLinks` 中部分实现），防止僵尸请求挂起。

## 2. 插件管理器“爆炸式”初始化改良 (Plugin Startup Optimization)
*   **痛点**: `PluginManagerStore` 启动时并行发起 2 * N 个请求（CSS + Config），虽然是并发，但由于 tRPC Batch 机制，它们被挤在了一起，造成瞬时网络拥塞。
*   **优化方案**:
    *   **聚合初始化 API**: 在 Server 端新增 `api.plugin.getInitializePayload` 接口，接收插件名列表，一次性返回所有配置和 CSS 样式。
    *   **动态激活**: 仅在需要（如打开插件面板或特定渲染触发）时再执行 `System.import` 加载插件逻辑，而非启动时全量加载。

## 3. 数据层极致提速 (Data & Caching)
*   **痛点**: 每次刷新都会清空内存 Store 并重新请求全量数据。
*   **优化方案**:
    *   **IndexDB 持久化缓存**: 将已获取的 Notes 数据持久化至本地 IndexDB。首屏先回显缓存，后台异步对比 `updateAt` 并补齐差量数据（Sync 模式）。
    *   **附件预加载机制**: 图片/附件请求目前是串行的。可以优化 `imageRender.tsx`，当卡片进入视口（Intersection Observer）前 100px 时即开始预取 Blob。

## 4. UI 渲染稳定性与流畅度 (UI/UX Robustness)
*   **痛点**: `[Violation]` 警报提示布局抖动（Forced Reflow）；重型库（Vditor）卸载后内存回收不彻底。
*   **优化方案**:
    *   **内容可见性 (Content-Visibility)**: 对长列表卡片使用 CSS `content-visibility: auto`，跳过视口外元素的渲染计算。
      - **骨架屏渲染锁**: 在 `BlinkoStore` 数据流转过程中，增加微任务级别的防抖，避免数据分批到达导致的界面多次重排。
    - **后端缩略图物理裁切 (Server-Side Cover Crop)**: 修改 `sharp` 逻辑，生成 `200x200` 绝对正方形缩略图 (`fit: cover`)，根治长图黑边及高度不一问题。

## 5. 2026 依赖体系现代化与维护建议 (Maintenance & Modernization)
*   **背景**: 针对 2026 年初的技术环境，项目需处理 React 19 迁移、ESLint Flat Config 适配及冗余 Polyfill 清理。
*   **核心升级清单**:
    *   **React 19+**: 迁移并利用 `use` Hook 及原生 Ref 传递，简化代码逻辑。
    *   **ESLint 9/10**: 切换至 Flat Config 模式，废弃旧版配置文件格式。
    *   **Prisma 6**: (已完成 ✅) 提升数据库引擎启动速度及 Edge 环境支持。
*   **冗余清理**:
    *   移除 `abortcontroller-polyfill`, `requestidlecallback-polyfill` (⚠️ 已暂缓：用户决定保留以兼容 Safari 15)。
    *   评估并移除 `systemjs` (现代 ESM 已足够强大)。
    *   使用 Bun 原生能力替换 `ncp` 等旧式工具。
*   **AI 栈优化**:
    *   **去重**: 如果核心逻辑已迁移至 Mastra，建议减少对原版 `langchain` 的直接依赖。
    *   **聚合**: 使用统一的 Provider 接口（如 Vercel AI SDK 或 OpenRouter）管理过多的 AI 模型供应商。
*   **一致性治理**:
    *   **Lodash**: 继续推行原生替代方案，减少 `lodash-es` 与 `lodash` 的混用。
    *   **Prisma**: (已完成 ✅) 统一 Monorepo 内所有模块的 Prisma 版本至 v6。

---

> **结论**: 当前的性能表现已能满足普通用户需求。上述优化属于从“好用”到“极致”的进阶。在 **2026 维护建议 (环节 5)** 中，优先建议实施 **Polyfill 清理**，因为它对减包、提效且风险极低。

## 6. Cloudflare 缓存规则 (2026.02 Update)
*   **背景**: 针对 Vite 构建产物（Assets）启用激进的长效缓存策略，以减少回源流量并提升全球访问速度。
*   **配置指南**:
    *   **Rule Name**: `Cache Assets`
    *   **Condition**: `(http.host eq "blinko.alok-rss.top") and (http.request.uri.path starts_with "/assets/")`
    *   **Cache Eligibility**: `Eligible for cache`
    *   **Edge TTL**: `1 month` (Vite Hashing 确保了文件内容的唯一性，长缓存安全)
    *   **Browser TTL**: `1 year`
*   **注意**: 严禁在 `public/` 下创建名为 `assets` 的无 Hash 文件夹。
