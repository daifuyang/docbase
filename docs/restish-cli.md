# Restish + OpenAPI 通用接入指南

适用场景：服务端已经提供 OpenAPI 文档，希望用 Restish 快速获得一个可用的命令行调用入口，而不是再单独维护一套 CLI。

DocBase 当前没有内置的第一方 CLI；命令行接入方式是直接消费项目暴露的 OpenAPI 文档。

## 安装 Restish

```bash
brew install restish
```

或：

```bash
go install github.com/rest-sh/restish/v2/cmd/restish@latest
```

## 接入前提

服务需要满足两点：

1. 暴露可访问的 OpenAPI 文档 URL，例如 `/api/v1/openapi`
2. 如果需要鉴权，在 OpenAPI 里声明 `securitySchemes`

如果希望 Restish 在 `api connect` 时自动识别认证方式，建议在 OpenAPI 顶层增加 `x-cli-config`。DocBase 当前使用的是 API Key header 方案：

```json
{
  "x-cli-config": {
    "profiles": {
      "default": {
        "headers": ["Accept: application/json"],
        "prompt": {
          "api_key": {
            "description": "API key",
            "example": "service_..."
          }
        },
        "credentials": {
          "ApiKeyAuth": {
            "auth": {
              "type": "api-key",
              "params": {
                "in": "header",
                "name": "x-api-key",
                "value": "{api_key}"
              }
            }
          }
        }
      }
    }
  }
}
```

## 通用连接方式

先准备几个变量：

```bash
export SERVICE_NAME=myservice
export BASE_URL=https://api.example.com
export SPEC_URL=https://api.example.com/api/v1/openapi
export API_KEY=replace-with-real-key
```

然后执行：

```bash
restish api connect "$SERVICE_NAME" "$BASE_URL" \
  --spec "$SPEC_URL" \
  --replace \
  "prompt.api_key:env:API_KEY"
```

如果 OpenAPI 中没有 `x-cli-config`，也可以显式传认证头，但那样会更定制，不适合作为通用方案。

## 常见用法

查看已连接的 API：

```bash
restish api list
```

查看命令树：

```bash
restish "$SERVICE_NAME"
```

查看某个操作的帮助：

```bash
restish "$SERVICE_NAME" --help
restish "$SERVICE_NAME" documents-list --help
```

执行只读请求：

```bash
restish "$SERVICE_NAME" health
restish "$SERVICE_NAME" documents-list
restish "$SERVICE_NAME" spaces-list
```

带查询参数：

```bash
restish "$SERVICE_NAME" documents-list --query "search text" --page 1 --pageSize 20
```

写操作建议通过 stdin 传 JSON body，这样更适合长 payload，也更稳定：

```bash
restish "$SERVICE_NAME" spaces-create <<'EOF'
{"name":"Engineering","description":"Team docs"}
EOF
```

更新操作同理：

```bash
restish "$SERVICE_NAME" documents-update my-doc-slug <<'EOF'
{"title":"New title"}
EOF
```

如果文档内容是富文本，优先确认请求体字段。DocBase 当前写入正文使用 `contentJson`，也就是 TipTap JSON 文档，而不是 Markdown 字符串。

## 建议约定

为了让 Restish 生成的命令更稳定、可读，OpenAPI 最好保持这些约定：

1. 每个操作都写 `operationId`
2. `operationId` 使用稳定命名，例如 `documents.list`、`documents.create`
3. 路径参数命名清晰，例如 `slug`、`id`
4. 写操作请求体使用 `application/json`
5. 认证方式统一，不要同一套 API 同时混多种不必要的鉴权模式

## 故障排查

连接时提示找不到 spec：

```bash
curl -I "$SPEC_URL"
```

命令存在但调用 401/403：

1. 检查 API key 是否有效
2. 检查 OpenAPI 里的 header 名称是否与服务端一致
3. 检查 Restish 连接时是否真的写入了凭证

重新连接覆盖本地配置：

```bash
restish api connect "$SERVICE_NAME" "$BASE_URL" \
  --spec "$SPEC_URL" \
  --replace \
  "prompt.api_key:env:API_KEY"
```

## DocBase 示例

本地开发默认 OpenAPI 地址：

```text
http://localhost:3000/api/v1/openapi
```

如果是已部署环境，把下面的 `BASE_URL` 和 `SPEC_URL` 替换为对应域名即可。

连接命令示例：

```bash
export SERVICE_NAME=docbase
export BASE_URL=http://localhost:3000
export SPEC_URL=http://localhost:3000/api/v1/openapi
export API_KEY=replace-with-real-key

restish api connect "$SERVICE_NAME" "$BASE_URL" \
  --spec "$SPEC_URL" \
  --replace \
  "prompt.api_key:env:API_KEY"
```

说明：

1. `API_KEY` 需要使用 DocBase 中已创建的 API Key
2. 本地如果走种子数据模式，先按 `README.md` 完成本地启动
3. 生产环境若使用 `https://docbase.zerocmf.com`，只需把上面的域名改成线上地址

连接后可直接调用：

```bash
restish docbase health
restish docbase documents-list
restish docbase spaces-list
restish docbase tags-list
```

补充说明：

1. 当前生成的命令是扁平风格，如 `documents-list` / `documents-update`
2. 线上 OpenAPI 目前存在一个本地 schema 引用问题，`--rsh-validate` 可能失败；如果业务请求本身成功，不要把这个校验失败误判为接口不可用
