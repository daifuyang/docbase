# DocBase 部署运维手册（FC + 阿里云 ECS 内网）

> 适用：`docbase.zerocmf.com`，部署到阿里云上海 FC（函数计算），数据库与 Redis 在内网 ECS 上。
> 数据库账号 `docbase_app`，遵循"一个项目一个账号一库"最小权限模型。

---

## 0. 架构速览

```
push to deploy 分支
       │
       ▼
GitHub Actions self-hosted runner (内网 VPS, Shanghai)
       │
       ├── env-config get  → ~/.aliyun/config.json (本地凭证)
       ├── psql/redis-cli  → 内网 ECS PG+Redis (sanity + migrate + ACL verify)
       ├── pnpm build / build:fc → server-build/
       ├── certbot + aliyun cas UploadSSLCertificate
       └── npx s deploy -f s.yaml  → FC cn-shanghai + 阿里云 DNS
                                          │
                                          ▼
                              https://docbase.zerocmf.com (HTTPS, custom Domain)
```

---

## 1. 一次性初始化

> 仅在 ECS、阿里云控制台、VPS runner 上各执行一次。第二次发布不需要重做。

### 1.1 阿里云控制台

| 资源 | 步骤 |
| --- | --- |
| VPC / VSwitch / SecurityGroup / NAT | 在 cn-shanghai 创建 / 复用一套，**FC 要和 ECS 同 VPC** |
| 域名 `zerocmf.com` | 在阿里云 DNS 控制台建立 zone |
| SSL 证书 | 用 certbot 签发后上传到阿里云 CAS，留 certId |
| RAM 子账号 | 创建 `docbase-deploy`，授权 `AliyunFCFullAccess`、`AliyunDNSFullAccess`、`AliyunSSLFullAccess`、受限的 `AliyunVPCReadOnlyAccess`；AK/SK 写到 `env-config` |

### 1.2 ECS PG（自建 PostgreSQL 16）

```bash
# 在 ECS 上装好 PostgreSQL 16，监听 0.0.0.0:5432，仅允许 runner 安全组访问
ssh $ECS_PG "apt-get install -y postgresql-16"
ssh $ECS_PG "pg_ctlcluster 16 main start"

# 在 VPS runner 上跑授权脚本
env \
  ECS_PG_HOST=10.0.x.x ECS_PG_PORT=5432 \
  PG_ADMIN_PWD=$(env-config get docbase.pg_super_pwd) \
  APP_DB_PWD=$(env-config get docbase.db_app_pwd) \
  bash scripts/apply-grants.sh
```

验证：

```bash
PGPASSWORD=$(env-config get docbase.db_app_pwd) \
  psql -h 10.0.x.x -U docbase_app -d docbase \
  -c '\dn+' -c '\du docbase_app'
```

### 1.3 ECS Redis（自建 Redis 7）

```bash
ssh $ECS_REDIS "apt-get install -y redis-server"
# 把 redis/acl.conf 写到 /etc/redis/acl.conf
ssh $ECS_REDIS "redis-server /etc/redis/redis.conf &"
```

回到 runner：

```bash
env \
  ECS_REDIS_HOST=10.0.x.y ECS_REDIS_PORT=6379 \
  REDIS_ADMIN_PWD=$(env-config get docbase.redis_super_pwd) \
  REDIS_APP_PWD=$(env-config get docbase.redis_app_pwd) \
  bash scripts/apply-redis-acl.sh
```

验证：

```bash
redis-cli -u redis://docbase_app:$(env-config get docbase.redis_app_pwd)@10.0.x.y:6379/0 \
  --no-auth-warning ACL WHOAMI
# 期望输出 docbase_app
```

### 1.4 VPS runner 初始化

```bash
git clone https://github.com/<owner>/docbase.git /opt/docbase
cd /opt/docbase
bash scripts/install-runner-deps.sh
```

按提示：

- 填 `~/.aliyun/cred.ini`（certbot 用）
- 填 `~/.aliyun/config.json`（aliyun CLI + env-config）
- 注册 runner：

```bash
cd /home/actions-runner
./config.sh --url https://github.com/<owner>/docbase --token <TOKEN> \
            --labels fc-deploy,docbase --unattended --replace
sudo ./svc.sh install
sudo ./svc.sh start
```

