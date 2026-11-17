import { redirect } from '@sveltejs/kit';
import { appState } from '#lib/state.svelte.js';
import { ROUTES } from '#lib/routes.js';

export async function load({ parent }) {
  await parent();
  if (!appState.hasAccount) redirect(307, ROUTES.login);
}
