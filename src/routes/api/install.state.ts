import { createFileRoute } from '@tanstack/react-router'
import { getInstallStateService } from '~/server/services/install'

export const Route = createFileRoute('/api/install/state')({
  server: {
    handlers: {
      GET: async () => {
        const state = await getInstallStateService()
        return new Response(JSON.stringify(state), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      },
    },
  },
})
