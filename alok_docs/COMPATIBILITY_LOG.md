# Monterey (Safari 15-17) 兼容性改造日志

> [!IMPORTANT]
> **⚠️ 当前开发策略 (2026-02-08)**：
> 目前首要任务是保障**主力设备**的运行流畅度与性能。
> - **目标设备**：macOS Monterey (12.7.6) / iOS (17.6)
> - **目标浏览器**：**Safari 17.6**
> - **策略调整**：鉴于 Safari 17.6 对现代 JS 语法（如正则具名捕获组等）已有良好支持，为了极限优化首屏加载速度，**当前已主动停用 `@vitejs/plugin-legacy`**。全量 Safari 15 兼容性（Babel 转译）内容已保留在下文中，作为未来构建发布版 DMG 时的技术储备。

本文档记录了本 Fork 仓库相对于官方上游仓库 (`blinkospace/blinko`) 所做的关键调整。

## 核心调整概览

| 调整领域 | 方案 | 类型 | 影响评估 | 是否应用 (Safari 17.6) |
| :--- | :--- | :--- | :--- | :--- |
| **CSS 样式** | `postcss-preset-env` | ✅ 无损 | 自动降级，视觉效果一致 | ❌ **否** (代码已注释，优先原生) |
| **JS API** | NPM Polyfills | ✅ 无损 | 补齐标准 API，无逻辑副作用 | ❌ **否** (代码已注释) |
| **JS 正则** | `@vitejs/plugin-legacy` | ✅ 无损 | Babel 自动转译，语义等价 | ❌ **否** (目前已移除) |
| **构建目标** | Target `es2020` | ✅ 无损 | 现代浏览器更小包体积 | ✅ **是** (已从 `esnext` 调整) |

---

## 1. CSS 样式 (无损改造)

### 🔴 原版问题
官方使用了 `color-mix(in srgb, ...)` 等现代 CSS 语法。
在 Safari 15 下，浏览器无法解析此函数，导致背景透明或按钮不可见。

### 🟢 我们的方案
*   **工具**: 引入 `postcss-preset-env`。
*   **原理**: 在构建打包时，自动计算出 `color-mix` 的最终颜色值，并生成 `rgba()` 格式的 Fallback 代码。

---

## 2. JS API 运行时 (无损改造)

### 🔴 原版问题
Safari 15 缺失 `AbortSignal.timeout` 和 `requestIdleCallback`。

### 🟢 我们的方案
*   **工具**: 引入 `abort-controller-polyfill` 和 `requestidlecallback-polyfill`。
*   **原理**: 在 `main.tsx` 最顶层检测并自动打补丁。

---

## 3. JS 正则表达式 (无损改造)

### 🔴 原版问题
Safari 15 不支持正则反向断言 `(?<=...)`。主要来源是第三方库：`vditor`, `prismjs`, `mermaid` 等。

### 🟢 我们的方案
*   **工具**: 使用官方 `@vitejs/plugin-legacy` 插件。
*   **原理**: 生成 Safari 15 兼容的转译代码。
*   **注意**: 由于性能原因，目前已**暂时移除**此插件。

---

## 4. 构建目标 (已简化)

*   **配置**: `target` 设置为 `esnext` 或 `es2020`。
*   **策略**: 优先保障现代浏览器性能。

---

## 5. iOS Safari 音频格式兼容性 (Audio Format Compatibility)

### 🔴 原版问题
Mac Safari 录制的音频文件（WebM 格式）无法在 iOS Safari 中播放。

### 🟢 我们的方案
*   **调整优先级**: 修改 `AudioRecorder/hook.ts`，将 MIME 类型优先级调整为 `audio/mp4` 优先。
*   **结论**: 实现跨平台播放无损兼容。

---

## 6. Safari 15.x 正则解析错误

*   **🔴 问题**: 在不支持 Lookbehind 的 Safari 15 版本中，现代正则可能导致 `SyntaxError`。
*   **当前策略**: 
    - 鉴于用户当前设备为 Safari 17.6，暂不开启 Legacy 插件。
    - 开发建议：手动规避正则 Lookbehind，确保未来 DMG 版本在不开启 Legacy 时也有较好的兼容性。

---



---

## 7. Safari Vditor 样式兼容

*   **🔴 问题**: Safari 下 Vditor 编辑模式的任务列表复选框 (`checkbox`) 不可见；普通列表 (`ul`) 在容器溢出时 Bullet 被裁剪。
*   **🟢 我们的方案**:
    *   **Checkbox**: 显式添加 `-webkit-appearance: none` 及背景色/盒模型重置，解决 Safari 渲染异常。
    *   **List Padding**: 调整 `.vditor-reset ul` 的 `padding-left` 至 `2.5em`，防止 overflow 裁剪。
    *   **Passive Events**: 针对 `touchstart` / `wheel` 等事件强制添加 `{ passive: true }`，解决浏览器控制台的 Violation 警告并提升滚动响应速度。

---

## 💡 功能优化说明

关于 **AI 功能增强、插件系统桥接、UI/UX 性能优化** 的具体记录已迁移至：
👉 **[OPTIMIZATION_LOG.md](./OPTIMIZATION_LOG.md)**
