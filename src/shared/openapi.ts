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
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/api/v1/spaces/tree': {
      get: {
        operationId: 'spaces.tree',
        tags: ['spaces'],
        summary: 'List space tree',
        responses: { '200': { description: 'Space tree' } },
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
