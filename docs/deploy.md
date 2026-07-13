# DocBase 部署运维手册

适用范围：DocBase 生产环境，TanStack Start 应用部署到阿里云函数计算 FC 3.0，PostgreSQL 和 Redis 通过阿里云 VPC 私网访问。

> **同步状态**：本文件的「架构、发布标准、流程、踩坑」与 DocBase 知识库的 [TanStack Start 阿里云函数计算发布规范（附录 A）](https://docbase.zerocmf.com/api/v1/documents/tanstack-start-2) 保持一致。仓库镜像作为 PR review 上下文，正式变更以知识库为准。

## 架构

```text
GitHub deploy 分支
  -> GitHub Actions runner
  -> GitHub Secrets 注入生产凭证
  -> pnpm build
  -> pnpm build:fc 生成 fc-deploy/code
  -> Serverless Devs 部署 fc-deploy/s.yaml
  -> FC custom runtime 启动 /code/bootstrap
  -> node .output/server/index.mjs
```

## 发布标准

标准以 `fc-deploy/` 为函数代码部署入口，以根目录 `s.yaml` 为自定义域名入口：

- `fc-deploy/s.yaml`: FC 3.0 函数配置。
- `s.yaml`: `fc3-domain` 自定义域名配置，只负责把线上域名路由到已部署函数。
- `fc-deploy/code/`: 构建生成的上传目录。
- `server/bootstrap`: FC custom runtime 启动脚本模板。
- `scripts/build-fc.mjs`: 从 TanStack Start 产物生成 `fc-deploy/code/`。
- `scripts/deploy-fc.sh`: 发布编排脚本。

不再使用：

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
| RAM 凭证 | runner 可执行 FC 发布 |
| GitHub Actions runner | 可安装 `pnpm`、`@serverless-devs/s`、`aliyun-cli` |
| 域名与证书 | 独立流程维护，不混入函数代码发布包 |

## 环境变量

workflow 侧通过 GitHub Secrets 注入原始凭证，并映射为 `deploy-fc.sh` 需要的标准变量：

| 标准变量 | 当前 workflow 来源 |
| --- | --- |
| `VPC_ID` | `VPC_ID` |
| `VSWITCH_ID` | `VSWITCH_ID` |
| `SECURITY_GROUP_ID` | `SECURITY_GROUP_ID` |
| `DATABASE_URL` | `APP_DB_URL` |
| `REDIS_URL` | `REDIS_APP_URL` |
| `BETTER_AUTH_SECRET` | `BETTER_AUTH_SECRET` |
| `BETTER_AUTH_URL` | `https://docbase.zerocmf.com` |
| `PUBLIC_APP_URL` | `https://docbase.zerocmf.com` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | workflow 拼接为 `https://docbase.zerocmf.com,https://cn-shanghai.fcapp.run` |

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

只构建 FC 上传包：

```bash
bash scripts/deploy-fc.sh package
```

只发布已有上传包：

```bash
DOCBASE_SKIP_BUILD=1 pnpm deploy
```

## 自定义域名配置

根目录 `s.yaml` 单独声明 `fc3-domain` 资源，绑定当前线上域名 `docbase.zerocmf.com` 到函数 `docbase-web`。这样做有两个目的：

- 保持 `fc-deploy/s.yaml` 仍然只负责函数代码部署和本地 `s local`。
- 让证书续签流程可以像 `cert-auto` 一样，在部署侧生成 PEM 文件后只更新域名绑定，而不改函数代码包。

域名资源依赖以下环境变量：

| 变量 | 用途 |
| --- | --- |
| `DOCBASE_DOMAIN` | 自定义域名，例如 `docbase.zerocmf.com` |
| `DOCBASE_DOMAIN_CERT_NAME` | FC 域名配置里展示的证书名 |
| `DOCBASE_DOMAIN_CERT_FILE` | 证书 PEM / fullchain 文件路径 |
| `DOCBASE_DOMAIN_KEY_FILE` | 私钥文件路径 |

执行方式：

```bash
pnpm deploy:domain:dry
pnpm deploy:domain
```

## GitHub Actions 发布

`.github/workflows/deploy.yml` 触发：

- push 到 `deploy` 分支
- `workflow_dispatch`

流程：

1. checkout `deploy`。
2. 安装并校验 `pnpm`、`@serverless-devs/s`、`aliyun-cli`。
3. 生成 `fc-deploy/prod.env`。
4. `scripts/deploy-fc.sh apply`，内部完成 build、deploy 和 smoke。
5. `/api/health` 冒烟。

如果证书续签流程产出了新的 `fullchain.cer` / `private.key`，可以在同一 runner 上继续执行：

```bash
DOCBASE_DOMAIN=docbase.zerocmf.com \
DOCBASE_DOMAIN_CERT_NAME=docbase-zerocmf-com \
DOCBASE_DOMAIN_CERT_FILE=/path/to/fullchain.cer \
DOCBASE_DOMAIN_KEY_FILE=/path/to/private.key \
bash scripts/deploy-fc.sh domain-apply
```

仓库内的 `.github/workflows/cert-renew.yml` 已经把这条链路自动化：

1. 每天北京时间 `00:00` 触发检测。
2. 读取 Aliyun CAS 中 `docbase.zerocmf.com` 当前上传证书的到期时间。
3. 若剩余有效期大于阈值（默认 30 天），直接退出。
4. 若剩余有效期小于等于阈值，执行 `aic cert:issue` 签发新证书。
5. 将新证书上传到 Aliyun CAS。
6. 执行 `bash scripts/renew-fc-domain-cert.sh` 内部的 `domain-apply`，更新 FC 自定义域名绑定。

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
