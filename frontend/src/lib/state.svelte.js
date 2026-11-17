import { goto } from '$app/navigation';
import { api } from './api.js';
import { fireCelebration } from './confetti.js';
import { formatName } from './formatters.js';
import { ROUTES, gameUrl, joinUrl, dashboardUrl } from './routes.js';
import { DEFAULT_PHOTO_CHALLENGES, PRESET_QUIZZES, PRESET_HUNTS, PRESET_MOMENTS } from './challengePresets.js';

const withFormattedNames = (item) => ({
  ...item,
  first_name: formatName(item.first_name),
  last_name: formatName(item.last_name),
});

// Il modulo viene importato anche durante la build (in Node), dove localStorage non esiste.
const stored = (key) => globalThis.localStorage?.getItem(key) || null;

class AppState {
  pendingInvite = $state(null); // codice invito mentre gli sposi configurano il matrimonio appena creato
  pendingJoinCode = null; // codice di un link d'invito, ricordato se l'ospite passa dal login
  user = $state(null);
  event = $state(null);
  account = $state(null); // account dell'utente (email/password o social)
  token = $state(stored('fm_auth_token'));
  refreshToken = $state(stored('fm_refresh_token'));
  jwtToken = $state(stored('fm_jwt_token'));
  quizSubTab = $state('quiz'); // 'quiz' | 'vote'
  showInstructionsModal = $state(false);
  refreshTimer = null;
  _initPromise = null;

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

  /** Il matrimonio caricato è quello con questo codice (e c'è un profilo di gioco)? */
  isInEvent(code) {
    return !!this.user && !!code && this.event?.invite_code?.toUpperCase() === code.toUpperCase();
  }

  /** URL di una tab del gioco del matrimonio corrente. */
  gameUrl(tab = 'home') {
    return gameUrl(this.event?.invite_code, tab);
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

  /** Recupera la sessione salvata (una sola volta): lo attende il layout radice prima di ogni pagina. */
  ready() {
    this._initPromise ??= this._init();
    return this._initPromise;
  }

  async _init() {
    if (!this.hasSession) return;
    try {
      const res = await api.getMe();
      this._saveTokens(null, null, res.account, res.refresh_token);
      // Senza token di un matrimonio si è solo "account": i dati di gioco non servono.
      if (!this.token || !res.user) return;

      this.setUser(res.user);
      this.event = res.event || null;
      if (this.event && !this.event.invite_code) {
        try {
          const inv = await api.getEventInvite();
          if (inv?.invite_code) this.event.invite_code = inv.invite_code;
        } catch (_) {}
      }
      await this.loadInitialData();
    } catch (err) {
      console.warn('Session restoration failed:', err);
      this._clearAll();
    }
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

  async finishOnboarding(target = 'home') {
    this.pendingInvite = null;
    if (target === 'dashboard') return goto(dashboardUrl(this.event?.id));
    await this.loadInitialData();
    return goto(this.gameUrl('home'), { replace: true });
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
      const keepAccount = this.jwtToken && this.account;
      this.showToast(keepAccount ? 'Creazione annullata. L’account è ancora attivo.' : 'Creazione annullata.', 'info');
      goto(keepAccount ? ROUTES.dashboard : ROUTES.home);
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
      await this.loadInitialData();
      await goto(this.gameUrl('home'), { replace: true });
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

  /** Dalla dashboard: apre un matrimonio dell'account (tab di gioco o 'setup' per gli sposi). */
  async selectEvent(eventItem, targetTab = 'home') {
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
      await goto(this.gameUrl(targetTab));
      this.showToast(`Entrato nel matrimonio di ${this.event.spouse1_name} & ${this.event.spouse2_name}`, 'info');
    } catch (err) {
      console.error('Errore selezione evento:', err);
      this.showToast('Impossibile entrare nell\'evento', 'error');
    }
  }

  // ── Account ───────────────────────────────────────────────────────────────

  /**
   * Dopo un login/registrazione riuscito. Con `redirect` (default) porta alla dashboard utente
   * (o al matrimonio del link d'invito); senza resta nella pagina corrente.
   */
  async _completeAccountAuth(res, { redirect = true, toast = '' } = {}) {
    this._saveTokens(null, res.jwt, res.account);
    if (toast) this.showToast(toast, 'success');
    if (!redirect) return;

    if (this.pendingJoinCode) {
      // L'ospite era arrivato da un link d'invito: torna al form con il codice gia' inserito.
      const code = this.pendingJoinCode;
      this.pendingJoinCode = null;
      return goto(joinUrl(code));
    }
    // Scollega lo stato di gioco del singolo matrimonio
    this._clearGame();
    return goto(ROUTES.dashboard);
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

  _clearAll() {
    this.pendingInvite = null;
    this._clearEventSession();
    this._clearGame();
    this.jwtToken = null;
    this.account = null;
    this.dashboardEvents = [];
    localStorage.removeItem('fm_jwt_token');
  }

  logout() {
    this._clearAll();
    return goto(ROUTES.home);
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

  /** Punteggio e classifica live mentre si è dentro il gioco (lo avvia il layout del gioco). */
  startPolling() {
    if (this.pollingTimer) return;
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
