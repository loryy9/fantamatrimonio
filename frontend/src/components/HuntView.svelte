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
    <h1 class="page-title font-serif">Caccia al Tesoro</h1>
    <p class="page-desc">
      Trova i soggetti, scatta le foto richieste e conquista punti per scalare la classifica!
    </p>
  </div>

  {#if appState.isCouple}
    <div class="couple-hint-banner glass-card">
      <span class="hint-text">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-svg-icon"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
        <strong>Area Sposi:</strong> vuoi aggiungere o modificare le missioni fotografiche?
      </span>
      <button class="btn btn-secondary btn-sm" onclick={() => appState.setGameTab('manage')}>
        Pannello Sposi →
      </button>
    </div>
  {/if}

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
                {#if isDone}
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Completata
                {:else}
                  +{hunt.points} PT
                {/if}
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
  .header-box { padding: 0 4px; }
  .header-box::after { content: ''; display: block; width: 44px; height: 2px; border-radius: 2px; background: var(--wine); margin-top: 14px; }
  .page-title { font-family: var(--font-display); font-size: clamp(2rem, 6vw, 2.8rem); font-weight: 600; line-height: 1.05; letter-spacing: -0.01em; color: var(--text-main); }
  .page-desc { font-size: 0.92rem; font-style: italic; color: #6b5f64; margin-top: 8px; line-height: 1.5; max-width: 560px; }

  .hunt-container { display: flex; flex-direction: column; gap: 22px; }
  .hunt-list { display: flex; flex-direction: column; gap: 14px; }
  .hunt-card { position: relative; padding: 22px 20px; display: flex; flex-direction: column; gap: 10px; border-radius: 26px; background: #fff; border: 1px solid rgba(36,28,32,.07); box-shadow: 0 18px 34px -24px rgba(106,32,55,.4); overflow: hidden; }
  .hunt-card::before { content: ''; position: absolute; left: 0; top: 22px; bottom: 22px; width: 3px; border-radius: 0 3px 3px 0; background: var(--wine); }
  .card-completed { background: linear-gradient(160deg, rgba(127,169,148,.12) 0%, #fff 55%); border-color: rgba(127,169,148,.4); }
  .card-completed::before { background: #7fa994; }
  .hunt-card-header { display: flex; justify-content: space-between; align-items: center; }
  .done-check { display: flex; align-items: center; gap: 5px; font-size: .8rem; font-weight: 700; color: #3f6d58; }
  .done-icon { color: #7fa994; }
  .hunt-title { font-size: 1.45rem; font-weight: 600; line-height: 1.15; color: var(--text-main); }
  .hunt-desc { font-size: .9rem; color: #6b5f64; line-height: 1.5; }
  .completed-box { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(127,169,148,.14); border: 1px solid rgba(127,169,148,.35); padding: 12px 14px; border-radius: 18px; margin-top: 4px; }
  .completed-info { display: flex; flex-direction: column; font-size: .82rem; color: var(--text-main); }
  .points-awarded { font-weight: 700; color: #7a5a1c; font-size: .85rem; }
  .completed-thumb { width: 48px; height: 48px; border-radius: 14px; object-fit: cover; border: 2px solid #fff; box-shadow: 0 6px 12px -6px rgba(36,28,32,.4); }
  .hidden-file { display: none; }
  .empty-state { text-align: center; padding: 44px 20px; border-radius: 26px; }
  .empty-icon { width: 68px; height: 68px; margin: 0 auto 12px; border-radius: 50%; background: var(--wine-tint); color: var(--wine); display: flex; align-items: center; justify-content: center; }
  .empty-title { font-family: var(--font-display); font-size: 1.4rem; font-weight: 600; color: var(--text-main); }
  .empty-desc { font-size: .85rem; color: #6b5f64; margin-top: 4px; }
  .ended-banner { display: flex; align-items: center; gap: 12px; padding: 16px 18px; background: var(--wine-tint); border: 1px solid rgba(140,47,75,.18); border-radius: 22px; box-shadow: none; }
  .ended-banner-icon { color: var(--wine); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ended-banner-text { display: flex; flex-direction: column; gap: 2px; font-size: .82rem; color: #6b5f64; }
  .ended-banner-text strong { font-size: .9rem; color: var(--wine-deep); }
  .ended-mission-notice { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 14px; background: var(--bg-surface-elevated); border: 1px dashed rgba(36,28,32,.18); border-radius: 999px; color: #6b5f64; font-size: .82rem; font-weight: 600; }
  .couple-hint-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-radius: 22px; background: #fff; border: 1px solid rgba(36,28,32,.07); box-shadow: 0 18px 34px -26px rgba(106,32,55,.4); font-size: .88rem; color: var(--text-main); }
  .couple-hint-banner :global(.inline-svg-icon) { color: var(--wine); vertical-align: -3px; }
  @media (max-width: 600px) { .couple-hint-banner { flex-direction: column; align-items: flex-start; gap: 10px; } }
</style>
