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
*   **Vditor 适配**: 修复了 Safari 下 Vditor 初始化 ID 冲突的问题，支持多实例稳定运行。

### 3. UI 健壮性修复
*   **图标 Ref 警告**: 修复了 HeroIcons 在 React 18 下由于缺失 `forwardRef` 导致的控制台报错。
*   **标签颜色冲突**: 修复了自定义主题色（如 Rose）时标签背景变纯色的问题。通过引入 `--primary-rgb` 变量并为 `color-mix` 提供 `rgba` 降级方案，确保了在所有现代浏览器中标签背景维持 10% 的透明度。同时合并清理了 `globals.css` 中的冗余定义。
*   **卡片图片显示**: 修复了卡片中图片显示不出的问题。通过优化 `HandleFileType` 避免为已有附件触发错误的“上传中”状态，并纠正了 `imageRender.tsx` 中硬编码的宽度布局。同时增强了 HeroUI Image 组件在 Safari 下的显式可见性控制。

---

> [!NOTE]
> 记录于 2026-02-09: 已完成全链路性能补强与构建稳定性修复。