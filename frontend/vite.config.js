import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'

// https://svelte.dev/docs/kit
export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
