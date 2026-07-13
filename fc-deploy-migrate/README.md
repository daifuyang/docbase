# DocBase DB Migration Runner (FC 3.0)

This is a standalone deploy unit that runs `drizzle-kit migrate` against
the production Postgres. It exists because:

1. GitHub Actions runners sit on the public internet and cannot reach
   the production Postgres at its private VPC IP.
2. The runtime role `docbase_app` (used by `docbase-web`) intentionally
   lacks DDL on the `public` schema.

The runner here is invoked from `.github/workflows/migrate.yml` via
`aliyun fc InvokeFunction`. It uses the PG **superuser** (`postgres`)
connection string so it can apply schema changes; it has no HTTP
trigger and `internetAccess: false` keeps it inside the VPC.

## Layout

```
fc-deploy-migrate/
├── code/
│   ├── bootstrap              # bash launcher → node index.mjs
│   └── index.mjs              # migration runner (drizzle migrator)
├── s.yaml                     # FC 3.0 deploy config
├── .env.example               # template; copy to prod.env and fill
└── README.md
```

`code/` is rebuilt by `scripts/build-migrate.mjs` and is gitignored.

## Deploy

```bash
# Local one-time: copy env and fill superuser URL.
cp fc-deploy-migrate/.env.example fc-deploy-migrate/prod.env
$EDITOR fc-deploy-migrate/prod.env

# Deploy (also builds the artifact).
pnpm deploy:migrate
```

`pnpm deploy:migrate` runs `scripts/deploy-migrate.sh apply`, which:
1. Loads env from `fc-deploy-migrate/prod.env`.
2. Runs `node scripts/build-migrate.mjs` to assemble `fc-deploy-migrate/code/`.
3. Runs `npx s deploy -y` to push the function to FC.

## Trigger a migration

Once the function is deployed, trigger from GitHub Actions:
**Actions → DB Migrate (Manual) → Run workflow**. The workflow calls
`aliyun fc InvokeFunction` against `docbase-migrate/migrate-runner`,
which boots the container, applies pending migrations, and returns a
JSON payload (`{ ok: true, durationMs, ts }`) or a 500 with the error.

Re-runs are idempotent — Drizzle's migrator uses a journal table, so a
second trigger with no new migrations just reports "No migrations to
run".

## Differences from `fc-deploy/`

| Aspect | `fc-deploy/` | `fc-deploy-migrate/` |
|---|---|---|
| Service name | `docbase-prod` | `docbase-migrate` |
| Function name | `docbase-web` | `migrate-runner` |
| Runtime | TanStack Start / Nitro | Plain Node.js HTTP listener |
| DB user | `docbase_app` (DML only) | `postgres` (superuser) |
| Triggers | HTTP, public | None (invoke-only) |
| Internet | Yes (serves web) | No |
| Build | `pnpm build:fc` (Nitro) | `pnpm build:migrate` (script) |