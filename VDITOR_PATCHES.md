# Vditor 补丁说明

## 概述

Blinko 使用 Vditor 3.11.2 作为编辑器。通过**差量补丁脚本** (`patches/apply-vditor-patches.js`) 对 `node_modules/vditor/dist/index.js` 做精准字符串替换。

不维护源码 fork（Bun 无法兼容 Vditor 的 Webpack/Rspack 构建链），也不维护完整的 `dist/index.js` 快照（0.7MB）。

## 自动执行

| 环境 | 触发方式 |
|------|---------|
| 本地开发 | `bun install` → `postinstall` 脚本自动执行 |
| Docker 构建 | `RUN node patches/apply-vditor-patches.js` |

## 补丁清单

### Patch 1 — 订单列表新建时合并编号
- **原生行为**：每个新 `<ol>` 独立编号，从 1 开始
- **修改后**：向前查找同级已有 `<ol>`，如果中间无分隔符（`<p>`/`<hr>`），则追加到已有列表。跳过 `<ul>`/`<ol>`（同类结构不算分隔符）

### Patch 2 — 注释标注

### Patch 3 — 任务清单切换仅影响当前项（添加 checkbox）
- **原生行为**：`itemElement.parentElement.querySelectorAll("li").forEach(...)` — 遍历所有兄弟
- **修改后**：仅操作 `itemElement`，不影响同级其他项

### Patch 4 — 任务清单切换仅影响当前项（移除 checkbox）
- 同上，取消 checklist 时只移除当前项的标记

### Patch 5 — 列表类型切换拆分 + 合并 + 跳过重组
- 将当前 `<li>` 从父列表中拆分到新类型的列表（只影响当前项）
- 拆分时查找同级 `<ol>` 合并（无分隔符则连续编号）
- 如果已在 `<ol>` 中且目标就是 `ordered-list`，跳过 DOM 重组（仅去 checkbox）

## 如何添加新补丁

1. 在 `node_modules/vditor/dist/index.js`（原始版或已打补丁版）中定位目标代码
2. 在 `patches/apply-vditor-patches.js` 末尾按 `PATCH_N_OLD` / `PATCH_N_NEW` 格式添加
3. 运行 `node patches/apply-vditor-patches.js` 验证
4. 如果 Vditor 版本升级后某个补丁报 "anchor not found"，检查并更新对应的 OLD 字符串
