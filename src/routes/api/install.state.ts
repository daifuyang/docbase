import { createFileRoute } from '@tanstack/react-router'
import { isFcDeployMode } from '~/lib/runtime-config.server'
import { getInstallStateService } from '~/server/services/install'

export const Route = createFileRoute('/api/install/state')({
  server: {
    handlers: {
      GET: async () => {
        if (isFcDeployMode()) return installDisabledResponse()
        const state = await getInstallStateService()
        return new Response(JSON.stringify(state), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      },
    },
  },
})

function installDisabledResponse() {
  return new Response(
    JSON.stringify({ ok: false, error: 'FC production mode disables install APIs' }),
    {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  )
}
