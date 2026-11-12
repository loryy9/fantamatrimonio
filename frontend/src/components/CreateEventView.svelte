<script>
  import { tick } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { copyToClipboard } from '../lib/clipboard.js';
  import OnboardingSetup from './OnboardingSetup.svelte';
  import EmailVerificationField from './EmailVerificationField.svelte';
  import SocialButtons from './SocialButtons.svelte';
  import SiteHeader from './SiteHeader.svelte';

  // Wizard: 1 Nomi & Cerimonia -> 2 Registrazione (solo se non si ha già un account) -> 'setup' -> 'share'.
  let wizardStep = $state(1);
  const totalSteps = $derived(appState.hasAccount ? 2 : 3);
  const progress = $derived(Math.round((wizardStep / totalSteps) * 100));

  // Step 2: registrazione / accesso di chi crea il matrimonio
  let authMode = $state('register'); // 'register' | 'login'
  let cFirst = $state('');
  let cLast = $state('');
  let cEmail = $state('');
  let cPassword = $state('');
  let cCode = $state('');
  let cVerified = $state(false);
  let showPassword = $state(false);
  let lEmail = $state('');
  let lPassword = $state('');

  // Step 1: Nomi & Cerimonia
  let spouse1 = $state('');
  let spouse2 = $state('');
  let eventDate = $state(localDateString());
  let enableTimer = $state(false);

  // Orari inizio e fine sfide: Giorno + Ora separati sia per inizio che per fine (nessun overflow su mobile!)
  let startDate = $state(localDateString());
  let startTime = $state('12:00');
  let endDate = $state(localDateString());
  let endTime = $state('23:30');

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  let isSubmitting = $state(false);
  let copied = $state('');

  // Sottofase onboarding post-creazione
  let currentStep = $state('form'); // 'form' | 'setup' | 'share'

  function scrollToTopInstant() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const appEl = document.getElementById('app');
      if (appEl) appEl.scrollTop = 0;
    }
  }

  // Sincronizza la data dell'evento con le date di inizio e fine
  $effect(() => {
    if (eventDate) {
      if (!startDate || startDate === endDate) {
        startDate = eventDate;
        endDate = eventDate;
      }
    }
  });

  // Data leggibile in italiano
  const readableDate = $derived.by(() => {
    if (!eventDate) return '';
    try {
      const d = new Date(eventDate);
      return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  });

  const inviteLink = $derived(
    appState.pendingInvite ? `${window.location.origin}/?code=${appState.pendingInvite}` : ''
  );

  /** Valida il passo 1 e prepara i dati dell'evento (null + toast se qualcosa non va). */
  function buildPayload() {
    if (!spouse1.trim() || !spouse2.trim()) {
      appState.showToast('Inserisci il nome di entrambi gli sposi.', 'error');
      return null;
    }
    if (!eventDate || eventDate < localDateString()) {
      appState.showToast("La data del matrimonio non può essere nel passato.", 'error');
      return null;
    }
    let startIso = null;
    let endIso = null;
    if (enableTimer) {
      if (!startDate || !startTime || !endDate || !endTime) {
        appState.showToast('Imposta sia giorno che ora di inizio e di chiusura delle sfide.', 'error');
        return null;
      }
      const dStart = new Date(`${startDate}T${startTime}`);
      const dEnd = new Date(`${endDate}T${endTime}`);
      if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
        appState.showToast('Date e orari non validi.', 'error');
        return null;
      }
      if (dStart <= new Date()) {
        appState.showToast("L'inizio dei giochi deve essere nel futuro.", 'error');
        return null;
      }
      if (dEnd <= dStart) {
        appState.showToast("La chiusura delle sfide deve essere successiva all'inizio.", 'error');
        return null;
      }
      startIso = dStart.toISOString();
      endIso = dEnd.toISOString();
    }
    return {
      spouse1_name: spouse1.trim(),
      spouse2_name: spouse2.trim(),
      enable_timer: enableTimer,
      start_time: startIso,
      end_time: endIso
    };
  }

  async function createTheEvent() {
    const payload = buildPayload();
    if (!payload) {
      wizardStep = 1;
      await tick();
      scrollToTopInstant();
      return false;
    }
    const res = await appState.createEvent(payload);
    if (!res.success) {
      appState.showToast(res.error || 'Impossibile creare il matrimonio.', 'error');
      return false;
    }
    currentStep = 'setup';
    await tick();
    scrollToTopInstant();
    return true;
  }

  // Passo 1: con un account si crea subito, altrimenti si passa alla registrazione.
  async function handleStep1(e) {
    e.preventDefault();
    if (!buildPayload()) return;
    if (appState.hasAccount) {
      isSubmitting = true;
      await createTheEvent();
      isSubmitting = false;
    } else {
      wizardStep = 2;
      await tick();
      scrollToTopInstant();
    }
  }

  async function goToStep1() {
    wizardStep = 1;
    await tick();
    scrollToTopInstant();
  }

  async function afterAuth(res) {
    if (!res.success) {
      appState.showToast(res.error, 'error');
      return;
    }
    await createTheEvent();
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!cFirst.trim() || !cLast.trim()) {
      appState.showToast('Nome e cognome sono obbligatori.', 'error');
      return;
    }
    if (cPassword.length < 6) {
      appState.showToast('La password deve contenere almeno 6 caratteri.', 'error');
      return;
    }
    if (!cVerified && cCode.trim().length !== 6) {
      appState.showToast('Verifica la tua email inserendo il codice a 6 cifre.', 'error');
      return;
    }
    isSubmitting = true;
    try {
      await afterAuth(
        await appState.register(
          {
            email: cEmail.trim(),
            password: cPassword,
            firstName: cFirst.trim(),
            lastName: cLast.trim(),
            nickname: '',
            verificationCode: cCode.trim()
          },
          { redirect: false }
        )
      );
    } finally {
      isSubmitting = false;
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!lEmail.trim() || !lPassword) {
      appState.showToast('Email e password sono obbligatorie.', 'error');
      return;
    }
    isSubmitting = true;
    try {
      await afterAuth(await appState.loginSecure(lEmail.trim(), lPassword, { redirect: false }));
    } finally {
      isSubmitting = false;
    }
  }

  async function handleSocial(provider, token) {
    isSubmitting = true;
    try {
      await afterAuth(await appState.loginSocial(provider, token, { redirect: false }));
    } finally {
      isSubmitting = false;
    }
  }

  async function copy(kind, text) {
    const ok = await copyToClipboard(text);
    if (ok) {
      copied = kind;
      setTimeout(() => { if (copied === kind) copied = ''; }, 2000);
      appState.showToast('Copiato negli appunti!', 'success');
    }
  }

  async function share() {
    const text = `Partecipa al nostro Fanta Matrimonio! Codice invito: ${appState.pendingInvite}`;
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
  {#if appState.pendingInvite}<SiteHeader />{/if}
  <OnboardingSetup onComplete={() => { currentStep = 'share'; scrollToTopInstant(); }} />
{:else if currentStep === 'share' || appState.pendingInvite}
  <!-- SCHERMATA CODICE PRONTO -->
  <div class="wizard-screen">
    <div class="wizard-container">
      <div class="reveal-card">
        <div class="reveal-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </div>
        <span class="step-badge-text">EVENTO CREATO CON SUCCESSO</span>
        <h1 class="wizard-title font-serif">
          {appState.event?.spouse1_name || spouse1} &amp; {appState.event?.spouse2_name || spouse2}
        </h1>
        <p class="wizard-subtitle">
          Condividete questo codice o il link con gli invitati per farli entrare al volo!
        </p>

        <div class="code-big-display">
          {appState.pendingInvite || appState.event?.invite_code}
        </div>

        <div class="reveal-actions">
          <button type="button" class="action-pill-btn" onclick={() => copy('code', appState.pendingInvite)}>
            {#if copied === 'code'}✓ Codice copiato{:else}Copia codice{/if}
          </button>
          <button type="button" class="action-pill-btn" onclick={() => copy('link', inviteLink)}>
            {#if copied === 'link'}✓ Link copiato{:else}Copia link WhatsApp{/if}
          </button>
          <button type="button" class="action-pill-btn primary-wine" onclick={share}>
            Condividi
          </button>
        </div>

        <div class="reveal-footer">
          <button type="button" class="submit-action-btn" onclick={() => appState.finishOnboarding('dashboard')}>
            <span>Vai alla tua dashboard</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          <button type="button" class="secondary-plain-btn" onclick={() => appState.finishOnboarding('home')}>
            Guarda cosa vedono gli invitati
          </button>
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- WIZARD: stessa struttura delle altre pagine del sito (intro + auth-card) -->
  <div class="create-layout">
    <div class="create-intro">
      <span class="eyebrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        Nuovo matrimonio · Passo {wizardStep} di {totalSteps}
      </span>

      {#if wizardStep === 1}
        <h1 class="page-title">Chi sono i <span class="gold-gradient-text">festeggiati?</span></h1>
        <p class="page-lead">
          Questi nomi compariranno nell'app degli invitati, nelle classifiche delle sfide e nelle foto condivise.
        </p>
      {:else}
        <h1 class="page-title">{authMode === 'register' ? 'Create il vostro' : 'Bentornati,'} <span class="gold-gradient-text">{authMode === 'register' ? 'account' : 'sposi'}</span></h1>
        <p class="page-lead">
          {authMode === 'register'
            ? 'Serve a voi per gestire la festa: console di regia, classifica e foto restano sempre a vostra disposizione. Registrandovi creiamo subito il matrimonio.'
            : 'Accedete con il vostro account: creeremo il matrimonio con quei dati.'}
        </p>
      {/if}

      <div class="create-progress" aria-hidden="true">
        <div class="create-progress-bar" style="width: {progress}%"></div>
      </div>

      <p class="switch">
        {#if wizardStep === 2}
          <button type="button" class="link-btn" onclick={goToStep1}>‹ Torna ai nomi degli sposi</button>
        {:else}
          <button type="button" class="link-btn" onclick={() => appState.setAuthView('entry')}>‹ Annulla e torna alla home</button>
        {/if}
      </p>
    </div>

    <div class="auth-card create-form">
      {#if wizardStep === 1}
        <h2 class="form-title font-serif">Il vostro matrimonio</h2>

        <form class="create-fields" onsubmit={handleStep1}>
          <div class="name-row">
            <div class="input-group">
              <label for="spouse1" class="input-label">Sposo/a 1</label>
              <input id="spouse1" type="text" class="input-field" placeholder="Elena" bind:value={spouse1} autocomplete="off" required />
            </div>
            <div class="input-group">
              <label for="spouse2" class="input-label">Sposo/a 2</label>
              <input id="spouse2" type="text" class="input-field" placeholder="Davide" bind:value={spouse2} autocomplete="off" required />
            </div>
          </div>

          <div class="name-row">
            <div class="input-group">
              <label for="eventDate" class="input-label">Data dell'evento</label>
              <input id="eventDate" type="date" class="input-field" bind:value={eventDate} required />
              {#if readableDate}<span class="field-hint capital-first">{readableDate}</span>{/if}
            </div>
          </div>

          <div class="option-box">
            <div class="option-head">
              <div class="option-copy">
                <strong>Orario di apertura giochi</strong>
                <span>Missioni e quiz attivi solo durante il ricevimento, per evitare spoiler prima del brindisi.</span>
              </div>
              <label class="clean-switch">
                <input type="checkbox" bind:checked={enableTimer} />
                <span class="slider"></span>
              </label>
            </div>

            {#if enableTimer}
              <div class="timer-grid">
                <div class="input-group">
                  <label for="startDateInput" class="input-label">Giorno inizio</label>
                  <input id="startDateInput" type="date" class="input-field" bind:value={startDate} />
                </div>
                <div class="input-group">
                  <label for="startTimeInput" class="input-label">Ora inizio</label>
                  <input id="startTimeInput" type="time" class="input-field" bind:value={startTime} />
                </div>
                <div class="input-group">
                  <label for="endDateInput" class="input-label">Giorno fine</label>
                  <input id="endDateInput" type="date" class="input-field" bind:value={endDate} />
                </div>
                <div class="input-group">
                  <label for="endTimeInput" class="input-label">Ora fine</label>
                  <input id="endTimeInput" type="time" class="input-field" bind:value={endTime} />
                </div>
              </div>
            {/if}
          </div>

          <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
            {#if isSubmitting}
              <div class="spinner spinner-on-dark"></div>
              <span>Creazione in corso...</span>
            {:else}
              <span>{appState.hasAccount ? 'Continua: scegli le modalità' : 'Continua: crea il tuo account'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            {/if}
          </button>
          <p class="field-hint center">Potrai modificare questi dettagli in qualsiasi momento dalle impostazioni.</p>
        </form>
      {:else}
        <h2 class="form-title font-serif">{authMode === 'register' ? 'Registrati' : 'Accedi'}</h2>

        <SocialButtons onToken={handleSocial} busy={isSubmitting} label={authMode === 'register' ? 'Registrati con' : 'Accedi con'} />

        {#if authMode === 'register'}
          <form class="create-fields" onsubmit={handleRegister}>
            <EmailVerificationField
              bind:email={cEmail}
              bind:verificationCode={cCode}
              bind:verified={cVerified}
              purpose="register_account"
              label="Email"
              placeholder="es. marco.elena@email.it"
              disabled={isSubmitting}
            />
            {#if cVerified}
              <div class="name-row">
                <div class="input-group">
                  <label for="cFirst" class="input-label">Nome</label>
                  <input id="cFirst" type="text" class="input-field" placeholder="Elena" bind:value={cFirst} autocomplete="given-name" required />
                </div>
                <div class="input-group">
                  <label for="cLast" class="input-label">Cognome</label>
                  <input id="cLast" type="text" class="input-field" placeholder="Rossi" bind:value={cLast} autocomplete="family-name" required />
                </div>
              </div>
              <div class="input-group">
                <label for="cPassword" class="input-label">Password</label>
                <input id="cPassword" type={showPassword ? 'text' : 'password'} class="input-field" placeholder="Almeno 6 caratteri" bind:value={cPassword} autocomplete="new-password" minlength="6" required disabled={isSubmitting} />
                <button type="button" class="link-btn align-start" onclick={() => (showPassword = !showPassword)}>
                  {showPassword ? 'Nascondi password' : 'Mostra password'}
                </button>
              </div>
              <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
                {#if isSubmitting}
                  <div class="spinner spinner-on-dark"></div>
                  <span>Creazione in corso...</span>
                {:else}
                  <span>Crea account e matrimonio</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                {/if}
              </button>
            {:else}
              <div class="verification-note" role="status">
                <strong>Verifica prima la tua email</strong>
                <span>Dopo la verifica compariranno nome, cognome, password e il pulsante per creare account e matrimonio.</span>
              </div>
            {/if}
          </form>
          <p class="switch center">Hai già un account? <button type="button" class="link-btn" onclick={() => (authMode = 'login')}>Accedi</button></p>
        {:else}
          <form class="create-fields" onsubmit={handleLogin}>
            <div class="input-group">
              <label for="lEmail" class="input-label">Email</label>
              <input id="lEmail" type="email" class="input-field" placeholder="es. marco.elena@email.it" bind:value={lEmail} autocomplete="email" required />
            </div>
            <div class="input-group">
              <label for="lPassword" class="input-label">Password</label>
              <input id="lPassword" type="password" class="input-field" placeholder="La tua password" bind:value={lPassword} autocomplete="current-password" required />
            </div>
            <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
              {#if isSubmitting}
                <div class="spinner spinner-on-dark"></div>
                <span>Accesso in corso...</span>
              {:else}
                <span>Accedi e crea il matrimonio</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              {/if}
            </button>
          </form>
          <p class="switch center">Non hai un account? <button type="button" class="link-btn" onclick={() => (authMode = 'register')}>Registrati</button></p>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .wizard-screen {
    min-height: 100vh;
    min-height: 100dvh;
    background-color: var(--bg-primary);
    padding-bottom: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  /* STICKY STEP HEADER CON ZERO SPAZIO MORTO IN ALTO */
  .sticky-step-header {
    position: sticky;
    top: 0;
    z-index: 100;
    width: 100%;
    background: #faf7f2;
    padding-top: 0;
    border-bottom: 1px solid rgba(140, 47, 75, 0.08);
    box-shadow: 0 1px 6px rgba(43, 31, 36, 0.03);
  }

  @media (display-mode: standalone) {
    .sticky-step-header {
      padding-top: max(4px, env(safe-area-inset-top, 0px));
    }
  }

  .sticky-inner {
    width: 100%;
    max-width: 620px;
    margin: 0 auto;
    padding: 0 14px;
  }

  /* Top Navigation Bar */
  .wizard-topbar {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0 2px;
    min-height: 42px;
  }

  .top-icon-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .top-icon-btn:hover {
    background: rgba(140, 47, 75, 0.08);
  }

  .user-avatar-pill {
    background: var(--wine);
    color: #ffffff;
    width: 32px;
    height: 32px;
  }

  .top-nav-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1px;
  }

  .sub-brand {
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: #9c8850;
    text-transform: uppercase;
    line-height: 1;
  }

  .step-pill-indicator {
    font-family: var(--font-display);
    font-size: 0.92rem;
    color: var(--wine);
    font-weight: 700;
    line-height: 1.15;
  }

  .top-nav-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-percent-tag {
    font-size: 0.72rem;
    font-weight: 800;
    color: var(--wine);
    background: #faedf2;
    padding: 2px 7px;
    border-radius: 999px;
  }

  /* Progress Line */
  .step-progress-wrapper {
    width: 100%;
    height: 2.5px;
    background: rgba(200, 185, 175, 0.35);
    margin: 2px 0 0;
    border-radius: 2px;
    overflow: hidden;
  }

  .step-progress-bar {
    height: 100%;
    background: var(--wine);
    transition: width 0.35s ease-out;
  }

  .gold-pill-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #faeed3;
    color: #7a5814;
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    align-self: flex-start;
  }

  /* Container */
  .wizard-container {
    width: 100%;
    max-width: 620px;
    margin: 0 auto;
    padding: 6px 16px 28px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Header */
  .wizard-header {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
    margin-bottom: 2px;
  }

  .wizard-title {
    font-size: clamp(1.65rem, 4.5vw, 2.1rem);
    color: var(--wine);
    line-height: 1.1;
    font-weight: 700;
    margin: 0;
  }

  .wizard-subtitle {
    font-size: 0.88rem;
    color: #6b5e65;
    line-height: 1.45;
  }

  /* Form */
  .wizard-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Clean Card */
  .clean-card {
    background: #ffffff;
    border-radius: 22px;
    padding: 20px;
    box-shadow: 0 4px 16px rgba(140, 47, 75, 0.04);
    border: 1px solid rgba(220, 205, 195, 0.4);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .card-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #8c7840;
    text-transform: uppercase;
  }

  .field-block {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    min-width: 0;
  }

  .flex-1 {
    flex: 1;
    min-width: 0;
  }

  .spouses-inputs-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @media (min-width: 540px) {
    .spouses-inputs-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      gap: 12px;
    }
  }

  .desktop-row-2col {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  @media (min-width: 540px) {
    .desktop-row-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
  }

  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .field-sublabel {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #4a3c43;
    text-transform: uppercase;
  }

  .field-tag-muted {
    font-size: 0.72rem;
    font-style: italic;
    color: #8e7f86;
  }

  .field-tag-badge.gold {
    font-size: 0.68rem;
    font-weight: 700;
    color: #9c7b2c;
  }

  .input-with-icon {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
  }

  .input-with-icon svg {
    position: absolute;
    left: 14px;
    color: #7b6d74;
    pointer-events: none;
    z-index: 2;
  }

  .clean-input {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    background: #f4efe9;
    border: 1.5px solid transparent;
    border-radius: 14px;
    padding: 13px 16px 13px 44px;
    font-family: var(--font-sans);
    font-size: 16px !important; /* Prevents auto zoom on iOS */
    color: var(--text-main);
    transition: all 0.2s ease;
    outline: none;
  }

  .clean-input:focus {
    background: #ffffff;
    border-color: var(--wine);
    box-shadow: 0 0 0 3px rgba(140, 47, 75, 0.12);
  }

  .clean-input::placeholder {
    color: #9c8e94;
  }

  .ampersand-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: -2px 0;
  }

  @media (min-width: 540px) {
    .ampersand-divider {
      padding-bottom: 8px;
    }
  }

  .ampersand-divider span {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #f4efe9;
    color: #7b6d74;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-style: italic;
    font-weight: 600;
  }

  .field-hint {
    font-size: 0.74rem;
    color: #756970;
    line-height: 1.35;
    margin-top: 2px;
  }

  .capital-first {
    text-transform: capitalize;
  }

  /* Timer card & Datetime inputs */
  .timer-toggle-card {
    background: #f5f0eb;
    border: none;
  }

  .timer-card-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .clock-icon-bubble {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #f4d068;
    color: #4a3400;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .timer-head-copy {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .timer-head-copy strong {
    font-size: 0.88rem;
    color: #2b1f24;
  }

  .timer-head-copy p {
    font-size: 0.75rem;
    color: #6b5d63;
    line-height: 1.35;
    margin: 0;
  }

  /* Clean Switch */
  .clean-switch {
    position: relative;
    display: inline-block;
    width: 46px;
    height: 26px;
    flex-shrink: 0;
  }

  .clean-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .clean-switch .slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: #d1c7c2;
    transition: 0.25s;
    border-radius: 26px;
  }

  .clean-switch .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.25s;
    border-radius: 50%;
  }

  .clean-switch input:checked + .slider {
    background-color: var(--wine);
  }

  .clean-switch input:checked + .slider:before {
    transform: translateX(20px);
  }

  .timer-full-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 14px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    width: 100%;
    box-sizing: border-box;
  }

  .timer-range-card {
    background: #fbf9f6;
    border: 1px solid rgba(220, 205, 195, 0.5);
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
  }

  .timer-range-header {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .timer-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .timer-dot.start {
    background: #2ea869;
    box-shadow: 0 0 6px rgba(46, 168, 105, 0.4);
  }

  .timer-dot.end {
    background: var(--wine);
    box-shadow: 0 0 6px rgba(140, 47, 75, 0.4);
  }

  .timer-inputs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
    box-sizing: border-box;
  }

  .mini-label {
    font-size: 0.68rem;
    font-weight: 700;
    color: #7b6d74;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }

  .timer-cell-input {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    font-size: 16px !important;
    padding: 10px 12px !important;
    background: #ffffff !important;
    border: 1px solid rgba(200, 185, 175, 0.4) !important;
    border-radius: 10px !important;
    color: var(--text-main);
  }

  @media (max-width: 360px) {
    .timer-inputs-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Preview Code Card */
  .preview-code-card {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .preview-code-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .qr-icon-bubble {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #fae0ea;
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .code-preview-text {
    display: block;
    font-size: 1.05rem;
    letter-spacing: 0.08em;
    color: var(--wine);
    margin-top: 2px;
  }

  .auto-tag {
    background: #eae5e0;
    color: #65585f;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
  }

  /* Transparency card */
  .transparency-card {
    background: #f5f0eb;
    border: none;
    flex-direction: row;
    gap: 14px;
    align-items: flex-start;
  }

  .sparkle-bubble {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #f4d068;
    color: #4a3400;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .transparency-card strong {
    display: block;
    font-size: 0.88rem;
    color: #2b1f24;
    margin-bottom: 2px;
  }

  .transparency-card p {
    font-size: 0.78rem;
    color: #6b5d63;
    line-height: 1.4;
    margin: 0;
  }

  .email-verify-wrapper {
    margin-bottom: 6px;
  }

  /* Buttons */
  .submit-action-btn {
    width: 100%;
    min-height: 50px;
    background: var(--wine);
    color: #ffffff;
    border: none;
    border-radius: 999px;
    font-family: var(--font-sans);
    font-size: 0.98rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(140, 47, 75, 0.28);
    transition: all 0.15s ease;
  }

  .submit-action-btn:hover {
    background: var(--wine-deep);
  }

  .bottom-safe-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.73rem;
    color: #6a5e64;
    text-align: center;
  }

  .bottom-safe-note svg {
    color: #8c7840;
  }

  .back-link-btn {
    background: transparent;
    border: none;
    color: var(--wine);
    font-weight: 700;
    font-size: 0.86rem;
    cursor: pointer;
    align-self: center;
    padding: 6px 12px;
  }

  .eye-btn {
    position: absolute;
    right: 12px;
    background: transparent;
    border: none;
    color: #7b6d74;
    cursor: pointer;
    padding: 4px;
    z-index: 2;
  }

  .preauth-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #eef7f2;
    border-radius: 12px;
    padding: 12px;
    color: #246845;
    font-size: 0.82rem;
  }

  /* Code Reveal screen */
  .reveal-card {
    background: #ffffff;
    border-radius: 26px;
    padding: 32px 20px 24px;
    box-shadow: 0 6px 24px rgba(140, 47, 75, 0.06);
    border: 1px solid rgba(220, 205, 195, 0.4);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
  }

  .reveal-badge {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #fae0ea;
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .step-badge-text {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #8c7840;
  }

  .code-big-display {
    font-family: var(--font-display);
    font-size: 2.2rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--wine);
    background: #fbf6f2;
    border: 1.5px dashed rgba(140, 47, 75, 0.35);
    padding: 16px 28px;
    border-radius: 16px;
    margin: 8px 0;
  }

  .reveal-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    width: 100%;
  }

  .action-pill-btn {
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.18);
    color: var(--wine);
    padding: 10px 18px;
    border-radius: 999px;
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
  }

  .action-pill-btn.primary-wine {
    background: var(--wine);
    color: #ffffff;
    border-color: var(--wine);
  }

  .reveal-footer {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }

  .secondary-plain-btn {
    background: transparent;
    border: none;
    color: #6a5e64;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    padding: 8px;
  }

  .spinner-white {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .step2-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .step2-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 420px) {
    .step2-row { grid-template-columns: 1fr; }
  }

  /* ── Wizard di creazione: stesso stile delle altre pagine (login/registrazione) ── */
  .create-layout {
    display: grid;
    grid-template-columns: 1fr minmax(0, 520px);
    gap: 56px;
    align-items: start;
  }
  .create-intro {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    position: sticky;
    top: 96px;
  }
  .create-intro .page-title {
    font-size: clamp(2.2rem, 4vw, 3.1rem);
    line-height: 1.05;
    color: var(--text-main);
    margin: 0;
  }
  .create-intro .page-title::after {
    content: '';
    display: block;
    width: 40px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin-top: 14px;
  }
  .create-intro .page-lead {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.2rem;
    line-height: 1.5;
    color: #6b5f64;
    margin: 0;
  }
  .eyebrow {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--gold-dark);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.3);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .create-progress {
    width: 100%;
    max-width: 260px;
    height: 4px;
    border-radius: 4px;
    background: rgba(201, 169, 110, 0.25);
    overflow: hidden;
  }
  .create-progress-bar {
    height: 100%;
    background: var(--wine);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .switch {
    font-size: 0.92rem;
    color: var(--text-muted);
    line-height: 1.6;
    margin: 0;
  }
  .switch.center,
  .field-hint.center {
    text-align: center;
  }
  .form-title {
    font-size: 1.55rem;
    font-weight: 700;
    margin: 0 0 4px;
  }
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .create-fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .name-row,
  .timer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .input-group {
    min-width: 0;
  }
  .create-fields .input-field {
    min-width: 0;
    max-width: 100%;
  }
  .create-fields input[type="date"],
  .create-fields input[type="time"] {
    display: block;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    height: 48px;
    min-height: 48px;
    padding: 10px 12px;
    box-sizing: border-box;
    line-height: normal;
    -webkit-appearance: none;
    appearance: none;
  }
  .create-fields input[type="date"]::-webkit-date-and-time-value,
  .create-fields input[type="time"]::-webkit-date-and-time-value {
    display: flex;
    align-items: center;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    text-align: left;
  }
  .optional {
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    font-size: 0.85em;
  }
  .option-box {
    background: rgba(201, 169, 110, 0.08);
    border: 1px solid rgba(201, 169, 110, 0.25);
    border-radius: 16px;
    padding: 14px 16px;
    margin-bottom: 14px;
  }
  .option-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .option-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .option-copy span {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .timer-grid {
    margin-top: 14px;
  }
  .timer-grid .input-group {
    margin-bottom: 0;
  }
  .verification-note {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(201, 169, 110, 0.1);
    border: 1px solid rgba(201, 169, 110, 0.35);
  }
  .verification-note span {
    color: #6b5f64;
    font-size: 0.9rem;
  }
  .align-start {
    align-self: flex-start;
    font-size: 0.85rem;
  }
  .spinner-on-dark {
    border-color: rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
  }

  @media (max-width: 900px) {
    .create-layout {
      grid-template-columns: 1fr;
      gap: 24px;
    }
    .create-intro {
      position: static;
    }
  }
  @media (max-width: 520px) {
    .create-form.auth-card {
      padding: 22px 18px;
    }
  }
  @media (max-width: 420px) {
    .name-row,
    .timer-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
