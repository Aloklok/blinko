# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作提供指导。

## 项目概述

这是 [Blinko](https://github.com/blinko-space/blinko) 的 Fork 版本（[Aloklok/blinko](https://github.com/Aloklok/blinko)）。

Blinko 是一个自托管的 AI 驱动卡片笔记应用，支持 Web、Tauri 桌面端和移动端。

## 技术栈

- **前端**: React 18, TypeScript, Vite, TailwindCSS v4, Tauri (桌面端)
- **后端**: Node.js, Express, tRPC, Prisma ORM
- **数据库**: PostgreSQL
- **包管理器**: Bun (v1.2.8+)
- **构建工具**: Turbo (monorepo)
- **AI**: 多 provider 支持 (OpenAI, Anthropic, Google, Azure, Ollama 等)

## 项目结构

```
blinko/
├── app/                    # 前端 React 应用
│   ├── src/               # React 源码
│   │   ├── store/         # MobX 状态管理
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # UI 组件
│   │   └── lib/           # 工具库 (trpc.ts, i18n 等)
│   ├── src-tauri/         # Tauri 桌面端配置
│   └── vite.config.ts     # Vite + PWA 配置
├── server/                 # 后端服务
│   ├── routerTrpc/        # tRPC 路由 (notes, users, tags, config 等)
│   ├── routerExpress/     # Express 路由 (auth, file, openai 等)
│   │   └── auth/          # 认证路由 (OAuth + 本地登录)
│   ├── aiServer/          # AI 集成服务
│   ├── jobs/              # 后台定时任务
│   ├── middleware/         # tRPC 中间件 (authProcedure, publicProcedure)
│   ├── context.ts         # tRPC 请求上下文 (token 解析)
│   ├── index.ts           # Express 服务入口
│   └── lib/               # 工具函数 (helper.ts)
├── prisma/                # 数据库 Schema 和迁移
├── shared/                # 前后端共享的类型和工具
└── patches/               # 第三方库补丁 (Vditor)
```

## 常用命令

```bash
# 安装依赖
bun install

# 生成 Prisma 客户端
bun run prisma:generate

# 开发
bun run dev:backend        # 仅后端
bun run dev:frontend       # 仅前端

# 构建
bun run build:web          # 构建 Web 应用 (turbo run build:web)

# 数据库
bun run prisma:migrate:dev # 开发环境迁移
bun run prisma:migrate:deploy # 生产环境迁移
bun run prisma:studio      # 打开 Prisma Studio

# 类型检查
bunx tsc --noEmit --project app/tsconfig.json   # 前端
bunx tsc --noEmit --project server/tsconfig.json # 后端
```

## 架构要点

### API 层 (tRPC + Express)

- **tRPC 路由**: `server/routerTrpc/` 下，分为 `publicProcedure`（无需认证）和 `authProcedure`（需要 JWT token）
- **Express 路由**: `server/routerExpress/` 下，用于文件上传、OAuth 回调、OpenAI 兼容接口等
- **认证**: JWT token 通过 `Authorization: Bearer <token>` 传递，解析逻辑在 `server/context.ts`
- **注意**: `notes.list`、`users.canRegister` 等是 `.mutation()` 不是 `.query()`，客户端必须用 POST

### 前端状态管理

- **MobX Store**: `app/src/store/` 下
- **UserStore**: 管理登录状态、token、用户信息
- **BlinkoStore**: 管理笔记列表、搜索、过滤
- **PromiseState / PromisePageState**: 封装异步操作，自动管理 loading 状态
- **tRPC 客户端**: `app/src/lib/trpc.ts`，使用 `httpBatchLink`，mutations 用 POST，queries 用 GET

### 认证流程

- 本地登录: `POST /api/auth/login` → passport 'local' 策略
- OAuth: `GET /api/auth/:providerId` → passport 动态策略
- Token 验证: `GET /api/auth/profile`
- **注意**: `GET /:providerId` 是 OAuth 的 catch-all 路由，已排除 login/logout/profile 等保留路径

### PWA / Service Worker

- 使用 `vite-plugin-pwa`，仅生产环境启用
- Workbox 配置在 `app/vite.config.ts`
- `/api/` 路径已配置为 `NetworkOnly`，不缓存 tRPC 请求

## Fork 本仓库的特殊说明

### 已修复的问题

1. **移动端登录错误**: 修复了 `GET /:providerId` catch-all 路由拦截 `/api/auth/login` 的问题
2. **Tailwind CSS v4 兼容性**: 修复了 list-style 被 preflight 覆盖的问题（使用 `@layer base`）
3. **Markdown 列表渲染**: 卡片列表序号和 checkbox 显示修复
4. **Vditor 补丁**: `patches/apply-vditor-patches.js` 在 postinstall 时自动应用
5. **Prisma 版本锁定**: 锁定 7.3.0 避免兼容性问题

### 与上游同步

上游仓库: `https://github.com/blinko-space/blinko`

```bash
# 添加上游远程仓库（首次）
git remote add upstream https://github.com/blinko-space/blinko.git

# 拉取上游更新
git fetch upstream
git merge upstream/main

# 解决冲突时的原则：
# 1. 最大可能保留 fork 的功能修改
# 2. 如果上游是 Bug 修复，采用上游的
```

## 环境配置

在根目录创建 `.env` 文件:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/blinko
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:1111

# S3 存储（可选）
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# AI Provider（可选）
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

## 部署

```bash
# Docker
docker-compose -f docker-compose.prod.yml up -d

# 手动部署
bun run build:web
bun run prisma:migrate:deploy
bun run start
```

## 注意事项

- 包管理器使用 Bun，不要用 npm/yarn
- 默认端口 1111
- PostgreSQL 是必须的数据库
- Tauri 桌面端需要 Rust 工具链
- 前端类型检查有部分预存错误（与本次修改无关）
