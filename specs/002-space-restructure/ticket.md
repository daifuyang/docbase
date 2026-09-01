# DocBase 知识空间结构整理 — 后端能力扩展工单 v1

> **工单类型**：能力扩展（API + DB schema）
> **优先级**：P1（运营整理类，无紧迫性，但不补齐则下一次同类需求仍做不干净）
> **目标版本**：v1.x（部署后可立即执行的迁移脚本消费）
> **状态**：待排期 / 评审
> **作者 / 起草时间**：docbase 业务方（基于 `/tmp/db-{openapi,spaces,cats,tree,docs}.json` 5 份只读快照）

---

## 一、需求背景

DocBase 当前共有 **11 个顶级 space**（来自 `GET /api/v1/spaces/tree`），按「使用性质」可归为三类：

| 类型 | 数量 | 空间示例 | 现状 |
|---|---|---|---|
| **空骨架（治理类）** | 8 | 公司治理与制度 / 战略与经营 / 产品与项目 / 市场销售与客户 / 运营与交付 / 人力行政 / 财务法务 / 安全与权限 | 描述齐备、0 篇文档 |
| **单应用专属** | 1 | 应用文档（仅装 yishan-media 一个分类、10 篇文档） | 性质属于"单应用实现"，不应作为顶级导航位 |
| **单项目专属** | 1 | OPC 超级个体（7 个分类、18 篇文档） | 单项目作战室 |
| **正常混合** | 1 | 技术研发（5 个分类、8 篇文档） | 通用研发规范，是真正的"高频导航" |

**问题**：顶级目录混用了「导航维度（公司级职能）」和「使用频率 / 单应用 / 单项目」两类逻辑。

**想做成的结构**：把 `应用文档` 降级为 `技术研发` 下的二级分类 `应用归档`，让 yishan-media 的 10 篇文档迁过去，最终把 `应用文档` 这个空顶级 space 删掉。

**当前 OpenAPI 缺口**（来自 `GET /api/v1/openapi`）：

1. **无法删除一个空 space** —— 当前 space 只暴露了 `GET /api/v1/spaces`、`POST /api/v1/spaces`、`GET /api/v1/spaces/tree`，没有 `DELETE /api/v1/spaces/{id}`。迁移做完后空 space 删不掉。
2. **无法修改 category 的 spaceId** —— category 只暴露了 `GET /api/v1/categories`、`POST /api/v1/categories`，没有 `PATCH /api/v1/categories/{id}`。要把 yishan-media category 从 `应用文档` 搬到 `技术研发`，只能手工 SQL。
3. **不支持 space 二级嵌套** —— `Space` schema 没有 `parentId` 字段，`/api/v1/spaces/tree` 响应也只到一级。即便现在靠手工 SQL 顶住了本次需求，下次想搭「公司知识库 → 治理规范 → 公司治理」三级目录时又会卡在这里。

> **快照校核**：本工单用的 ID 全部来自 5 份 `/tmp/db-*.json` 快照；其中 **`db-docs.json` 是局部快照（仅 20 条最新文档）**，因此 yishan-media 实际文档数以 `db-tree.json` 为准 = **10 篇**（不是题面里写的 8 篇），迁移脚本需迁移全部 10 篇。本工单已按 10 篇修正。

---

## 二、需新增 / 修改的 3 项能力

### 能力 1 — `DELETE /api/v1/spaces/{id}`（必做）

**用途**：删除一个 space。如果该 space 下还存在 categories 或 documents，应返回 `409 Conflict` 并在 body 中列出阻碍项，由调用方决定先迁移再删。

**OpenAPI 片段（追加到 `src/shared/openapi.ts`，复用现有 `Security/ApiKeyAuth` 全局定义）**：

