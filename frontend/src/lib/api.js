// API Client for Fanta Matrimonio
import { compressImage } from './imageCompressor.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, detail, code = null) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.code = code || (detail && typeof detail === 'object' ? detail.code : null);
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
    let parsedDetail = null;
    let errorCode = null;
    try {
      const rawText = await response.text();
      try {
        const errJson = JSON.parse(rawText);
        parsedDetail = errJson.detail;
        if (typeof errJson.detail === 'object' && errJson.detail !== null) {
          if (Array.isArray(errJson.detail)) {
            errorDetail = errJson.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
          } else {
            errorCode = errJson.detail.code || null;
            errorDetail = errJson.detail.message || JSON.stringify(errJson.detail);
          }
        } else {
          errorDetail = errJson.detail || errJson.message || rawText;
        }
      } catch {
        errorDetail = rawText || errorDetail;
      }
    } catch {
      // Se anche leggere il testo fallisce, mantieni errorDetail di default
    }

    // Refresh automatico in caso di 401 (token scaduto)
    if (response.status === 401 && !endpoint.startsWith('/auth/refresh') && !endpoint.startsWith('/auth/login') && !options._isRetry) {
      const refreshToken = localStorage.getItem('fm_refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await api.refreshToken(refreshToken);
          if (refreshRes?.token) {
            localStorage.setItem('fm_auth_token', refreshRes.token);
            if (refreshRes.refresh_token) {
              localStorage.setItem('fm_refresh_token', refreshRes.refresh_token);
            }
            if (refreshRes.jwt) {
              localStorage.setItem('fm_jwt_token', refreshRes.jwt);
            }
            return await request(endpoint, { ...options, _isRetry: true });
          }
        } catch (refreshErr) {
          console.warn('Silent refresh failed:', refreshErr);
          localStorage.removeItem('fm_auth_token');
          localStorage.removeItem('fm_refresh_token');
        }
      }
    }

    throw new ApiError(errorDetail, response.status, parsedDetail, errorCode);
  }

  // If 204 No Content
  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

export const api = {
  // ── Auth (login veloce: nickname + pin) ───────────────────────────────────
  async login(payload, argFirst, argLast, argSecret, argCouple = false, argEmail = null) {
    let body;
    if (typeof payload === 'object' && payload !== null) {
      body = {
        invite_code: payload.inviteCode || payload.invite_code,
        nickname: payload.nickname,
        pin: payload.pin,
        secret_word: payload.secretWord || payload.secret_word || payload.pin,
        is_couple: !!(payload.isCouple || payload.is_couple)
      };
    } else {
      body = {
        invite_code: payload,
        nickname: argFirst,
        pin: argSecret,
        secret_word: argSecret,
        is_couple: !!argCouple
      };
    }

    return await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  // ── Refresh token ────────────────────────────────────────────────────────
  async refreshToken(refreshToken) {
    return await request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken })
    });
  },

  async getEventPreview(inviteCode) {
    return await request(`/events/preview/${encodeURIComponent(inviteCode.trim().toUpperCase())}`);
  },

  // ── Verifica Email OTP ───────────────────────────────────────────────────
  async sendVerificationCode(email, purpose = 'registration', confirmExisting = false) {
    return await request('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose, confirm_existing: confirmExisting })
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
  async upgradeAccount(email, password, firstName = null, lastName = null, displayName = null, verificationCode = null) {
    return await request('/auth/upgrade', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
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

  async completeClaim(claimToken, password, firstName = null, lastName = null, displayName = null) {
    return await request('/auth/complete-claim', {
      method: 'POST',
      body: JSON.stringify({
        claim_token: claimToken,
        password,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
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
