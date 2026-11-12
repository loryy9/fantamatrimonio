import { api } from './api.js';
import { fireCelebration } from './confetti.js';
import { formatName } from './formatters.js';
import { DEFAULT_PHOTO_CHALLENGES, PRESET_QUIZZES, PRESET_HUNTS, PRESET_MOMENTS } from './challengePresets.js';

function readAuthView() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) return 'join';
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/partita/')) return 'entry';
    if (path === '/crea') return 'create';
    if (path === '/entra') return 'join';
    if (path === '/dashboard_utente' || path === '/login' || path === '/dashboard') return 'login-secure';
  }

  return 'entry';
}

class AppState {
  authView = $state(readAuthView()); // 'entry' | 'join' | 'create' | 'login-secure' | 'dashboard'
  pendingInvite = $state(null); // invite code shown right after creating an event
  pendingJoinCode = null; // codice invito di un link, ricordato se l'ospite passa dal login classico
  user = $state(null);
  event = $state(null);
  account = $state(null); // account dell'utente (email/password o social)
  token = $state(localStorage.getItem('fm_auth_token') || null);
  refreshToken = $state(localStorage.getItem('fm_refresh_token') || null);
  jwtToken = $state(localStorage.getItem('fm_jwt_token') || null);
  isLoadingAuth = $state(true);
  activeTab = $state(readAuthView());
  quizSubTab = $state('quiz'); // 'quiz' | 'vote'
  showInstructionsModal = $state(false);
  refreshTimer = null;

  challenges = $state([]);
  setupChallenges = $state([]);
  mySubmissions = $state([]);
  leaderboard = $state([]);
  galleryPhotos = $state([]);

  // Dashboard state
  dashboardEvents = $state([]);
  dashboardLoading = $state(false);

  toasts = $state([]);
  isPolling = $state(false);
  pollingTimer = null;

  get gameRoute() {
    const code = this.event?.invite_code?.trim().toUpperCase();
    return code && this.activeTab ? `/partita/${encodeURIComponent(code)}/${this.activeTab}` : '/';
  }

  setGameTab(tab, replace = false) {
    const allowed = ['home', 'gallery', 'hunt', 'quiz', 'leaderboard', 'setup'];
    if (!allowed.includes(tab) || (tab === 'setup' && !this.isCouple)) return;
    this.activeTab = tab;
    if (this.event?.invite_code && typeof window !== 'undefined') {
      const method = replace ? 'replaceState' : 'pushState';
      history[method](null, '', this.gameRoute);
    }
  }

