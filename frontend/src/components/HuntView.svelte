<script>
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import { eventTimer } from '../lib/timer.svelte.js';
  import LockedChallenges from './LockedChallenges.svelte';

  const huntChallenges = $derived(
    appState.challenges.filter(c => c.challenge_type === 'hunt' && c.active !== false)
  );

  let uploadingId = $state(null);
  let fileInputs = $state({});

  function triggerUpload(challengeId) {
    if (eventTimer.status === 'ended') {
      appState.showToast('Il tempo per completare le missioni è terminato!', 'info');
      return;
    }
    if (fileInputs[challengeId]) {
      fileInputs[challengeId].click();
    }
  }

  async function handleFileSelected(challengeId, e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (eventTimer.status === 'ended') {
      appState.showToast('Il tempo per completare le missioni è terminato!', 'info');
      return;
    }

    uploadingId = challengeId;
    try {
      await api.submitHunt(challengeId, file);
      appState.showToast('Missione completata con successo!', 'success', 25);
      uploadingId = null;
      if (fileInputs[challengeId]) fileInputs[challengeId].value = '';

      // Aggiornamento dati in background senza bloccare la UI
      Promise.all([
        appState.refreshUser(true),
        appState.refreshMySubmissions(),
        appState.refreshLeaderboard(),
        appState.refreshGallery()
      ]).catch(e => console.warn('Background refresh hunt:', e));
    } catch (err) {
      appState.showToast(err.message || 'Errore durante l\'invio della missione', 'error');
      uploadingId = null;
      if (fileInputs[challengeId]) fileInputs[challengeId].value = '';
    }
  }
</script>

<div class="hunt-container">
  <div class="header-box">
    <h1 class="page-title font-serif gold-gradient-text">Caccia al Tesoro</h1>
    <p class="page-desc">
      Trova i soggetti, scatta le foto richieste e conquista punti per scalare la classifica!
    </p>
  </div>

  {#if eventTimer.status === 'ended'}
    <div class="ended-banner glass-card">
      <div class="ended-banner-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="ended-banner-text">
        <strong>Tempo di gioco concluso!</strong>
        <span>Puoi consultare le tue missioni e foto inviate. La caccia al tesoro è ora chiusa.</span>
      </div>
    </div>
  {/if}

  {#if eventTimer.status === 'before_start'}
    <LockedChallenges
      title="Caccia al Tesoro Bloccata"
      subtitle="Gli indizi e le missioni fotografiche saranno svelati all'inizio dei giochi."
    />
  {:else}
    <div class="hunt-list">
    {#if huntChallenges.length === 0}
      <div class="empty-state glass-card">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
        </div>
        <div class="empty-title">Nessuna missione attiva</div>
        <p class="empty-desc">Le missioni di caccia al tesoro appariranno a breve!</p>
      </div>
    {:else}
      {#each huntChallenges as hunt (hunt.id)}
        {@const submission = appState.mySubmissionsByChallenge[hunt.id]}
        {@const isDone = !!submission}

        <div class="hunt-card glass-card {isDone ? 'card-completed' : ''}">
          <div class="hunt-card-header">
            <div class="hunt-badge-wrap">
              <span class="badge {isDone ? 'badge-green' : 'badge-gold'}">
                {isDone ? '✓ Completata' : `+${hunt.points} PT`}
              </span>
            </div>
            {#if isDone}
              <span class="done-check">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="done-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Fatta!
              </span>
            {/if}
          </div>

          <h3 class="hunt-title font-serif">{hunt.title}</h3>
          <p class="hunt-desc">{hunt.description}</p>

          {#if isDone}
            <div class="completed-box">
              <div class="completed-info">
                <span>Foto inviata con successo!</span>
                <span class="points-awarded">+{submission.points_awarded || hunt.points} PT guadagnati</span>
              </div>
              {#if submission.photo_url}
                <img src={submission.photo_url} alt="Foto inviata" class="completed-thumb" />
              {/if}
            </div>
          {:else}
            {#if eventTimer.status === 'ended'}
              <div class="ended-mission-notice">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Tempo scaduto · Missione non completata</span>
              </div>
            {:else}
              <div class="action-row">
                <button
                  class="btn btn-primary btn-block"
                  onclick={() => triggerUpload(hunt.id)}
                  disabled={uploadingId === hunt.id}
                >
                  {#if uploadingId === hunt.id}
                    <div class="spinner"></div>
                    <span>Ottimizzazione e invio...</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                    <span>Scatta o Carica Foto</span>
                  {/if}
                </button>

                <input
                  type="file"
                  accept="image/*"
                  class="hidden-file"
                  bind:this={fileInputs[hunt.id]}
                  onchange={(e) => handleFileSelected(hunt.id, e)}
                />
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  </div>
  {/if}
</div>

<style>
  .hunt-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .header-box {
    padding: 0 4px;
  }

  .page-title {
    font-size: 1.6rem;
    font-weight: 800;
  }

  .page-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.4;
  }

  .hunt-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .hunt-card {
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .card-completed {
    border-color: rgba(123, 184, 158, 0.35);
    background: linear-gradient(135deg, rgba(123, 184, 158, 0.06) 0%, rgba(255, 255, 255, 0.85) 100%);
  }

  .hunt-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .done-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--accent-emerald);
  }

  .done-icon {
    color: var(--accent-emerald);
  }

  .hunt-title {
    font-size: 1.15rem;
    color: var(--text-main);
  }

  .hunt-desc {
    font-size: 0.88rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .completed-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(123, 184, 158, 0.06);
    border: 1px dashed rgba(123, 184, 158, 0.3);
    padding: 10px 12px;
    border-radius: var(--radius-md);
    margin-top: 4px;
  }

  .completed-info {
    display: flex;
    flex-direction: column;
    font-size: 0.8rem;
    color: var(--text-main);
  }

  .points-awarded {
    font-weight: 800;
    color: var(--accent-emerald);
    font-size: 0.85rem;
  }

  .completed-thumb {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-sm);
    object-fit: cover;
    border: 1px solid var(--border-subtle);
  }

  .hidden-file {
    display: none;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    color: var(--accent-purple);
    margin-bottom: 10px;
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .empty-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .ended-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: linear-gradient(135deg, rgba(212, 163, 115, 0.1) 0%, rgba(255, 255, 255, 0.85) 100%);
    border: 1px solid rgba(212, 163, 115, 0.3);
    border-radius: var(--radius-md);
  }

  .ended-banner-icon {
    color: var(--accent-gold);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ended-banner-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.82rem;
    color: var(--text-main);
  }

  .ended-banner-text strong {
    font-size: 0.88rem;
    color: var(--accent-gold);
  }

  .ended-mission-notice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(140, 120, 110, 0.08);
    border: 1px dashed rgba(140, 120, 110, 0.25);
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: 0.82rem;
    font-weight: 600;
  }
</style>
