# Prisma 7 + Docker + Zeabur 最佳实践指南

> **⚠️ 警告 (CRITICAL WARNING)**
> 本文档记录了 Blinko 项目升级至 Prisma 7 后的核心架构决策与配置红线。
> **在修改 `Dockerfile`、`prisma/schema.prisma` 或 `server/package.json` 前，必须阅读本文档。**
>这里的任何一行配置都有其背后的血泪调试史，请勿随意更改！

---

## 1. Dockerfile 核心红线 (DO NOT TOUCH)

### 1.1 依赖安装 (Runner Stage)
**现状**：我们在 Runner 阶段显式安装了 `prisma@7.3.0` 和 `@prisma/adapter-pg`。
**原因**：
1.  Monorepo 结构导致 `server/package.json` 中的依赖可能未包含底层适配器。
2.  `bun install` 在 Runner 阶段不可用（为了最小镜像体积）。
3.  **不能删**：`@prisma/adapter-pg` 是运行时连接数据库的物理驱动。

```dockerfile
# 必须保留这行显式安装，且版本必须与开发环境一致 (7.3.0)
RUN npm install prisma@7.3.0 @prisma/adapter-pg@7.3.0 --save-exact --legacy-peer-deps && \
    npm install pg lru-cache@11.1.0 uint8array-extras tsx @prisma/config --save-exact --legacy-peer-deps
```

### 1.2 启动脚本生成 (Start Script)
**现状**：使用 `npm exec prisma migrate deploy`。
**原因**：
1.  **禁止 `npx`**：`npx` 会在运行时尝试联网查询最新版（如 7.4.0），导致与本地生成的 Client (7.3.0) 不兼容。
2.  **禁止 `node .../index.js`**：源码路径不稳定，随 Prisma 版本变化。
3.  **必须 `npm exec`**：它强制使用当前目录 `node_modules` 下的二进制文件，确保 **100% 确定性**。

```dockerfile
# 必须使用 npm exec
DATABASE_URL=$DIRECT_URL npm exec prisma migrate deploy
```

### 1.3 幂等性检查 (Idempotency)
**现状**：`if [ -f "server/index.js" ]; then mv ... fi`
**原因**：容器在 Crash Back-off 重启时，文件可能已经被重命名为 `.cjs`。如果不加判断直接 `mv`，会导致重启失败进入死循环。

---

## 2. Prisma 配置红线

### 2.1 Schema Binary Targets
**文件**: `prisma/schema.prisma`
**配置**: `binaryTargets = ["native", "linux-musl"]`
**原因**：
*   `native`: 用于 macOS/Windows 本地开发。
*   `linux-musl`: **必须保留**。Docker 容器基于 Alpine Linux，它使用 musl libc 而不是 glibc。漏掉这个会导致 Client 初始化失败 (`Query engine library not found`)。

### 2.2 配置文件格式
**文件**: `prisma.config.ts` (TypeScript)
**原因**：Prisma 7 推荐使用 TS 配置。旧的 CJS (`.js`) 配置在 ESM (`type: module`) 项目中极易引发解析错误。
**运行时支持**: 必须安装 `tsx` 和 `@prisma/config` 才能加载此文件。

---

## 3. 连接池架构 (Connection Pooling)

**核心原则**：Migration 走直连，App 走连接池。

| 场景 | 环境变量 | 端口 | 模式 | 原因 |
| :--- | :--- | :--- | :--- | :--- |
| **Migration** | `$DIRECT_URL` | 5432 | Session | Prisma Migrate 需要数据库的排他性锁，Pooler (Transaction Mode) 不支持。 |
| **App Runtime** | `DATABASE_URL` | 6543 | Transaction | App 高并发请求需要复用连接，直连会导致 Postgres 连接数耗尽 (max_connections)。 |

**实施方式**：
在 `Dockerfile` 的 `start.sh` 中，我们**仅在 Migration 步骤**临时覆盖环境变量：
```bash
# 仅此一行使用直连
DATABASE_URL=$DIRECT_URL npm exec prisma migrate deploy

# App 启动时恢复默认 (读取 Zeabur 注入的 6543 端口配置)
node server/index.cjs
```

---

## 4. 常见误区 (Pitfalls)

1.  **"我更新了 `package.json`，为什么 Docker 里的 prisma 没变？"**
    *   Docker 的 Layer Caching 机制。必须修改 Dockerfile 中的 `prisma@7.3.0` 版本号，或者使用 `--no-cache` 构建。
2.  **"为什么本地能跑，Docker 里报 `MODULE_NOT_FOUND`？"**
    *   检查 Runner 阶段的 `npm install` 是否漏掉了新引入的依赖。Runner 阶段是“白名单”机制，不是自动的全量安装。
3.  **"为什么应用启动后连不上数据库？"**
    *   检查 Zeabur 环境变量 `DATABASE_URL` 是否包含 `pgbouncer=true` 和 `&sslmode=no-verify`。
    *   检查是否在 `start.sh` 中错误地给 App 进程也加上了 `DATABASE_URL=$DIRECT_URL` (这是之前的 Bug)。

---

> **维护者注**：
> 任何涉及上述配置的修改，都应该在 Zeabur 的 Staging 环境先行验证，严禁直接推送到 Production。
