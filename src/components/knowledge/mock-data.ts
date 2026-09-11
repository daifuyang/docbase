import type { KnowledgeNode } from '~/components/knowledge/types'

/**
 * Seed data for the knowledge sidebar tree.
 *
 * Front-end only for now: the brief asks for a Feishu-style tree that can
 * create folders before the backend has a folder concept, so the initial shape
 * is mocked here. Top-level entries are `space` nodes; `folder` nodes may nest.
 *
 * `document` leaves carry no slug yet — they are rendered as non-navigating
 * rows until the tree is backed by real DTOs.
 */
export function createInitialKnowledgeTree(): KnowledgeNode[] {
  return [
    {
      id: 'space-engineering',
      name: '工程知识库',
      type: 'space',
      children: [
        {
          id: 'folder-agent-platform',
          name: 'Agent Platform',
          type: 'folder',
          children: [
            { id: 'doc-arch-design', name: '架构设计文档', type: 'document' },
            { id: 'doc-deploy-guide', name: '部署与发布指南', type: 'document' },
            { id: 'doc-api-spec', name: '接口规范', type: 'document' },
          ],
        },
        {
          id: 'folder-data-layer',
          name: '数据层',
          type: 'folder',
          children: [
            { id: 'doc-schema', name: '库表设计', type: 'document' },
            { id: 'doc-migration', name: '迁移规范', type: 'document' },
          ],
        },
        { id: 'doc-onboarding', name: '新人上手指南', type: 'document' },
      ],
    },
    {
      id: 'space-product',
      name: '产品知识库',
      type: 'space',
      children: [
        {
          id: 'folder-requirements',
          name: '需求文档',
          type: 'folder',
          children: [{ id: 'doc-prd-template', name: 'PRD 模板', type: 'document' }],
        },
        { id: 'doc-roadmap', name: '版本规划', type: 'document' },
      ],
    },
  ]
}
