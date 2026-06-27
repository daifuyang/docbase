import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { contextFromHeaders } from '~/server/services/context'
import { listTagsService } from '~/server/services/tags'

export const listTags = createServerFn({ method: 'GET' })
  .validator(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional())
  .handler(async ({ data }) =>
    listTagsService(await contextFromHeaders(getRequestHeaders()), data ?? undefined),
  )
