import { redirect } from '@sveltejs/kit';
import { appState } from '#lib/state.svelte.js';
import { joinUrl } from '#lib/routes.js';

// Si entra nel gioco solo con il matrimonio di quel codice già aperto; altrimenti si passa
// dal form "Entra nella festa" con il codice precompilato.
export async function load({ params, parent }) {
  await parent();
  if (!appState.isInEvent(params.code)) redirect(307, joinUrl(params.code));
}
