import { createFileRoute } from '@tanstack/react-router'
import { json } from '~/server/http'
import { docbaseOpenApiSpec } from '~/shared/openapi'

export const Route = createFileRoute('/api/v1/openapi')({
  server: {
    handlers: {
      GET: async () => json(docbaseOpenApiSpec),
    },
  },
})