### 1.5 `env-config` 注入所有凭证

```bash
env-config set --profile docbase-prod --key ALIYUN_AK --value <主账号AK>
env-config set --profile docbase-prod --key ALIYUN_SK --value <主账号SK>
env-config set --profile docbase-prod --key FC_VPC_ID   --value vpc-xxxxxx
env-config set --profile docbase-prod --key FC_VSW_ID   --value vsw-xxxxxx
env-config set --profile docbase-prod --key FC_SG_ID    --value sg-xxxxxx
env-config set --profile docbase-prod --key FC_NAT_ID   --value nat-xxxxxx
env-config set --profile docbase-prod --key PG_PRIVATE_HOST --value 10.0.x.x
env-config set --profile docbase-prod --key REDIS_PRIVATE_HOST --value 10.0.x.y
env-config set --profile docbase-prod --key PG_SUPER_URL --value postgres://postgres:...@10.0.x.x:5432/docbase
env-config set --profile docbase-prod --key APP_DB_URL   --value postgres://docbase_app:...@10.0.x.x:5432/docbase
env-config set --profile docbase-prod --key REDIS_SUPER_URL --value redis://default:...@10.0.x.y:6379/0
env-config set --profile docbase-prod --key REDIS_APP_URL    --value redis://docbase_app:...@10.0.x.y:6379/0
env-config set --profile docbase-prod --key BETTER_AUTH_SECRET --value $(openssl rand -hex 32)
env-config set --profile docbase-prod --key CAS_CERT_ID  --value <uploaded-cert-id>
env-config set --profile docbase-prod --key LE_EMAIL     --value letsencrypt@zerocmf.com
env-config set --profile docbase-prod --key WEBHOOK_URL  --value https://oapi.dingtalk.com/robot/send?access_token=...
env-config set --profile docbase-prod --key WEBHOOK_KIND --value dingtalk
```

### 1.6 在 `s.yaml` 里填硬编码值

`s.yaml` 的 `vars` 是文档化的"一切从哪里来"入口；下面的几个值因 cert/vpc/nat 不能从 env-config 直接拿（必须是 const），写到 `s.yaml` 的 vars 块顶部或 env-config 加载后由 `s-deploy.sh` 注入。

| vars 名称 | 来源 |
| --- | --- |
| `fc-service-role` | 阿里云控制台 RAM → Roles → 选中 `AliyunFCDefaultRole` / 自行创建 |
| `cert-id` | 第一步在 CAS 拿到，写进 env-config 的 `CAS_CERT_ID` |

### 1.7 创建 `deploy` 分支 & 首次发布

```bash
cd /opt/docbase
git fetch origin
git switch -c deploy origin/main
git push -u origin deploy
```

合并后 GH Actions 自动跑 `deploy.yml`。

### 1.8 首次联调（不走 CD）

在 runner 上手动跑：

```bash
cd /opt/docbase
git pull
pnpm install --frozen-lockfile

# 源码变动时必须 clean build（Vite 缓存 dist/，不删会漏掉改动的文件）
rm -rf dist && pnpm build

pnpm build:fc
bash scripts/s-deploy.sh plan    # 看一眼会创建什么
bash scripts/s-deploy.sh apply   # 真发版
curl -sk https://docbase.zerocmf.com/api/health
```

> **本地手动发版**（无需 runner）：
> ```bash
> export $(cat /tmp/opencode/docbase-fc.env | xargs) && \
>   rm -rf dist && pnpm build && pnpm build:fc && \
>   s deploy -f s.yaml -y
> ```

---

## 2. 日常发布

1. 提 PR 到 `main`
2. CI（`ci.yml`）跑通 → 自动合并到 `main`
3. 由人在 GitHub UI 上 `Create a PR` 从 `main` 到 `deploy`，或者用 fast-forward 同步：

   ```bash
   git switch deploy && git merge --ff-only main && git push
   ```

4. `deploy.yml` 自动跑：
   - env-config load → pre-deploy-checks → migrate → build → build:fc → renew-cert（可选）→ s deploy → smoke test
5. 飞书/钉钉通知结果

