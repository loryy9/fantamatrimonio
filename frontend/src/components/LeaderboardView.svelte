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
</script>

<div class="leaderboard-container">
  <!-- Header -->
  <div class="header-box">
    <div class="header-top">
      <h1 class="page-title font-serif">Classifica Live</h1>
      <div class="live-pill">
        <span class="pulse-dot"></span>
        <span class="live-text">Live</span>
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
      <div class="podium-medal medal-silver" title="2° Posto">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
      </div>
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
      class="podium-card podium-1 glass-card podium-gold {first ? 'has-user' : 'empty-slot'}"
      onclick={() => first && openUserDetail(first.id)}
    >
      <div class="crown-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
      </div>
      <div class="podium-medal medal-gold" title="1° Posto">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
      </div>
      <div class="podium-avatar avatar-gold {first ? '' : 'avatar-empty'}">
        {first ? formatName(first.first_name).charAt(0) : '—'}
      </div>
      <div class="podium-name {first ? '' : 'text-placeholder'}">
        {first ? displayName(first) : 'In attesa'}
      </div>
      <div class="podium-points {first ? '' : 'points-placeholder'}">
        {first ? `${first.total_points} pt` : '0 pt'}
      </div>
      <div class="podium-step step-1">1°</div>
    </div>

    <!-- 3rd Place (Right) -->
    <div
      class="podium-card podium-3 glass-card {third ? 'has-user' : 'empty-slot'}"
      onclick={() => third && openUserDetail(third.id)}
    >
      <div class="podium-medal medal-bronze" title="3° Posto">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
      </div>
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

  <!-- Tabella della Classifica -->
  <div class="leaderboard-table-card glass-card">
    <div class="table-card-header">
      <div class="table-title-group">
        <h2 class="table-card-title font-serif">Classifica Generale</h2>
        <span class="table-subtitle">Dal 4° posto in poi · Punti aggiornati in tempo reale</span>
      </div>
      <div class="table-count-badge">
        {#if appState.leaderboard.length > 3}
          {restOfBoard.length} {restOfBoard.length === 1 ? 'invitato' : 'invitati'} in lista
        {:else}
          {appState.leaderboard.length} {appState.leaderboard.length === 1 ? 'invitato' : 'invitati'}
        {/if}
      </div>
    </div>

    <!-- Intestazioni colonne -->
    <div class="table-head">
      <span class="col-rank">Pos.</span>
      <span class="col-user">Invitato</span>
      <span class="col-points">Punti</span>
    </div>

    <div class="table-body">
      {#if restOfBoard.length === 0}
        <!-- Righe segnaposto dimostrative a partire dal 4° posto (1, 2 e 3 sono sul podio) -->
        {#each [4, 5, 6, 7, 8] as pos}
          <div class="table-row row-placeholder">
            <span class="col-rank rank-num">#{pos}</span>
            <div class="col-user user-cell">
              <div class="table-avatar avatar-placeholder">—</div>
              <div class="user-meta">
                <span class="user-name placeholder-name">In attesa di partecipanti...</span>
                <span class="user-sub placeholder-sub">Posizione #{pos} aperta</span>
              </div>
            </div>
            <div class="col-points points-cell">
              <span class="pts-val placeholder-pts">0</span>
              <span class="pts-label">pt</span>
            </div>
          </div>
        {/each}
        <div class="empty-table-banner">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>I primi 3 classificati sono sul podio in alto. I punteggi dal 4° posto in poi appariranno qui man mano che gli invitati giocano!</span>
        </div>
      {:else}
        {#each restOfBoard as entry (entry.id)}
          {@const isMe = appState.user?.id === entry.id}
          <div
            class="table-row {isMe ? 'row-me' : ''}"
            onclick={() => openUserDetail(entry.id)}
            title="Clicca per visualizzare le sfide completate"
          >
            <span class="col-rank rank-num">
              #{entry.rank}
            </span>
            <div class="col-user user-cell">
              <div class="table-avatar">
                {formatName(entry.first_name).charAt(0)}
              </div>
              <div class="user-meta">
                <span class="user-name">{displayName(entry)}</span>
                {#if isMe}
                  <span class="me-badge">Tu</span>
                {/if}
              </div>
            </div>
            <div class="col-points points-cell">
              <span class="pts-val">{entry.total_points}</span>
              <span class="pts-label">pt</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<!-- User Detail Modal -->
{#if selectedUserDetail}
  <div class="modal-overlay" onclick={() => selectedUserDetail = null}>
    <div class="modal-content glass-card" onclick={(e) => e.stopPropagation()}>
      <button class="modal-close" onclick={() => selectedUserDetail = null} aria-label="Chiudi">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

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
    gap: 24px;
  }

  /* Editorial header */
  .header-box {
    padding: 4px 4px 0;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 2.3rem;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--text-main);
  }

  .header-box::after {
    content: '';
    display: block;
    width: 44px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin-top: 12px;
  }

  .page-desc {
    font-size: 0.95rem;
    font-style: italic;
    color: #6b5f64;
    margin-top: 12px;
    line-height: 1.5;
  }

  .live-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(127, 169, 148, 0.14);
    border: 1px solid rgba(127, 169, 148, 0.4);
    padding: 5px 12px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .live-text {
    font-size: 0.74rem;
    font-weight: 700;
    color: #3f7a60;
  }

  /* Podium */
  .podium-grid {
    display: grid;
    grid-template-columns: 1fr 1.18fr 1fr;
    gap: 10px;
    align-items: flex-end;
    margin-top: 4px;
  }

  .podium-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 6px 0 6px;
    text-align: center;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    background: #fff;
    border-radius: 26px;
  }

  .podium-card:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  /* The single bold focal element: first place */
  .podium-card.podium-gold {
    background: linear-gradient(160deg, var(--wine) 0%, var(--wine-deep) 100%);
    border-color: rgba(106, 32, 55, 0.6);
    box-shadow: 0 24px 40px -22px rgba(106, 32, 55, 0.75);
    color: #fff;
    padding-top: 22px;
  }

  .crown-icon {
    position: absolute;
    top: 6px;
    color: var(--gold-bright);
  }

  .podium-medal {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
    line-height: 1;
  }

  .podium-medal.medal-gold {
    color: var(--gold-bright);
    margin-top: 12px;
  }

  .podium-medal.medal-silver {
    color: #9a8f94;
  }

  .podium-medal.medal-bronze {
    color: #b98a5a;
  }

  .podium-avatar {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--wine-tint);
    border: 2px solid rgba(140, 47, 75, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.3rem;
    margin: 8px 0;
    color: var(--wine);
  }

  .avatar-gold {
    width: 58px;
    height: 58px;
    font-size: 1.6rem;
    background: var(--gold-bright);
    color: var(--wine-deep);
    border-color: rgba(255, 255, 255, 0.55);
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
  }

  .podium-name {
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    padding: 0 6px;
    color: var(--text-main);
  }

  .podium-gold .podium-name {
    color: #fff;
    font-size: 0.88rem;
  }

  .podium-points {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    color: #a07a35;
    margin: 2px 0 10px 0;
  }

  .podium-gold .podium-points {
    color: var(--gold-bright);
    font-size: 1.5rem;
    background: none;
    -webkit-text-fill-color: currentColor;
  }

  .podium-step {
    width: 100%;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.1rem;
    padding: 8px 0;
    border-radius: 14px 14px 0 0;
  }

  .step-1 {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    height: 70px;
  }

  .step-2 {
    background: var(--wine-tint);
    color: var(--wine);
    height: 50px;
  }

  .step-3 {
    background: rgba(233, 201, 143, 0.28);
    color: #8a6a2c;
    height: 38px;
  }

  .podium-card.empty-slot {
    cursor: default;
    opacity: 0.85;
  }

  .podium-avatar.avatar-empty {
    border-style: dashed;
    border-color: rgba(36, 28, 32, 0.15);
    color: var(--text-dim);
    background: rgba(36, 28, 32, 0.03);
  }

  .podium-gold .avatar-empty {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    border-color: rgba(255, 255, 255, 0.35);
  }

  .text-placeholder {
    color: var(--text-dim) !important;
    font-weight: 500;
  }

  .podium-gold .text-placeholder {
    color: rgba(255, 255, 255, 0.7) !important;
  }

  .points-placeholder {
    color: var(--text-dim) !important;
    font-weight: 600;
  }

  .podium-gold .points-placeholder {
    color: rgba(255, 255, 255, 0.7) !important;
  }

  /* Table Card */
  .leaderboard-table-card {
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(36, 28, 32, 0.07);
    box-shadow: 0 18px 34px -24px rgba(106, 32, 55, 0.4);
    background: #fff;
  }

  .table-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 22px 22px 14px;
  }

  .table-title-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .table-card-title {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-main);
  }

  .table-subtitle {
    font-size: 0.8rem;
    color: #6b5f64;
  }

  .table-count-badge {
    font-size: 0.76rem;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 999px;
    background: var(--wine-tint);
    color: var(--wine);
    border: 1px solid rgba(140, 47, 75, 0.2);
    white-space: nowrap;
  }

  .table-head {
    display: flex;
    align-items: center;
    padding: 8px 22px;
    border-top: 1px solid rgba(36, 28, 32, 0.07);
    border-bottom: 1px solid rgba(36, 28, 32, 0.07);
    background: rgba(245, 228, 233, 0.35);
    font-size: 0.78rem;
    font-weight: 600;
    color: #6b5f64;
  }

  .col-rank {
    width: 48px;
    flex-shrink: 0;
  }

  .col-user {
    flex: 1;
    min-width: 0;
  }

  .col-points {
    width: 80px;
    text-align: right;
    flex-shrink: 0;
  }

  .table-body {
    display: flex;
    flex-direction: column;
  }

  .table-row {
    display: flex;
    align-items: center;
    padding: 14px 22px;
    border-bottom: 1px solid rgba(36, 28, 32, 0.06);
    transition: background 0.18s ease;
    cursor: pointer;
  }

  .table-row:last-child {
    border-bottom: none;
  }

  .table-row:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: -2px;
  }

  @media (hover: hover) {
    .table-row:hover:not(.row-placeholder) {
      background: var(--wine-tint);
    }
  }

  .row-placeholder {
    cursor: default;
    opacity: 0.65;
  }

  .row-me {
    background: rgba(245, 228, 233, 0.7) !important;
    box-shadow: inset 3px 0 0 var(--wine);
  }

  .rank-num {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.15rem;
    color: #6b5f64;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .table-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--wine);
    flex-shrink: 0;
  }

  .table-avatar.avatar-placeholder {
    border-style: dashed;
    color: var(--text-dim);
    background: transparent;
  }

  .user-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px 6px;
    min-width: 0;
  }

  .user-cell .user-meta:has(.placeholder-sub) {
    flex-direction: column;
    align-items: flex-start;
  }

  .user-name {
    font-size: 0.94rem;
    font-weight: 600;
    color: var(--text-main);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .placeholder-name {
    color: var(--text-dim);
    font-weight: 500;
    font-style: italic;
  }

  .placeholder-sub {
    font-size: 0.74rem;
    color: var(--text-dim);
  }

  .me-badge {
    display: inline-block;
    background: var(--wine);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 2px 9px;
    border-radius: 999px;
  }

  .points-cell {
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 3px;
  }

  .pts-val {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.3rem;
    color: #a07a35;
  }

  .placeholder-pts {
    color: var(--text-dim) !important;
  }

  .pts-label {
    font-size: 0.74rem;
    color: var(--text-dim);
  }

  .empty-table-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    background: var(--wine-tint);
    border-top: 1px dashed rgba(140, 47, 75, 0.3);
    color: var(--wine-deep);
    font-size: 0.82rem;
    font-weight: 500;
    text-align: center;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(36, 18, 26, 0.6);
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
    max-width: 420px;
    background: var(--paper);
    border-radius: 28px;
    padding: 28px 22px 22px;
    position: relative;
    max-height: min(85dvh, calc(100svh - 24px));
    display: flex;
    flex-direction: column;
    box-shadow: 0 30px 60px -20px rgba(106, 32, 55, 0.5);
  }

  .modal-close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--wine-tint);
    border: none;
    border-radius: 50%;
    color: var(--wine);
    cursor: pointer;
  }

  .modal-close:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
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
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: var(--grad-gold-rose);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 700;
    color: #fff;
  }

  .modal-name {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .modal-points-badge {
    background: rgba(233, 201, 143, 0.25);
    border: 1px solid rgba(201, 169, 110, 0.4);
    color: #7a5c22;
    font-weight: 700;
    font-size: 0.86rem;
    padding: 6px 14px;
    border-radius: 999px;
  }

  .modal-body {
    overflow-y: auto;
    flex: 1;
  }

  .submissions-title {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 10px;
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
    gap: 10px;
    padding: 11px 14px;
    background: #fff;
    border: 1px solid rgba(36, 28, 32, 0.07);
    border-radius: 18px;
  }

  .sub-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: flex-start;
  }

  .sub-title {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .sub-points {
    font-family: var(--font-display);
    font-weight: 700;
    color: #a07a35;
    font-size: 1.1rem;
    white-space: nowrap;
  }

  .no-subs {
    font-size: 0.85rem;
    color: #6b5f64;
    text-align: center;
    padding: 16px;
  }

  @media (min-width: 900px) {
    .page-title { font-size: 3rem; }
    .podium-grid { max-width: 720px; width: 100%; margin: 0 auto; gap: 16px; }
    .podium-avatar { width: 56px; height: 56px; }
    .avatar-gold { width: 72px; height: 72px; }
    .step-1 { height: 90px; }
    .step-2 { height: 64px; }
    .step-3 { height: 48px; }
  }

  @media (max-width: 380px) {
    .table-card-header { flex-direction: column; align-items: flex-start; }
  }
</style>