```yaml
/api/v1/spaces/{id}:
  delete:
    operationId: spaces.delete
    tags: [spaces]
    summary: Delete a space (only when empty)
    description: |
      Deletes a top-level (or, after capability 3 lands, child) space.
      Refuses with 409 when the space still contains categories or documents;
      the response body's `details` lists the blockers so a caller can
      migrate children first and retry.
    security:
      - ApiKeyAuth: []
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '204':
        description: Space deleted (no content)
      '401':
        description: Missing or invalid API key
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
      '404':
        description: Space not found
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
            example:
              ok: false
              code: NOT_FOUND
              error: 知识空间不存在
      '409':
        description: Space still has categories or documents
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/Error'
                - type: object
                  properties:
                    details:
                      type: object
                      properties:
                        remainingCategories:
                          type: integer
                          description: 直接挂在该 space 下的 category 数（不含子 space）
                        remainingDocuments:
                          type: integer
                          description: space 直接或通过 category 间接关联的 document 数
                        sampleCategoryIds:
                          type: array
                          items: { type: string, format: uuid }
                          description: 最多前 5 个 category id，便于排查
            example:
              ok: false
              code: CONFLICT
              error: 知识空间仍有子内容，请先迁移
              details:
                remainingCategories: 1
                remainingDocuments: 10
                sampleCategoryIds: ["07dfc77e-0558-4952-9051-2efb38269ada"]
```

**TypeScript（ServerFunction + Route 层，沿用现有模式）**：

`src/server/spaces.ts`（追加）：

```ts
export const deleteSpace = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) =>
    deleteSpaceService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )
```

`src/server/services/spaces.ts`（追加，实现要点）：

```ts
export async function deleteSpaceService(
  ctx: ServiceContext,
  input: { id: string },
): Promise<{ ok: true }> {
  await requireAdmin(ctx) // 见下"权限"段；当前先放行 + TODO

  const existing = await db.query.space.findFirst({ where: eq(schema.space.id, input.id) })
  if (!existing) throw Errors.notFound('知识空间不存在')

  // cascade check：统计 category + document
  const catRows = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(eq(schema.category.spaceId, input.id))

  // 间接文档 = 通过 category 关联的；另统计直接挂在 space 上的（无 categoryId）
  const categoryIds = catRows.map((c) => c.id)
  const docRows = categoryIds.length
    ? await db
        .select({ id: schema.document.id })
        .from(schema.document)
        .where(
          or(
            and(
              eq(schema.document.spaceId, input.id),
              isNull(schema.document.categoryId),
            ),
            inArray(schema.document.categoryId, categoryIds),
          ),
        )
    : await db
        .select({ id: schema.document.id })
        .from(schema.document)
        .where(
          and(eq(schema.document.spaceId, input.id), isNull(schema.document.categoryId)),
        )

  if (catRows.length > 0 || docRows.length > 0) {
    throw Errors.conflict('知识空间仍有子内容，请先迁移', {
      remainingCategories: catRows.length,
      remainingDocuments: docRows.length,
      sampleCategoryIds: catRows.slice(0, 5).map((c) => c.id),
    })
  }

  await db.delete(schema.space).where(eq(schema.space.id, input.id))
  // 同级缓存失效
  await redis.del(withPrefix('cache:spaces:*')).catch(() => {})
  return { ok: true }
}
```

`src/routes/api/v1/spaces.$id.ts`（**新文件**，参考 `src/routes/api/v1/spaces.ts` 风格）：

```ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, requireApiContext } from '~/server/http'
import { deleteSpaceService } from '~/server/services/spaces'

const paramsSchema = z.object({ id: z.string().uuid() })

export const Route = createFileRoute('/api/v1/spaces/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const { id } = paramsSchema.parse(params)
          await deleteSpaceService(ctx, { id })
          return new Response(null, { status: 204 })
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
```

