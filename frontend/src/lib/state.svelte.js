import { api } from './api.js';
import { fireCelebration } from './confetti.js';
import { formatName } from './formatters.js';

function readAuthView() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) return 'join';
    const path = window.location.pathname.toLowerCase();
    if (path === '/crea') return 'create';
    if (path === '/entra') return 'join';
    if (path === '/dashboard_utente' || path === '/login' || path === '/dashboard') return 'login-secure';
  }
  return 'entry';
}

class AppState {
  authView = $state(readAuthView()); // 'entry' | 'join' | 'create' | 'login-secure' | 'dashboard'
  pendingInvite = $state(null); // invite code shown right after creating an event
  user = $state(null);
  event = $state(null);
  account = $state(null); // account registrato (email + password)
  token = $state(localStorage.getItem('fm_auth_token') || null);
  jwtToken = $state(localStorage.getItem('fm_jwt_token') || null);
  isLoadingAuth = $state(true);
  activeTab = $state(readAuthView());
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
      ['home', 'gallery', 'hunt', 'quiz', 'leaderboard', 'manage'].includes(this.activeTab)
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

      if (codeParam) {
        this.authView = 'join';
        this.activeTab = 'join';
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
    const claimParam = urlParams.get('claim')?.trim() || urlParams.get('claim_token')?.trim();
    const codeParam = urlParams.get('code')?.trim();
    if (this.pendingInvite) return;

    if (claimParam && !this.showClaimModal && !this.claimData) {
      this.resolveClaim(claimParam);
      return;
    }

    if (urlParams.get('upgrade') === '1' && (this.user || this.token)) {
      this.showUpgradeModal = true;
    }

    if (codeParam) {
      this.authView = 'join';
      this.activeTab = 'join';
      return;
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

  openDashboard() {
    this.activeTab = 'dashboard';
    this.authView = 'dashboard';
    this.stopPolling();
    history.pushState(null, '', '/dashboard_utente');
    window.dispatchEvent(new PopStateEvent('popstate'));
    this.loadDashboardEvents();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setAuthView(view) {
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
    this.authView = 'entry';
    this.activeTab = targetTab || (this.isCouple ? 'manage' : 'home');
    history.replaceState(null, '', '/');
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

  async login(inviteCode, firstName, lastName, secretWord, isCouple = false, email = null) {
    try {
      const res = await api.login(inviteCode, firstName, lastName, secretWord, isCouple, email);
      this._saveTokens(res.token, res.jwt, res.account);
      this.setUser(res.user);
      this.event = {
        ...(res.event || {}),
        invite_code: res.event?.invite_code || inviteCode.trim().toUpperCase()
      };

      const storageKey = `fm_logged_in_before_${this.user.id}`;
      const isFirstTime = res.is_new === true || (!localStorage.getItem(storageKey) && res.is_new !== false);

      if (this.isCouple) {
        const coupleNames = [this.event?.spouse1_name, this.event?.spouse2_name].filter(Boolean).join(' & ');
        this.showToast(coupleNames ? `Bentornati ${coupleNames}!` : 'Bentornati Sposi!', 'success');
        this.activeTab = 'manage';
      } else if (isFirstTime) {
        this.showToast(`Benvenuto/a ${this.user.first_name}!`, 'success');
        this.activeTab = 'home';
      } else {
        this.showToast(`Bentornato/a ${this.user.first_name}!`, 'success');
        this.activeTab = 'home';
      }

      this.authView = 'entry';
      history.pushState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));

      localStorage.setItem(storageKey, 'true');

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
      this.activeTab = 'dashboard';
      history.pushState(null, '', '/dashboard_utente');
      window.dispatchEvent(new PopStateEvent('popstate'));

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

      this.activeTab = 'dashboard';
      history.pushState(null, '', '/dashboard_utente');
      window.dispatchEvent(new PopStateEvent('popstate'));

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
        this.authView = 'entry';
        this.activeTab = targetTab || ((res.user.role === 'couple') ? 'manage' : 'home');
        history.pushState(null, '', '/');
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
      this.syncRouteFromUrl();
    }
  }

  async completeClaim(password, displayName = null) {
    if (!this.pendingClaimToken) {
      return { success: false, error: 'Token di recupero non trovato' };
    }
    try {
      const res = await api.completeClaim(this.pendingClaimToken, password, displayName);
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
    this.activeTab = 'entry';
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
