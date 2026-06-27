import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { contextFromHeaders } from '~/server/services/context'
import {
  createCategoryService,
  createSpaceService,
  getNavigationTreeService,
  listCategoriesBySpaceService,
  listCategoriesService,
  listSpaceTreeService,
  listSpacesService,
  updateNavigationTreeStateService,
} from '~/server/services/spaces'

export const listSpaces = createServerFn({ method: 'GET' }).handler(async () =>
  listSpacesService(await contextFromHeaders(getRequestHeaders())),
)

export const listSpaceTree = createServerFn({ method: 'GET' }).handler(async () =>
  listSpaceTreeService(await contextFromHeaders(getRequestHeaders())),
)

export const getNavigationTree = createServerFn({ method: 'GET' }).handler(async () =>
  getNavigationTreeService(await contextFromHeaders(getRequestHeaders())),
)

export const updateNavigationTreeState = createServerFn({ method: 'POST' })
  .validator(z.object({ expandedKeys: z.array(z.string()).max(300) }))
  .handler(async ({ data }) =>
    updateNavigationTreeStateService(await contextFromHeaders(getRequestHeaders()), data),
  )

export const listCategoriesBySpace = createServerFn({ method: 'GET' })
  .validator(z.object({ spaceId: z.string().uuid() }))
  .handler(async ({ data }) =>
    listCategoriesBySpaceService(await contextFromHeaders(getRequestHeaders()), data),
  )

export const listCategories = createServerFn({ method: 'GET' }).handler(async () =>
  listCategoriesService(await contextFromHeaders(getRequestHeaders())),
)

export const createSpace = createServerFn({ method: 'POST' })
  .validator(
    z.object({ name: z.string().min(1).max(60), description: z.string().max(200).optional() }),
  )
  .handler(async ({ data }) =>
    createSpaceService(await contextFromHeaders(getRequestHeaders()), data),
  )

export const createCategory = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      spaceId: z.string().uuid(),
      name: z.string().min(1).max(60),
      description: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ data }) =>
    createCategoryService(await contextFromHeaders(getRequestHeaders()), data),
  )
