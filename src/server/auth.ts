import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { contextFromHeaders } from '~/server/services/context'
import {
  createMemberService,
  getCurrentUserService,
  listMembersService,
  signInService,
  signOutService,
  signUpService,
} from '~/server/services/auth'
import { isServerError } from '~/lib/errors'
import { signInSchema, signUpSchema } from '~/shared/validation/user'

// =============================================================================
// Current user (US4) — return current user or null
// =============================================================================
//
// `getCurrentUser` is the one auth probe that's safe to call when the
// visitor is anonymous: route guards use its null result to trigger a
// `redirect({ to: '/auth/login' })` in `beforeLoad`. If it threw
// UNAUTHENTICATED instead, the root loader would error out, the route
// would never reach its `beforeLoad`, and the user would land on the
// generic error boundary instead of the login page.
//
// All other server fns in this module genuinely require an authenticated
// context, so they keep going through `contextFromHeaders` and bubble up
// UNAUTHENTICATED normally.
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    return await getCurrentUserService(await contextFromHeaders(getRequestHeaders()))
  } catch (e) {
    if (isServerError(e) && e.code === 'UNAUTHENTICATED') return null
    throw e
  }
})

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