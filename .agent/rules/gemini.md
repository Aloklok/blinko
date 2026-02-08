---
trigger: always_on
---

# Blinko Fork - Antigravity 首席架构助理指南 (GEMINI.MD)

> **本文档面向 AI 助手 (Antigravity)**，旨在提供项目架构、技术栈、开发规范以及本 Fork 仓库特有逻辑的权威说明。

---

## 🤖 核心准则 (Guiding Principles)

1.  **全中文交互**：技术方案、文档、代码注释必须使用中文。
2.  **全量上下文阅读**：优先阅读根目录下的 `alok_docs/COMPATIBILITY_LOG.md`, `alok_docs/OPTIMIZATION_LOG.md` 以及 `alok_docs/DIY_CUSTOMIZATIONS.md`。
3.  **设备优先策略**：当前主力开发环境为 **macOS 12.7.6 / iOS 17.6 (Safari 17.6)**。性能优化优先于 Safari 15 极致兼容。Safari 15 兼容性代码已注释。

---

## 🏗️ 技术栈

| 层级 | 技术 | 详情 |
|-----|------|------|
| **前端** | React 18 + TS + Vite 6 | HeroUI (@heroui/react), Vditor, MobX, TailwindCSS |
| **后端** | Node.js + tRPC + Express | Prisma ORM, PostgreSQL |
| **桌面/移动** | Tauri 2.0 (Rust) | 支持 macOS, Android, iOS |
| **基础设施** | Bun (v1.2.8+) | 包管理、脚本执行、运行时 |
| **构建/管道** | Turborepo | 模块化构建与提取自动化 |

---

## 📁 关键目录结构

```bash
blinko/
├── app/                    # 前端 (React + Tauri)
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── store/          # MobX 状态管理 (根在 rootStore.ts)
│   │   └── lib/            # 工具类
│   └── src-tauri/          # Tauri 配置与 Rust 代码
├── server/                 # 后端 (tRPC + Express)
│   ├── aiServer/           # AI 核心桥接与 Provider
│   ├── routerTrpc/         # 类型安全 API 路由
│   └── routerExpress/      # 文件上传/下载等原生路由
├── shared/                 # 前后端共享类型与工具
├── prisma/                 # 数据库 Schema 与 Migration
├── plugins/                # 本地插件目录 (如 beautify)
└── *.md                    # 项目核心日志与指南
```

---

## 🔧 核心兼容性方案 (Safari 15-17)

本 Fork 针对 Safari 做了以下专项优化（详见 `COMPATIBILITY_LOG.md`）：
- **CSS**: 针对 Safari 15 的强制降级已在 `postcss.config.js` 中**注释**。
- **API**: `main.tsx` 中的 Polyfills (AbortSignal, IdleCallback) 已**注释**。
- **正则**: 严禁在源码中使用后行断言 `(?<=...)`，作为保障现代浏览器解析性能的通用规范。

---

## 🚀 常用开发命令

```bash
# 安装依赖与生成数据库客户端
bun install && bun run prisma:generate

# 启动开发环境 (Tauri 模式)
bun run dev

# 构建 Web 产物 (自动触发图标扫描)
bun run build:web

# 数据库管理
bun run prisma:studio
```

---

## ⚠️ 开发注意事项

1.  **图标扫描**: 使用 Iconify。新增图标需匹配 `prefix:name` 格式，构建时会自动提取至 `icons.tsx`。
2.  **插件通信**: 优先使用挂载在 `window.Blinko` 上的 `streamApi` 及其配套桥接函数。
3.  **性能优先**: 避免在 `init` 阶段执行大批量串行 `await`，应优先考虑并行化 (`Promise.all`)。
4.  **tRPC 调用**: 前端使用 `api.xxx.yyy.query/mutate()`。
