import { redirect } from '@sveltejs/kit';
import { appState } from '#lib/state.svelte.js';
import { ROUTES, joinUrl } from '#lib/routes.js';

export async function load({ url, parent }) {
  await parent();
  // Vecchi link d'invito (/?code=...) e QR già stampati
  const code = url.searchParams.get('code');
  if (code) redirect(307, joinUrl(code));
  // Con un account (e nessun matrimonio aperto) la home è la dashboard
  if (appState.hasAccount && !appState.event) redirect(307, ROUTES.dashboard);
}
