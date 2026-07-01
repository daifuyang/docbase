# FC 连接 VPS 资源测试总结

**测试日期**: 2026-07-01

## 测试目的

验证阿里云 FC3 函数能否正常连接 VPS 上的 PostgreSQL 和 Redis。

## 测试结果

| 服务 | 公网 IP | 内网 IP | 连接结果 |
|------|---------|---------|----------|
| PostgreSQL | `139.196.89.64:5432` | `172.23.212.135:5432` | ❌ 不通 |
| Redis | `139.196.89.64:6379` | - | ✅ 可通 |

## 问题原因

PostgreSQL 只监听在内网 IP `172.23.212.135` 和本地 `127.0.0.1`，没有监听公网。

Redis 监听 `0.0.0.0:6379`，公网可访问。

## 解决方案

### 方案一：使用内网连接（推荐）

FC 和 VPS 在同一 VPC 内，使用内网 IP 连接：

```bash
DATABASE_URL=postgresql://postgres:Codecloud2025.@172.23.212.135:5432/docbase
REDIS_URL=redis://:Codecloud2025.@139.196.89.64:6379
```

### 方案二：开放 PostgreSQL 公网监听

修改 PostgreSQL 配置使其监听公网（不推荐，安全风险）。

## s.yaml 配置

```yaml
environmentVariables:
  DATABASE_URL: postgresql://docbase_app:Dbc2025!Xk9@172.23.212.135:5432/docbase
  REDIS_URL: redis://:Codecloud2025.@139.196.89.64:6379
```

## 数据库用户

| 用户 | 权限 | 用途 |
|------|------|------|
| `docbase_app` | 普通用户 | DocBase 应用连接 |
| `postgres` | superuser | 管理员操作 |

## 关键配置

| 配置项 | 值 |
|--------|-----|
| VPC | `vpc-uf65806lcuh5b43szs1db` |
| vSwitch | `vsw-uf6fcm08qor78wfioz1c2` |
| 安全组 | `sg-uf6bl327dijrauls3ism` |
| VPS 内网 IP | `172.23.212.135` |
| VPS 公网 IP | `139.196.89.64` |
| PG 端口 | `5432` |
| Redis 端口 | `6379` |

## 数据库迁移状态

**VPS PostgreSQL 数据库**: `docbase`

已执行迁移：

| ID | 迁移名称 | 状态 |
|----|----------|------|
| 1 | 0000_strong_old_lace | ✅ 已应用 |
| 2 | 0001_dizzy_odin | ✅ 已应用 |
| 3 | 0002_dear_wolfsbane | ✅ 已应用 |
| 4 | 0003_good_switch | ✅ 已应用 |
| 5 | 0004_polite_omega_sentinel | ✅ 已应用 |
| 6 | 0005_clumsy_wraith | ✅ 已应用 |

### 现有表

```
account, apikey, category, document, document_tag,
session, space, tag, user, user_preference, verification
```

## 临时测试函数

临时测试函数 `fc-pg-redis-test` 已删除。测试代码保存在 `/tmp/fc-pg-redis-test/`。

## 已知问题

- **自定义域名部署失败**: 证书 ID `CAS_CERT_ID` 无效，需要配置有效的阿里云 SSL 证书 ID

## PG 用户配置参考

```
psql -h 172.23.212.135 -U postgres -d docbase
```

密码: `Codecloud2025.`

可用用户: `pms`, `yishanflow`, `postgres`, `docbase_app`
