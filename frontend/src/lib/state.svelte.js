import { goto } from '$app/navigation';
import { page } from '$app/state';
import { api } from './api.js';
import { RealtimeClient } from './realtime.js';
import { fireCelebration } from './confetti.js';
import { formatName } from './formatters.js';

// Ogni "tab" dell'app corrisponde a una route SvelteKit: l'URL è la fonte di verità.
export const TAB_PATHS = {
  entry: '/',
  create: '/crea',
  join: '/entra',
  'login-secure': '/login',
  dashboard: '/dashboard',
  home: '/gioco/home',
  gallery: '/gioco/gallery',
  hunt: '/gioco/hunt',
  quiz: '/gioco/quiz',
  leaderboard: '/gioco/leaderboard',
  manage: '/gioco/manage',
};

export const GAME_TABS = ['home', 'gallery', 'hunt', 'quiz', 'leaderboard', 'manage'];

function normalizePath(pathname) {
  const p = (pathname || '/').toLowerCase();
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

function tabFromPath(pathname) {
  const p = normalizePath(pathname);
  const found = Object.entries(TAB_PATHS).find(([, path]) => path === p);
  return found ? found[0] : 'entry';
}

class AppState {
  pendingInvite = $state(null); // invite code shown right after creating an event
  user = $state(null);
  event = $state(null);
  account = $state(null); // account registrato (email + password)
  token = $state(localStorage.getItem('fm_auth_token') || null);
  jwtToken = $state(localStorage.getItem('fm_jwt_token') || null);
  isLoadingAuth = $state(true);
  quizSubTab = $state('quiz'); // 'quiz' | 'vote'
  showInstructionsModal = $state(false);
  showUpgradeModal = $state(false); // modal per registrazione account
  showClaimModal = $state(false); // modal per completamento account da link email
  pendingClaimToken = $state(null);
  claimData = $state(null);

  challenges = $state([]);
  mySubmissions = $state([]);
  leaderboard = $state([]);
  galleryPhotos = $state([]);

  // Dashboard state
  dashboardEvents = $state([]);
  dashboardLoading = $state(false);

  toasts = $state([]);
  isPolling = $state(false);
  pollingTimer = null;
  realtimeConnected = $state(false);
  realtime = null;
  realtimeTopics = [];
  leaderboardTimer = null;

  // Tab corrente, derivato dall'URL. Assegnarlo naviga alla route corrispondente.
  get activeTab() {
    return tabFromPath(page.url.pathname);
  }

  set activeTab(tab) {
    goto(TAB_PATHS[tab] ?? '/');
  }

  // 'entry' | 'join' | 'create' | 'login-secure' | 'dashboard' (o una tab di gioco)
  get authView() {
    const tab = this.activeTab;
    return GAME_TABS.includes(tab) ? 'entry' : tab;
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
    return Boolean(this.event && this.user && !this.pendingInvite && GAME_TABS.includes(this.activeTab));
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
    this.user = {
      ...u,
      first_name: formatName(u.first_name),
      last_name: formatName(u.last_name)
    };
  }

  _saveTokens(sessionToken, jwt, account) {
    if (sessionToken) {
      this.token = sessionToken;
      localStorage.setItem('fm_auth_token', sessionToken);
    }
    if (jwt) {
      this.jwtToken = jwt;
      localStorage.setItem('fm_jwt_token', jwt);
    }
    if (account) {
      this.account = account;
    }
  }

  async init() {
    this.isLoadingAuth = true;
    try {
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const claimParam = urlParams?.get('claim')?.trim() || urlParams?.get('claim_token')?.trim();
      const codeParam = urlParams?.get('code')?.trim();

      // Se l'utente clicca il link ricevuto via mail (claim token)
      if (claimParam) {
        await this.resolveClaim(claimParam);
        this.isLoadingAuth = false;
        return;
      }

      // Link di invito condiviso (/?code=XXXX): porta alla pagina "Entra"
      if (codeParam) {
        if (normalizePath(window.location.pathname) === '/') {
          await goto('/entra' + window.location.search, { replaceState: true });
        }
        this.isLoadingAuth = false;
        return;
      }

      if (this.token || this.jwtToken) {
        try {
          const res = await api.getMe();
          if (res.account) {
            this.account = res.account;
          }

          if (this.jwtToken && !this.token) {
            this.user = null;
            this.event = null;
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

      if (urlParamsHas(urlParams, 'upgrade', '1') && (this.user || this.token)) {
        this.showUpgradeModal = true;
      }

      // Dalla landing "/" rientra direttamente nella propria area
      if (normalizePath(window.location.pathname) === '/') {
        if (this.user && this.event) {
          await goto(TAB_PATHS[this.isCouple ? 'manage' : 'home'], { replaceState: true });
        } else if (this.hasAccount) {
          await goto(TAB_PATHS.dashboard, { replaceState: true });
        }
      }
    } catch (err) {
      console.error('Fatal init error:', err);
    } finally {
      this.isLoadingAuth = false;
    }
  }

  openDashboard() {
    this.stopPolling();
    goto(TAB_PATHS.dashboard);
    this.loadDashboardEvents();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setAuthView(view) {
    const path = TAB_PATHS[view] || '/';
    const search = view === 'join' ? window.location.search : '';
    goto(path + search);
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
    await goto(TAB_PATHS[targetTab || (this.isCouple ? 'manage' : 'home')], { replaceState: true });
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
      this.jwtToken = null;
      this.account = null;
      this.setUser(null);
      this.event = null;
      this.challenges = [];
      this.mySubmissions = [];
      this.leaderboard = [];
      this.galleryPhotos = [];
      localStorage.removeItem('fm_auth_token');
      localStorage.removeItem('fm_jwt_token');
      this.stopPolling();
      this.setAuthView('entry');
      this.showToast('Creazione annullata. Tutti i dati sono stati rimossi.', 'info');
    }
  }

  async login(payload, argFirst, argLast, argSecret, argCouple = false, argEmail = null) {
    try {
      const res = await api.login(payload, argFirst, argLast, argSecret, argCouple, argEmail);
      this._saveTokens(res.token, res.jwt, res.account);
      this.setUser(res.user);
      const code = typeof payload === 'object' && payload !== null ? (payload.inviteCode || payload.invite_code) : payload;
      this.event = {
        ...(res.event || {}),
        invite_code: res.event?.invite_code || (code ? code.trim().toUpperCase() : '')
      };

      const storageKey = `fm_logged_in_before_${this.user.id}`;
      const isFirstTime = res.is_new === true || (!localStorage.getItem(storageKey) && res.is_new !== false);

      let targetTab = 'home';
      if (this.isCouple) {
        const coupleNames = [this.event?.spouse1_name, this.event?.spouse2_name].filter(Boolean).join(' & ');
        this.showToast(coupleNames ? `Bentornati ${coupleNames}!` : 'Bentornati Sposi!', 'success');
        targetTab = 'manage';
      } else if (isFirstTime) {
        this.showToast(`Benvenuto/a ${this.user.first_name}!`, 'success');
      } else {
        this.showToast(`Bentornato/a ${this.user.first_name}!`, 'success');
      }

      localStorage.setItem(storageKey, 'true');
      await goto(TAB_PATHS[targetTab]);

      await this.loadInitialData();
      this.startPolling();
      return { success: true };
    } catch (err) {
      this.showToast(err.message || 'Errore durante l\'accesso', 'error');
      return { success: false, error: err.message };
    }
  }

  async loginSecure(email, password) {
    try {
      const res = await api.loginSecure(email, password);
      this._saveTokens(null, res.jwt, res.account);
      this.account = res.account;

      // Resetta e scollega qualsiasi sessione / stato di gioco del singolo matrimonio
      this.user = null;
      this.event = null;
      this.challenges = [];
      this.mySubmissions = [];
      this.leaderboard = [];
      this.galleryPhotos = [];
      this.stopPolling();

      // Vai SEMPRE e subito alla dashboard utente!
      await goto(TAB_PATHS.dashboard);

      // Carica i dati dashboard
      await this.loadDashboardEvents();

      this.showToast(`Bentornato/a ${res.account.display_name}!`, 'success');

      return { success: true, events: res.events || [] };
    } catch (err) {
      this.showToast(err.message || 'Email o password non corretti', 'error');
      return { success: false, error: err.message };
    }
  }

  async register(email, password, displayName, verificationCode = null) {
    try {
      const res = await api.register(email, password, displayName, verificationCode);
      this._saveTokens(null, res.jwt, res.account);
      this.account = res.account;

      // Resetta e scollega qualsiasi sessione / stato di gioco del singolo matrimonio
      this.user = null;
      this.event = null;
      this.challenges = [];
      this.mySubmissions = [];
      this.leaderboard = [];
      this.galleryPhotos = [];
      this.stopPolling();

      await goto(TAB_PATHS.dashboard);

      await this.loadDashboardEvents();
      this.showToast('Account creato con successo!', 'success');
      return { success: true };
    } catch (err) {
      this.showToast(err.message || 'Errore nella registrazione', 'error');
      return { success: false, error: err.message };
    }
  }

  async selectEvent(eventItem, targetTab = null) {
    const eventId = eventItem?.event?.id || eventItem?.id;
    if (!eventId) return;
    try {
      const res = await api.getMe(eventId);
      if (res.user) {
        if (res.token) {
          this._saveTokens(res.token, this.jwtToken, this.account);
        }
        this.setUser(res.user);
        this.event = res.event;
        await goto(TAB_PATHS[targetTab || ((res.user.role === 'couple') ? 'manage' : 'home')]);
        await this.loadInitialData();
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

  async resolveClaim(claimToken) {
    try {
      const res = await api.getClaimInfo(claimToken);
      if (res.token) {
        this.token = res.token;
        localStorage.setItem('fm_auth_token', res.token);
      }
      if (res.user) {
        this.setUser(res.user);
      }
      if (res.event) {
        this.event = res.event;
      }
      if (res.already_registered) {
        if (res.jwt) {
          this.jwtToken = res.jwt;
          localStorage.setItem('fm_jwt_token', res.jwt);
        }
        if (res.account) {
          this.account = res.account;
        }
        this.showToast('Bentornato! Il tuo account è già registrato.', 'success');
        this.openDashboard();
        return;
      }

      this.pendingClaimToken = claimToken;
      this.claimData = res;
      this.showClaimModal = true;
      if (this.event) {
        await this.loadInitialData();
      }
    } catch (err) {
      console.error('Errore claim link:', err);
      this.showToast(err.message || 'Il link via email non è valido o è scaduto.', 'error');
    }
  }

  async completeClaim(password, firstName = null, lastName = null, displayName = null) {
    if (!this.pendingClaimToken) {
      return { success: false, error: 'Token di recupero non trovato' };
    }
    try {
      const res = await api.completeClaim(this.pendingClaimToken, password, firstName, lastName, displayName);
      this._saveTokens(res.token, res.jwt, res.account);
      if (res.user) this.setUser(res.user);
      if (res.event) this.event = res.event;
      this.showClaimModal = false;
      this.pendingClaimToken = null;
      this.claimData = null;
      this.showToast('Account registrato con successo! Benvenuto nella tua dashboard!', 'success');
      this.openDashboard();
      return { success: true };
    } catch (err) {
      this.showToast(err.message || 'Errore nella creazione account', 'error');
      return { success: false, error: err.message };
    }
  }

  async upgradeAccount(email, password, displayName = null, verificationCode = null) {
    try {
      const res = await api.upgradeAccount(email, password, displayName, verificationCode);
      this._saveTokens(null, res.jwt, res.account);
      this.showUpgradeModal = false;
      this.showToast('Account registrato! Ora puoi accedere con email e password.', 'success');
      this.openDashboard();
      return { success: true };
    } catch (err) {
      this.showToast(err.message || 'Errore nell\'upgrade', 'error');
      return { success: false, error: err.message };
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
    this.jwtToken = null;
    this.account = null;
    this.setUser(null);
    this.event = null;
    this.challenges = [];
    this.mySubmissions = [];
    this.leaderboard = [];
    this.galleryPhotos = [];
    this.dashboardEvents = [];
    localStorage.removeItem('fm_auth_token');
    localStorage.removeItem('fm_jwt_token');
    this.stopPolling();
    this.setAuthView('entry');
  }

  async loadInitialData() {
    await Promise.allSettled([
      this.refreshChallenges(),
      this.refreshMySubmissions(),
      this.refreshLeaderboard(),
      this.refreshGallery()
    ]);
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
    this._startRealtime();
    if (this.pollingTimer) return;
    this.isPolling = true;
    // Fallback: polling ogni 20 secondi solo se il WebSocket non è connesso
    this.pollingTimer = setInterval(async () => {
      if (this.isAuthenticated && !this.realtimeConnected) {
        await Promise.allSettled([
          this.refreshUser(true),
          this.refreshLeaderboard()
        ]);
      }
    }, 20000);
  }

  stopPolling() {
    this.realtime?.disconnect();
    this.realtime = null;
    clearTimeout(this.leaderboardTimer);
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
  }

  _startRealtime() {
    if (this.realtime) return;
    let everOpened = false;
    this.realtime = new RealtimeClient({
      getToken: () => this.jwtToken || this.token,
      onStatus: (connected) => { this.realtimeConnected = connected; },
      onMessage: (msg) => this._onRealtimeMessage(msg),
      onOpen: () => {
        // Dopo una riconnessione si riallineano i dati che potrebbero essere stati persi
        if (everOpened) this._resyncRealtime();
        everOpened = true;
      }
    });
    this.realtime.setTopics(this.realtimeTopics);
    this.realtime.connect();
  }

  // Topic in base alla pagina: la classifica serve sempre (rank e punti), la galleria solo nella sua tab
  setRealtimeTab(tab) {
    const topics = ['leaderboard'];
    if (tab === 'gallery') topics.push('gallery');
    const enteringGallery = tab === 'gallery' && !this.realtimeTopics.includes('gallery');
    this.realtimeTopics = topics;
    this.realtime?.setTopics(topics);
    // Le foto arrivate mentre non si era iscritti al topic vanno recuperate
    if (enteringGallery && this.isAuthenticated) this.refreshGallery();
  }

  _resyncRealtime() {
    this.refreshUser(true);
    this.refreshLeaderboard();
    if (this.realtimeTopics.includes('gallery')) this.refreshGallery();
  }

  _onRealtimeMessage(msg) {
    switch (msg.type) {
      case 'photo_added': {
        const photo = msg.photo;
        // Le proprie foto sono già gestite dall'upload (aggiornamento ottimistico)
        if (!photo || photo.user_id === this.user?.id) return;
        if (this.galleryPhotos.some(p => p.id === photo.id)) return;
        this.galleryPhotos = [{
          ...photo,
          first_name: formatName(photo.first_name),
          last_name: formatName(photo.last_name)
        }, ...this.galleryPhotos];
        break;
      }
      case 'photo_removed':
        this.galleryPhotos = this.galleryPhotos.filter(p => p.id !== msg.id);
        break;
      case 'leaderboard_changed':
        // Debounce: più eventi ravvicinati producono un solo refresh
        clearTimeout(this.leaderboardTimer);
        this.leaderboardTimer = setTimeout(() => {
          this.refreshUser(true);
          this.refreshLeaderboard();
        }, 300);
        break;
    }
  }
}

function urlParamsHas(params, key, value) {
  return params?.get(key) === value;
}

export const appState = new AppState();
