# DocBase Restish CLI

DocBase does not maintain a first-party CLI binary. The supported CLI path is
Restish + DocBase OpenAPI.

## Install Restish

```bash
brew install restish
```

or:

```bash
go install github.com/rest-sh/restish/v2/cmd/restish@latest
```

## Connect

```bash
export DOCBASE_API_URL=https://docbase.zerocmf.com
export DOCBASE_API_KEY=your-api-key
pnpm cli:connect
```

The OpenAPI document includes `x-cli-config` for the `x-api-key` header. If
Restish prompts for the API key, paste the same value from `DOCBASE_API_KEY`.

## Examples

```bash
restish docbase health
restish docbase documents list
restish docbase spaces list
restish docbase tags list
```

Write operations use JSON request bodies:

```bash
restish docbase spaces create '{"name":"Engineering","description":"Team docs"}'
```

The OpenAPI spec is available at:

```text
/api/v1/openapi
```
