import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';

export default defineConfig({
  plugins: [
    sveltekit({
      // SPA: tutte le pagine sono renderizzate nel browser. La build finisce in dist/, servita dal
      // Worker Cloudflare che rimanda ogni URL sconosciuto a index.html (vedi worker/wrangler.jsonc).
      adapter: adapter({ pages: 'dist', assets: 'dist', fallback: 'index.html' })
    })
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Le API girano sul Worker (wrangler dev, porta 8000)
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
