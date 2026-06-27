import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0', // Listen on all interfaces for LAN access
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    // MUST come before react()
    tanstackStart(),
    viteReact(),
  ],
})
