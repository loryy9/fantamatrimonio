<script>
  import { fly, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { tick, onDestroy } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import { appState } from '../lib/state.svelte.js';
  import { ROUTES, joinUrl } from '../lib/routes.js';
  import { copyToClipboard } from '../lib/clipboard.js';
  import OnboardingSetup from './OnboardingSetup.svelte';
  import EmailVerificationField from './EmailVerificationField.svelte';
  import TimerFields from './TimerFields.svelte';
  import SocialButtons from './SocialButtons.svelte';
  import PageIntro from './PageIntro.svelte';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cardTransition = { duration: prefersReducedMotion ? 0 : 240, easing: cubicOut };
  const progressTransitionDuration = prefersReducedMotion ? 0 : 420;
  const pageExitDuration = prefersReducedMotion ? 0 : 180;
  const onboardingEnterTransition = {
    y: prefersReducedMotion ? 0 : 16,
    duration: prefersReducedMotion ? 0 : 340,
    easing: cubicOut
  };
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Wizard: 1 Nomi & Cerimonia -> 2 Registrazione (solo senza account) -> 'setup' -> 'share'.
  let currentStep = $state('form'); // 'form' | 'setup' | 'share'
  let wizardStep = $state(1);
  const totalSteps = $derived(appState.hasAccount ? 2 : 3);
  let completingCreation = $state(false);
  let isLeavingCreatePage = $state(false);
  const progress = $derived(completingCreation ? 100 : Math.round((wizardStep / totalSteps) * 100));
  let step1FormEl = $state(null);
  let registerFormEl = $state(null);
  let loginFormEl = $state(null);
  let isSubmitting = $state(false);
  let copied = $state('');

  // Step 1: Nomi & Cerimonia
  let spouse1 = $state('');
  let spouse2 = $state('');
  let eventDate = $state(localDateString());
  let enableTimer = $state(false);
  // Inizio e fine sfide: giorno e ora separati (nessun overflow su mobile)
  let startDate = $state(localDateString());
  let startTime = $state('12:00');
  let endDate = $state(localDateString());
  let endTime = $state('23:30');

  // Step 2: registrazione / accesso di chi crea il matrimonio
  let authMode = $state('register'); // 'register' | 'login'
  const isRegister = $derived(authMode === 'register');
  let cFirst = $state('');
  let cLast = $state('');
  let cEmail = $state('');
  let cPassword = $state('');
  let cCode = $state('');
  let cVerified = $state(false);
  let showPassword = $state(false);
  let lEmail = $state('');
  let lPassword = $state('');

  function localDateString(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  const timerStart = () => new Date(`${startDate}T${startTime}`);
  const timerEnd = () => new Date(`${endDate}T${endTime}`);

  /** Regole del passo 1: ritorna il messaggio d'errore, oppure null se è tutto a posto. */
  function step1Error() {
    if (!spouse1.trim() || !spouse2.trim()) return 'Inserisci il nome di entrambi gli sposi.';
    if (!eventDate || eventDate < localDateString()) return 'La data del matrimonio non può essere nel passato.';
    if (!enableTimer) return null;
    if (!startDate || !startTime || !endDate || !endTime) return 'Imposta sia giorno che ora di inizio e di chiusura delle sfide.';
    const start = timerStart();
    const end = timerEnd();
    if (isNaN(start) || isNaN(end)) return 'Date e orari non validi.';
    if (start <= new Date()) return "L'inizio dei giochi deve essere nel futuro.";
    if (end <= start) return "La chiusura delle sfide deve essere successiva all'inizio.";
    return null;
  }

  const canAdvance = $derived.by(() => {
    if (isSubmitting) return false;
    if (wizardStep === 1) return !step1Error() && step1FormEl?.checkValidity() !== false;
    if (isRegister) {
      return cVerified && !!cEmail.trim() && !!cFirst.trim() && !!cLast.trim() &&
        cPassword.length >= 6 && !!registerFormEl?.checkValidity();
    }
    return !!lEmail.trim() && !!lPassword && !!loginFormEl?.checkValidity();
  });

  const backLabel = $derived(wizardStep === 1 ? 'Torna alla pagina precedente' : 'Torna ai dati del matrimonio');
  const forwardLabel = $derived(wizardStep === 1 ? 'Continua al passaggio successivo' : 'Completa la creazione del matrimonio');

  // Le date di inizio/fine seguono la data dell'evento finché non vengono cambiate a mano
  $effect(() => {
    if (eventDate && (!startDate || startDate === endDate)) {
      startDate = eventDate;
      endDate = eventDate;
    }
  });

  const readableDate = $derived(
    eventDate
      ? new Date(eventDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : ''
  );

  const inviteLink = $derived(
    appState.pendingInvite ? `${location.origin}${joinUrl(appState.pendingInvite)}` : ''
  );

  // Il matrimonio esiste già dalla fine del passo 1: prima di lasciare la configurazione
  // (topbar, link o tasto indietro) avvisa che lo si ritrova in "I miei matrimoni".
  beforeNavigate((navigation) => {
    if (!appState.pendingInvite || navigation.type === 'leave' || !navigation.to) return;
    navigation.cancel();
    appState.confirm(
      'Il matrimonio è già stato creato: lo ritrovi in «I miei matrimoni», dove potrai completare le sfide e recuperare il codice invito.',
      { title: 'Lasciare la creazione?', confirmText: 'Esci', cancelText: 'Resta qui' }
    ).then((ok) => {
      if (!ok) return;
      appState.pendingInvite = null;
      goto(navigation.to.url);
    });
  });

  onDestroy(() => {
    appState.pendingInvite = null;
  });

  async function scrollToTop() {
    await tick();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  async function withSubmitting(task) {
    isSubmitting = true;
    try {
      await task();
    } finally {
      isSubmitting = false;
    }
  }

  /** Dati dell'evento dal passo 1 (null + toast se qualcosa non va). */
  function buildPayload() {
    const error = step1Error();
    if (error) {
      appState.showToast(error, 'error');
      return null;
    }
    return {
      spouse1_name: spouse1.trim(),
      spouse2_name: spouse2.trim(),
      enable_timer: enableTimer,
      start_time: enableTimer ? timerStart().toISOString() : null,
      end_time: enableTimer ? timerEnd().toISOString() : null
    };
  }

  async function createTheEvent() {
    const payload = buildPayload();
    if (!payload) {
      wizardStep = 1;
      await scrollToTop();
      return;
    }
    completingCreation = true;
    await tick();
    const progressFinished = wait(progressTransitionDuration ? progressTransitionDuration + 30 : 0);
    const res = await appState.createEvent(payload);
    if (!res.success) {
      completingCreation = false;
      appState.showToast(res.error || 'Impossibile creare il matrimonio.', 'error');
      return;
    }
    await progressFinished;
    isLeavingCreatePage = true;
    await tick();
    await wait(pageExitDuration);
    appState.pendingInvite = res.inviteCode;
    currentStep = 'setup';
    await scrollToTop();
  }

  // Passo 1: con un account si crea subito, altrimenti si passa alla registrazione.
  async function handleStep1(e) {
    e.preventDefault();
    if (!buildPayload()) return;
    if (appState.hasAccount) {
      await withSubmitting(createTheEvent);
    } else {
      wizardStep = 2;
      await scrollToTop();
    }
  }

  function goBack() {
    if (isSubmitting) return;
    if (wizardStep > 1) {
      wizardStep = 1;
      scrollToTop();
    } else {
      goto(ROUTES.home);
    }
  }

  function goForward() {
    if (!canAdvance) return;
    const form = wizardStep === 1 ? step1FormEl : isRegister ? registerFormEl : loginFormEl;
    form?.requestSubmit();
  }

  /** Dopo login/registrazione nel passo 2 si crea il matrimonio. */
  function authThenCreate(authenticate) {
    return withSubmitting(async () => {
      const res = await authenticate();
      if (!res.success) {
        appState.showToast(res.error, 'error');
        return;
      }
      await createTheEvent();
    });
  }

  function handleRegister(e) {
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
    authThenCreate(() => appState.register(
      {
        email: cEmail.trim(),
        password: cPassword,
        firstName: cFirst.trim(),
        lastName: cLast.trim(),
        nickname: '',
        verificationCode: cCode.trim()
      },
      { redirect: false }
    ));
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!lEmail.trim() || !lPassword) {
      appState.showToast('Email e password sono obbligatorie.', 'error');
      return;
    }
    authThenCreate(() => appState.loginSecure(lEmail.trim(), lPassword, { redirect: false }));
  }

  function handleSocial(provider, token) {
    authThenCreate(() => appState.loginSocial(provider, token, { redirect: false }));
  }

  async function copy(kind, text) {
    if (!(await copyToClipboard(text))) return;
    copied = kind;
    setTimeout(() => { if (copied === kind) copied = ''; }, 2000);
    appState.showToast('Copiato negli appunti!', 'success');
  }

  async function share() {
    const text = `Partecipa al nostro Fanta Matrimonio! Codice invito: ${appState.pendingInvite}`;
    if (!navigator.share) return copy('link', inviteLink);
    try {
      await navigator.share({ title: 'Fanta Matrimonio', text, url: inviteLink });
    } catch { /* condivisione annullata */ }
  }
</script>

{#snippet arrowRight(size, strokeWidth)}
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
{/snippet}

{#snippet submitButton(label, busyLabel)}
  <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
    {#if isSubmitting}
      <div class="spinner spinner-on-dark"></div>
      <span>{busyLabel}</span>
    {:else}
      <span>{label}</span>
      {@render arrowRight(18, 2.5)}
    {/if}
  </button>
{/snippet}

{#if currentStep === 'setup'}
  <div class="onboarding-arrival" in:fly|local={onboardingEnterTransition}>
    <OnboardingSetup onComplete={() => { currentStep = 'share'; scrollToTop(); }} />
  </div>
{:else if currentStep === 'share'}
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

        <div class="code-big-display">{appState.pendingInvite}</div>

        <div class="reveal-actions">
          <button type="button" class="action-pill-btn" onclick={() => copy('code', appState.pendingInvite)}>
            {copied === 'code' ? '✓ Codice copiato' : 'Copia codice'}
          </button>
          <button type="button" class="action-pill-btn" onclick={() => copy('link', inviteLink)}>
            {copied === 'link' ? '✓ Link copiato' : 'Copia link WhatsApp'}
          </button>
          <button type="button" class="action-pill-btn primary-wine" onclick={share}>Condividi</button>
        </div>

        <div class="reveal-footer">
          <button type="button" class="submit-action-btn" onclick={() => appState.finishOnboarding('dashboard')}>
            <span>Vai alla tua dashboard</span>
            {@render arrowRight(18, 2.2)}
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
  <div class="create-layout" class:leaving={isLeavingCreatePage}>
    <div class="create-intro">
      {#if wizardStep === 1}
        <PageIntro before="Chi sono i" accent="festeggiati?" lead="Questi nomi compariranno nell'app degli invitati, nelle classifiche delle sfide e nelle foto condivise." />
      {:else if isRegister}
        <PageIntro before="Create il vostro" accent="account" lead="Serve a voi per gestire la festa: console di regia, classifica e foto restano sempre a vostra disposizione. Registrandovi creiamo subito il matrimonio." />
      {:else}
        <PageIntro before="Bentornati," accent="sposi" lead="Accedete con il vostro account: creeremo il matrimonio con quei dati." />
      {/if}
    </div>

    <div class="auth-card create-form">
      <div class="wizard-stepper">
        <button type="button" class="step-arrow" onclick={goBack} disabled={isSubmitting} aria-label={backLabel} title={backLabel}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
        </button>
        <div
          class="create-progress"
          role="progressbar"
          aria-label="Avanzamento creazione matrimonio"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
        >
          <div class="create-progress-bar" style="width: {progress}%"></div>
        </div>
        <button type="button" class="step-arrow step-arrow-next" onclick={goForward} disabled={!canAdvance} aria-label={forwardLabel} title={forwardLabel}>
          {@render arrowRight(20, 2.2)}
        </button>
      </div>

      {#if wizardStep === 1}
        <h2 class="form-title font-serif">Il vostro matrimonio</h2>

        <form bind:this={step1FormEl} class="create-fields" onsubmit={handleStep1} transition:slide|local={cardTransition}>
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

          <div class="timer-slot">
            <TimerFields
              bind:enabled={enableTimer}
              bind:startDate
              bind:startTime
              bind:endDate
              bind:endTime
              idPrefix="create-timer"
            />
          </div>

          {@render submitButton(appState.hasAccount ? 'Continua: scegli le modalità' : 'Continua: crea il tuo account', 'Creazione in corso...')}
          <p class="field-hint center">Potrai cambiare nomi e orari in qualsiasi momento dalla pagina del matrimonio.</p>
        </form>
      {:else}
        <h2 class="form-title font-serif">{isRegister ? 'Registrati' : 'Accedi'}</h2>

        <div class="social-transition" transition:slide|local={cardTransition}>
          <SocialButtons onToken={handleSocial} busy={isSubmitting} label={isRegister ? 'Registrati con' : 'Accedi con'} />
        </div>

        {#if isRegister}
          <form bind:this={registerFormEl} class="create-fields" onsubmit={handleRegister} transition:slide|local={cardTransition}>
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
              <div class="verified-fields" transition:slide|local={cardTransition}>
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
                {@render submitButton('Crea account e matrimonio', 'Creazione in corso...')}
              </div>
            {/if}
          </form>
          <p class="switch center">Hai già un account? <button type="button" class="link-btn" onclick={() => (authMode = 'login')}>Accedi</button></p>
        {:else}
          <form bind:this={loginFormEl} class="create-fields" onsubmit={handleLogin} transition:slide|local={cardTransition}>
            <div class="input-group">
              <label for="lEmail" class="input-label">Email</label>
              <input id="lEmail" type="email" class="input-field" placeholder="es. marco.elena@email.it" bind:value={lEmail} autocomplete="email" required />
            </div>
            <div class="input-group">
              <label for="lPassword" class="input-label">Password</label>
              <input id="lPassword" type="password" class="input-field" placeholder="La tua password" bind:value={lPassword} autocomplete="current-password" required />
            </div>
            {@render submitButton('Accedi e crea il matrimonio', 'Accesso in corso...')}
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

  /* Top Navigation Bar */

  /* Progress Line */

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

  /* Clean Card */

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

  /* Preview Code Card */

  /* Transparency card */

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
    color: var(--gold-dark);
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
    min-height: var(--control-sm);
    padding: 0 16px;
    border-radius: 999px;
    font-size: var(--fs-sm);
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
    font-size: var(--fs-sm);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--control-md);
    padding: 0 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Wizard di creazione: stesso stile delle altre pagine (login/registrazione) ── */
  .create-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
    gap: 56px;
    align-items: start;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    opacity: 1;
    transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .create-layout.leaving {
    opacity: 0;
    pointer-events: none;
  }
  .onboarding-arrival {
    width: 100%;
  }
  .social-transition,
  .verified-fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .create-intro {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    position: sticky;
    top: 96px;
  }
  .wizard-stepper {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin-bottom: 4px;
  }
  .step-arrow {
    width: 44px;
    height: 44px;
    border: 1px solid rgba(140, 47, 75, 0.18);
    border-radius: 50%;
    background: #fff;
    color: var(--wine);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
  }
  .step-arrow-next {
    color: #fff;
    background: var(--wine);
    border-color: var(--wine);
  }
  .step-arrow:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(74, 14, 46, 0.16);
  }
  .step-arrow:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }
  .create-progress {
    width: 100%;
    height: 4px;
    border-radius: 4px;
    background: rgba(201, 169, 110, 0.25);
    overflow: hidden;
  }
  .create-progress-bar {
    height: 100%;
    background: var(--wine);
    border-radius: 4px;
    transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1);
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
    font-size: var(--fs-xl);
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--wine);
  }
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 28px;
    border-radius: 24px;
    background: #fff;
    border: 1px solid rgba(220, 205, 195, 0.45);
    box-shadow: 0 4px 20px rgba(140, 47, 75, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03);
  }
  .create-fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .name-row {
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
    font-size: 16px;
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
  .timer-slot {
    margin-bottom: 14px;
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
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 18px;
      max-width: 560px;
    }
    .create-intro {
      position: static;
      align-items: center;
      text-align: center;
      gap: 12px;
    }
  }
  @media (max-width: 520px) {
    .create-form.auth-card {
      padding: 24px 22px;
      border-radius: 24px;
    }
    .switch {
      font-size: 0.88rem;
    }
  }
  @media (max-width: 420px) {
    .name-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .step-arrow,
    .create-progress-bar,
    .create-layout {
      transition: none;
    }
  }
</style>
