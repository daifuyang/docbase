<!--
Sync Impact Report
==================
Version change: 1.1.0 -> 1.2.0
- MINOR bump: codified DocBase UI/navigation/search conventions and Chinese
  enterprise product visual acceptance rules under Product Experience.
Modified principles:
  - VI. Product Experience & Domain Fit (expanded with navigation, search,
    layout, visual focus, and Chinese enterprise UI rules)
Added principles:
  - (none)
Added sections:
  - Product navigation/search/layout acceptance requirements under Governance
Removed sections:
  - (none)
Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (UX gate references navigation/search/layout/focus)
  - ✅ .specify/templates/spec-template.md (UX requirements expanded for Chinese enterprise UI)
  - ✅ .specify/templates/tasks-template.md (UX review task expanded for nav/search/focus)
  - ✅ .specify/templates/checklist-template.md (checklist prompts expanded for UI conventions)
  - ✅ .specify/templates/commands/*.md (directory absent; no command templates to update)
  - ✅ specs/001-docbase-mvp/plan.md (current feature Constitution Check updated)
  - ✅ README.md (no principle-specific stale references)
  - ✅ AGENTS.md (generic current-plan instruction remains valid)
  - ✅ CLAUDE.md (constitution version updated)
Follow-up TODOs:
  - TODO(DESIGN_SYSTEM_DOC): Create a dedicated product/design standards document
    if UI rules grow beyond constitution-level governance.
-->

# DocBase Constitution

本宪章是 DocBase 项目所有工程、产品、设计与交付实践的最高准则。任何与本文件冲突的做法必须通过修订宪章解决，而不是在实现中绕过。

## Core Principles

### I. Modular Boundaries & Library-First

DocBase 的每个主要能力必须拥有清晰边界：路由只编排界面和数据加载，业务规则进入 `src/server/` 或领域库，数据库访问统一经过 `src/lib/db.server.ts` 及领域服务。跨模块复用必须以明确接口、共享 schema 或组件 API 完成，禁止绕过模块边界直接读取其他模块的内部实现。

每个新增模块必须具备独立测试入口和最小必要文档。禁止只为目录整齐而创建没有职责、没有接口、没有测试价值的空模块。

**Rationale**: 企业知识库会快速扩展文档、空间、分类、标签、成员、权限与搜索能力。边界清晰才能避免功能互相缠绕，并让后续替换存储、缓存或 UI 组件时成本可控。

### II. Test-First Delivery (NON-NEGOTIABLE)

任何非平凡变更必须先定义可失败的验证方式，再实现功能。测试顺序为：写测试或可执行验收脚本 -> 确认失败或确认当前行为缺失 -> 实现 -> 重构 -> 再次验证。没有测试的实现只能作为临时探索代码，不能直接合入主干。

测试范围必须匹配风险：领域逻辑用单元测试，server function 和数据访问用集成测试，核心用户旅程用 Playwright 或等价 E2E。确实无法自动化的视觉或交互验收，必须在任务或 PR 中写明人工验证步骤、浏览器尺寸和通过标准。

**Rationale**: DocBase 的核心价值是团队知识沉淀、组织和查找链路稳定。测试先行让行为契约先于实现存在，避免登录、空间、分类、文档编辑和搜索等基础流程在迭代中回退。

### III. Contract & Journey Coverage

所有跨边界契约必须有验证：server function 输入输出、Zod schema、数据库迁移、权限判断、缓存失效、HTML 清洗、TipTap 内容转换都必须覆盖正常路径、失败路径和边界输入。每个 P1 用户故事必须具备独立可运行的端到端验证；P2 及以上故事至少具备集成测试，除非宪章合规说明中记录了可接受替代方案。

测试数据必须可重复，不能依赖开发者本机的临时账号或不可重建状态。涉及登录态的测试必须使用固定 seed 用户、测试专用工厂或显式创建的账号。

**Rationale**: 企业知识库最常见的缺陷发生在模块边界：权限漏判、富文本清洗不完整、空间分类关系错误、缓存读到旧数据。契约和旅程测试能把这些问题前移。

### IV. Production Observability & Operability

服务端关键路径必须输出结构化日志，并携带可关联的请求标识。错误必须包含可定位上下文，但不得泄露密码、token、cookie、数据库连接串或未脱敏个人信息。外部依赖 PostgreSQL、Redis、better-auth、Caddy 和后台任务必须有健康检查、超时、失败日志和降级策略。

性能目标必须在 spec 或 plan 中写成可测量指标。涉及首页、文档详情、登录、发布、搜索、空间和分类的变更必须说明对 FCP、TTI、p95 延迟或数据库查询数的影响；无法量化时必须说明原因。

**Rationale**: 自托管部署的问题往往发生在生产环境。没有结构化日志、健康检查和可测指标，故障只能靠猜测定位。

### V. Spec-First Change Control

任何非平凡变更必须先在 `spec.md`、issue 或等价设计记录中说明目标、用户场景、验收标准、非目标和约束。存在歧义时必须先澄清，再进入实现计划。实现计划必须显式通过宪章检查，任务必须能追溯到用户故事或治理要求。

所有 PR 必须经过代码评审并通过 CI 门禁。评审者必须检查：是否符合宪章、是否存在未说明的复杂度增加、是否破坏现有用户旅程、是否需要同步文档或迁移数据。

**Rationale**: Spec-first 让团队先对“做什么”和“不做什么”达成一致。代码评审和 CI 则防止规范依赖个人习惯执行。

### VI. Product Experience & Domain Fit

DocBase 的界面必须服务于内容阅读、写作和协作效率。默认采用克制、清晰、符合中文企业产品习惯的交互：信息层级明确，表单文案自然，关键操作可扫描，移动端和桌面端都不得出现文本溢出、控件重叠或布局失衡。

面向内部知识库或国内企业用户的界面不得直接套用海外 SaaS 文案结构后翻译成中文。登录、文档编辑、空间分类、成员管理等核心界面必须使用贴合中文语境的标题、占位符、错误提示和按钮文案。新增视觉样式必须复用设计系统 token 或现有组件模式；若偏离现有模式，必须说明原因并提供验证截图或人工验收记录。

全局导航必须职责清晰：顶部导航只承载品牌、全局能力入口和账户入口；主要功能导航属于左侧栏或当前工作区上下文。创建内容、发布内容等上下文操作不得无理由放入顶栏；如果某个操作被提升为全局主操作，必须在 spec 或 plan 中说明频率、适用范围和替代位置。

全局搜索必须避免“看起来可用但不可用”的伪交互。若搜索以输入框呈现，它必须能真实输入并有明确行为；若采用命令面板或弹窗模式，触发器必须是明确的搜索图标或搜索入口，弹窗必须提供自动聚焦输入、关闭方式、空态或快捷入口。不得展示 `⌘K`、快捷键、结果计数等暗示，除非对应交互已经实现。

中文企业产品的视觉反馈应优先使用浅底色、分割线、hover 背景和柔和阴影。不得在普通导航、搜索弹窗、列表项中过度依赖欧美组件库常见的粗 outline、强 ring 或高对比描边。键盘可访问性仍然必须保留，但可在具体组件作用域内用更协调的弱焦点样式替代全局强 ring。

桌面大屏布局必须明确整体关系：主内容和辅助栏应作为同一布局整体处理，主内容在自身区域内居中，辅助栏在整体中右对齐。文档正文、列表和表单必须限制可读宽度；超大屏新增的信息密度应通过辅助区、最近更新、常用标签等上下文内容承载，而不是无限拉宽正文或卡片。

**Rationale**: 内容产品的信任感来自稳定、熟悉、低干扰的体验。中文企业场景对文案密度、表单结构和信息对齐有明确偏好，不能只满足功能可用。

### VII. Security, Privacy & Data Integrity

认证、会话、权限、输入清洗和数据写入必须默认安全。所有用户输入必须在边界处校验；富文本必须经过白名单清洗；需要登录的写操作必须验证当前用户身份和资源归属；错误响应不得暴露内部实现细节。

数据库迁移必须可审查、可回滚或提供补救步骤。涉及用户资料、文档内容、空间分类、标签关系的变更必须说明数据完整性策略。新增登录、成员创建、文档发布等入口必须考虑限流、审计日志和滥用场景。

**Rationale**: DocBase 存储的是组织知识和用户生成内容。权限、清洗或数据一致性上的小漏洞会直接影响信任、合规和内容资产安全。

## Governance

- **Constitution supersedes all other practices**: 本宪章高于所有其他实践文档、模板和口头惯例；冲突时以本文件为准，并更新受影响文档。
- **Amendment procedure**: 任何原则的增删或语义变更必须提交修订提案，说明动机、影响范围、迁移计划和回滚方式；经维护者批准后，更新本文件、同步模板，并按 SemVer 提升版本号。
- **Versioning policy**:
  - **MAJOR**: 删除原则、降低强制级别，或重新定义治理方式；
  - **MINOR**: 新增原则、治理章节，或显著扩展现有原则；
  - **PATCH**: 澄清措辞、修复错别字、补充示例等不改变语义的更新。
- **Constitution Check**: 每个 `plan.md` 必须逐条覆盖原则 I-VII。未满足项必须记录为 Complexity Tracking 或阻塞问题，不能只写“通过”。
- **Review gates**: PR 评审必须覆盖测试证据、模块边界、用户体验、可观测性、安全/隐私、数据迁移和文档同步。任一高风险项缺失时，评审者必须要求补充。
- **Product and UX gate**: 影响用户界面的变更必须提供验收方式。核心界面变更应包含桌面、移动和超大屏尺寸检查；涉及中文文案的变更必须检查语气、字段命名、错误提示和按钮语义。导航、搜索、焦点样式、列表密度和大屏布局变更必须说明其信息架构职责和视觉验收标准。
- **Security and data gate**: 影响认证、授权、用户输入、富文本、数据库 schema、缓存一致性或个人信息的变更必须经过安全与数据完整性审查。
- **Runtime guidance**: 当前运行时说明以 `README.md` 和 `specs/001-docbase-mvp/quickstart.md` 为准。未来如新增设计系统或运维手册，必须在本节登记并纳入合规检查。

**Version**: 1.2.0 | **Ratified**: 2026-06-26 | **Last Amended**: 2026-06-27
