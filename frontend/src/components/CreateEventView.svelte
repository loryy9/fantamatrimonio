<script>
  import { appState } from '../lib/state.svelte.js';
  import OnboardingSetup from './OnboardingSetup.svelte';

  let spouse1 = $state('');
  let spouse2 = $state('');
  let enableTimer = $state(false);
  let startTime = $state('');
  let endTime = $state('');
  let coupleFirst = $state('');
  let coupleLast = $state('');
  let coupleWord = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let copied = $state('');

  // 'form' (creazione) | 'setup' (onboarding quiz/caccia/momenti) | 'share' (codice invito)
  let currentStep = $state('form');

  const inviteLink = $derived(
    appState.pendingInvite ? `${window.location.origin}/?code=${appState.pendingInvite}` : ''
  );

  async function handleSubmit(e) {
    e.preventDefault();
    errorMessage = '';

    if (!spouse1.trim() || !spouse2.trim()) {
      errorMessage = 'Inserisci il nome di entrambi gli sposi.';
      return;
    }
    if (enableTimer) {
      if (!startTime || !endTime) {
        errorMessage = 'Imposta sia l\'orario di inizio che quello di fine.';
        return;
      }
      if (new Date(endTime) <= new Date(startTime)) {
        errorMessage = 'L\'orario di fine deve essere successivo a quello di inizio.';
        return;
      }
    }
    if (!coupleFirst.trim() || !coupleLast.trim() || !coupleWord.trim()) {
      errorMessage = 'Compila tutti i campi di accesso degli sposi.';
      return;
    }

    isSubmitting = true;
    const res = await appState.createEvent({
      spouse1_name: spouse1.trim(),
      spouse2_name: spouse2.trim(),
      enable_timer: enableTimer,
      start_time: enableTimer ? new Date(startTime).toISOString() : null,
      end_time: enableTimer ? new Date(endTime).toISOString() : null,
      couple_first_name: coupleFirst.trim(),
      couple_last_name: coupleLast.trim(),
      couple_secret_word: coupleWord.trim()
    });
    isSubmitting = false;

    if (!res.success) {
      errorMessage = res.error || 'Non è stato possibile creare il matrimonio.';
    } else {
      // Passa allo step 2: configurazione attività
      currentStep = 'setup';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function copy(kind, text) {
    try {
      await navigator.clipboard.writeText(text);
      copied = kind;
      setTimeout(() => { if (copied === kind) copied = ''; }, 2000);
    } catch {
      appState.showToast('Copia non riuscita, seleziona il testo a mano.', 'error');
    }
  }

  async function share() {
    const text = `Unisciti al nostro matrimonio! Codice invito: ${appState.pendingInvite}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Fanta Matrimonio', text, url: inviteLink });
      } catch { /* dismissed */ }
    } else {
      copy('link', inviteLink);
    }
  }
</script>

{#if currentStep === 'setup'}
  <OnboardingSetup onComplete={() => { currentStep = 'share'; window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
{:else if currentStep === 'share' || appState.pendingInvite}
  <div class="reveal auth-card">
    <span class="reveal-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
    </span>
    <span class="eyebrow">Il vostro matrimonio è pronto</span>
    <h1 class="page-title">
      {appState.event?.spouse1_name} <span class="gold-gradient-text">&amp;</span> {appState.event?.spouse2_name}
    </h1>
    <p class="page-lead">Condividi questo codice con gli invitati: lo useranno per entrare nell'evento.</p>

    <div class="code-box" aria-label="Codice invito">{appState.pendingInvite}</div>

    <div class="reveal-actions">
      <button class="btn btn-secondary" onclick={() => copy('code', appState.pendingInvite)}>
        {#if copied === 'code'}
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Codice copiato
        {:else}
          Copia codice
        {/if}
      </button>
      <button class="btn btn-secondary" onclick={() => copy('link', inviteLink)}>
        {#if copied === 'link'}
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Link copiato
        {:else}
          Copia link invito
        {/if}
      </button>
      <button class="btn btn-secondary" onclick={share}>Condividi</button>
    </div>

    <div class="link-line">{inviteLink}</div>

    <div class="reveal-footer-actions">
      <button class="btn btn-primary btn-lg" onclick={() => appState.finishOnboarding()}>
        Entra nel matrimonio →
      </button>
      <button class="link-btn-subtle" onclick={() => currentStep = 'setup'}>
        ← Modifica ancora le attività
      </button>
      <button
        type="button"
        class="link-btn-danger"
        onclick={async () => {
          if (confirm("Sei sicuro di voler annullare ed eliminare questo matrimonio dal database?")) {
            await appState.cancelEventCreation();
          }
        }}
      >
        Annulla ed elimina questo matrimonio dal database
      </button>
    </div>
  </div>
{:else}
  <div class="create-layout">
    <aside class="create-aside">
      <span class="eyebrow">Per gli sposi</span>
      <h1 class="page-title">Create il vostro <span class="gold-gradient-text">matrimonio</span></h1>
      <p class="page-lead">
        Tre passaggi e l'evento è online. Riceverete un codice invito da condividere con gli ospiti.
      </p>

      <ol class="steps">
        <li><span class="step-num">1</span><div><strong>I vostri nomi</strong><span>Compariranno nell'intestazione del gioco.</span></div></li>
        <li><span class="step-num">2</span><div><strong>Le tempistiche</strong><span>Facoltative: limita i giochi a una finestra oraria.</span></div></li>
        <li><span class="step-num">3</span><div><strong>Il vostro accesso</strong><span>Con queste credenziali gestirete l'evento.</span></div></li>
      </ol>

      <p class="switch">
        Sei un invitato?
        <button type="button" class="link-btn" onclick={() => appState.setAuthView('join')}>Entra con un codice</button>
      </p>

      <button type="button" class="link-btn-back" onclick={() => appState.setAuthView('entry')}>
        ← Annulla e torna alla pagina iniziale
      </button>
    </aside>

    <form class="auth-card create-form" onsubmit={handleSubmit}>
      {#if errorMessage}
        <div class="form-error" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          <span>{errorMessage}</span>
        </div>
      {/if}

      <fieldset>
        <legend><span class="step-num">1</span> I vostri nomi</legend>
        <div class="row">
          <div class="input-group">
            <label for="spouse1" class="input-label">Sposo/a 1</label>
            <input id="spouse1" type="text" class="input-field" placeholder="Es. Giulia" bind:value={spouse1} autocomplete="off" required />
          </div>
          <div class="input-group">
            <label for="spouse2" class="input-label">Sposo/a 2</label>
            <input id="spouse2" type="text" class="input-field" placeholder="Es. Marco" bind:value={spouse2} autocomplete="off" required />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend><span class="step-num">2</span> Le tempistiche</legend>
        <label class="switch-row">
          <input type="checkbox" bind:checked={enableTimer} />
          <span class="switch-track"><span class="switch-thumb"></span></span>
          <span class="switch-text">
            <strong>Attiva orari di gioco</strong>
            <span>Limita i giochi a una finestra oraria</span>
          </span>
        </label>

        {#if enableTimer}
          <div class="row timer-row">
            <div class="input-group">
              <label for="startTime" class="input-label">Inizio</label>
              <input id="startTime" type="datetime-local" class="input-field" bind:value={startTime} />
            </div>
            <div class="input-group">
              <label for="endTime" class="input-label">Fine</label>
              <input id="endTime" type="datetime-local" class="input-field" bind:value={endTime} />
            </div>
          </div>
        {/if}
      </fieldset>

      <fieldset>
        <legend><span class="step-num">3</span> Il vostro accesso</legend>
        <div class="row">
          <div class="input-group">
            <label for="coupleFirst" class="input-label">Nome</label>
            <input id="coupleFirst" type="text" class="input-field" bind:value={coupleFirst} autocomplete="given-name" required />
          </div>
          <div class="input-group">
            <label for="coupleLast" class="input-label">Cognome</label>
            <input id="coupleLast" type="text" class="input-field" bind:value={coupleLast} autocomplete="family-name" required />
          </div>
        </div>
        <div class="input-group">
          <label for="coupleWord" class="input-label">Parola segreta</label>
          <input id="coupleWord" type="text" class="input-field" bind:value={coupleWord} autocomplete="off" required />
          <span class="field-hint">Vi servirà, con nome e cognome, per rientrare come sposi.</span>
        </div>
      </fieldset>

      <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
        {#if isSubmitting}
          <div class="spinner spinner-on-dark"></div>
          <span>Creazione in corso...</span>
        {:else}
          <span>Crea il matrimonio</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        {/if}
      </button>
    </form>
  </div>
{/if}

<style>
  .create-layout {
    display: grid;
    grid-template-columns: minmax(0, 380px) 1fr;
    gap: 56px;
    align-items: start;
  }

  .create-aside {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    position: sticky;
    top: 96px;
  }

  .eyebrow {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--wine);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.15);
  }

  .create-aside .page-title {
    font-size: clamp(2.2rem, 4vw, 3.1rem);
    line-height: 1.05;
    color: var(--text-main);
    margin: 0;
  }

  .create-aside .page-title::after {
    content: '';
    display: block;
    width: 40px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin-top: 14px;
  }

  .create-aside .page-lead {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.2rem;
    line-height: 1.5;
    color: #6b5f64;
    margin: 0;
  }

  .steps {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 8px;
    position: relative;
  }

  .steps li {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    position: relative;
  }

  .steps li:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 13px;
    top: 30px;
    bottom: -14px;
    width: 1px;
    background: rgba(140, 47, 75, 0.2);
  }

  .steps li div {
    display: flex;
    flex-direction: column;
    font-size: 0.9rem;
    color: #6b5f64;
  }

  .steps li strong {
    color: var(--text-main);
    font-size: 0.98rem;
  }

  .step-num {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--grad-gold-rose);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 800;
    box-shadow: 0 4px 10px rgba(140, 47, 75, 0.25);
  }

  .switch {
    font-size: 0.92rem;
    color: var(--text-muted);
    margin-top: 8px;
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 26px;
  }

  fieldset {
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  legend {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 14px;
    padding: 0;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .timer-row {
    margin-top: 16px;
  }

  .switch-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: 22px;
    border: 1px solid rgba(36, 28, 32, 0.08);
    background: var(--bg-primary);
    cursor: pointer;
  }

  .switch-row input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .switch-track {
    position: relative;
    flex-shrink: 0;
    width: 46px;
    height: 28px;
    border-radius: var(--radius-full);
    background: rgba(36, 28, 32, 0.18);
    transition: background 0.2s;
  }

  .switch-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;
  }

  .switch-row input:checked + .switch-track {
    background: var(--wine);
  }

  .switch-row input:checked + .switch-track .switch-thumb {
    transform: translateX(18px);
  }

  .switch-row input:focus-visible + .switch-track {
    outline: 2px solid var(--wine);
    outline-offset: 3px;
  }

  .switch-text {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    color: #6b5f64;
  }

  .switch-text strong {
    color: var(--text-main);
    font-size: 0.95rem;
  }

  .spinner-on-dark {
    border-color: rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
  }

  /* ---------- Invite reveal ---------- */
  .reveal {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .reveal .page-title {
    color: var(--text-main);
    margin: 0;
  }

  .reveal .page-title::after {
    content: '';
    display: block;
    width: 40px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin: 14px auto 0;
  }

  .reveal .page-lead {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.2rem;
    color: #6b5f64;
    margin: 0;
  }

  .reveal-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    color: var(--wine);
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.18);
  }

  .code-box {
    width: 100%;
    padding: 24px 22px;
    border-radius: 28px;
    background: var(--grad-dusk);
    border: 1px solid rgba(233, 201, 143, 0.3);
    box-shadow: 0 18px 40px rgba(74, 31, 51, 0.28);
    font-family: var(--font-sans);
    font-size: clamp(1.8rem, 8vw, 3rem);
    font-weight: 800;
    letter-spacing: 0.3em;
    text-indent: 0.3em;
    background-clip: padding-box;
    color: var(--gold-bright);
    user-select: all;
    overflow-wrap: anywhere;
  }

  .reveal-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .link-line {
    max-width: 100%;
    padding: 8px 16px;
    border-radius: 9999px;
    background: var(--bg-primary);
    border: 1px solid rgba(36, 28, 32, 0.07);
    color: var(--text-muted);
    font-size: 0.82rem;
    overflow-wrap: anywhere;
    user-select: all;
  }

  .reveal-footer-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .link-btn-subtle {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 9999px;
    transition: color 0.2s;
  }

  @media (hover: hover) {
    .link-btn-subtle:hover {
      color: var(--wine);
      text-decoration: underline;
    }
  }

  .link-btn-back {
    margin-top: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    transition: color 0.15s ease;
    padding: 4px 0;
  }

  @media (hover: hover) {
    .link-btn-back:hover {
      color: var(--wine);
    }
  }

  .link-btn-danger {
    margin-top: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.84rem;
    font-weight: 600;
    color: #a63552;
    transition: color 0.15s ease;
    text-decoration: underline;
  }

  @media (hover: hover) {
    .link-btn-danger:hover {
      color: #7e2740;
    }
  }

  .link-btn-subtle:focus-visible,
  .link-btn-back:focus-visible,
  .link-btn-danger:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .switch-track,
    .switch-thumb {
      transition: none;
    }
  }

  @media (max-width: 900px) {
    .create-layout {
      grid-template-columns: 1fr;
      gap: 28px;
    }
    .create-aside { position: static; }
  }

  @media (max-width: 520px) {
    .row { grid-template-columns: 1fr; gap: 0; }
    :global(.auth-card) { padding: 24px; }
  }
</style>