> **实现注意**：
> - `Errors.conflict(code, details)` 是 `src/lib/errors.ts` 现有 API；若当前只支持 message，可临时 `throw Object.assign(new Error(msg), { code: 'CONFLICT', statusCode: 409, details })` —— 建议直接补一个 `Errors.conflict` 工厂。
> - 路由文件路径 `spaces.$id.ts` 是 TanStack file-routing 约定；如果框架只识别 `spaces.{id}.ts`，可改名为 `spaces.{$id}.ts`，跑一次 `pnpm dev` 触发 `routeTree.gen.ts` 重新生成。
> - **权限**：当前 API Key 是「全权」。建议 `deleteSpaceService` 直接调用 `requireAdmin(ctx)`，与 `createSpaceService`/`createCategoryService` 保持一致；**如果后续要做 role-based，可以把"删除空间"独立为 `space:delete` 权限位**，但本工单不要求改鉴权模型，留 TODO 即可。

---

### 能力 2 — `PATCH /api/v1/categories/{id}`（必做）

**用途**：修改分类元数据，主要场景是改 `spaceId`（把分类从一个 space 搬到另一个），同时支持改 `name`、`description`。

**OpenAPI 片段**：

```yaml
/api/v1/categories/{id}:
  patch:
    operationId: categories.update
    tags: [categories]
    summary: Update a category (name, description, or move to another space)
    description: |
      Used to migrate a category from one space to another (the typical
      "downgrade a top-level space into a sub-category" flow). Pass only
      the fields you want to change.
    security:
      - ApiKeyAuth: []
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/UpdateCategory'
    responses:
      '200':
        description: Updated
        content:
          application/json:
            schema:
              type: object
              properties:
                category:
                  $ref: '#/components/schemas/Category'
      '400':
        description: Invalid payload (e.g. empty name)
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
      '401':
        description: Missing or invalid API key
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
      '404':
        description: Category not found
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'
      '409':
        description: Target space not found
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Error'

components:
  schemas:
    UpdateCategory:
      type: object
      minProperties: 1
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 60
        description:
          type: string
          maxLength: 200
        spaceId:
          type: string
          format: uuid
          description: Move this category to another space. The target space must already exist.
```

**TypeScript（ServerFunction + Route 层）**：

`src/server/spaces.ts`（追加）：

```ts
export const updateCategory = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(60).optional(),
      description: z.string().max(200).optional(),
      spaceId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) =>
    updateCategoryService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )
```

`src/server/services/spaces.ts`（追加）：

```ts
export async function updateCategoryService(
  ctx: ServiceContext,
  input: {
    id: string
    name?: string
    description?: string
    spaceId?: string
  },
): Promise<{ category: CategorySummary }> {
  await requireAdmin(ctx)

  const existing = await db.query.category.findFirst({ where: eq(schema.category.id, input.id) })
  if (!existing) throw Errors.notFound('分类不存在')

  // 改 spaceId 时校验目标 space 存在
  if (input.spaceId && input.spaceId !== existing.spaceId) {
    const target = await db.query.space.findFirst({ where: eq(schema.space.id, input.spaceId) })
    if (!target) throw Errors.conflict('目标知识空间不存在', { spaceId: input.spaceId })
  }

  const next = {
    name: input.name ?? existing.name,
    description: input.description === undefined ? existing.description : input.description,
    spaceId: input.spaceId ?? existing.spaceId,
    // slug 暂时不重算：保持原 slug 以免历史外链失效；后续如果要做 slug 同步再加
    slug: existing.slug,
  }

  await db.update(schema.category).set(next).where(eq(schema.category.id, input.id))

  // 把挂在该 category 下的 document 的 spaceId 同步过来（FK 一致性）
  if (input.spaceId && input.spaceId !== existing.spaceId) {
    await db
      .update(schema.document)
      .set({ spaceId: next.spaceId, updatedAt: new Date() })
      .where(eq(schema.document.categoryId, input.id))
  }

  await redis.del(withPrefix('cache:spaces:*'), withPrefix('cache:documents:*')).catch(() => {})

  return { category: { id: input.id, ...next } }
}
```

`src/routes/api/v1/categories.$id.ts`（**新文件**）：

```ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { handleApiError, json, parseJson, requireApiContext } from '~/server/http'
import { updateCategoryService } from '~/server/services/spaces'

const paramsSchema = z.object({ id: z.string().uuid() })
const bodySchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    description: z.string().max(200).optional(),
    spaceId: z.string().uuid().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: '至少传一个字段' })

export const Route = createFileRoute('/api/v1/categories/$id')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const ctx = await requireApiContext(request)
          const { id } = paramsSchema.parse(params)
          const input = bodySchema.parse(await parseJson(request))
          return json(await updateCategoryService(ctx, { id, ...input }))
        } catch (error) {
          return handleApiError(error)
        }
      },
    },
  },
})
```

> **实现注意**：
> - `name` 为空 / 缺失字符 → 走 Zod 的 `min(1)`，由现有 `handleApiError` 翻译成 `400 VALIDATION_ERROR`。
> - `spaceId` 不存在 → 走 `Errors.conflict` → `409`。
> - **文档同步**：改 `spaceId` 时必须把 `document.spaceId` 一起改，否则 `documents.list` 会按 `space.slug` 查不到这条记录。已写入上面 service。
> - **slug**：本次**不**改 slug，保留历史外链；如果将来要做 slug 同步，再加 `slug: slugify(next.name)` 重算逻辑。

---

### 能力 3 — Space 二级嵌套（强烈建议，方案 A：最小改动）

**用途**：让顶级可以嵌套子级，构建「公司知识库 → 治理规范 → 公司治理」三层结构，从根本上解决顶级膨胀。  
**为什么选 A 不选 B**：

- **方案 A（最小）**：`POST /api/v1/spaces` 的 body 增加可选 `parentId`；`Space` schema 增加 `parentId`、`children`；`spaces.tree` 响应带嵌套结构。改动集中在 3 处，DB 加 1 个列。✅ 本工单推荐。
- **方案 B（激进）**：新增 `Workspace` 概念，把现有 `space` 全部降为二级。改动面太大（涉及 `document.spaceId`/`category.spaceId` 外键、所有路由），**本工单不推荐**。

**OpenAPI 片段（方案 A，3 处变更）**：

**变更 ① — `components.schemas.Space`**（追加 `parentId`、`children`）：

```yaml
components:
  schemas:
    Space:
      type: object
      properties:
        id:           { type: string, format: uuid }
        name:         { type: string }
        slug:         { type: string }
        description:  { type: string, nullable: true }
        parentId:
          type: string
          format: uuid
          nullable: true
          description: |
            二级嵌套字段。null/缺省 = 顶级；非空 = 挂在该 parent space 下。
            最多允许 2 级（不允许再嵌套）。
        children:
          type: array
          description: 仅顶级 space 在 `spaces.tree` 响应里填充该字段。
          items:
            $ref: '#/components/schemas/Space'
```

**变更 ② — `POST /api/v1/spaces` 的 requestBody**（`parentId` 改为可选）：

```yaml
/api/v1/spaces:
  post:
    operationId: spaces.create
    tags: [spaces]
    summary: Create a space (top-level, or a child if parentId is provided)
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [name]
            properties:
              name:        { type: string, minLength: 1, maxLength: 60 }
              description: { type: string, maxLength: 200 }
              parentId:
                type: string
                format: uuid
                nullable: true
                description: |
                  非空 = 在该 parent space 下创建子 space（仅 2 级）。
                  parent 必须是顶级；不允许把子 space 挂到另一个子 space 下。
    responses:
      '201': { description: Created }
      '400': { description: Invalid payload (parent 不存在/parent 不是顶级) }
```

**变更 ③ — `GET /api/v1/spaces/tree`**（响应说明更新，`Space` schema 已含 `children`，无需额外引用）：

```yaml
/api/v1/spaces/tree:
  get:
    operationId: spaces.tree
    tags: [spaces]
    summary: List space tree (now nests children inside top-level spaces)
    responses:
      '200':
        description: |
          Space tree。顶级 space 直接出现在 `items[]` 里；
          它的二级子 space 出现在该顶级 space 的 `children[]` 里，
          二级 space 的 `categories/documents` 保持平铺在其自身节点上。
```