---

## 3. 紧急回滚

```bash
# 1. 看 FC 的版本历史（FC 自带版本管理，可保留最近 N 个）
bash scripts/s-deploy.sh info

# 2. 切到指定版本
# 用 Serverless Devs 的 rollback：
bash scripts/s-deploy.sh rollback

# 或者手动用 aliyun fc UpdateFunction 指定 codeUri 指向上一个 server-build.zip。
```

数据库迁移是单向的：仓促回滚后，**不能再次发布包含新 schema 的镜像**，先回到上一个稳定 hash。

---

## 4. 灾备

### 4.1 PostgreSQL

每天 02:00 (Shanghai) 由 runner 端 cron 跑：

```cron
0 2 * * * cd /opt/docbase && bash scripts/pg-backup.sh
```

`pg-backup.sh` 用 `pg_dump --format=custom` 落到 `/backup/docbase/$(date +%F).dump`，再 `ossutil cp` 上传 OSS（key 也只存在 env-config 里）。

### 4.2 Redis

Redis 7 默认开启 AOF + snapshot（`appendonly yes`、`save 60 1000`）。重启后从 `/var/lib/redis/appendonlydir/` 自动 load。

需要快速定位时 `redis-cli -u redis://docbase_app:… INFO replication` / `LATENCY`。

---

## 5. 监控

| 维度 | 检查命令 |
| --- | --- |
| HTTPS | `curl -vI https://docbase.zerocmf.com/api/health` |
| DNS | `dig docbase.zerocmf.com @1.1.1.1 CNAME +short` |
| 证书 | `openssl s_client -connect docbase.zerocmf.com:443 -servername docbase.zerocmf.com </dev/null 2>/dev/null \| openssl x509 -noout -dates -subject -ext subjectAltName` |
| FC 状态 | `aliyun fc GetFunction --region cn-shanghai --serviceName docbase-prod --functionName docbase-web` |
| 冷启动 | `aliyun fc GetProvisionConfig --region cn-shanghai --serviceName docbase-prod --functionName docbase-web` |
| PG | `psql -h $PG_PRIVATE_HOST -U docbase_app -d docbase -c 'select 1;'` |
| Redis | `redis-cli -u $REDIS_APP_URL ping` |

---

## 6. 凭证轮换

| 项 | 频率 |
| --- | --- |
| `BETTER_AUTH_SECRET` | 每 90 天 |
| `docbase_app`（PG + Redis） | 每 180 天 |
| Aliyun AK/SK | 每 90 天 |
| Let's Encrypt cert | 每 60 天（certbot 自动续签） |

```bash
# 1) 生成新密钥
NEW=$(openssl rand -hex 32)

# 2) 更新 env-config（仅一台 runner 主机）
env-config set --profile docbase-prod --key BETTER_AUTH_SECRET --value "$NEW"

# 3) 触发一次部署，让 FC 函数被 recreate
gh workflow run deploy.yml --repo <owner>/docbase --ref deploy
```

---

## 7. 常见问题

| 现象 | 排查 |
| --- | --- |
| `psql: connection to server … timeout` | 安全组没放开 runner 私网 → ECS。检查 `FC_SG_ID` 与 ECS 入方向 |
| `redis-cli NOAUTH` | `REDIS_APP_URL` 里密码错，或 `default` user 被禁后必须显式 `--user docbase_app` |
| `flushall 拒绝执行` | `redis/acl.conf` 设对了；确保生产 ECS 真的用 ACL 启动 |
| `s deploy` 报 `dns:CNAME not found` | 第一次创建走 `AddDomainRecord`，后续走 `UpdateDomainRecord`（脚本已封装） |
| `health` 接口 503 | 看 `redis: "up"/"down"`、`db: "up"/"down"`，定位到 PG 或 Redis 私网通讯 |

---

## 8. 维护清单（建议每季度）

- [ ] PG + Redis ACL 凭证轮换
- [ ] Aliyun AK/SK 轮换
- [ ] 证书续签一次演练（`gh workflow run deploy.yml` + `inputs.skip_cert_renew=false`）
- [ ] ECS 镜像/快照备份演习
- [ ] Runbook 复盘：本次出过什么问题
