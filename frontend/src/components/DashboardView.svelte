<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import { formatName } from '../lib/formatters.js';

  let selectedEvent = $state(null);
  let eventDetail = $state(null);
  let eventSubmissions = $state(null);
  let detailLoading = $state(false);
  let activeSection = $state('photos'); // 'photos' | 'quiz' | 'participants'

  onMount(() => {
    appState.loadDashboardEvents();
  });

  async function openEvent(ev) {
    selectedEvent = ev;
    detailLoading = true;
    activeSection = 'photos';
    try {
      const [detail, subs] = await Promise.all([
        api.getDashboardEventDetail(ev.event.id),
        api.getDashboardEventSubmissions(ev.event.id),
      ]);
      eventDetail = detail;
      eventSubmissions = subs;
    } catch (err) {
      appState.showToast('Errore nel caricamento dell\'evento', 'error');
    } finally {
      detailLoading = false;
    }
  }

  function goBack() {
    selectedEvent = null;
    eventDetail = null;
    eventSubmissions = null;
  }

  function enterEvent(ev) {
    // Entra nell'evento come giocatore attivo
    appState.login(
      ev.event.invite_code,
      '', '', '', false
    ).catch(() => {});
  }

  const photos = $derived(eventDetail?.photos || []);
  const participants = $derived(eventDetail?.participants || []);
  const quizSubmissions = $derived(
    (eventSubmissions || []).filter(s => s.challenge_type === 'quiz' || s.challenge_type === 'vote')
  );
</script>