**DB schema 迁移**（Drizzle，在 `db/schema.ts`）：

```ts
export const space = mysqlTable('space', {
  // ...原有字段
  parentId: uuid('parent_id').references((): AnyMySqlColumn => space.id, {
    onDelete: 'set null',
  }), // ← 新增
})
```

迁移 SQL（建议放进 `db/migrations/<timestamp>-space-parent-id.sql`）：

```sql
-- 1. 新增 parent_id（可空 + 自引用 + on delete set null）
ALTER TABLE `space`
  ADD COLUMN `parent_id` CHAR(36) NULL AFTER `description`,
  ADD CONSTRAINT `fk_space_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `space`(`id`) ON DELETE SET NULL;

-- 2. 索引（按 parent 查子级）
CREATE INDEX `idx_space_parent_id` ON `space` (`parent_id`);

-- 3. （可选）回填示例：把"应用归档"挂到"技术研发"下
-- INSERT INTO space (id, name, slug, description, parent_id, sort_order, created_by, created_at, updated_at)
--   VALUES (UUID(), '应用归档', 'app-archive', '...', 'f4cd2eb2-5bcb-48b5-bf35-623bded43e56', 60, '<admin>', NOW(), NOW());
```

> **实现注意**：
> - **不允许 3 级嵌套**：`createSpaceService` 收到 `parentId` 时必须校验 `parent.parentId === null`；否则 400。
> - **不允许循环**：`parentId` 不等于自身，且祖先链上不能出现自身；简单实现：只校验 1 级（`parent.parentId === null`），因为二级不允许再生二级。
> - **删除语义**：`ON DELETE SET NULL` —— 当顶级被删，子 space 自动升级为顶级；如果想"连子级一起删"，改成 `ON DELETE CASCADE` 即可，建议默认 `SET NULL`，更安全。
> - **`spaces.tree` 实现**：在 `listSpaceTreeService` 里按 `parentId` 分组，顶级进 `items[]`，非顶级进 `parent.children[]`。
> - **暂时不动 `category`**：分类保持一级（挂在 space 下），不再嵌套。本工单不涉及。

---

## 三、验收脚本（bash，跑通一遍即可确认 3 项能力 OK）

> 用途：在能力上线后，先把脚本里 `$API_KEY` 设好（顶部有 `export` 行），然后 `bash scripts/verify-space-restructure.sh`。
> 脚本是 **幂等** 的（用 `set -e` + 每个动作有前置 GET），失败会立即退出。

```bash
#!/usr/bin/env bash
# verify-space-restructure.sh
# 前置：能力 1/2/3 已上线；API_KEY 来自 ~/.config/env-config/docbase.yaml
set -euo pipefail

export API_KEY=$(awk '/^api_key:/{print $2}' ~/.config/env-config/docbase.yaml)

API="https://docbase.zerocmf.com/api/v1"
H_AUTH=(-H "x-api-key: ${API_KEY}" -H "Accept: application/json")

# === 0. 现状 baseline ===
echo "── 0) baseline: GET /api/v1/spaces/tree ──"
curl -fsS "${H_AUTH[@]}" "${API}/spaces/tree" | python3 -m json.tool > /tmp/baseline-tree.json
echo "    saved to /tmp/baseline-tree.json"

# === 1. 在「技术研发」下新建分类「应用归档」 ===
echo
echo "── 1) POST /api/v1/categories  → 建「应用归档」到「技术研发」下 ──"
TECH_SPACE_ID="f4cd2eb2-5bcb-48b5-bf35-623bded43e56"
NEW_CAT_JSON=$(curl -fsS "${H_AUTH[@]}" -X POST "${API}/categories" \
  -H "Content-Type: application/json" \
  -d "{\"spaceId\":\"${TECH_SPACE_ID}\",\"name\":\"应用归档\",\"description\":\"各应用对通用规范的实现、运行手册与复盘；按应用分子分类。\"}")