  get isAuthenticated() {
    return (!!this.token || !!this.jwtToken) && (!!this.user || !!this.account);
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
      this.activeTab !== 'dashboard' &&
      this.activeTab !== 'create' &&
      this.activeTab !== 'join' &&
      this.activeTab !== 'entry' &&
      this.activeTab !== 'login-secure' &&
      (this.activeTab !== 'setup' || this.isCouple) &&
      ['home', 'gallery', 'hunt', 'quiz', 'leaderboard', 'setup'].includes(this.activeTab)
    );
  }

  get mySubmissionsByChallenge() {
    const map = {};
    for (const sub of this.mySubmissions) {
      if (sub.challenge_id) {
        map[sub.challenge_id] = sub;
      }
    }
    return map;
  }

  get myRank() {
    if (!this.user || !this.leaderboard.length || this.isCouple) return null;
    const entry = this.leaderboard.find(item => item.id === this.user.id);
    return entry ? entry.rank : null;
  }

  showToast(text, type = 'info', points = null) {
    const id = Date.now() + Math.random();
    this.toasts.push({ id, text, type, points });
    if (points && points > 0) {
      fireCelebration();
    }
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
    }, 4000);
  }

  removeToast(id) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

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
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (!expiresInSeconds || expiresInSeconds <= 0) return;
    // Rinfresca prima della scadenza (all'80% del TTL, min 10s)
    const delayMs = Math.max(10000, expiresInSeconds * 0.8 * 1000);
    this.refreshTimer = setTimeout(() => {
      this.refreshSessionToken();
    }, delayMs);
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
    if (account) {
      this.account = account;
    }
    if (expiresIn) {
      this._scheduleAutoRefresh(expiresIn);
    }
  }

  async init() {
    this.isLoadingAuth = true;
    try {
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const codeParam = urlParams?.get('code')?.trim();

      // Link d'invito: se c'e' gia' un account lo recuperiamo, cosi' si salta il login.
      if (codeParam) {
        this.authView = 'join';
        this.activeTab = 'join';
        if (this.jwtToken) {
          try {
            const res = await api.getMe();
            if (res.account) this.account = res.account;
          } catch (_) {
            this.logout();
            this.authView = 'join';
            this.activeTab = 'join';
          }
        }
        this.isLoadingAuth = false;
        return;
      }

      const path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
      if (this.token || this.jwtToken) {
        try {
          const res = await api.getMe();
          if (res.account) {
            this.account = res.account;
          }
          if (res.refresh_token) {
            this.refreshToken = res.refresh_token;
            localStorage.setItem('fm_refresh_token', res.refresh_token);
          }

          if (this.jwtToken && !this.token) {
            this.user = null;
            this.event = null;
            this.activeTab = 'dashboard';
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

  syncRouteFromUrl() {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname.toLowerCase();
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code')?.trim();
    if (this.pendingInvite) return;

    if (codeParam) {
      this.authView = 'join';
      this.activeTab = 'join';
      return;
    }

    const gameMatch = path.match(/^\/partita\/([^/]+)(?:\/([^/]+))?\/?$/);
    if (gameMatch) {
      const routeCode = decodeURIComponent(gameMatch[1]).toUpperCase();
      const tab = gameMatch[2] || 'home';
      const allowed = ['home', 'gallery', 'hunt', 'quiz', 'leaderboard', 'setup'];
      if (this.event?.invite_code?.toUpperCase() === routeCode && tab === 'setup' && !this.isCouple) {
        this.activeTab = 'home';
        history.replaceState(null, '', `/partita/${encodeURIComponent(routeCode)}/home`);
        return;
      }
      if (this.event?.invite_code?.toUpperCase() === routeCode && tab === 'manage') {
        this.activeTab = 'home';
        history.replaceState(null, '', `/partita/${encodeURIComponent(routeCode)}/home`);
        return;
      }
      if (this.event?.invite_code?.toUpperCase() === routeCode && allowed.includes(tab)) {
        this.authView = 'entry';
        this.activeTab = tab;
        return;
      }
    }

    if (path === '/crea') {
      this.authView = 'create';
      this.activeTab = 'create';
    } else if (path === '/entra') {
      this.authView = 'join';
      this.activeTab = 'join';
    } else if (path === '/dashboard_utente' || path === '/login' || path === '/dashboard') {
      if (this.hasAccount) {
        this.authView = 'dashboard';
        this.activeTab = 'dashboard';
        this.loadDashboardEvents();
      } else {
        this.authView = 'login-secure';
        this.activeTab = 'login-secure';
      }
    } else if (path === '/' && !this.isInGame) {
      if (this.hasAccount && !this.event) {
        this.activeTab = 'dashboard';
        this.authView = 'dashboard';
        this.loadDashboardEvents();
      } else {
        this.authView = 'entry';
        this.activeTab = 'entry';
      }
    }
  }

  openDashboard(eventId = null) {
    this.activeTab = 'dashboard';
    this.authView = 'dashboard';
    this.stopPolling();
    const eventQuery = eventId ? `?event=${encodeURIComponent(eventId)}` : '';
    history.pushState(null, '', `/dashboard_utente${eventQuery}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setAuthView(view) {
    if (typeof window !== 'undefined') {
      const urlCode = new URLSearchParams(window.location.search).get('code');
      if (view === 'login-secure' && urlCode) this.pendingJoinCode = urlCode.trim().toUpperCase();
      else if (view === 'entry' || view === 'create') this.pendingJoinCode = null;
    }
    this.authView = view;
    if (view === 'create') {
      this.activeTab = 'create';
    } else if (view === 'join') {
      this.activeTab = 'join';
    } else if (view === 'login-secure') {
      this.activeTab = 'login-secure';
    } else if (view === 'dashboard') {
      this.activeTab = 'dashboard';
    } else if (view === 'entry') {
      this.activeTab = 'entry';
    }
    const pathMap = {
      'create': '/crea',
      'join': '/entra',
      'login-secure': '/dashboard_utente',
      'dashboard': '/dashboard_utente',
      'entry': '/',
    };
    const path = pathMap[view] || '/';
    const search = view === 'join' ? window.location.search : '';
    history.pushState(null, '', path + search);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async createEvent(payload) {
    try {
      const res = await api.createEvent(payload);
      this._saveTokens(res.token, res.jwt, res.account);
      this.setUser(res.user);
      this.event = {
        ...(res.event || {}),
        invite_code: res.invite_code || res.event?.invite_code
      };
      this.pendingInvite = res.invite_code;
      return { success: true };
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
    this.authView = 'entry';
    this.setGameTab(targetTab || 'home', true);
    await this.loadInitialData();
    this.startPolling();
  }

  async cancelEventCreation() {
    try {
      if (this.token) {
        await api.deleteMyEvent();
      }
    } catch (err) {
      console.warn('Errore cancellazione evento:', err);
    } finally {
      this.pendingInvite = null;
      this.token = null;
      this.refreshToken = null;
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      this.setUser(null);
      this.event = null;
      this.challenges = [];
      this.mySubmissions = [];
      this.leaderboard = [];
      this.galleryPhotos = [];
      localStorage.removeItem('fm_auth_token');
      localStorage.removeItem('fm_refresh_token');
      this.stopPolling();
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

      if (this.isCouple) {
        const coupleNames = [this.event?.spouse1_name, this.event?.spouse2_name].filter(Boolean).join(' & ');
        this.showToast(coupleNames ? `Bentornati ${coupleNames}!` : 'Bentornati Sposi!', 'success');
        this.setGameTab('home', true);
      } else if (res.is_new) {
        this.showToast(`Benvenuto/a ${this.user.first_name}!`, 'success');
        this.setGameTab('home', true);
      } else {
        this.showToast(`Bentornato/a ${this.user.first_name}!`, 'success');
        this.setGameTab('home', true);
      }

      this.authView = 'entry';
      this.pendingJoinCode = null;
      history.replaceState(null, '', this.gameRoute);
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

  /**
   * Dopo un login/registrazione riuscito. Con `redirect` (default) porta alla dashboard utente;
   * senza resta nella schermata corrente (es. "entra con codice" o "crea matrimonio").
   */
  async _completeAccountAuth(res, { redirect = true, toast = '' } = {}) {
    this._saveTokens(null, res.jwt, res.account);
    this.account = res.account;

    if (redirect && this.pendingJoinCode) {
      // L'ospite era arrivato da un link d'invito: lo riportiamo al form con il codice gia' inserito.
      const code = this.pendingJoinCode;
      this.pendingJoinCode = null;
      this.authView = 'join';
      this.activeTab = 'join';
      history.pushState(null, '', `/entra?code=${encodeURIComponent(code)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      if (toast) this.showToast(toast, 'success');
      return;
    }

    if (redirect) {
      // Resetta e scollega qualsiasi sessione / stato di gioco del singolo matrimonio
      this.user = null;
      this.event = null;
      this.challenges = [];
      this.mySubmissions = [];
      this.leaderboard = [];
      this.galleryPhotos = [];
      this.stopPolling();

      this.activeTab = 'dashboard';
      history.pushState(null, '', '/dashboard_utente');
      window.dispatchEvent(new PopStateEvent('popstate'));
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

  async selectEvent(eventItem, targetTab = null) {
    const eventId = eventItem?.event?.id || eventItem?.id;
    if (!eventId) return;
    try {
      const res = await api.getMe(eventId, this.jwtToken);
      if (res.user) {
        if (res.token) {
          this._saveTokens(res.token, this.jwtToken, this.account, res.refresh_token);
        }
        this.setUser(res.user);
        this.event = res.event;
        if (targetTab === 'setup') {
          const existing = await api.getChallenges(true);
          this.setupChallenges = await this.ensureStarterChallenges(existing);
          this.challenges = this.setupChallenges.filter(ch => ch.active !== false);
        } else {
          await this.loadInitialData();
        }
        this.authView = 'entry';
        this.setGameTab(targetTab || 'home', true);
        this.startPolling();
        this.showToast(`Entrato nel matrimonio di ${this.event.spouse1_name} & ${this.event.spouse2_name}`, 'info');
      } else {
        this.showToast('Nessun profilo trovato per questo matrimonio', 'error');
      }
    } catch (err) {
      console.error('Errore selezione evento:', err);
      this.showToast('Impossibile entrare nell\'evento', 'error');
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
    this.token = null;
    this.refreshToken = null;
    this.jwtToken = null;
    this.account = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.setUser(null);
    this.event = null;
    this.challenges = [];
    this.mySubmissions = [];
    this.leaderboard = [];
    this.galleryPhotos = [];
    this.dashboardEvents = [];
    localStorage.removeItem('fm_auth_token');
    localStorage.removeItem('fm_refresh_token');
    localStorage.removeItem('fm_jwt_token');
    this.stopPolling();
    this.activeTab = 'entry';
    this.setAuthView('entry');
  }

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
    if (!this.token && !this.jwtToken) return;
    try {
      const res = await api.getMe();
      if (!silent && this.user && res.user.total_points > this.user.total_points) {
        const diff = res.user.total_points - this.user.total_points;
        this.showToast(`Hai guadagnato +${diff} punti!`, 'success', diff);
      }
      this.setUser(res.user);
      this.event = res.event || this.event;
      if (res.account) {
        this.account = res.account;
      }
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  }

  async refreshChallenges() {
    if (!this.token && !this.jwtToken) return;
    try {
      this.challenges = await api.getChallenges();
    } catch (err) {
      console.error('Failed to load challenges', err);
    }
  }

  async refreshMySubmissions() {
    if (!this.token && !this.jwtToken) return;
    try {
      this.mySubmissions = await api.getMySubmissions();
    } catch (err) {
      console.error('Failed to load submissions', err);
    }
  }

  async refreshLeaderboard() {
    if (!this.token && !this.jwtToken) return;
    try {
      const data = await api.getLeaderboard();
      this.leaderboard = data.map(item => ({
        ...item,
        first_name: formatName(item.first_name),
        last_name: formatName(item.last_name)
      }));
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    }
  }

  async refreshGallery(force = false) {
    if (!this.token && !this.jwtToken) return;
    try {
      const data = await api.getGallery();
      // Evita di rimpiazzare l'array (e rieseguire il render di tutte le immagini) se non ci sono nuove foto
      if (!force && this.galleryPhotos.length === data.length && this.galleryPhotos[0]?.id === data[0]?.id) {
        return;
      }
      this.galleryPhotos = data.map(photo => ({
        ...photo,
        first_name: formatName(photo.first_name),
        last_name: formatName(photo.last_name)
      }));
    } catch (err) {
      console.error('Failed to load gallery', err);
    }
  }

  startPolling() {
    if (this.pollingTimer) return;
    this.isPolling = true;
    // Polling ogni 20 secondi per punteggio e classifica live
    this.pollingTimer = setInterval(async () => {
      if (this.isAuthenticated) {
        await Promise.allSettled([
          this.refreshUser(true),
          this.refreshLeaderboard()
        ]);
      }
    }, 20000);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
  }
}

export const appState = new AppState();
