/**
 * OpenAPI 3.0 spec for the CLI HTTP API.
 *
 * Aggregates the routes registered against `openApiRegistry` (imported
 * transitively by each route file under `src/routes/api/v1/cli/`).
 */
import { createFileRoute } from '@tanstack/react-router'
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { openApiRegistry } from '~/server/openapi'

export const Route = createFileRoute('/api/v1/openapi/json')({
  server: {
    handlers: {
      GET: async () => {
        const generator = new OpenApiGeneratorV3(openApiRegistry.definitions)
        const document = generator.generateDocument({
          openapi: '3.0.3',
          info: {
            title: 'DocBase CLI API',
            version: '0.1.0',
            description:
              'HTTP endpoints used by the `docbase` CLI. All routes require a better-auth API Key passed as `Authorization: Bearer <key>`.',
          },
          servers: [{ url: '/' }],
        })
        return new Response(JSON.stringify(document, null, 2), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=60',
          },
        })
      },
    },
  },
})
