import { api } from './api.js';
import { fireCelebration } from './confetti.js';
import { formatName } from './formatters.js';

class AppState {
  user = $state(null);
  token = $state(localStorage.getItem('fm_auth_token') || null);
  isLoadingAuth = $state(true);
  activeTab = $state('home');
  quizSubTab = $state('quiz'); // 'quiz' | 'vote'
  showInstructionsModal = $state(false);

  challenges = $state([]);
  mySubmissions = $state([]);
  leaderboard = $state([]);
  galleryPhotos = $state([]);

  toasts = $state([]);
  isPolling = $state(false);
  pollingTimer = null;

  get isAuthenticated() {
    return !!this.token && !!this.user;
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
    if (!this.user || !this.leaderboard.length) return null;
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

  async init() {
    this.isLoadingAuth = true;
    if (this.token) {
      try {
        const res = await api.getMe();
        this.setUser(res.user);
        await this.loadInitialData();
        this.startPolling();
      } catch (err) {
        console.warn('Session restoration failed:', err);
        this.logout();
      }
    }
    this.isLoadingAuth = false;
  }

  async login(firstName, lastName, secretWord) {
    try {
      const res = await api.login(firstName, lastName, secretWord);
      this.token = res.token;
      this.setUser(res.user);
      localStorage.setItem('fm_auth_token', res.token);

      const storageKey = `fm_logged_in_before_${this.user.id}`;
      const isFirstTime = res.is_new === true || (!localStorage.getItem(storageKey) && res.is_new !== false);

      if (isFirstTime) {
        this.showToast(`Benvenuto/a ${this.user.first_name}! 🎉`, 'success');
      } else {
        this.showToast(`Bentornato/a ${this.user.first_name}! 🎉`, 'success');
      }

      localStorage.setItem(storageKey, 'true');

      await this.loadInitialData();
      this.startPolling();
      this.activeTab = 'home';
      return { success: true };
    } catch (err) {
      this.showToast(err.message || 'Errore durante l\'accesso', 'error');
      return { success: false, error: err.message };
    }
  }

  logout() {
    this.token = null;
    this.setUser(null);
    this.challenges = [];
    this.mySubmissions = [];
    this.leaderboard = [];
    this.galleryPhotos = [];
    localStorage.removeItem('fm_auth_token');
    this.stopPolling();
    this.activeTab = 'home';
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
    if (!this.token) return;
    try {
      const res = await api.getMe();
      if (!silent && this.user && res.user.total_points > this.user.total_points) {
        const diff = res.user.total_points - this.user.total_points;
        this.showToast(`Hai guadagnato +${diff} punti! 🏆`, 'success', diff);
      }
      this.setUser(res.user);
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  }

  async refreshChallenges() {
    if (!this.token) return;
    try {
      this.challenges = await api.getChallenges();
    } catch (err) {
      console.error('Failed to load challenges', err);
    }
  }

  async refreshMySubmissions() {
    if (!this.token) return;
    try {
      this.mySubmissions = await api.getMySubmissions();
    } catch (err) {
      console.error('Failed to load submissions', err);
    }
  }

  async refreshLeaderboard() {
    if (!this.token) return;
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
    if (!this.token) return;
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
