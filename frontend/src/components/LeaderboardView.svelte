<script>
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import { formatName } from '../lib/formatters.js';

  let selectedUserDetail = $state(null);
  let isLoadingDetail = $state(false);

  const first = $derived(appState.leaderboard[0] || null);
  const second = $derived(appState.leaderboard[1] || null);
  const third = $derived(appState.leaderboard[2] || null);
  const restOfBoard = $derived(appState.leaderboard.slice(3));

  function displayName(entry) {
    if (appState.user?.id === entry.id) return 'Tu';
    return `${formatName(entry.first_name)} ${formatName(entry.last_name)}`;
  }

  function displayNameFull(user) {
    return `${formatName(user.first_name)} ${formatName(user.last_name)}`;
  }

  async function openUserDetail(userId) {
    isLoadingDetail = true;
    try {
      const data = await api.getUserDetail(userId);
      selectedUserDetail = data;
    } catch (err) {
      appState.showToast(err.message || 'Errore nel caricamento dei dettagli', 'error');
    } finally {
      isLoadingDetail = false;
    }
  }

  function getMedalEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}°`;
  }
</script>

<div class="leaderboard-container">
  <!-- Header -->
  <div class="header-box">
    <div class="header-top">
      <h1 class="page-title font-serif gold-gradient-text">Classifica Live</h1>
      <div class="live-pill">
        <span class="pulse-dot"></span>
        <span class="live-text">LIVE</span>
      </div>
    </div>
    <p class="page-desc">Aggiornata in tempo reale con i punti di tutti gli invitati!</p>
  </div>

  <!-- Fixed Podium for Top 3 (Always Visible in Order: 2°, 1°, 3°) -->
  <div class="podium-grid">
    <!-- 2nd Place (Left) -->
    <div
      class="podium-card podium-2 glass-card {second ? 'has-user' : 'empty-slot'}"
      onclick={() => second && openUserDetail(second.id)}
    >
      <div class="podium-medal">🥈</div>
      <div class="podium-avatar {second ? '' : 'avatar-empty'}">
        {second ? formatName(second.first_name).charAt(0) : '—'}
      </div>
      <div class="podium-name {second ? '' : 'text-placeholder'}">
        {second ? displayName(second) : 'In attesa'}
      </div>
      <div class="podium-points {second ? '' : 'points-placeholder'}">
        {second ? `${second.total_points} pt` : '0 pt'}
      </div>
      <div class="podium-step step-2">2°</div>
    </div>

    <!-- 1st Place (Center) -->
    <div
      class="podium-card podium-1 glass-card glass-card-gold {first ? 'has-user' : 'empty-slot'}"
      onclick={() => first && openUserDetail(first.id)}
    >
      <div class="crown-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
      </div>
      <div class="podium-medal">🥇</div>
      <div class="podium-avatar avatar-gold {first ? '' : 'avatar-empty'}">
        {first ? formatName(first.first_name).charAt(0) : '—'}
      </div>
      <div class="podium-name {first ? '' : 'text-placeholder'}">
        {first ? displayName(first) : 'In attesa'}
      </div>
      <div class="podium-points gold-gradient-text {first ? '' : 'points-placeholder'}">
        {first ? `${first.total_points} pt` : '0 pt'}
      </div>
      <div class="podium-step step-1">1°</div>
    </div>

    <!-- 3rd Place (Right) -->
    <div
      class="podium-card podium-3 glass-card {third ? 'has-user' : 'empty-slot'}"
      onclick={() => third && openUserDetail(third.id)}
    >
      <div class="podium-medal">🥉</div>
      <div class="podium-avatar {third ? '' : 'avatar-empty'}">
        {third ? formatName(third.first_name).charAt(0) : '—'}
      </div>
      <div class="podium-name {third ? '' : 'text-placeholder'}">
        {third ? displayName(third) : 'In attesa'}
      </div>
      <div class="podium-points {third ? '' : 'points-placeholder'}">
        {third ? `${third.total_points} pt` : '0 pt'}
      </div>
      <div class="podium-step step-3">3°</div>
    </div>
  </div>

  {#if appState.leaderboard.length === 0}
    <div class="empty-podium-note glass-card">
      <div class="empty-note-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
      </div>
      <div class="empty-note-text">
        <strong>Il podio è pronto!</strong>
        <span>Completa le missioni e rispondi ai quiz per guadagnare punti e salire sul podio!</span>
      </div>
    </div>
  {:else if restOfBoard.length > 0}
    <!-- Rest of Leaderboard List (ranks 4+) -->
    <div class="ranking-list">
      {#each restOfBoard as entry (entry.id)}
        {@const isMe = appState.user?.id === entry.id}
        <div
          class="ranking-row glass-card {isMe ? 'row-me' : ''}"
          onclick={() => openUserDetail(entry.id)}
        >
          <div class="rank-num">#{entry.rank}</div>
          <div class="rank-user">
            <div class="rank-avatar">
              {formatName(entry.first_name).charAt(0)}
            </div>
            <div class="rank-name-box">
              <span class="rank-name">{displayName(entry)}</span>
              {#if isMe}
                <span class="me-badge">Tu</span>
              {/if}
            </div>
          </div>
          <div class="rank-pts">
            <span class="pts-val">{entry.total_points}</span>
            <span class="pts-label">pt</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- User Detail Modal -->
{#if selectedUserDetail}
  <div class="modal-overlay" onclick={() => selectedUserDetail = null}>
    <div class="modal-content glass-card" onclick={(e) => e.stopPropagation()}>
      <button class="modal-close" onclick={() => selectedUserDetail = null}>✕</button>

      <div class="modal-header">
        <div class="modal-avatar">
          {formatName(selectedUserDetail.user.first_name).charAt(0)}
        </div>
        <h2 class="modal-name font-serif">
          {displayNameFull(selectedUserDetail.user)}
        </h2>
        <div class="modal-points-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:4px"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          {selectedUserDetail.user.total_points} Punti Totali
        </div>
      </div>

      <div class="modal-body">
        <h4 class="submissions-title">Attività e Punti Conquistati</h4>
        {#if !selectedUserDetail.submissions || selectedUserDetail.submissions.length === 0}
          <p class="no-subs">Nessuna attività registrata ancora.</p>
        {:else}
          <div class="modal-subs-list">
            {#each selectedUserDetail.submissions as sub (sub.id)}
              <div class="sub-item">
                <div class="sub-info">
                  <span class="sub-title">{sub.challenge_title || 'Foto Libera'}</span>
                  <span class="sub-type badge badge-purple">{sub.challenge_type}</span>
                </div>
                <div class="sub-points">+{sub.points_awarded} pt</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .leaderboard-container {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .header-box {
    padding: 0 4px;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-title {
    font-size: 1.7rem;
    font-weight: 700;
  }

  .page-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .live-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(123, 184, 158, 0.1);
    border: 1px solid rgba(123, 184, 158, 0.3);
    padding: 4px 10px;
    border-radius: var(--radius-full);
  }

  .live-text {
    font-size: 0.68rem;
    font-weight: 800;
    color: #4d8e73;
    letter-spacing: 0.06em;
  }

  /* Podium */
  .podium-grid {
    display: grid;
    grid-template-columns: 1fr 1.15fr 1fr;
    gap: 8px;
    align-items: flex-end;
    margin-top: 10px;
  }

  .podium-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 6px 0 6px;
    text-align: center;
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }

  .crown-icon {
    position: absolute;
    top: 4px;
    color: var(--gold-primary);
    animation: bounce 2s infinite ease-in-out;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  .podium-medal {
    font-size: 1.2rem;
    margin-top: 4px;
  }

  .podium-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--bg-surface-elevated);
    border: 2px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
    margin: 6px 0;
    color: var(--text-main);
  }

  .avatar-gold {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #c9a96e 0%, #a17f49 100%);
    color: #fff;
    border-color: var(--gold-primary);
    box-shadow: 0 0 12px rgba(201, 169, 110, 0.3);
  }

  .podium-name {
    font-size: 0.78rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    padding: 0 4px;
    color: var(--text-main);
  }

  .podium-points {
    font-size: 0.82rem;
    font-weight: 800;
    color: var(--text-main);
    margin: 2px 0 8px 0;
  }

  .podium-step {
    width: 100%;
    font-weight: 800;
    font-size: 0.95rem;
    padding: 8px 0;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  }

  .step-1 {
    background: linear-gradient(180deg, rgba(201, 169, 110, 0.18) 0%, rgba(201, 169, 110, 0.05) 100%);
    color: var(--gold-dark);
    height: 65px;
  }

  .step-2 {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.04) 0%, transparent 100%);
    color: var(--text-muted);
    height: 48px;
  }

  .step-3 {
    background: linear-gradient(180deg, rgba(186, 134, 87, 0.12) 0%, rgba(186, 134, 87, 0.03) 100%);
    color: #a17f49;
    height: 36px;
  }

  .podium-card.empty-slot {
    cursor: default;
    opacity: 0.85;
  }

  .podium-avatar.avatar-empty {
    border-style: dashed;
    border-color: var(--border-subtle);
    color: var(--text-dim);
    background: rgba(0, 0, 0, 0.03);
  }

  .avatar-gold.avatar-empty {
    background: rgba(201, 169, 110, 0.12);
    color: var(--gold-dark);
    box-shadow: none;
    border-style: dashed;
    border-color: rgba(201, 169, 110, 0.4);
  }

  .text-placeholder {
    color: var(--text-dim) !important;
    font-weight: 500;
  }

  .points-placeholder {
    color: var(--text-dim) !important;
    font-weight: 600;
  }

  .empty-podium-note {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    margin-top: 6px;
  }

  .empty-note-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(201, 169, 110, 0.12);
    color: var(--gold-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .empty-note-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.86rem;
    color: var(--text-muted);
    line-height: 1.35;
  }

  .empty-note-text strong {
    color: var(--text-main);
    font-size: 0.92rem;
  }

  /* List */
  .ranking-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ranking-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
  }

  .row-me {
    border-color: rgba(201, 169, 110, 0.4);
    background: linear-gradient(135deg, rgba(201, 169, 110, 0.08) 0%, rgba(255, 255, 255, 0.9) 100%);
  }

  .rank-num {
    font-size: 0.88rem;
    font-weight: 800;
    color: var(--text-dim);
    width: 36px;
  }

  .rank-user {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .rank-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-surface-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-muted);
  }

  .rank-name-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rank-name {
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--text-main);
  }

  .me-badge {
    background: var(--gold-primary);
    color: #fff;
    font-size: 0.62rem;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: var(--radius-full);
    letter-spacing: 0.02em;
  }

  .rank-pts {
    display: flex;
    align-items: baseline;
    gap: 3px;
  }

  .pts-val {
    font-weight: 800;
    font-size: 1rem;
    color: var(--gold-dark);
  }

  .pts-label {
    font-size: 0.72rem;
    color: var(--text-dim);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 12, 8, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top, 0px)) 16px max(12px, env(safe-area-inset-bottom, 0px)) 16px;
  }

  .modal-content {
    width: 100%;
    max-width: 400px;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    padding: 24px 20px;
    position: relative;
    max-height: min(85dvh, calc(100svh - 24px));
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  }

  .modal-close {
    position: absolute;
    top: 14px;
    right: 14px;
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 1.1rem;
    cursor: pointer;
  }

  .modal-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    margin-bottom: 18px;
  }

  .modal-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, #c9a96e 0%, #d4849a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    font-weight: 800;
    color: #fff;
  }

  .modal-name {
    font-size: 1.3rem;
    color: var(--text-main);
  }

  .modal-points-badge {
    background: rgba(201, 169, 110, 0.1);
    border: 1px solid rgba(201, 169, 110, 0.3);
    color: var(--gold-dark);
    font-weight: 700;
    font-size: 0.88rem;
    padding: 6px 14px;
    border-radius: var(--radius-full);
  }

  .modal-body {
    overflow-y: auto;
    flex: 1;
  }

  .submissions-title {
    font-size: 0.78rem;
    text-transform: uppercase;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-bottom: 10px;
    font-weight: 700;
  }

  .modal-subs-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sub-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--bg-surface-elevated);
    border-radius: var(--radius-md);
  }

  .sub-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sub-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .sub-points {
    font-weight: 800;
    color: var(--gold-dark);
    font-size: 0.88rem;
  }

  .no-subs {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-align: center;
    padding: 16px;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    color: var(--gold-primary);
    margin-bottom: 10px;
  }

  .empty-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .empty-desc {
    font-size: 0.84rem;
    color: var(--text-muted);
    margin-top: 4px;
  }
</style>
