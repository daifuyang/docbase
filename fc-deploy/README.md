# DocBase FC 发布标准

本目录是 DocBase 面向阿里云函数计算 FC 3.0 的部署单元。当前标准只支持 TanStack Start 的 Nitro Node 产物，不再兼容旧的 `dist/` + `fc-server.mjs` 方案。

## 设计原则

- bootstrap 只启动应用，不安装依赖、不生成文件、不做迁移。
- 构建、依赖处理、迁移和管理员初始化都发生在发布侧。
- FC 只接收 `fc-deploy/code/`，部署配置、环境模板和真实凭证不进入函数代码包。
- 生产函数是已安装实例，`DOCBASE_DEPLOY_MODE=fc` 和 `DOCBASE_INSTALLED=true` 必须开启。

## 官方模型

阿里云 FC custom runtime 的关键配置是：

- `code`: 上传到函数实例并挂载为 `/code` 的目录。
- `customRuntimeConfig.command`: 函数实例启动命令。
- `customRuntimeConfig.port`: FC HTTP 触发器反向代理到的应用端口。

DocBase 对应关系：

| FC 配置 | DocBase |
| --- | --- |
| `code` | `fc-deploy/code` |
| 启动命令 | `/code/bootstrap` |
| 应用入口 | `.output/server/index.mjs` |
| 监听端口 | `9000` |
| 运行时 | `custom.debian12` + Node PATH |

TanStack Start 的生产入口是 `node .output/server/index.mjs`。因此 bootstrap 保持最小：

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /code

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-9000}"

exec node .output/server/index.mjs
```

## 目录布局

| 路径 | 来源 | 是否提交 |
| --- | --- | --- |
| `s.yaml` | 手维护的 FC 3.0 配置 | 是 |
| `.env.example` | 本地/发布环境模板 | 是 |
| `.gitignore` | 手维护 | 是 |
| `README.md` | 本文档 | 是 |
| `code/` | `pnpm build:fc` 生成 | 否 |
| `code/bootstrap` | 从 `server/bootstrap` 复制 | 否 |
| `code/.output/` | `pnpm build` 的 TanStack Start/Nitro 产物 | 否 |
| `code/db/migrations/` | 从 `db/migrations` 复制 | 否 |
| `code/package.json` | 构建脚本生成的最小运行元数据 | 否 |
| `code/fc-manifest.json` | 构建脚本生成的发布包信息 | 否 |
| `.env` / `prod.env` | 本机真实环境变量 | 否 |

## 发布包生成

在仓库根目录执行：

```bash
pnpm build
pnpm build:fc
```

`pnpm build:fc` 会生成 `fc-deploy/code/` 并校验以下文件存在：

- `code/bootstrap`
- `code/.output/server/index.mjs`
- `code/.output/public`
- `code/db/migrations`
- `code/package.json`
- `code/fc-manifest.json`

## 本地验证

FC 本地模拟：

```bash
cd fc-deploy
cp .env.example .env
s local start --env-file .env
curl http://localhost:9000/api/health
```

如果本地 Docker 环境无法拉取 FC runtime 镜像，可以直接验证 Nitro 产物：

```bash
cd fc-deploy
set -a; source .env; set +a
PORT=9000 node code/.output/server/index.mjs
curl http://localhost:9000/api/health
```

## 手动发布

默认读取 `fc-deploy/prod.env`：

```bash
pnpm deploy
```

指定环境文件：

```bash
DOCBASE_FC_ENV_FILE=/path/to/prod.env pnpm deploy
```

只构建发布包：

```bash
bash scripts/deploy-fc.sh package
```

只校验已生成的发布包：

```bash
bash scripts/deploy-fc.sh check
```

只发布已生成的发布包：

```bash
DOCBASE_SKIP_BUILD=1 pnpm deploy
```

完整 release 可显式打开发布前步骤：

```bash
DOCBASE_RUN_PREFLIGHT=1 DOCBASE_RUN_MIGRATIONS=1 DOCBASE_RUN_ADMIN_ENSURE=1 pnpm deploy
```

## 必填环境变量

`scripts/deploy-fc.sh apply` 需要：

| 变量 | 用途 |
| --- | --- |
| `VPC_ID` | FC 访问私网 PG/Redis 的 VPC |
| `VSWITCH_ID` | FC 绑定的交换机 |
| `SECURITY_GROUP_ID` | FC 绑定的安全组 |
| `DATABASE_URL` | 应用运行时数据库连接 |
| `REDIS_URL` | 应用运行时 Redis 连接 |
| `BETTER_AUTH_SECRET` | better-auth 密钥 |
| `BETTER_AUTH_URL` | 认证回调基准 URL |
| `PUBLIC_APP_URL` | 对外站点 URL |
| `BETTER_AUTH_TRUSTED_ORIGINS` | 可信 Origin，多个用逗号分隔 |

推荐固定：

```env
DOCBASE_DEPLOY_MODE=fc
DOCBASE_INSTALLED=true
LOG_LEVEL=info
```

## Workflow 接入

`.github/workflows/deploy.yml` 的发布链路：

1. 自托管 runner 加载 `env-config`。
2. 内网连通性检查。
3. 数据库迁移。
4. 生成临时 `$RUNNER_TEMP/docbase-fc.env`，把 runner 环境变量映射成 `deploy-fc.sh` 需要的标准变量名。
5. `bash scripts/deploy-fc.sh package` 生成 `fc-deploy/code/`。
6. 证书续签流程单独执行。
7. `DOCBASE_SKIP_BUILD=1 bash scripts/deploy-fc.sh plan`。
8. `DOCBASE_SKIP_BUILD=1 bash scripts/deploy-fc.sh apply`。
9. 访问 `/api/health` 冒烟。

## 故障排查

| 现象 | 排查 |
| --- | --- |
| `Cannot resolve ${env(VPC_ID)}` | 环境文件没有传给 `deploy-fc.sh`，或变量名没有映射成 `VPC_ID`。 |
| `node: command not found` | FC runtime PATH 未包含 Node。检查 `fc-deploy/s.yaml` 的 `PATH`。 |
| `Cannot find module ...` | TanStack Start 产物缺失或 Nitro bundling 异常。重跑 `pnpm build && pnpm build:fc`。 |
| `/api/health` 返回 503 | 检查 `DATABASE_URL`、`REDIS_URL`、VPC、安全组和账号权限。 |
| 本地 `s local start` 拉镜像失败 | 直接运行 `node code/.output/server/index.mjs` 验证产物，或预拉 FC runtime 镜像。 |
