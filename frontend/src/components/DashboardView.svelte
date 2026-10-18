<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import { formatName } from '../lib/formatters.js';
  import { copyToClipboard } from '../lib/clipboard.js';

  let selectedEvent = $state(null);
  let eventDetail = $state(null);
  let eventSubmissions = $state(null);
  let detailLoading = $state(false);
  let activeSection = $state('photos'); // 'photos' | 'quiz' | 'participants'
  let copied = $state(false);

  onMount(async () => {
    await appState.loadDashboardEvents();
    const eventId = new URLSearchParams(window.location.search).get('event');
    const event = eventId ? appState.dashboardEvents.find((item) => item.event?.id === eventId) : null;
    if (event) await openEvent(event);
  });

  async function openEvent(ev) {
    selectedEvent = ev;
    history.replaceState(null, '', `/dashboard_utente?event=${encodeURIComponent(ev.event.id)}`);
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
    history.replaceState(null, '', '/dashboard_utente');
  }

  async function copyInviteCode(code) {
    const ok = await copyToClipboard(code);
    if (ok) {
      copied = true;
      setTimeout(() => { copied = false; }, 2200);
    }
  }

  const photos = $derived(eventDetail?.photos || []);
  const participants = $derived(eventDetail?.participants || []);
  const quizSubmissions = $derived(
    (eventSubmissions || []).filter(s => s.challenge_type === 'quiz' || s.challenge_type === 'vote')
  );
</script>