NEW_CAT_ID=$(echo "$NEW_CAT_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['category']['id'])")
echo "    new category id = ${NEW_CAT_ID}"

# === 2. 把 10 篇 yishan-media 文档迁到「技术研发 / 应用归档」===
echo
echo "── 2) PATCH 10 篇 yishan-media 文档 → spaceId/categoryId 改为新建分类 ──"
YISHAN_DOC_IDS=$(curl -fsS "${H_AUTH[@]}" \
  "${API}/documents?spaceSlug=document-cf67094837&pageSize=50" \
  | python3 -c "import sys,json;[print(d['id']) for d in json.load(sys.stdin)['items'] if d['category'] and d['category']['id']=='07dfc77e-0558-4952-9051-2efb38269ada']")
COUNT=$(echo -n "$YISHAN_DOC_IDS" | grep -c . || true)
echo "    found ${COUNT} docs"
for DOC_ID in $YISHAN_DOC_IDS; do
  curl -fsS "${H_AUTH[@]}" -X PATCH "${API}/documents/${DOC_ID}" \
    -H "Content-Type: application/json" \
    -d "{\"spaceId\":\"${TECH_SPACE_ID}\",\"categoryId\":\"${NEW_CAT_ID}\"}" > /dev/null
  echo "    patched doc ${DOC_ID}"
done

# === 3. 把原 yishan-media category 也搬到「技术研发」下（保留作为子分类）===
echo
echo "── 3) PATCH category 07dfc77e-0558-4952-9051-2efb38269ada → spaceId=技术研发 ──"
curl -fsS "${H_AUTH[@]}" -X PATCH "${API}/categories/07dfc77e-0558-4952-9051-2efb38269ada" \
  -H "Content-Type: application/json" \
  -d "{\"spaceId\":\"${TECH_SPACE_ID}\"}" | python3 -m json.tool
echo "    OK"

# === 4. 删除「应用文档」顶级 space（应 204）===
echo
echo "── 4) DELETE /api/v1/spaces/b439459e-7cb9-4784-94ac-262e3c5ec747 ──"
STATUS=$(curl -s -o /tmp/delete-resp.txt -w "%{http_code}" "${H_AUTH[@]}" \
  -X DELETE "${API}/spaces/b439459e-7cb9-4784-94ac-262e3c5ec747")
echo "    HTTP ${STATUS}"
if [[ "$STATUS" != "204" ]]; then
  echo "    !! 期望 204，实际 ${STATUS}："
  cat /tmp/delete-resp.txt
  exit 1
fi

# === 5. 终态确认 ===
echo
echo "── 5) GET /api/v1/spaces/tree  → 终态 ──"
curl -fsS "${H_AUTH[@]}" "${API}/spaces/tree" | python3 -m json.tool > /tmp/final-tree.json
echo "    saved to /tmp/final-tree.json"
echo "    校验："
python3 - <<'PY'
import json
b = json.load(open('/tmp/baseline-tree.json'))['items']
f = json.load(open('/tmp/final-tree.json'))['items']
b_names = {s['name'] for s in b}
f_names = {s['name'] for s in f}
print(f"      baseline spaces ({len(b_names)}): {sorted(b_names)}")
print(f"      final    spaces ({len(f_names)}): {sorted(f_names)}")
assert '应用文档' in b_names and '应用文档' not in f_names, "FAIL: 应用文档 没被删掉"
print("      ✅ 应用文档 已消失")
tech = next((s for s in f if s['name'] == '技术研发'), None)
assert tech is not None, "FAIL: 技术研发 不见了"
cats = {c['name'] for c in tech.get('categories', [])}
print(f"      技术研发下分类: {sorted(cats)}")
assert '应用归档' in cats and 'yishan-media（新媒体管理平台）' in cats, "FAIL: 缺少目标分类"
print("      ✅ 技术研发 下同时包含「应用归档」和「yishan-media」")
PY

