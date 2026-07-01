import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import {
  assertSameOrigin,
  getInstallStateService,
  runInstallService,
  testInstallConfigService,
} from '~/server/services/install'
import { installConfigSchema, installInputSchema } from '~/shared/validation/install'

export const getInstallState = createServerFn({ method: 'GET' }).handler(async () =>
  getInstallStateService(),
)

export const testInstallConfig = createServerFn({ method: 'POST' })
  .validator(installConfigSchema)
  .handler(async ({ data }) => {
    assertSameOrigin(getRequestHeaders())
    return testInstallConfigService(data)
  })

export const runInstall = createServerFn({ method: 'POST' })
  .validator(installInputSchema)
  .handler(async ({ data }) => {
    assertSameOrigin(getRequestHeaders())
    return runInstallService(data)
  })
