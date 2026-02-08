# Blinko 下一阶段性能优化路线图 (NEXT_STEPS.md)

基于对 `localhost.har` 的深度解析及代码审查，我们已经通过“补全索引”解决了数据库层的慢查询（8s -> 35ms）。然而，当前系统仍存在**请求排队阻塞 (Blocked)** 与 **启动初始化压力大** 的瓶颈。以下是建议的极致优化路线图。

---

## 1. tRPC 链路与批处理策略优化 (tRPC Link Strategy)
*   **痛点**: 目前所有请求共用一个 batch 链路，导致插件初始化等低优先级任务阻塞了 `notes.list` 等核心渲染请求。单个 Batch 体积（30KB+）触发了浏览器队列等待。
*   **优化方案**:
    *   **限制批处理规模**: 在 `trpc.ts` 的 `httpBatchLink` 中设置 `maxBatchSize: 10`，避免生成超大 HTTP 数据包。
    *   **请求分级**: 为 `notes.list` 和 `noteDetail` 添加 `skipBatch: true` 标记，确保核心数据走独立、即时的 `httpLink`。
    *   **注入 `AbortSignal`**: 全面应用超时中断（目前已在 `getLinks` 中部分实现），防止僵尸请求挂起。

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
    *   **骨架屏渲染锁**: 在 `BlinkoStore` 数据流转过程中，增加微任务级别的防抖，避免数据分批到达导致的界面多次重排。

---

> [!TIP]
> **结论**: 当前的性能表现已能满足普通用户需求。上述优化属于从“好用”到“极致”的进阶，建议优先实施 **tRPC 请求分级 (环节 1)**，因为它成本最低且对响应感的提升最直接。
