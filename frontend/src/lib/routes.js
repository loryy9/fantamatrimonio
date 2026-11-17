/** URL dell'app: definiti solo qui. */

export const ROUTES = {
  home: '/',
  join: '/entra',
  create: '/crea',
  login: '/login',
  dashboard: '/dashboard_utente',
  admin: '/admin',
};

/** Tab del gioco, ognuna è una pagina /partita/<codice>/<tab>. */
export const GAME_TABS = ['home', 'gallery', 'hunt', 'quiz', 'leaderboard'];

const withQuery = (path, key, value) => (value ? `${path}?${key}=${encodeURIComponent(value)}` : path);

export const normalizeCode = (code) => (code || '').trim().toUpperCase();

export const gameUrl = (code, tab = 'home') => `/partita/${encodeURIComponent(normalizeCode(code))}/${tab}`;
export const joinUrl = (code) => withQuery(ROUTES.join, 'code', normalizeCode(code));
export const loginUrl = (code) => withQuery(ROUTES.login, 'code', normalizeCode(code));
export const dashboardUrl = (eventId) => withQuery(ROUTES.dashboard, 'event', eventId);
