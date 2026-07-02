import { createFileRoute } from '@tanstack/react-router'
import { isFcDeployMode } from '~/lib/runtime-config.server'
import { testInstallConfigService } from '~/server/services/install'
import { installConfigSchema } from '~/shared/validation/install'

export const Route = createFileRoute('/api/install/config')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (isFcDeployMode()) return installDisabledResponse()
        const body = await request.json()
        const parsed = installConfigSchema.safeParse(body)
        if (!parsed.success) {
          return new Response(JSON.stringify({ ok: false, error: parsed.error.message }), {
            status: 400,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          })
        }
        const result = await testInstallConfigService(parsed.data)
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      },
    },
  },
})

function installDisabledResponse() {
  return new Response(JSON.stringify({ ok: false, error: 'FC production mode disables install APIs' }), {
    status: 404,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
