import { appState } from '#lib/state.svelte.js';

// SPA: niente rendering lato server, tutto gira nel browser (sessione in localStorage).
export const ssr = false;
export const prerender = false;

// Ogni pagina parte dopo il recupero della sessione: i load figli possono già decidere i redirect.
export const load = () => appState.ready();
