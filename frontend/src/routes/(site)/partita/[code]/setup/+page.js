import { redirect } from '@sveltejs/kit';
import { appState } from '#lib/state.svelte.js';
import { gameUrl, joinUrl } from '#lib/routes.js';

// Modifica delle sfide: solo gli sposi del matrimonio aperto, nel layout del sito.
export async function load({ params, parent }) {
  await parent();
  if (!appState.isInEvent(params.code)) redirect(307, joinUrl(params.code));
  if (!appState.isCouple) redirect(307, gameUrl(params.code, 'home'));
}
