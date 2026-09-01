export const docbaseOpenApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DocBase API',
    version: '1.0.0',
    description: 'DocBase REST API for Restish and automation clients.',
  },
  servers: [{ url: '/', description: 'Current DocBase server' }],
  security: [{ ApiKeyAuth: [] }],
  'x-cli-config': {
    profiles: {
      default: {
        headers: ['Accept: application/json'],
        prompt: {
          api_key: {
            description: 'DocBase API key',
            example: 'docbase_...',
          },
        },
        credentials: {
          ApiKeyAuth: {
            auth: {
              type: 'api-key',
              params: {
                in: 'header',
                name: 'x-api-key',
                value: '{api_key}',
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          code: { type: 'string' },
          error: { type: 'string' },
          details: {},
        },
      },
      TipTapDoc: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['doc'] },
          content: { type: 'array', items: {} },
        },
        additionalProperties: true,
      },
      Space: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          parentId: { type: 'string', format: 'uuid', nullable: true },
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Space' },
            description: 'Nested child spaces (only present on tree responses).',
          },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          spaceId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
        },
      },
      DocumentSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          slug: { type: 'string' },
          excerpt: { type: 'string', nullable: true },
          space: { $ref: '#/components/schemas/Space' },
          category: { $ref: '#/components/schemas/Category', nullable: true },
          publishedAt: { type: 'string', nullable: true },
          updatedAt: { type: 'string' },
          viewCount: { type: 'number' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      DocumentDetail: {
        allOf: [
          { $ref: '#/components/schemas/DocumentSummary' },
          {
            type: 'object',
            properties: {
              contentHtml: { type: 'string' },
              contentJson: { $ref: '#/components/schemas/TipTapDoc' },
              status: { type: 'string', enum: ['draft', 'published'] },
              isAuthor: { type: 'boolean' },
            },
          },
        ],
      },
      CreateDocument: {
        type: 'object',
        required: ['title', 'contentJson', 'status', 'spaceId'],
        properties: {
          title: { type: 'string', maxLength: 200 },
          contentJson: { $ref: '#/components/schemas/TipTapDoc' },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          status: { type: 'string', enum: ['draft', 'published'] },
          spaceId: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      UpdateDocument: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 200 },
          contentJson: { $ref: '#/components/schemas/TipTapDoc' },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          status: { type: 'string', enum: ['draft', 'published'] },
          spaceId: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      ImportMarkdownDocument: {
        type: 'object',
        required: ['title', 'markdown', 'spaceId'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          markdown: { type: 'string', minLength: 1 },
          status: { type: 'string', enum: ['draft', 'published'], default: 'draft' },
          spaceId: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
        },
      },
      ImportMarkdownResponse: {
        type: 'object',
        properties: {
          document: { $ref: '#/components/schemas/DocumentDetail' },
        },
      },
      UpdateCategory: {
        type: 'object',
        description:
          'Partial update for a category. At least one field must be provided. ' +
          'Changing `spaceId` cascades: every document currently attached to the category ' +
          'is retargeted to the new space so the foreign key stays consistent.',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          description: { type: 'string', maxLength: 200, nullable: true },
          spaceId: { type: 'string', format: 'uuid' },
        },
      },
      UpdateSpace: {
        type: 'object',
        description:
          'Partial update for a space. At least one field must be provided. ' +
          'Setting `parentId` moves the space under another space (or to the top ' +
          'level when null). The new parent must not be the space itself nor any ' +
          'of its descendants — the service rejects both with a validation error.',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 60 },
          description: { type: 'string', maxLength: 200, nullable: true },
          parentId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        operationId: 'health',
        tags: ['system'],
        security: [],
        summary: 'Check service health',
        responses: { '200': { description: 'OK' }, '503': { description: 'Unhealthy' } },
      },
    },
    '/api/v1/documents': {
      get: {
        operationId: 'documents.list',
        tags: ['documents'],
        summary: 'List documents',
        parameters: [
          { name: 'query', in: 'query', schema: { type: 'string' } },
          { name: 'spaceSlug', in: 'query', schema: { type: 'string' } },
          { name: 'categorySlug', in: 'query', schema: { type: 'string' } },
          { name: 'tagSlug', in: 'query', schema: { type: 'string' } },
          { name: 'mine', in: 'query', schema: { type: 'boolean' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'published'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated documents' } },
      },
      post: {
        operationId: 'documents.create',
        tags: ['documents'],
        summary: 'Create a document',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateDocument' } },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/v1/documents/import-md': {
      post: {
        operationId: 'documents.importMarkdown',
        tags: ['documents'],
        summary: 'Create a document from a Markdown source',
        description:
          'Accepts a Markdown string and converts it server-side to a TipTap document, ' +
          'then persists it through the same code path as `documents.create`. The response ' +
          'envelope is identical to `documents.create` so existing clients can consume it ' +
          'without branching.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ImportMarkdownDocument' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ImportMarkdownResponse' },
              },
            },
          },
          '400': { description: 'Invalid Markdown payload' },
          '404': { description: 'Space or category not found' },
        },
      },
    },
    '/api/v1/documents/{slug}': {
      get: {
        operationId: 'documents.get',
        tags: ['documents'],
        summary: 'Get a document by slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Document detail' },
          '404': { description: 'Not found' },
        },
      },
      patch: {
        operationId: 'documents.update',
        tags: ['documents'],
        summary: 'Update a document by slug',
        description:
          'Slugs are unique per (spaceId, slug) pair, so two documents in different ' +
          'spaces may share the same slug. When they do, this endpoint only reaches ' +
          'whichever row the database returns first — for unambiguous addressing use ' +
          '`/api/v1/documents/{id}`.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateDocument' } },
          },
        },
        responses: { '200': { description: 'Updated' } },
      },
      delete: {
        operationId: 'documents.delete',
        tags: ['documents'],
        summary: 'Delete a document by slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/api/v1/documents/{id}': {
      patch: {
        operationId: 'documents.updateById',
        tags: ['documents'],
        summary: 'Update a document by id',
        description:
          'ID-addressed counterpart to the slug-based PATCH. Use this when two ' +
          'documents share a slug and the slug path cannot disambiguate them. The ' +
          'request body is identical, except `id` is already supplied by the path.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateDocument' } },
          },
        },
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Not the document author' },
          '404': { description: 'Document not found' },
        },
      },
      delete: {
        operationId: 'documents.deleteById',
        tags: ['documents'],
        summary: 'Delete a document by id',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Deleted' },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Not the document author' },
          '404': { description: 'Document not found' },
        },
      },
    },
    '/api/v1/spaces': {
      get: {
        operationId: 'spaces.list',
        tags: ['spaces'],
        summary: 'List spaces',
        responses: { '200': { description: 'Spaces' } },
      },
      post: {
        operationId: 'spaces.create',
        tags: ['spaces'],
        summary: 'Create a space',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  parentId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                    description:
                      'Optional parent space id. When provided, the new space is created ' +
                      'as a child of the referenced space. Must not form a cycle.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Validation error or cycle detected' },
          '404': { description: 'Parent space not found' },
        },
      },
    },
    '/api/v1/spaces/tree': {
      get: {
        operationId: 'spaces.tree',
        tags: ['spaces'],
        summary: 'List space tree',
        description:
          'Returns the full space tree. Each top-level space carries its nested `children` ' +
          'array so the sidebar can render real two-level nesting without re-querying.',
        responses: { '200': { description: 'Space tree' } },
      },
    },
    '/api/v1/spaces/{id}': {
      patch: {
        operationId: 'spaces.update',
        tags: ['spaces'],
        summary: 'Update a space by id',
        description:
          'Partial update. Pass any subset of `name`, `description`, `parentId`. ' +
          'Setting `parentId` is rejected when it would create a cycle (A → B → A or ' +
          'making the space its own ancestor).',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateSpace' } },
          },
        },
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Validation error or cycle detected' },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Not an admin' },
          '404': { description: 'Space or parent space not found' },
        },
      },
      delete: {
        operationId: 'spaces.delete',
        tags: ['spaces'],
        summary: 'Delete a space by id',
        description:
          'Removes a space only when it no longer owns categories or documents. ' +
          'Otherwise returns 409 CONFLICT with counts and sample ids so the caller can ' +
          'migrate the remaining content first.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    deletedSpaceId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Not an admin' },
          '404': { description: 'Space not found' },
          '409': {
            description: 'Space still has categories or documents',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/v1/categories': {
      get: {
        operationId: 'categories.list',
        tags: ['categories'],
        summary: 'List categories',
        responses: { '200': { description: 'Categories' } },
      },
      post: {
        operationId: 'categories.create',
        tags: ['categories'],
        summary: 'Create a category',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['spaceId', 'name'],
                properties: {
                  spaceId: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/v1/categories/{id}': {
      patch: {
        operationId: 'categories.update',
        tags: ['categories'],
        summary: 'Update a category by id',
        description:
          'Partial update. Pass any subset of `name`, `description`, `spaceId`. ' +
          'When `spaceId` changes, every document attached to this category is ' +
          'retargeted to the new space so subsequent deletes of the old space ' +
          'do not hit the FK `onDelete: restrict` guard on `document.space_id`.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateCategory' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    category: { $ref: '#/components/schemas/Category' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthenticated' },
          '403': { description: 'Not an admin' },
          '404': { description: 'Category or target space not found' },
        },
      },
    },
    '/api/v1/tags': {
      get: {
        operationId: 'tags.list',
        tags: ['tags'],
        summary: 'List tags',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } }],
        responses: { '200': { description: 'Tags' } },
      },
    },
    '/api/v1/quick-notes': {
      get: {
        operationId: 'quickNotes.list',
        tags: ['quick-notes'],
        summary: 'List the current user’s quick notes (newest first)',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }],
        responses: { '200': { description: 'Quick notes' } },
      },
      post: {
        operationId: 'quickNotes.create',
        tags: ['quick-notes'],
        summary: 'Create a quick note',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: { type: 'string', minLength: 1, maxLength: 4000 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/v1/quick-notes/{id}': {
      delete: {
        operationId: 'quickNotes.delete',
        tags: ['quick-notes'],
        summary: 'Delete a quick note',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Deleted' } },
      },
    },
    '/api/v1/quick-notes/{id}/promote': {
      post: {
        operationId: 'quickNotes.promote',
        tags: ['quick-notes'],
        summary: 'Promote a quick note into a draft document',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Promoted' } },
      },
    },
  },
} as const
