import { redirect } from '@sveltejs/kit';
import { appState } from '#lib/state.svelte.js';
import { ROUTES, joinUrl, normalizeCode } from '#lib/routes.js';

export async function load({ url, parent }) {
  await parent();
  // Arrivati da un link d'invito: dopo l'accesso si torna al form con il codice già inserito
  const code = normalizeCode(url.searchParams.get('code'));
  appState.pendingJoinCode = code || null;
  if (appState.hasAccount) redirect(307, code ? joinUrl(code) : ROUTES.dashboard);
}
