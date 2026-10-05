import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    // SPA: tutte le route vengono servite dal fallback (vedi static/_redirects per Cloudflare Pages)
    adapter: adapter({ fallback: '200.html' }),
    alias: { $components: 'src/components' },
  },
};
