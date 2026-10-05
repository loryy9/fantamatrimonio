import { redirect } from '@sveltejs/kit';

// Vecchio URL della dashboard utente
export function load() {
  redirect(307, '/dashboard');
}
