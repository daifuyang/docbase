import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ command, mode }) => {
  const nodeEnv = command === 'build' ? 'production' : mode === 'development' ? 'development' : 'production'
  process.env.NODE_ENV ??= nodeEnv

  return {
    // Keep runtime checks aligned with the JSX runtime selected by React's Vite plugin.
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0', // Listen on all interfaces for LAN access
    },
    build: {
      sourcemap: false,
      minify: true,
    },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      // MUST come before react()
      tanstackStart(),
      nitro({ noExternals: true }),
      viteReact(),
    ],
  }
})
