import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import {
  createApiKeyService,
  createMemberService,
  getCurrentUserService,
  listApiKeysService,
  listMembersService,
  revokeApiKeyService,
  signInService,
  signOutService,
} from '~/server/services/auth'
import { contextFromHeaders, requireUserContext } from '~/server/services/context'
import {
  createApiKeySchema,
  expirationToSeconds,
  revokeApiKeySchema,
} from '~/shared/validation/api-key'
import { signInSchema, signUpSchema } from '~/shared/validation/user'

// =============================================================================
// Current user (US4) — return current user or null
// Anonymous is a normal case here: the root loader uses this to decide
// whether to redirect to /auth/login. Throwing here would render the
// error boundary instead.
// =============================================================================
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () =>
  getCurrentUserService(await contextFromHeaders(getRequestHeaders())),
)

export const listMembers = createServerFn({ method: 'GET' }).handler(async () =>
  listMembersService(requireUserContext(await contextFromHeaders(getRequestHeaders()))),
)

// =============================================================================
// signIn / signOut (US4)
// =============================================================================
export const signIn = createServerFn({ method: 'POST' })
  .validator(signInSchema)
  .handler(async ({ data }) => signInService(data))

export const signOut = createServerFn({ method: 'POST' }).handler(async () =>
  signOutService(requireUserContext(await contextFromHeaders(getRequestHeaders()))),
)

export const createMember = createServerFn({ method: 'POST' })
  .validator(signUpSchema)
  .handler(async ({ data }) =>
    createMemberService(requireUserContext(await contextFromHeaders(getRequestHeaders())), data),
  )

export const listApiKeys = createServerFn({ method: 'GET' }).handler(async () =>
  listApiKeysService(requireUserContext(await contextFromHeaders(getRequestHeaders()))),
)

export const createApiKey = createServerFn({ method: 'POST' })
  .validator(createApiKeySchema)
  .handler(async ({ data }) =>
    createApiKeyService(requireUserContext(await contextFromHeaders(getRequestHeaders())), {
      name: data.name,
      expiresIn: expirationToSeconds(data.expiration),
    }),
  )

export const revokeApiKey = createServerFn({ method: 'POST' })
  .validator(revokeApiKeySchema)
  .handler(async ({ data }) =>
    revokeApiKeyService(requireUserContext(await contextFromHeaders(getRequestHeaders())), {
      keyId: data.keyId,
    }),
  )
