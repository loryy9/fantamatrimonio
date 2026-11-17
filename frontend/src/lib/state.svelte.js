import { api } from './api.js';
import { fireCelebration } from './confetti.js';
import { formatName } from './formatters.js';
import { DEFAULT_PHOTO_CHALLENGES, PRESET_QUIZZES, PRESET_HUNTS, PRESET_MOMENTS } from './challengePresets.js';

/** Tab del gioco (dentro un matrimonio). 'setup' è riservata agli sposi. */
const GAME_TABS = ['home', 'gallery', 'hunt', 'quiz', 'leaderboard', 'setup'];

/** URL delle pagine del sito (fuori dal gioco). */
const VIEW_PATHS = {
  entry: '/',
  join: '/entra',
  create: '/crea',
  'login-secure': '/dashboard_utente',
  dashboard: '/dashboard_utente',
};
const DASHBOARD_PATHS = ['/dashboard_utente', '/login', '/dashboard'];

const withFormattedNames = (item) => ({
  ...item,
  first_name: formatName(item.first_name),
  last_name: formatName(item.last_name),
});

class AppState {
  /**
   * Schermata corrente: una pagina del sito ('entry' | 'join' | 'create' | 'login-secure' | 'dashboard')
   * oppure una tab del gioco (GAME_TABS).
   */
  view = $state('entry');
  pendingInvite = $state(null); // codice invito mentre gli sposi configurano il matrimonio appena creato
  pendingJoinCode = null; // codice invito di un link, ricordato se l'ospite passa dal login classico
  user = $state(null);
  event = $state(null);
  account = $state(null); // account dell'utente (email/password o social)
  token = $state(localStorage.getItem('fm_auth_token') || null);
  refreshToken = $state(localStorage.getItem('fm_refresh_token') || null);
  jwtToken = $state(localStorage.getItem('fm_jwt_token') || null);
  isLoadingAuth = $state(true);
  quizSubTab = $state('quiz'); // 'quiz' | 'vote'
  showInstructionsModal = $state(false);
  refreshTimer = null;

  challenges = $state([]);
  setupChallenges = $state([]);
  mySubmissions = $state([]);
  leaderboard = $state([]);
  galleryPhotos = $state([]);

  dashboardEvents = $state([]);
  dashboardLoading = $state(false);

  toasts = $state([]);
  pollingTimer = null;

  // ── Getter ────────────────────────────────────────────────────────────────

  get gameRoute() {
    const code = this.event?.invite_code?.trim().toUpperCase();
    return code ? `/partita/${encodeURIComponent(code)}/${this.view}` : '/';
  }

  get hasSession() {
    return !!this.token || !!this.jwtToken;
  }

  get isAuthenticated() {
    return this.hasSession && (!!this.user || !!this.account);
  }

  get isCouple() {
    return this.user?.role === 'couple';
  }

  get hasAccount() {
    return !!this.account || !!this.jwtToken;
  }

  get isInGame() {
    return Boolean(
      this.event &&
      this.user &&
      !this.pendingInvite &&
      GAME_TABS.includes(this.view) &&
      (this.view !== 'setup' || this.isCouple)
    );
  }

  get mySubmissionsByChallenge() {
    const map = {};
    for (const sub of this.mySubmissions) {
      if (sub.challenge_id) map[sub.challenge_id] = sub;
    }
    return map;
  }

  get myRank() {
    if (!this.user || this.isCouple) return null;
    return this.leaderboard.find(item => item.id === this.user.id)?.rank ?? null;
  }

  // ── Toast e dialoghi ──────────────────────────────────────────────────────

  showToast(text, type = 'info', points = null) {
    const id = Date.now() + Math.random();
    this.toasts.push({ id, text, type, points });
    if (points > 0) fireCelebration();
    setTimeout(() => this.removeToast(id), 4000);
  }

  removeToast(id) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  // Dialogo di conferma/avviso al posto di confirm()/alert() del browser.
  dialog = $state(null); // { title, message, confirmText, cancelText, danger, alertOnly }
  _dialogResolve = null;

  /** Chiede conferma: risolve true/false. */
  confirm(message, { title = 'Sei sicuro?', confirmText = 'Conferma', cancelText = 'Annulla', danger = false } = {}) {
    return this._openDialog({ title, message, confirmText, cancelText, danger, alertOnly: false });
  }

