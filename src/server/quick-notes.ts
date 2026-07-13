import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { contextFromHeaders, requireUserContext } from '~/server/services/context'
import {
  createQuickNoteService,
  deleteQuickNoteService,
  listQuickNotesService,
  promoteQuickNoteService,
} from '~/server/services/quick-notes'

const createSchema = z.object({
  content: z.string().min(1).max(4000),
})

const listSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
})

const idSchema = z.object({ id: z.string().uuid() })

export const createQuickNote = createServerFn({ method: 'POST' })
  .validator(createSchema)
  .handler(async ({ data }) =>
    createQuickNoteService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )

export const listQuickNotes = createServerFn({ method: 'GET' })
  .validator(listSchema.optional())
  .handler(async ({ data }) =>
    listQuickNotesService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data ?? {},
    ),
  )

export const deleteQuickNote = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data }) =>
    deleteQuickNoteService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )

export const promoteQuickNote = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data }) =>
    promoteQuickNoteService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data,
    ),
  )
