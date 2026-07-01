# DocBase — fc-deploy 自包含部署单元

> 这个目录是**部署侧**的产物：源码 → `pnpm build` → `pnpm build:fc` → 这里。
> 它与仓库根目录的源码完全解耦，能独立 `s local` 验证、独立 `s deploy`。

---

## 目录布局

| 文件                  | 来源                          | git 提交? |
| --------------------- | ----------------------------- | --------- |
| `s.yaml`              | 手维护                        | ✅        |
| `.env.example`        | 模板（本地 env 占位）         | ✅        |
| `.gitignore`          | 手维护                        | ✅        |
| `README.md`           | 手维护                        | ✅        |
| `bootstrap`           | build-fc 从 repo `server/bootstrap` 复制 | ❌ gitignore |
| `fc-server.mjs`       | build-fc 从 repo `server/fc-server.mjs` 复制 | ❌ gitignore |
| `dist/`               | `pnpm build` → build-fc 拷贝  | ❌ gitignore |
| `db/migrations/`      | build-fc 从 repo 拷贝         | ❌ gitignore |
| `node_modules/`       | build-fc 跑 `pnpm install --prod` | ❌ gitignore |
| `package.json`        | build-fc 合成（deps + devDeps）| ❌ gitignore |
| `pnpm-lock.yaml`      | build-fc 跑 pnpm 生成          | ❌ gitignore |
| `.env`                | 用户从 `.env.example` 复制    | ❌ gitignore |

> `bootstrap` / `fc-server.mjs` 放在 fc-deploy/ **根**（与 .fc-code/ 历史布局
> 一致）——bootstrap 里写死 `cd /code; node fc-server.mjs`，必须能在 /code/
> 下找到 fc-server.mjs。

---

## 三步上手

```bash
# 在仓库根
pnpm build && pnpm build:fc

# 进入部署单元
cd fc-deploy
cp .env.example .env
vim .env                  # 填 DATABASE_URL / REDIS_URL / BETTER_AUTH_SECRET

# 启动本地 FC 模拟
s local start --env-file .env
```

容器启动后访问 `http://localhost:9000/api/health`，期望：

```json
{"ok":true,"db":"up","redis":"up","ts":"2026-..."}
```

---

## 它在 FC 上做什么

FC 把 `fc-deploy/` 整体上传到函数实例的 `/code`，然后执行：

```bash
/code/bootstrap
```

bootstrap 在 FC 上长这样：

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /code
exec /var/fc/lang/nodejs22/bin/node fc-server.mjs
```

`fc-server.mjs` 把 TanStack Start 导出的 `fetch` 包成 `http.createServer().listen(9000)`，
FC 把外部 HTTP 请求反向代理到 `:9000`。

---

## 本地降级方案

如果 `s local start` 在沙箱/受限网络里 docker 拉不到 `aliyunfc/runtime-custom.debian12`，
可以**直接跑 fc-server.mjs** 验证 build 产物正确性（不走 fc3 的 docker 模拟）：

```bash
cd fc-deploy
set -a; source .env; set +a
node fc-server.mjs
# → [docbase] listening on http://0.0.0.0:9000
curl http://localhost:9000/api/health
```

注意：bootstrap 是 FC 专用脚本（写死 `cd /code` + FC-managed node），本地降级
直接调 `node fc-server.mjs` 而不是走 `bash ./bootstrap`。

---

## 发到生产

```bash
# 在 VPS runner 上（已 `env-config load` 拿到真凭证）
cd /opt/docbase
git pull                                  # 同步最新 fc-deploy/
pnpm build && pnpm build:fc               # 重新生成 fc-deploy/

cd fc-deploy
s deploy -f s.yaml --env-file /etc/docbase/prod.env -y
```

`prod.env` 包含 `DATABASE_URL`（指向 ECS PG）、`REDIS_URL`（指向 ECS Redis）、
`BETTER_AUTH_SECRET`、`VPC_ID` / `VSWITCH_ID` / `SECURITY_GROUP_ID`、`CAS_CERT_ID`
等。`fc3 custom-runtime` 真实部署时**不需要** HTTPS / 自定义域名配置——
这部分由仓库根目录的 `s.yaml`（含 `fc3-domain` 资源）单独维护，**不要**合到本目录。

---

## 故障排查

| 现象                                                | 排查                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `Cannot resolve ${env(VPC_ID)}`                     | 没有 `--env-file` 或 `source .env`。所有 `${env(...)}` 必须能解析。         |
| `Cannot find package '@tanstack/...'`              | `fc-deploy/node_modules/` 没生成。重跑 `pnpm build:fc`。                  |
| `pnpm install` 卡在 supply-chain                   | 确认 `pnpm-workspace.yaml` 在仓库根目录（项目本地配置），且 `onlyBuiltDependencies` 含 `esbuild`。 |
| `/api/health` 返回 503 `db:"down"`                 | DATABASE_URL 写错 / 安全组没放行 / 凭据不对。                              |
| `s local start` 拉不到 `aliyunfc/runtime-...` 镜像  | 走"本地降级方案"，或提前 `docker pull aliyunfc/runtime-custom.debian12`。  |
| `bootstrap: cd: /code: No such file or directory`   | 正常：bootstrap 是 FC 专用，本地降级不要 `bash bootstrap`，直接 `node fc-server.mjs`。 |