  /** Avviso con il solo tasto "Ok": risolve quando viene chiuso. */
  alert(message, { title = 'Attenzione', confirmText = 'Ok' } = {}) {
    return this._openDialog({ title, message, confirmText, cancelText: '', danger: false, alertOnly: true });
  }

  _openDialog(dialog) {
    this._closeDialog(false); // un eventuale dialogo aperto viene annullato
    return new Promise(resolve => {
      this._dialogResolve = resolve;
      this.dialog = dialog;
    });
  }

  _closeDialog(result) {
    const resolve = this._dialogResolve;
    this._dialogResolve = null;
    this.dialog = null;
    resolve?.(result);
  }

  // ── Sessione ──────────────────────────────────────────────────────────────

  setUser(u) {
    if (!u) {
      this.user = null;
      return;
    }
    const nick = u.nickname || u.first_name || '';
    this.user = {
      ...u,
      nickname: nick,
      first_name: formatName(nick),
      last_name: formatName(u.last_name || '')
    };
  }

  _scheduleAutoRefresh(expiresInSeconds) {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    if (!expiresInSeconds || expiresInSeconds <= 0) return;
    // Rinfresca prima della scadenza (all'80% del TTL, min 10s)
    const delayMs = Math.max(10000, expiresInSeconds * 0.8 * 1000);
    this.refreshTimer = setTimeout(() => this.refreshSessionToken(), delayMs);
  }

  async refreshSessionToken() {
    if (!this.refreshToken) return;
    try {
      const res = await api.refreshToken(this.refreshToken);
      if (res?.token) {
        this._saveTokens(res.token, res.jwt, null, res.refresh_token, res.expires_in);
      }
    } catch (err) {
      console.warn('Auto refresh session failed:', err);
    }
  }