{#if detailLoading && !eventDetail}
  <div class="dashboard-loading-view">
    <div class="loading-spinner-wrap">
      <div class="spinner"></div>
      <p class="font-serif loading-title">Caricamento matrimonio in corso...</p>
    </div>
  </div>
{:else if selectedEvent && eventDetail}
  <!-- Event Detail View -->
  <div class="dashboard-detail">
    <!-- Navigazione superiore -->
    <div class="detail-nav-bar">
      <button class="back-pill-btn" onclick={goBack} aria-label="Torna a tutti i matrimoni">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        <span>Tutti i matrimoni</span>
      </button>

      <span class="detail-role-badge" class:couple={eventDetail.is_couple}>
        {#if eventDetail.is_couple}
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
          <span>Sposi</span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          <span>Ospite</span>
        {/if}
      </span>
    </div>

    <!-- Hero Card Matrimonio -->
    <div class="event-hero-card">
      <div class="hero-watermark" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>
      </div>

      <div class="hero-content">
        <div class="hero-eyebrow">
          <span class="rule"></span>
          <span>Matrimonio di</span>
        </div>

        <h1 class="hero-spouses font-serif">
          {eventDetail.event.spouse1_name} <span class="amp">&amp;</span> {eventDetail.event.spouse2_name}
        </h1>

        <!-- Code & Quick actions -->
        <div class="hero-meta-strip">
          <button
            class="code-chip"
            onclick={() => copyInviteCode(eventDetail.event.invite_code)}
            title="Tocca per copiare il codice invito"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Codice: <strong>{eventDetail.event.invite_code}</strong></span>
            {#if copied}
              <span class="copied-tooltip">Copiato!</span>
            {:else}
              <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            {/if}
          </button>
        </div>

        <div class="hero-cta-wrap">
          <button class="btn btn-primary hero-live-btn" onclick={() => appState.selectEvent(eventDetail.event)}>
            {#if eventDetail.is_couple}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
              <span>Apri Console Sposi</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Entra nella festa live</span>
            {/if}
            <svg class="cta-arrow" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Statistiche compatte a 3 colonne orizzontali -->
    <div class="detail-stats-grid">
      <div class="stat-pill-card">
        <div class="stat-icon guests-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-num font-serif">{eventDetail.stats.guests_count}</span>
          <span class="stat-label">Ospiti</span>
        </div>
      </div>

      <div class="stat-pill-card">
        <div class="stat-icon photos-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-num font-serif">{eventDetail.stats.photos_count}</span>
          <span class="stat-label">Foto</span>
        </div>
      </div>

      <div class="stat-pill-card">
        <div class="stat-icon quiz-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-num font-serif">{eventDetail.stats.quiz_count}</span>
          <span class="stat-label">Quiz</span>
        </div>
      </div>
    </div>

    <!-- Segmented Tab Bar a 3 colonne bilanciate -->
    <div class="detail-tabs-segment" role="tablist" aria-label="Sezioni evento">
      <button
        class="segment-btn"
        class:active={activeSection === 'photos'}
        onclick={() => activeSection = 'photos'}
        role="tab"
        aria-selected={activeSection === 'photos'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
        <span>Galleria</span>
      </button>

      <button
        class="segment-btn"
        class:active={activeSection === 'quiz'}
        onclick={() => activeSection = 'quiz'}
        role="tab"
        aria-selected={activeSection === 'quiz'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        <span>Quiz</span>
      </button>

      <button
        class="segment-btn"
        class:active={activeSection === 'participants'}
        onclick={() => activeSection = 'participants'}
        role="tab"
        aria-selected={activeSection === 'participants'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Ospiti</span>
      </button>
    </div>

    <!-- Contenuti delle schede -->
    <div class="tab-panel">
      {#if activeSection === 'photos'}
        {#if photos.length === 0}
          <div class="empty-state-card">
            <div class="empty-state-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </div>
            <h3 class="font-serif empty-state-title">Nessuna foto ancora</h3>
            <p class="empty-state-sub">Tutti gli scatti condivisi durante la festa appariranno in questo album.</p>
          </div>
        {:else}
          <div class="photo-grid">
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
          </div>
        {/if}

      {:else if activeSection === 'quiz'}
        {#if quizSubmissions.length === 0}
          <div class="empty-state-card">
            <div class="empty-state-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <h3 class="font-serif empty-state-title">Nessuna risposta ai quiz</h3>
            <p class="empty-state-sub">
              {eventDetail.is_couple ? 'Le risposte inviate dagli ospiti appariranno qui.' : 'Le tue risposte alle sfide appariranno qui.'}
            </p>
          </div>
        {:else}
          <div class="submissions-list">
            {#each quizSubmissions as sub (sub.id)}
              <div class="submission-card">
                <div class="sub-header">
                  <div class="sub-author-wrap">
                    <span class="sub-avatar">{formatName(sub.author.split(' ')[0])[0] || '?'}</span>
                    <span class="sub-author">{formatName(sub.author.split(' ')[0])} {formatName(sub.author.split(' ')[1] || '')}</span>
                  </div>
                  <span class="sub-type" class:quiz={sub.challenge_type === 'quiz'} class:vote={sub.challenge_type === 'vote'}>
                    {sub.challenge_type === 'quiz' ? 'Quiz' : 'Voto'}
                  </span>
                </div>
                <div class="sub-challenge">{sub.challenge_title}</div>
                <div class="sub-answer-box">
                  <div class="sub-answer">
                    <span class="ans-label">Risposta:</span>
                    <strong class="ans-text">{sub.answer_text || '—'}</strong>
                  </div>
                  {#if sub.correct_answer}
                    <span class="correct-badge" class:right={sub.answer_text?.toLowerCase() === sub.correct_answer?.toLowerCase()}>
                      {sub.answer_text?.toLowerCase() === sub.correct_answer?.toLowerCase() ? '✓ Corretta' : `✗ Era: ${sub.correct_answer}`}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

      {:else if activeSection === 'participants'}
        <div class="participants-list">
          {#each participants as p, i (p.id)}
            <div class="participant-card" class:is-me={p.id === eventDetail.my_user_id} class:top-rank={i < 3}>
              <div class="p-rank-col">
                {#if i === 0}
                  <span class="rank-medal gold" title="1° Posto">🥇</span>
                {:else if i === 1}
                  <span class="rank-medal silver" title="2° Posto">🥈</span>
                {:else if i === 2}
                  <span class="rank-medal bronze" title="3° Posto">🥉</span>
                {:else}
                  <span class="p-rank">{i + 1}</span>
                {/if}
              </div>

              <span class="p-avatar" style="--hue: {(i * 47) % 360}">{formatName(p.first_name)[0]}</span>
              
              <div class="p-info">
                <div class="p-name-line">
                  <span class="p-name">{formatName(p.first_name)} {formatName(p.last_name)}</span>
                  {#if p.id === eventDetail.my_user_id}
                    <span class="you-badge">Tu</span>
                  {/if}
                </div>
                <span class="p-role">
                  {#if p.role === 'couple'}
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
                    Sposi
                  {:else}
                    Ospite
                  {/if}
                </span>
              </div>
              <span class="p-points font-serif">{p.total_points} <small>pt</small></span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

{:else}
  <!-- Events List -->
  <div class="dashboard-container">
    <div class="dashboard-header">
      <div class="header-titles">
        <div class="eyebrow-tag">
          <span class="rule"></span>
          <span>Area Personale</span>
        </div>
        <h1 class="page-title font-serif">I tuoi <span class="gold-gradient-text">Matrimoni</span></h1>
        <p class="page-lead">Tutti i matrimoni a cui partecipi o che hai creato.</p>
      </div>
    </div>

    {#if appState.dashboardLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p class="font-serif">Caricamento matrimoni in corso...</p>
      </div>
    {:else if appState.dashboardEvents.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </div>
        <h3 class="font-serif">Nessun matrimonio ancora</h3>
        <p>Crea un nuovo matrimonio o partecipa con un codice invito per iniziare subito a giocare e collezionare ricordi.</p>
        <div class="empty-actions">
          <button class="btn btn-primary" onclick={() => appState.setAuthView('create')}>Crea matrimonio</button>
          <button class="btn btn-secondary" onclick={() => appState.setAuthView('join')}>Ho un codice invito</button>
        </div>
      </div>
    {:else}
      <div class="events-grid">
        <!-- Card Azione: Crea o Aggiungi -->
        <div class="event-card event-actions-card">
          <div class="actions-card-top">
            <span class="event-actions-icon">+</span>
            <span class="event-names font-serif">Altro Matrimonio</span>
          </div>
          <span class="event-actions-hint">Crea una nuova festa oppure partecipa inserendo un codice invito.</span>
          <div class="event-actions-buttons">
            <button class="btn btn-primary btn-sm" onclick={() => appState.setAuthView('create')}>Crea nuovo</button>
            <button class="btn btn-secondary btn-sm" onclick={() => appState.setAuthView('join')}>Unisciti</button>
          </div>
        </div>

        {#each appState.dashboardEvents as ev (ev.event.id)}
          <button class="event-card event-item-card" onclick={() => openEvent(ev)}>
            <div class="event-card-header">
              <span class="event-names font-serif">{ev.event.spouse1_name} &amp; {ev.event.spouse2_name}</span>
              <span class="event-role-chip" class:couple={ev.role === 'couple'}>
                {#if ev.role === 'couple'}
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
                  <span>Sposi</span>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                  <span>Ospite</span>
                {/if}
              </span>
            </div>

            <div class="event-card-stats">
              <span class="event-stat">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                {ev.guests_count} ospiti
              </span>
              <span class="event-stat">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                {ev.photos_count} foto
              </span>
              <span class="event-stat points">
                {ev.total_points} pt
              </span>
            </div>

            <div class="event-card-footer">
              <span class="event-card-code">
                Codice: <strong>{ev.event.invite_code}</strong>
              </span>
              <span class="event-card-arrow">
                <span>Dettagli</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ==========================================================================
     Dashboard Container
     ========================================================================== */
  .dashboard-container {
    max-width: 960px;
    margin: 0 auto;
    padding: 16px 16px 90px;
  }

  .dashboard-header {
    margin-bottom: 24px;
  }

  .eyebrow-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--wine, #8c2f4b);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 6px;
  }

  .eyebrow-tag .rule {
    width: 20px;
    height: 1px;
    background: currentColor;
    opacity: 0.6;
  }

  .page-title {
    font-size: clamp(2.2rem, 6vw, 3.2rem);
    line-height: 1.05;
    color: var(--text-main, #241c20);
    margin-bottom: 6px;
  }

  .page-lead {
    color: var(--text-muted, #6e6167);
    font-size: 0.95rem;
  }

  /* ==========================================================================
     Events Grid (Dashboard List)
     ========================================================================== */
  .events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 16px;
  }

  .event-card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 20px;
    border-radius: 24px;
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.1);
    box-shadow: 0 10px 24px -14px rgba(106, 32, 55, 0.12);
    text-align: left;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .event-item-card {
    cursor: pointer;
  }

  .event-item-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 18px 36px -16px rgba(106, 32, 55, 0.2);
    border-color: rgba(140, 47, 75, 0.25);
  }

  .event-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .event-names {
    font-size: 1.35rem;
    font-weight: 600;
    line-height: 1.15;
    color: var(--text-main, #241c20);
  }

  .event-role-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    background: rgba(36, 28, 32, 0.05);
    color: var(--text-muted, #6e6167);
    flex-shrink: 0;
  }

  .event-role-chip.couple {
    background: var(--wine-tint, #f5e4e9);
    color: var(--wine, #8c2f4b);
    border: 1px solid rgba(140, 47, 75, 0.2);
  }

  .event-card-stats {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }

  .event-stat {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: var(--text-muted, #6e6167);
    font-weight: 500;
  }

  .event-stat.points {
    margin-left: auto;
    font-weight: 700;
    color: var(--wine, #8c2f4b);
    background: rgba(140, 47, 75, 0.06);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .event-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid rgba(36, 28, 32, 0.06);
  }

  .event-card-code {
    font-size: 0.8rem;
    color: var(--text-muted, #6e6167);
  }

  .event-card-code strong {
    color: var(--text-main, #241c20);
    letter-spacing: 0.08em;
  }

  .event-card-arrow {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--wine, #8c2f4b);
  }

  .event-actions-card {
    background: linear-gradient(135deg, rgba(201, 169, 110, 0.06) 0%, rgba(140, 47, 75, 0.04) 100%);
    border: 1.5px dashed rgba(201, 169, 110, 0.4);
  }

  .actions-card-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .event-actions-icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--gold-primary, #c9a96e);
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
  }

  .event-actions-hint {
    font-size: 0.82rem;
    color: var(--text-muted, #6e6167);
    line-height: 1.4;
    margin-bottom: 16px;
  }

  .event-actions-buttons {
    display: flex;
    gap: 8px;
  }

  /* ==========================================================================
     Event Detail View (Selected Event)
     ========================================================================== */
  .dashboard-detail {
    max-width: 820px;
    margin: 0 auto;
    padding: 12px 14px 100px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .detail-nav-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
  }

  .back-pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    background: #ffffff;
    border: 1px solid rgba(36, 28, 32, 0.1);
    color: var(--text-muted, #6e6167);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    transition: all 0.15s ease;
  }

  .back-pill-btn:hover {
    color: var(--wine, #8c2f4b);
    border-color: rgba(140, 47, 75, 0.3);
    transform: translateX(-2px);
  }

  .detail-role-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 700;
    background: rgba(36, 28, 32, 0.06);
    color: var(--text-muted, #6e6167);
  }

  .detail-role-badge.couple {
    background: var(--grad-gold-rose);
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(140, 47, 75, 0.25);
  }

  /* ==========================================================================
     Hero Card (Romantic & Editorial)
     ========================================================================== */
  .event-hero-card {
    position: relative;
    overflow: hidden;
    padding: 22px 20px;
    border-radius: 28px;
    background: linear-gradient(145deg, #ffffff 0%, #fffbf8 50%, #fdf5f7 100%);
    border: 1px solid rgba(140, 47, 75, 0.14);
    box-shadow: 0 16px 36px -18px rgba(106, 32, 55, 0.18);
  }

  .hero-watermark {
    position: absolute;
    right: -24px;
    bottom: -32px;
    color: var(--wine, #8c2f4b);
    opacity: 0.05;
    pointer-events: none;
  }

  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .hero-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--wine, #8c2f4b);
    font-size: 0.8rem;
    font-weight: 500;
    font-style: italic;
    letter-spacing: 0.04em;
  }

  .hero-eyebrow .rule {
    width: 24px;
    height: 1px;
    background: var(--wine, #8c2f4b);
    opacity: 0.5;
  }

  .hero-spouses {
    font-size: clamp(2rem, 7vw, 2.9rem);
    font-weight: 600;
    line-height: 1.05;
    color: var(--text-main, #241c20);
    letter-spacing: -0.01em;
  }

  .hero-spouses .amp {
    font-style: italic;
    color: var(--wine, #8c2f4b);
    font-weight: 400;
    margin: 0 3px;
  }

  .hero-meta-strip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .code-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--gold-dark, #8a6d3b);
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .code-chip:hover {
    background: rgba(201, 169, 110, 0.2);
  }

  .code-chip strong {
    letter-spacing: 0.1em;
    font-weight: 700;
    color: var(--text-main, #241c20);
  }

  .copy-icon {
    opacity: 0.6;
    margin-left: 2px;
  }

  .copied-tooltip {
    color: var(--wine, #8c2f4b);
    font-weight: 700;
    font-size: 0.75rem;
  }

  .hero-cta-wrap {
    margin-top: 4px;
  }

  .hero-live-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 13px 20px;
    font-size: 0.95rem;
    font-weight: 700;
    box-shadow: 0 10px 22px -8px rgba(140, 47, 75, 0.5);
  }

  .hero-live-btn .cta-arrow {
    transition: transform 0.2s ease;
    margin-left: 4px;
  }

  .hero-live-btn:hover .cta-arrow {
    transform: translateX(4px);
  }

  /* ==========================================================================
     Statistiche orizzontali compatte (3 colonne bilanciate)
     ========================================================================== */
  .detail-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .stat-pill-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    padding: 14px 8px;
    border-radius: 20px;
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.1);
    box-shadow: 0 8px 20px -12px rgba(106, 32, 55, 0.1);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .stat-pill-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px -12px rgba(106, 32, 55, 0.18);
  }

  .stat-icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .guests-icon {
    background: rgba(125, 168, 212, 0.14);
    color: #4a7cb0;
  }

  .photos-icon {
    background: rgba(201, 98, 127, 0.14);
    color: #b94b68;
  }

  .quiz-icon {
    background: rgba(201, 169, 110, 0.18);
    color: #8a6d3b;
  }

  .stat-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-num {
    font-size: 1.65rem;
    font-weight: 600;
    line-height: 1;
    color: var(--text-main, #241c20);
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-muted, #6e6167);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ==========================================================================
     Segmented Tabs Control (3 colonne fisse, NESSUN wrapping lumpy)
     ========================================================================== */
  .detail-tabs-segment {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(36, 28, 32, 0.05);
    border: 1px solid rgba(36, 28, 32, 0.06);
  }

  .segment-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    padding: 6px 10px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--text-muted, #6e6167);
    font-family: var(--font-sans);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .segment-btn svg {
    flex-shrink: 0;
  }

  .segment-btn:hover {
    color: var(--text-main, #241c20);
  }

  .segment-btn.active {
    background: #ffffff;
    color: var(--wine, #8c2f4b);
    font-weight: 700;
    box-shadow: 0 4px 14px rgba(36, 28, 32, 0.08);
  }

  @media (max-width: 440px) {
    .segment-btn {
      font-size: 0.74rem;
      padding: 6px 4px;
      gap: 4px;
      min-height: 36px;
    }
  }

  /* ==========================================================================
     Tab Panels & Card Lists
     ========================================================================== */
  .tab-panel {
    margin-top: 4px;
  }

  .empty-state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 38px 20px;
    border-radius: 24px;
    background: #ffffff;
    border: 1px dashed rgba(140, 47, 75, 0.2);
  }

  .empty-state-icon {
    display: grid;
    place-items: center;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: var(--wine-tint, #f5e4e9);
    color: var(--wine, #8c2f4b);
    margin-bottom: 4px;
  }

  .empty-state-title {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--text-main, #241c20);
  }

  .empty-state-sub {
    font-size: 0.86rem;
    color: var(--text-muted, #6e6167);
    max-width: 38ch;
  }

  /* ── Galleria Foto ──────────────────────────────────────────────────────── */
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  @media (min-width: 600px) {
    .photo-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
  }

  .photo-card {
    position: relative;
    border-radius: 18px;
    overflow: hidden;
    aspect-ratio: 1;
    background: rgba(36, 28, 32, 0.04);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
  }

  .photo-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
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
    background: linear-gradient(to top, rgba(18, 10, 14, 0.82) 0%, transparent 100%);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .photo-author {
    font-size: 0.74rem;
    font-weight: 700;
    color: #ffffff;
  }

  .photo-challenge {
    font-size: 0.66rem;
    color: rgba(255, 255, 255, 0.75);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Quiz Submissions ───────────────────────────────────────────────────── */
  .submissions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .submission-card {
    padding: 16px;
    border-radius: 20px;
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.1);
    box-shadow: 0 6px 18px -10px rgba(106, 32, 55, 0.08);
  }

  .sub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .sub-author-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sub-avatar {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--wine-tint, #f5e4e9);
    color: var(--wine, #8c2f4b);
    font-size: 0.75rem;
    font-weight: 700;
  }

  .sub-author {
    font-weight: 700;
    font-size: 0.86rem;
    color: var(--text-main, #241c20);
  }

  .sub-type {
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .sub-type.quiz {
    background: rgba(123, 184, 158, 0.15);
    color: #2e6650;
  }

  .sub-type.vote {
    background: rgba(212, 132, 154, 0.15);
    color: #8c2f4b;
  }

  .sub-challenge {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--text-muted, #6e6167);
    margin-bottom: 8px;
  }

  .sub-answer-box {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 12px;
    background: rgba(36, 28, 32, 0.03);
  }

  .sub-answer {
    font-size: 0.84rem;
    color: var(--text-main, #241c20);
  }

  .ans-label {
    color: var(--text-muted, #6e6167);
    margin-right: 4px;
  }

  .correct-badge {
    font-size: 0.74rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(192, 57, 43, 0.1);
    color: #c0392b;
  }

  .correct-badge.right {
    background: rgba(39, 174, 96, 0.12);
    color: #27ae60;
  }

  /* ── Partecipanti List ──────────────────────────────────────────────────── */
  .participants-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .participant-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 18px;
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.08);
    box-shadow: 0 4px 12px -8px rgba(106, 32, 55, 0.08);
  }

  .participant-card.is-me {
    border-color: rgba(140, 47, 75, 0.35);
    background: linear-gradient(135deg, #ffffff 0%, #fff7f9 100%);
  }

  .p-rank-col {
    width: 28px;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
  }

  .rank-medal {
    font-size: 1.15rem;
    line-height: 1;
  }

  .p-rank {
    font-weight: 700;
    font-size: 0.88rem;
    color: var(--text-muted, #6e6167);
    font-variant-numeric: tabular-nums;
  }

  .p-avatar {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 0.86rem;
    font-weight: 700;
    color: #ffffff;
    background: hsl(var(--hue, 340) 45% 48%);
    flex-shrink: 0;
  }

  .p-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .p-name-line {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .p-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-main, #241c20);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .you-badge {
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--wine, #8c2f4b);
    color: #ffffff;
  }

  .p-role {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--text-muted, #6e6167);
  }

  .p-points {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--wine, #8c2f4b);
    font-variant-numeric: tabular-nums;
  }

  .p-points small {
    font-size: 0.75rem;
    font-weight: 500;
    opacity: 0.8;
  }

  /* ── Loading & Empty states ─────────────────────────────────────────────── */
  .dashboard-loading-view,
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 60px 16px;
    text-align: center;
  }

  .loading-title {
    font-size: 1.15rem;
    color: var(--text-muted, #6e6167);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 48px 20px;
    text-align: center;
    border-radius: 28px;
    background: #ffffff;
    border: 1px dashed rgba(140, 47, 75, 0.2);
  }

  .empty-icon {
    color: var(--wine, #8c2f4b);
    opacity: 0.7;
  }

  .empty-state h3 {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-main, #241c20);
  }

  .empty-state p {
    max-width: 42ch;
    color: var(--text-muted, #6e6167);
    font-size: 0.88rem;
  }

  .empty-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