echo
echo "✅ 全部通过"
```

**预期执行结果**：

- 步骤 1：返回 `201`，新分类 `id` 落在第 4 段删除前的 tree 里也看得到。
- 步骤 2：循环 10 次（不是 8 次），每篇 PATCH 都返回 `200`。
- 步骤 3：返回 `200`，响应里 `category.spaceId = f4cd2eb2-5bcb-48b5-bf35-623bded43e56`（技术研发）。
- 步骤 4：返回 `204 No Content`，响应体为空。
- 步骤 5：Python 校验段输出 `✅ 应用文档 已消失` + `✅ 技术研发 下同时包含「应用归档」和「yishan-media」`，整脚本以 `✅ 全部通过` 结尾。

---

## 四、明确不在本次工单内（边界）

- ❌ **不做 soft-delete / 回收站**：`DELETE /api/v1/spaces/{id}` 是硬删，误删靠备份 + 权限位（`requireAdmin`）兜底。
- ❌ **不改 space slug 自定义**：保持现有 `slugify(name)` 自动生成逻辑；如果将来要重命名时同步更新 slug，再开新工单。
- ❌ **不做 categories CRUD 全功能**：本工单只补 `PATCH /api/v1/categories/{id}`。`DELETE /api/v1/categories/{id}`、`GET /api/v1/categories/{id}` 留作后续工单（按需再做）。
- ❌ **不改鉴权模型**：仍用 API Key + `requireAdmin`。如果后续要细化到 `space:delete`/`category:update` 权限位，再开新工单。
- ❌ **不做方案 B（Workspace）**：本工单只做方案 A 的 `parentId` 二级嵌套。
- ❌ **不改 OPC 超级个体**：它是单项目作战室，本次不动；以后如果也要降级，按同样套路再开一次工单。

---

## 五、附录 — 给后端的实现 checklist

- [ ] `src/lib/errors.ts` 补 `Errors.conflict(message, details)` 工厂（如果还没有）
- [ ] `db/schema.ts` 在 `space` 表加 `parentId` 字段 + Drizzle 关系
- [ ] 生成 migration：`pnpm drizzle-kit generate` → `db/migrations/<ts>-space-parent-id.sql`
- [ ] `src/server/services/spaces.ts` 追加 `deleteSpaceService`、`updateCategoryService`
- [ ] `src/server/services/spaces.ts` 在 `createSpaceService` 增加 `parentId` 校验（二级）
- [ ] `src/server/services/spaces.ts` 在 `listSpaceTreeService` 增加二级嵌套输出（顶级进 `items[]`，非顶级进 `parent.children[]`）
- [ ] `src/server/spaces.ts` 追加 `deleteSpace`、`updateCategory` ServerFunction 包装
- [ ] `src/routes/api/v1/spaces.$id.ts` 新增（DELETE）
- [ ] `src/routes/api/v1/categories.$id.ts` 新增（PATCH）
- [ ] `src/shared/openapi.ts` 同步 3 处变更：`Space` schema 加 `parentId/children`、`POST /api/v1/spaces` body 加 `parentId`、`/api/v1/spaces/tree` summary 改写
- [ ] 重启服务，跑 `pnpm tsx scripts/verify-space-restructure.sh`（脚本见第三节）

---

## 六、引用与快照（只读，未修改任何线上数据）

| 路径 | 来源 | 内容 |
|---|---|---|
| `/tmp/db-openapi.json` | `GET /api/v1/openapi` | 当前 OpenAPI 3.0.3 spec |
| `/tmp/db-spaces.json` | `GET /api/v1/spaces` | 11 个顶级 space |
| `/tmp/db-cats.json` | `GET /api/v1/categories` | 全部 category（无 documents） |
| `/tmp/db-tree.json` | `GET /api/v1/spaces/tree` | space → category → document 完整树 |
| `/tmp/db-docs.json` | `GET /api/v1/documents` (pageSize=50) | **仅 20 条**（top 最新）；yishan-media 实际文档数以 tree 为准 = 10 |