{#if selectedEvent && eventDetail}
  <!-- Event Detail View -->
  <div class="dashboard-detail">
    <button class="back-btn" onclick={goBack}>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      Torna alla dashboard
    </button>

    <div class="detail-header">
      <div class="detail-header-main">
        <div class="detail-names font-serif">
          {eventDetail.event.spouse1_name} <span class="gold-gradient-text">&amp;</span> {eventDetail.event.spouse2_name}
        </div>
        <div class="detail-meta">
          <span class="detail-code">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Codice: <strong>{eventDetail.event.invite_code}</strong>
          </span>
          <span class="detail-role" class:couple={eventDetail.is_couple}>
            {eventDetail.is_couple ? '👑 Sposi' : '🎉 Ospite'}
          </span>
        </div>
      </div>
      <button class="btn btn-primary enter-live-btn" onclick={() => appState.selectEvent(eventDetail.event)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>{eventDetail.is_couple ? 'Apri Console Sposi' : 'Entra nella festa live'}</span>
      </button>
    </div>

    <div class="detail-stats">
      <div class="stat-card">
        <span class="stat-num">{eventDetail.stats.guests_count}</span>
        <span class="stat-label">Ospiti</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{eventDetail.stats.photos_count}</span>
        <span class="stat-label">Foto</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{eventDetail.stats.quiz_count}</span>
        <span class="stat-label">Quiz</span>
      </div>
    </div>

    <div class="detail-tabs">
      <button class="tab-btn" class:active={activeSection === 'photos'} onclick={() => activeSection = 'photos'}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
        Galleria
      </button>
      <button class="tab-btn" class:active={activeSection === 'quiz'} onclick={() => activeSection = 'quiz'}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        Quiz e Risposte
      </button>
      <button class="tab-btn" class:active={activeSection === 'participants'} onclick={() => activeSection = 'participants'}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Partecipanti
      </button>
    </div>

    {#if activeSection === 'photos'}
      <div class="photo-grid">
        {#if photos.length === 0}
          <p class="empty-msg">Nessuna foto in questo matrimonio.</p>
        {:else}
          {#each photos as photo (photo.id)}
            <div class="photo-card">
              <img src={photo.image_url} alt={photo.caption || 'Foto matrimonio'} loading="lazy" />
              <div class="photo-overlay">
                <span class="photo-author">{formatName(photo.author.split(' ')[0])} {formatName(photo.author.split(' ')[1] || '')}</span>
                {#if photo.challenge_title}
                  <span class="photo-challenge">{photo.challenge_title}</span>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>

    {:else if activeSection === 'quiz'}
      <div class="submissions-list">
        {#if quizSubmissions.length === 0}
          <p class="empty-msg">
            {eventDetail.is_couple ? 'Nessuna risposta ai quiz ancora.' : 'Nessuna delle tue risposte ai quiz ancora.'}
          </p>
        {:else}
          {#each quizSubmissions as sub (sub.id)}
            <div class="submission-card">
              <div class="sub-header">
                <span class="sub-author">{formatName(sub.author.split(' ')[0])} {formatName(sub.author.split(' ')[1] || '')}</span>
                <span class="sub-type" class:quiz={sub.challenge_type === 'quiz'} class:vote={sub.challenge_type === 'vote'}>
                  {sub.challenge_type === 'quiz' ? 'Quiz' : 'Voto'}
                </span>
              </div>
              <div class="sub-challenge">{sub.challenge_title}</div>
              <div class="sub-answer">
                Risposta: <strong>{sub.answer_text || '—'}</strong>
                {#if sub.correct_answer}
                  <span class="correct-badge" class:right={sub.answer_text?.toLowerCase() === sub.correct_answer?.toLowerCase()}>
                    {sub.answer_text?.toLowerCase() === sub.correct_answer?.toLowerCase() ? '✓ Corretta' : `✗ Era: ${sub.correct_answer}`}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>

    {:else if activeSection === 'participants'}
      <div class="participants-list">
        {#each participants as p, i (p.id)}
          <div class="participant-card" class:is-me={p.id === eventDetail.my_user_id}>
            <span class="p-rank">{i + 1}</span>
            <span class="p-avatar" style="--hue: {(i * 47) % 360}">{formatName(p.first_name)[0]}</span>
            <div class="p-info">
              <span class="p-name">{formatName(p.first_name)} {formatName(p.last_name)}</span>
              <span class="p-role">{p.role === 'couple' ? '👑 Sposi' : 'Ospite'}</span>
            </div>
            <span class="p-points">{p.total_points} pt</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

{:else}
  <!-- Events List -->
  <div class="dashboard-container">
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">La tua <span class="gold-gradient-text">Dashboard</span></h1>
        <p class="page-lead">Tutti i matrimoni a cui hai partecipato o che hai creato.</p>
      </div>
      {#if appState.account}
        <div class="account-info">
          <span class="account-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            {appState.account.display_name}
          </span>
          <span class="account-email">{appState.account.email}</span>
        </div>
      {/if}
    </div>

    {#if appState.dashboardLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Caricamento matrimoni...</p>
      </div>
    {:else if appState.dashboardEvents.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </div>
        <h3>Nessun matrimonio ancora</h3>
        <p>Crea un nuovo matrimonio o partecipa con un codice invito per iniziare a collezionare ricordi.</p>
        <div class="empty-actions">
          <button class="btn btn-primary" onclick={() => appState.setAuthView('create')}>Crea un matrimonio</button>
          <button class="btn btn-secondary" onclick={() => appState.setAuthView('join')}>Ho un codice invito</button>
        </div>
      </div>
    {:else}
      <div class="events-grid">
        {#each appState.dashboardEvents as ev (ev.event.id)}
          <button class="event-card" onclick={() => openEvent(ev)}>
            <div class="event-card-header">
              <span class="event-names font-serif">{ev.event.spouse1_name} &amp; {ev.event.spouse2_name}</span>
              <span class="event-role" class:couple={ev.role === 'couple'}>
                {ev.role === 'couple' ? '👑' : '🎉'}
              </span>
            </div>
            <div class="event-card-stats">
              <span class="event-stat">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                {ev.guests_count}
              </span>
              <span class="event-stat">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                {ev.photos_count}
              </span>
              <span class="event-stat points">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                {ev.total_points} pt
              </span>
            </div>
            <div class="event-card-code">
              Codice: <strong>{ev.event.invite_code}</strong>
            </div>
            <span class="event-card-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── Dashboard Container ──────────────────────────────────────────────── */
  .dashboard-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 16px 120px;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 32px;
  }

  .account-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .account-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--radius-full);
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.3);
    color: var(--gold-dark);
    font-weight: 700;
    font-size: 0.88rem;
  }

  .account-email {
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  /* ── Events Grid ──────────────────────────────────────────────────────── */
  .events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .event-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 22px;
    border-radius: 22px;
    background: var(--paper);
    border: 1px solid rgba(201, 169, 110, 0.2);
    box-shadow: 0 4px 16px rgba(138, 109, 59, 0.08);
    cursor: pointer;
    text-align: left;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  }

  .event-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(138, 109, 59, 0.16);
    border-color: rgba(201, 169, 110, 0.4);
  }

  .event-card:active {
    transform: scale(0.98);
  }

  .event-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .event-names {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .event-role {
    font-size: 1.2rem;
  }

  .event-card-stats {
    display: flex;
    gap: 14px;
  }

  .event-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.82rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .event-stat.points {
    color: var(--gold-dark);
    font-weight: 800;
  }

  .event-card-code {
    font-size: 0.8rem;
    color: var(--text-dim);
    letter-spacing: 0.05em;
  }

  .event-card-code strong {
    color: var(--text-muted);
    letter-spacing: 0.12em;
  }

  .event-card-arrow {
    position: absolute;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-dim);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .event-card:hover .event-card-arrow {
    opacity: 1;
  }

  /* ── Empty & Loading ──────────────────────────────────────────────────── */
  .empty-state, .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 56px 24px;
    text-align: center;
  }

  .empty-icon {
    color: var(--gold-primary);
    opacity: 0.5;
  }

  .empty-state h3 {
    font-size: 1.3rem;
    color: var(--text-main);
  }

  .empty-state p {
    max-width: 40ch;
    color: var(--text-muted);
  }

  .empty-actions {
    display: flex;
    gap: 12px;
    margin-top: 12px;
  }

  .loading-state {
    color: var(--text-muted);
  }

  /* ── Event Detail ─────────────────────────────────────────────────────── */
  .dashboard-detail {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 16px 120px;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.9rem;
    padding: 8px 0;
    margin-bottom: 16px;
    transition: color 0.15s;
  }

  .back-btn:hover {
    color: var(--gold-dark);
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 24px;
  }

  .enter-live-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .detail-names {
    font-size: clamp(1.8rem, 5vw, 2.6rem);
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.1;
  }

  .detail-meta {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 10px;
  }

  .detail-code {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .detail-code strong {
    letter-spacing: 0.12em;
    color: var(--gold-dark);
  }

  .detail-role {
    font-size: 0.82rem;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    background: rgba(201, 169, 110, 0.12);
    color: var(--text-muted);
  }

  .detail-role.couple {
    background: rgba(184, 134, 11, 0.18);
    color: var(--gold-dark);
  }

  .detail-stats {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 16px;
    border-radius: 18px;
    background: var(--paper);
    border: 1px solid rgba(201, 169, 110, 0.18);
  }

  .stat-num {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--gold-dark);
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .detail-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: var(--radius-full);
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(0, 0, 0, 0.06);
    margin-bottom: 24px;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: var(--radius-full);
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: var(--text-main);
  }

  .tab-btn.active {
    background: #fff;
    color: var(--text-main);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    font-weight: 700;
  }

  /* ── Photo Grid ───────────────────────────────────────────────────────── */
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .photo-card {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.05);
  }

  .photo-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }

  .photo-card:hover img {
    transform: scale(1.05);
  }

  .photo-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 24px 10px 8px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .photo-author {
    font-size: 0.76rem;
    font-weight: 700;
    color: #fff;
  }

  .photo-challenge {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.7);
  }

  /* ── Submissions List ─────────────────────────────────────────────────── */
  .submissions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .submission-card {
    padding: 16px;
    border-radius: 16px;
    background: var(--paper);
    border: 1px solid rgba(201, 169, 110, 0.15);
  }

  .sub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .sub-author {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--text-main);
  }

  .sub-type {
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .sub-type.quiz {
    background: rgba(123, 184, 158, 0.15);
    color: #3f7a62;
  }

  .sub-type.vote {
    background: rgba(212, 132, 154, 0.15);
    color: #8a4d63;
  }

  .sub-challenge {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .sub-answer {
    font-size: 0.88rem;
    color: var(--text-main);
  }

  .correct-badge {
    margin-left: 8px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #c0392b;
  }

  .correct-badge.right {
    color: #27ae60;
  }

  /* ── Participants ──────────────────────────────────────────────────────── */
  .participants-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .participant-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 16px;
    background: var(--paper);
    border: 1px solid rgba(201, 169, 110, 0.12);
    transition: background 0.15s;
  }

  .participant-card.is-me {
    border-color: rgba(201, 169, 110, 0.4);
    background: rgba(201, 169, 110, 0.06);
  }

  .p-rank {
    width: 24px;
    font-weight: 800;
    font-size: 1rem;
    color: var(--gold-dark);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .p-avatar {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 0.88rem;
    font-weight: 700;
    color: #fff;
    background: hsl(var(--hue) 45% 48%);
    flex-shrink: 0;
  }

  .p-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .p-name {
    font-weight: 700;
    font-size: 0.92rem;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .p-role {
    font-size: 0.74rem;
    color: var(--text-dim);
  }

  .p-points {
    font-weight: 800;
    font-size: 0.92rem;
    color: var(--gold-dark);
    font-variant-numeric: tabular-nums;
  }

  .empty-msg {
    text-align: center;
    color: var(--text-muted);
    padding: 40px 16px;
    font-size: 0.95rem;
  }

  @media (max-width: 600px) {
    .dashboard-header {
      flex-direction: column;
      gap: 12px;
    }
    .account-info {
      align-items: flex-start;
    }
    .detail-stats {
      flex-direction: column;
    }
    .photo-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .detail-tabs {
      flex-wrap: wrap;
    }
  }
</style>
