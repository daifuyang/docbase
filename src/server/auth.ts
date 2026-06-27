import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import {
  createMemberService,
  getCurrentUserService,
  listMembersService,
  signInService,
  signOutService,
  signUpService,
} from '~/server/services/auth'
import { contextFromHeaders } from '~/server/services/context'
import { signInSchema, signUpSchema } from '~/shared/validation/user'

// =============================================================================
// Current user (US4) — return current user or null
// =============================================================================
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () =>
  getCurrentUserService(await contextFromHeaders(getRequestHeaders())),
)

export const listMembers = createServerFn({ method: 'GET' }).handler(async () =>
  listMembersService(await contextFromHeaders(getRequestHeaders())),
)

// =============================================================================
// signUp / signIn / signOut (US3 / US4)
// =============================================================================
export const signUp = createServerFn({ method: 'POST' })
  .validator(signUpSchema)
  .handler(async ({ data }) => signUpService(data))

export const signIn = createServerFn({ method: 'POST' })
  .validator(signInSchema)
  .handler(async ({ data }) => signInService(data))

export const signOut = createServerFn({ method: 'POST' }).handler(async () =>
  signOutService(await contextFromHeaders(getRequestHeaders())),
)

export const createMember = createServerFn({ method: 'POST' })
  .validator(signUpSchema)
  .handler(async ({ data }) =>
    createMemberService(await contextFromHeaders(getRequestHeaders()), data),
  )
