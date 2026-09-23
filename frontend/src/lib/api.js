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
  return localStorage.getItem('fm_auth_token');
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
    let errorDetail = 'Errore sconosciuto';
    try {
      const errJson = await response.json();
      if (Array.isArray(errJson.detail)) {
        errorDetail = errJson.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
      } else if (typeof errJson.detail === 'object' && errJson.detail !== null) {
        errorDetail = JSON.stringify(errJson.detail);
      } else {
        errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
      }
    } catch {
      errorDetail = await response.text();
    }
    throw new ApiError(errorDetail || `Errore HTTP ${response.status}`, response.status, errorDetail);
  }

  // If 204 No Content
  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

export const api = {
  // Auth
  async login(firstName, lastName, secretWord) {
    return await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        secret_word: secretWord
      })
    });
  },

  async getMe() {
    return await request('/auth/me');
  },

  // Challenges
  async getChallenges() {
    return await request('/challenges');
  },

  async getChallenge(id) {
    return await request(`/challenges/${id}`);
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
  }
};