  _saveTokens(sessionToken, jwt, account, refreshToken = null, expiresIn = null) {
    if (sessionToken) {
      this.token = sessionToken;
      localStorage.setItem('fm_auth_token', sessionToken);
    }
    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem('fm_refresh_token', refreshToken);
    }
    if (jwt) {
      this.jwtToken = jwt;
      localStorage.setItem('fm_jwt_token', jwt);
    }
    if (account) this.account = account;
    if (expiresIn) this._scheduleAutoRefresh(expiresIn);
  }

  /** Dimentica la sessione del singolo matrimonio (l'account resta). */
  _clearEventSession() {
    this.token = null;
    this.refreshToken = null;
    this._scheduleAutoRefresh(0);
    localStorage.removeItem('fm_auth_token');
    localStorage.removeItem('fm_refresh_token');
  }

  /** Svuota i dati di gioco del matrimonio corrente. */
  _clearGame() {
    this.user = null;
    this.event = null;
    this.challenges = [];
    this.mySubmissions = [];
    this.leaderboard = [];
    this.galleryPhotos = [];
    this.stopPolling();
  }

  async init() {
    this.isLoadingAuth = true;
    try {
      // Link d'invito: se c'e' gia' un account lo recuperiamo, cosi' si salta il login.
      if (new URLSearchParams(location.search).get('code')?.trim()) {
        this.view = 'join';
        if (this.jwtToken) {
          try {
            const res = await api.getMe();
            if (res.account) this.account = res.account;
          } catch (_) {
            this.logout();
            this.view = 'join';
          }
        }
        return;
      }

      if (this.hasSession) {
        try {
          const res = await api.getMe();
          this._saveTokens(null, null, res.account, res.refresh_token);

          if (this.jwtToken && !this.token) {
            this.user = null;
            this.event = null;
            this.view = 'dashboard';
            await this.loadDashboardEvents();
          } else if (res.user) {
            this.setUser(res.user);
            this.event = res.event || null;
            if (this.event && !this.event.invite_code) {
              try {
                const inv = await api.getEventInvite();
                if (inv?.invite_code) this.event.invite_code = inv.invite_code;
              } catch (_) {}
            }
            await this.loadInitialData();
            this.startPolling();
          }
        } catch (err) {
          console.warn('Session restoration failed:', err);
          this.logout();
        }
      }
      this.syncRouteFromUrl();
    } catch (err) {
      console.error('Fatal init error:', err);
    } finally {
      this.isLoadingAuth = false;
    }
  }

  // ── Navigazione ───────────────────────────────────────────────────────────

  /** Allinea la schermata all'URL corrente (avvio e tasto indietro del browser). */
  syncRouteFromUrl() {
    if (this.pendingInvite) return;
    const path = location.pathname.toLowerCase();

    if (new URLSearchParams(location.search).get('code')?.trim()) {
      this.view = 'join';
      return;
    }

    const game = path.match(/^\/partita\/([^/]+)(?:\/([^/]+))?\/?$/);
    const routeCode = game && decodeURIComponent(game[1]).toUpperCase();
    if (routeCode && routeCode === this.event?.invite_code?.toUpperCase()) {
      const tab = game[2] || 'home';
      if (GAME_TABS.includes(tab) && (tab !== 'setup' || this.isCouple)) {
        this.view = tab;
      } else {
        // tab sconosciuta o riservata agli sposi: si torna alla home della partita
        this.view = 'home';
        history.replaceState(null, '', `/partita/${encodeURIComponent(routeCode)}/home`);
      }
      return;
    }

    if (path === '/crea') {
      this.view = 'create';
    } else if (path === '/entra') {
      this.view = 'join';
    } else if (DASHBOARD_PATHS.includes(path)) {
      this.view = this.hasAccount ? 'dashboard' : 'login-secure';
    } else if (path === '/' && !this.isInGame) {
      this.view = this.hasAccount && !this.event ? 'dashboard' : 'entry';
    } else {
      return;
    }
    if (this.view === 'dashboard') this.loadDashboardEvents();
  }

  setGameTab(tab, replace = false) {
    if (!GAME_TABS.includes(tab) || (tab === 'setup' && !this.isCouple)) return;
    this.view = tab;
    if (this.event?.invite_code) {
      history[replace ? 'replaceState' : 'pushState'](null, '', this.gameRoute);
    }
  }

  /** Va a una pagina del sito (fuori dal gioco). */
  setAuthView(view) {
    const urlCode = new URLSearchParams(location.search).get('code');
    if (view === 'login-secure' && urlCode) this.pendingJoinCode = urlCode.trim().toUpperCase();
    else if (view === 'entry' || view === 'create') this.pendingJoinCode = null;
    // pendingInvite tiene "agganciato" il wizard di creazione: va chiuso quando si naviga altrove.
    if (view !== 'create') this.pendingInvite = null;
    this.view = view;
    const search = view === 'join' ? location.search : '';
    history.pushState(null, '', (VIEW_PATHS[view] || '/') + search);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openDashboard(eventId = null) {
    // Uscendo dal wizard di creazione l'evento resta salvato: si chiude solo il flusso.
    this.pendingInvite = null;
    this.view = 'dashboard';
    this.stopPolling();
    const eventQuery = eventId ? `?event=${encodeURIComponent(eventId)}` : '';
    history.pushState(null, '', `/dashboard_utente${eventQuery}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Matrimonio: creazione, ingresso, selezione ────────────────────────────

  async createEvent(payload) {
    try {
      const res = await api.createEvent(payload);
      this._saveTokens(res.token, res.jwt, res.account);
      this.setUser(res.user);
      const inviteCode = res.invite_code || res.event?.invite_code || null;
      this.event = { ...(res.event || {}), invite_code: inviteCode };
      return { success: true, inviteCode };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async finishOnboarding(targetTab = null) {
    this.pendingInvite = null;
    if (targetTab === 'dashboard') {
      this.openDashboard(this.event?.id);
      return;
    }
    this.setGameTab(targetTab || 'home', true);
    await this.loadInitialData();
    this.startPolling();
  }

  async cancelEventCreation() {
    try {
      if (this.token) await api.deleteMyEvent();
    } catch (err) {
      console.warn('Errore cancellazione evento:', err);
    } finally {
      this.pendingInvite = null;
      this._clearEventSession();
      this._clearGame();
      if (this.jwtToken && this.account) {
        this.openDashboard();
        this.showToast('Creazione annullata. L’account è ancora attivo.', 'info');
      } else {
        this.setAuthView('entry');
        this.showToast('Creazione annullata.', 'info');
      }
    }
  }

  /** Entra in un matrimonio con il codice invito (serve un account). */
  async join(inviteCode, nickname = '') {
    try {
      const res = await api.join(inviteCode, nickname);
      this._saveTokens(res.token, res.jwt, res.account, res.refresh_token, res.expires_in);
      this.setUser(res.user);
      this.event = {
        ...(res.event || {}),
        invite_code: res.event?.invite_code || inviteCode.trim().toUpperCase()
      };

      const name = this.user.first_name;
      const coupleNames = [this.event.spouse1_name, this.event.spouse2_name].filter(Boolean).join(' & ');
      const greeting = this.isCouple
        ? (coupleNames ? `Bentornati ${coupleNames}!` : 'Bentornati Sposi!')
        : (res.is_new ? `Benvenuto/a ${name}!` : `Bentornato/a ${name}!`);
      this.showToast(greeting, 'success');

      this.pendingJoinCode = null;
      this.setGameTab('home', true);
      window.dispatchEvent(new PopStateEvent('popstate'));

      await this.loadInitialData();
      this.startPolling();
      return { success: true };
    } catch (err) {
      if (err.code !== 'NICKNAME_TAKEN') {
        this.showToast(err.message || 'Errore durante l\'accesso', 'error');
      }
      return {
        success: false,
        error: err.message,
        code: err.code || null,
        detail: err.detail || null
      };
    }
  }

  async selectEvent(eventItem, targetTab = null) {
    const eventId = eventItem?.event?.id || eventItem?.id;
    if (!eventId) return;
    try {
      const res = await api.getMe(eventId, this.jwtToken);
      if (!res.user) {
        this.showToast('Nessun profilo trovato per questo matrimonio', 'error');
        return;
      }
      if (res.token) this._saveTokens(res.token, this.jwtToken, this.account, res.refresh_token);
      this.setUser(res.user);
      this.event = res.event;
      if (targetTab === 'setup') {
        const existing = await api.getChallenges(true);
        this.setupChallenges = await this.ensureStarterChallenges(existing);
        this.challenges = this.setupChallenges.filter(ch => ch.active !== false);
      } else {
        await this.loadInitialData();
      }
      this.setGameTab(targetTab || 'home', true);
      this.startPolling();
      this.showToast(`Entrato nel matrimonio di ${this.event.spouse1_name} & ${this.event.spouse2_name}`, 'info');
    } catch (err) {
      console.error('Errore selezione evento:', err);
      this.showToast('Impossibile entrare nell\'evento', 'error');
    }
  }

  // ── Account ───────────────────────────────────────────────────────────────

  /**
   * Dopo un login/registrazione riuscito. Con `redirect` (default) porta alla dashboard utente;
   * senza resta nella schermata corrente (es. "entra con codice" o "crea matrimonio").
   */
  async _completeAccountAuth(res, { redirect = true, toast = '' } = {}) {
    this._saveTokens(null, res.jwt, res.account);

    if (redirect && this.pendingJoinCode) {
      // L'ospite era arrivato da un link d'invito: lo riportiamo al form con il codice gia' inserito.
      const code = this.pendingJoinCode;
      this.pendingJoinCode = null;
      this.view = 'join';
      history.pushState(null, '', `/entra?code=${encodeURIComponent(code)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else if (redirect) {
      // Scollega lo stato di gioco del singolo matrimonio
      this._clearGame();
      this.openDashboard();
      await this.loadDashboardEvents();
    }
    if (toast) this.showToast(toast, 'success');
  }

  async loginSecure(email, password, opts = {}) {
    try {
      const res = await api.loginSecure(email, password);
      await this._completeAccountAuth(res, {
        ...opts,
        toast: `Bentornato/a ${res.account.first_name || res.account.display_name}!`
      });
      return { success: true, events: res.events || [] };
    } catch (err) {
      return { success: false, error: err.message || 'Email o password non corretti' };
    }
  }

  async loginSocial(provider, token, opts = {}) {
    try {
      const res = await api.loginSocial(provider, token);
      await this._completeAccountAuth(res, {
        ...opts,
        toast: `Benvenuto/a ${res.account.first_name || res.account.display_name}!`
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Accesso non riuscito' };
    }
  }

  async register(fields, opts = {}) {
    try {
      const res = await api.register(fields);
      await this._completeAccountAuth(res, { ...opts, toast: 'Account creato con successo!' });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Errore nella registrazione' };
    }
  }

  async loadDashboardEvents() {
    if (!this.hasAccount) return;
    this.dashboardLoading = true;
    try {
      this.dashboardEvents = await api.getDashboardEvents();
    } catch (err) {
      console.error('Failed to load dashboard events', err);
      this.dashboardEvents = [];
    } finally {
      this.dashboardLoading = false;
    }
  }

  logout() {
    this._clearEventSession();
    this._clearGame();
    this.jwtToken = null;
    this.account = null;
    this.dashboardEvents = [];
    localStorage.removeItem('fm_jwt_token');
    this.setAuthView('entry');
  }

  // ── Dati di gioco ─────────────────────────────────────────────────────────

  async loadInitialData() {
    const [challengeResult] = await Promise.allSettled([
      api.getChallenges(this.isCouple),
      this.refreshMySubmissions(),
      this.refreshLeaderboard(),
      this.refreshGallery()
    ]);
    if (challengeResult.status === 'fulfilled') {
      this.setupChallenges = challengeResult.value;
      this.challenges = challengeResult.value.filter(ch => ch.active !== false);
      await this.ensureStarterChallenges(this.isCouple ? challengeResult.value : null);
    }
  }

  async ensureStarterChallenges(existingChallenges = null) {
    if (!this.isCouple) return existingChallenges || [];
    try {
      const existing = existingChallenges || await api.getChallenges(true);
      if (existing.some(ch => ch.type === 'quiz' || ch.type === 'hunt' || ch.type === 'vote')) {
        this.setupChallenges = existing;
        return existing;
      }

      const payload = [
        ...(existing.length ? [] : DEFAULT_PHOTO_CHALLENGES),
        ...PRESET_QUIZZES,
        ...PRESET_HUNTS,
        ...PRESET_MOMENTS
      ].map(({ title, description, points, type, vote_options, correct_answer }) => ({
        title,
        description,
        points,
        type,
        active: true,
        ...(type === 'quiz' ? { vote_options, correct_answer } : {})
      }));

      const created = await api.createChallengesBulk(payload);
      const restored = [...existing, ...created].map(ch => ({
        ...ch,
        challenge_type: ch.challenge_type || ch.type,
        active: ch.active ?? true,
        config: ch.config || {
          options: (ch.vote_options || []).map(option => ({ id: option, text: option }))
        }
      }));
      this.setupChallenges = restored;
      this.challenges = restored.filter(ch => ch.active !== false);
      this.showToast('Abbiamo ripristinato le sfide iniziali per questo matrimonio.', 'success');
      return restored;
    } catch (err) {
      console.error('Failed to ensure starter challenges', err);
      this.showToast('Non è stato possibile caricare le sfide del matrimonio.', 'error');
      return existingChallenges || [];
    }
  }

  async refreshUser(silent = false) {
    if (!this.hasSession) return;
    try {
      const res = await api.getMe();
      if (!silent && this.user && res.user.total_points > this.user.total_points) {
        const diff = res.user.total_points - this.user.total_points;
        this.showToast(`Hai guadagnato +${diff} punti!`, 'success', diff);
      }
      this.setUser(res.user);
      this.event = res.event || this.event;
      if (res.account) this.account = res.account;
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  }

  async refreshChallenges() {
    if (!this.hasSession) return;
    try {
      this.challenges = await api.getChallenges();
    } catch (err) {
      console.error('Failed to load challenges', err);
    }
  }

  async refreshMySubmissions() {
    if (!this.hasSession) return;
    try {
      this.mySubmissions = await api.getMySubmissions();
    } catch (err) {
      console.error('Failed to load submissions', err);
    }
  }

  async refreshLeaderboard() {
    if (!this.hasSession) return;
    try {
      this.leaderboard = (await api.getLeaderboard()).map(withFormattedNames);
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    }
  }

  async refreshGallery(force = false) {
    if (!this.hasSession) return;
    try {
      const data = await api.getGallery();
      // Evita di rimpiazzare l'array (e rieseguire il render di tutte le immagini) se non ci sono nuove foto
      if (!force && this.galleryPhotos.length === data.length && this.galleryPhotos[0]?.id === data[0]?.id) {
        return;
      }
      this.galleryPhotos = data.map(withFormattedNames);
    } catch (err) {
      console.error('Failed to load gallery', err);
    }
  }

  startPolling() {
    if (this.pollingTimer) return;
    // Polling ogni 20 secondi per punteggio e classifica live
    this.pollingTimer = setInterval(async () => {
      if (this.isAuthenticated) {
        await Promise.allSettled([this.refreshUser(true), this.refreshLeaderboard()]);
      }
    }, 20000);
  }

  stopPolling() {
    clearInterval(this.pollingTimer);
    this.pollingTimer = null;
  }
}

export const appState = new AppState();
