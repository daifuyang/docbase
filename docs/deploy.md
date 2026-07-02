# DocBase 部署运维手册

适用范围：DocBase 生产环境，TanStack Start 应用部署到阿里云函数计算 FC 3.0，PostgreSQL 和 Redis 通过阿里云 VPC 私网访问。

## 架构

```text
GitHub deploy 分支
  -> self-hosted runner
  -> env-config 加载生产凭证
  -> preflight / migrate
  -> pnpm build
  -> pnpm build:fc 生成 fc-deploy/code
  -> Serverless Devs 部署 fc-deploy/s.yaml
  -> FC custom runtime 启动 /code/bootstrap
  -> node .output/server/index.mjs
```

## 发布标准

标准以 `fc-deploy/` 为唯一 FC 部署入口：

- `fc-deploy/s.yaml`: FC 3.0 函数配置。
- `fc-deploy/code/`: 构建生成的上传目录。
- `server/bootstrap`: FC custom runtime 启动脚本模板。
- `scripts/build-fc.mjs`: 从 TanStack Start 产物生成 `fc-deploy/code/`。
- `scripts/deploy-fc.sh`: 发布编排脚本。

不再使用：

- 根目录 `s.yaml`
- `server/fc-server.mjs`
- `scripts/s-deploy.sh`
- 旧的 `dist/` 或 `server-build/` 发布包

## FC custom runtime 约定

`fc-deploy/s.yaml` 中：

```yaml
runtime: custom.debian12
code: ./code
customRuntimeConfig:
  command:
    - /code/bootstrap
  port: 9000
```

`bootstrap` 只负责启动应用：

```bash
cd /code
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-9000}"
exec node .output/server/index.mjs
```

不要在函数实例启动阶段执行：

- `apt-get`
- `pnpm install`
- 数据库迁移
- 管理员初始化
- 证书续签
- 任何会拉长冷启动的资源准备动作

## 一次性资源准备

生产环境需要提前准备：

| 资源 | 要求 |
| --- | --- |
| VPC / VSwitch / SecurityGroup | FC 与 PG/Redis 位于可互通网络内 |
| PostgreSQL 16 | 建议单独应用账号 `docbase_app` |
| Redis 7 | 建议单独应用账号或受限 ACL |
| RAM 凭证 | runner 可执行 FC 发布、必要时可执行证书流程 |
| 自托管 runner | 位于可访问 PG/Redis 私网的机器 |
| 域名与证书 | 独立流程维护，不混入函数代码发布包 |

## 环境变量

runner 侧通过 `env-config` 加载原始凭证，workflow 会映射为 `deploy-fc.sh` 需要的标准变量：

| 标准变量 | 来源示例 |
| --- | --- |
| `VPC_ID` | `FC_VPC_ID` |
| `VSWITCH_ID` | `FC_VSW_ID` |
| `SECURITY_GROUP_ID` | `FC_SG_ID` |
| `DATABASE_URL` | `APP_DB_URL` |
| `REDIS_URL` | `REDIS_APP_URL` |
| `BETTER_AUTH_SECRET` | `BETTER_AUTH_SECRET` |
| `BETTER_AUTH_URL` | `https://docbase.zerocmf.com` |
| `PUBLIC_APP_URL` | `https://docbase.zerocmf.com` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `https://docbase.zerocmf.com` |

固定运行时变量：

```env
DOCBASE_DEPLOY_MODE=fc
DOCBASE_INSTALLED=true
LOG_LEVEL=info
```

本地或手动发布时可复制：

```bash
cp fc-deploy/.env.example fc-deploy/prod.env
```

然后填写真实值。`prod.env` 不提交。

## 手动发布

普通代码发布：

```bash
pnpm deploy
```

指定环境文件：

```bash
DOCBASE_FC_ENV_FILE=/path/to/prod.env pnpm deploy
```

完整 release，包括 preflight、迁移和管理员确保：

```bash
pnpm deploy:release
```

只构建 FC 上传包：

```bash
bash scripts/deploy-fc.sh package
```

只发布已有上传包：

```bash
DOCBASE_SKIP_BUILD=1 pnpm deploy
```

## GitHub Actions 发布

`.github/workflows/deploy.yml` 触发：

- push 到 `deploy` 分支
- 手动 `workflow_dispatch`
- 定时任务，用于证书续签和增量发布

流程：

1. checkout `deploy`。
2. 校验 runner 工具链。
3. `env-config` 加载生产环境变量。
4. `scripts/pre-deploy-checks.sh` 检查 PG、Redis、阿里云 API。
5. 非定时任务执行数据库迁移。
6. 生成 `$RUNNER_TEMP/docbase-fc.env`。
7. `scripts/deploy-fc.sh package` 构建并校验 `fc-deploy/code/`。
8. 证书续签流程按需执行。
9. `scripts/deploy-fc.sh plan`。
10. `scripts/deploy-fc.sh apply`。
11. `/api/health` 冒烟。

## 回滚

函数代码回滚：

```bash
pnpm deploy:info
pnpm deploy:rollback
```

数据库迁移默认不可自动回滚。涉及 schema 变更时，发布说明必须写明兼容策略：

- 先发布兼容旧 schema 的代码。
- 再执行迁移。
- 最后发布使用新 schema 的代码。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| `Cannot resolve ${env(VPC_ID)}` | 检查 `DOCBASE_FC_ENV_FILE` 或 workflow 临时 env 文件。 |
| `node: command not found` | 检查 `fc-deploy/s.yaml` 的 `PATH` 是否包含 FC Node 路径。 |
| `Cannot find module` | 重跑 `pnpm build && pnpm build:fc`，确认 `fc-deploy/code/.output/server/index.mjs` 存在。 |
| `/api/health` 503 | 检查 PG/Redis 连接、VPC、安全组、账号权限。 |
| workflow 发布旧代码 | 确认 `DOCBASE_SKIP_BUILD=1` 只用于已经完成 `deploy-fc.sh package` 的后续步骤。 |
