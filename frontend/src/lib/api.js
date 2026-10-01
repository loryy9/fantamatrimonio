// API Client for Fanta Matrimonio
import { compressImage } from './imageCompressor.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function getStoredToken() {
  // Preferisci JWT se disponibile, altrimenti session token
  return localStorage.getItem('fm_jwt_token') || localStorage.getItem('fm_auth_token');
}

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = { ...options.headers };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is NOT FormData, set JSON content-type
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorDetail = `Errore HTTP ${response.status}`;
    try {
      const rawText = await response.text();
      try {
        const errJson = JSON.parse(rawText);
        if (Array.isArray(errJson.detail)) {
          errorDetail = errJson.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
        } else if (typeof errJson.detail === 'object' && errJson.detail !== null) {
          errorDetail = JSON.stringify(errJson.detail);
        } else {
          errorDetail = errJson.detail || errJson.message || rawText;
        }
      } catch {
        errorDetail = rawText || errorDetail;
      }
    } catch {
      // Se anche leggere il testo fallisce, mantieni errorDetail di default
    }
    throw new ApiError(errorDetail, response.status, errorDetail);
  }

  // If 204 No Content
  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

export const api = {
  // ── Auth (login leggero) ──────────────────────────────────────────────────
  async login(inviteCode, firstName, lastName, secretWord, isCouple = false, email = null) {
    return await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        invite_code: inviteCode,
        first_name: firstName,
        last_name: lastName,
        secret_word: secretWord,
        is_couple: isCouple,
        email: email || undefined
      })
    });
  },

  async getEventPreview(inviteCode) {
    return await request(`/events/preview/${encodeURIComponent(inviteCode.trim().toUpperCase())}`);
  },

  // ── Verifica Email OTP ───────────────────────────────────────────────────
  async sendVerificationCode(email, purpose = 'registration') {
    return await request('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose })
    });
  },

  async verifyCode(email, code, purpose = 'registration') {
    return await request('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code, purpose })
    });
  },

  // ── Auth (registrazione sicura) ───────────────────────────────────────────
  async register(email, password, displayName, verificationCode = null) {
    return await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
        verification_code: verificationCode || undefined
      })
    });
  },

  // ── Auth (login sicuro con email/password) ────────────────────────────────
  async loginSecure(email, password) {
    return await request('/auth/login-secure', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  // ── Auth (upgrade account) ────────────────────────────────────────────────
  async upgradeAccount(email, password, displayName = null, verificationCode = null) {
    return await request('/auth/upgrade', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        display_name: displayName || undefined,
        verification_code: verificationCode || undefined
      })
    });
  },

  async getClaimInfo(claimToken) {
    return await request('/auth/claim-info', {
      method: 'POST',
      body: JSON.stringify({ claim_token: claimToken })
    });
  },

  async completeClaim(claimToken, password, displayName = null) {
    return await request('/auth/complete-claim', {
      method: 'POST',
      body: JSON.stringify({
        claim_token: claimToken,
        password,
        display_name: displayName || undefined
      })
    });
  },

  async createEvent(payload) {
    return await request('/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async deleteMyEvent() {
    return await request('/events/me', {
      method: 'DELETE'
    });
  },

  async getMe(eventId = null) {
    const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : '';
    return await request(`/auth/me${query}`);
  },

  // Challenges
  async getChallenges(includeInactive = false) {
    const query = includeInactive ? '?include_inactive=true' : '';
    return await request(`/challenges${query}`);
  },

  async getChallenge(id) {
    return await request(`/challenges/${id}`);
  },

  async createChallenge(payload) {
    return await request('/challenges', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async createChallengesBulk(list) {
    return await request('/challenges/bulk', {
      method: 'POST',
      body: JSON.stringify(list)
    });
  },

  async updateChallenge(id, payload) {
    return await request(`/challenges/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteChallenge(id) {
    return await request(`/challenges/${id}`, {
      method: 'DELETE'
    });
  },

  // Event & Couple Management
  async updateEvent(payload) {
    return await request('/events/me', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async getEventInvite() {
    return await request('/events/me/invite');
  },

  async getEventStats() {
    return await request('/events/me/stats');
  },

  // Submissions
  async submitPhoto(file, caption = '', awardPoints = true) {
    const optimizedFile = file._compressed ? file : await compressImage(file);
    const formData = new FormData();
    formData.append('file', optimizedFile);
    if (caption) {
      formData.append('caption', caption);
    }
    const query = awardPoints ? '' : '?award_points=false';
    return await request(`/submissions/photo${query}`, {
      method: 'POST',
      body: formData
    });
  },

  async submitPhotos(files, caption = '', awardPoints = true) {
    const optimizedFiles = await Promise.all(
      files.map(f => (f._compressed ? f : compressImage(f)))
    );
    const formData = new FormData();
    for (const f of optimizedFiles) {
      formData.append('files', f);
    }
    if (caption) {
      formData.append('caption', caption);
    }
    const query = awardPoints ? '' : '?award_points=false';
    return await request(`/submissions/photos${query}`, {
      method: 'POST',
      body: formData
    });
  },

  async deletePhoto(submissionId) {
    return await request(`/submissions/photo/${submissionId}`, {
      method: 'DELETE'
    });
  },

  async submitHunt(challengeId, file) {
    const optimizedFile = file._compressed ? file : await compressImage(file);
    const formData = new FormData();
    formData.append('file', optimizedFile);
    return await request(`/submissions/hunt/${challengeId}`, {
      method: 'POST',
      body: formData
    });
  },

  async submitVote(challengeId, optionOrText) {
    return await request(`/submissions/vote/${challengeId}`, {
      method: 'POST',
      body: JSON.stringify({
        option_id: optionOrText,
        text: optionOrText
      })
    });
  },

  async submitQuiz(challengeId, answer) {
    return await request(`/submissions/quiz/${challengeId}`, {
      method: 'POST',
      body: JSON.stringify({ answer })
    });
  },

  async getGallery(limit = 60, offset = 0) {
    return await request(`/submissions/gallery?limit=${limit}&offset=${offset}`);
  },

  async getMySubmissions() {
    return await request('/submissions/mine');
  },

  // Leaderboard
  async getLeaderboard() {
    return await request('/leaderboard');
  },

  async getUserDetail(userId) {
    return await request(`/leaderboard/${userId}`);
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboardEvents() {
    return await request('/dashboard/events');
  },

  async getDashboardEventDetail(eventId) {
    return await request(`/dashboard/events/${eventId}`);
  },

  async getDashboardEventSubmissions(eventId) {
    return await request(`/dashboard/events/${eventId}/submissions`);
  },

  // Admin Endpoints
  async adminLogin(username, password) {
    return await request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async adminVerify(adminToken) {
    return await request('/admin/verify', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
  },

  async adminGetEvents(adminToken) {
    return await request('/admin/events', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
  },

  async adminDeleteEvent(eventId, adminToken) {
    return await request(`/admin/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
  },

  async adminGetUsers(adminToken) {
    return await request('/admin/users', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
  },

  async adminDeleteUser(accountId, adminToken, deleteEvents = false) {
    const query = deleteEvents ? '?delete_events=true' : '';
    return await request(`/admin/users/${accountId}${query}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
  }
};
