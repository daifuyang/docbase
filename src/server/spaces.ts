import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { contextFromHeaders, requireUserContext } from '~/server/services/context'
import {
  createCategoryService,
  createSpaceService,
  deleteCategoryService,
  deleteSpaceService,
  getNavigationTreeService,
  listCategoriesBySpaceService,
  listCategoriesService,
  listSpaceTreeService,
  listSpacesService,
  updateNavigationTreeStateService,
  updateSpaceService,
} from '~/server/services/spaces'

export const listSpaces = createServerFn({ method: 'GET' }).handler(async () =>
  listSpacesService(requireUserContext(await contextFromHeaders(getRequestHeaders()))),
)

export const listSpaceTree = createServerFn({ method: 'GET' }).handler(async () =>
  listSpaceTreeService(requireUserContext(await contextFromHeaders(getRequestHeaders()))),
)

export const getNavigationTree = createServerFn({ method: 'GET' }).handler(async () =>
  getNavigationTreeService(requireUserContext(await contextFromHeaders(getRequestHeaders()))),
)

export const updateNavigationTreeState = createServerFn({ method: 'POST' })
  .validator(z.object({ expandedKeys: z.array(z.string()).max(300) }))
  .handler(async ({ data }) =>
    updateNavigationTreeStateService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data,
    ),
  )

export const listCategoriesBySpace = createServerFn({ method: 'GET' })
  .validator(z.object({ spaceId: z.string().uuid() }))
  .handler(async ({ data }) =>
    listCategoriesBySpaceService(
      requireUserContext(await contextFromHeaders(getRequestHeaders())),
      data,
    ),
  )

export const listCategories = createServerFn({ method: 'GET' }).handler(async () =>
  listCategoriesService(requireUserContext(await contextFromHeaders(getRequestHeaders()))),
)

export const createSpace = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().min(1).max(60),
      description: z.string().max(200).optional(),
      parentId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data }) =>
    createSpaceService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )

export const updateSpace = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(60).optional(),
      description: z.string().max(200).nullable().optional(),
      parentId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data }) =>
    updateSpaceService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )

export const deleteSpace = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) =>
    deleteSpaceService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )

export const deleteCategory = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) =>
    deleteCategoryService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
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
    createCategoryService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )
