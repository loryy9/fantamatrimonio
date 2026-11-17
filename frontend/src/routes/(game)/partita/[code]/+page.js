import { redirect } from '@sveltejs/kit';
import { gameUrl } from '#lib/routes.js';

export const load = ({ params }) => redirect(307, gameUrl(params.code, 'home'));
