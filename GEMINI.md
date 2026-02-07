# Blinko Fork - AI 助手指南

> **本文档面向 AI 助手**，帮助快速理解项目结构与上下文。

---

## 📋 项目概述

**Blinko** 是一款开源的个人笔记应用，支持 Markdown、AI 增强、多端同步。

本仓库是官方 [`blinkospace/blinko`](https://github.com/blinkospace/blinko) 的 **私有 Fork**，专注于：
- **macOS Monterey (12.x) / Safari 15 兼容性**
- **个性化 UI/UX 定制**
- **私有化部署优化**

---

## 🏗️ 技术栈

| 层级 | 技术 |
|-----|------|
| **前端** | React 18 + TypeScript + Vite + TailwindCSS |
| **后端** | Node.js + tRPC + Prisma + Express |
| **数据库** | PostgreSQL (支持 SQLite/LibSQL) |
| **桌面端** | Tauri 2.0 (Rust) |
| **AI** | LlamaIndex + LangChain |
| **部署** | Docker (多架构) / Zeabur |

---

## 📁 项目结构

```
blinko/
├── app/                    # 前端 (Vite + React + Tauri)
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── store/          # MobX 状态管理
│   │   └── lib/            # 工具函数
│   ├── src-tauri/          # Tauri Rust 代码
│   └── vite.config.ts      # Vite 配置
├── server/                 # 后端 (Express + tRPC)
├── prisma/                 # Prisma Schema + 迁移
├── plugins/                # 内置插件 (已从 server 迁移至根目录)
├── shared/                 # 前后端共享类型
├── dockerfile              # Docker 构建
├── turbo.json              # Turborepo 配置
└── *.md                    # 项目文档
```

---

## 📚 关键文档

| 文档 | 内容 |
|-----|------|
| `COMPATIBILITY_LOG.md` | Safari 15 兼容性改造记录（CSS/JS/Polyfills） |
| `DIY_CUSTOMIZATIONS.md` | 个性化 UI/UX 定制记录 |
| `.github/workflows/` | CI/CD 工作流 (Docker / DMG 构建) |

---

## 🔧 核心兼容性方案

本 Fork 针对 Safari 15 做了以下兼容处理：

| 问题 | 解决方案 |
|-----|---------|
| **CSS `color-mix()` 不支持** | `postcss-preset-env` 自动降级 |
| **正则后行断言语法错误** | `@vitejs/plugin-legacy` Babel 转译 |
| **`AbortSignal.timeout` 缺失** | 手动 Polyfill (`polyfill.ts`) |
| **`requestIdleCallback` 缺失** | NPM Polyfill 包 |

---

## 🚀 常用命令

```bash
# 开发
bun install          # 安装依赖
bun run dev          # 启动开发服务 (Tauri 桌面端)

# 构建
bun run build:web    # 构建 Web 产物 (自动触发图标扫描)

# Docker
docker build -t blinko .
```

---

## ⚠️ 开发注意事项

1. **Safari 15 测试**：开发模式仅支持 Chrome/Firefox，生产构建后再测试 Safari 15
2. **图标系统**：使用 Iconify，新增图标会自动扫描并打包到 `icons.tsx`
3. **插件系统**：插件位于根目录 `plugins/`，支持热加载
4. **tRPC 调用**：前端使用 `api.xxx.yyy.query/mutate()`，流式使用 `streamApi`

---

## 🔗 相关资源

- **上游仓库**: https://github.com/blinkospace/blinko
- **Tauri 文档**: https://tauri.app/
- **tRPC 文档**: https://trpc.io/
