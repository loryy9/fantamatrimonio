<script>
  import { tick } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { copyToClipboard } from '../lib/clipboard.js';
  import OnboardingSetup from './OnboardingSetup.svelte';
  import EmailVerificationField from './EmailVerificationField.svelte';

  // Wizard state: 1 (Nomi & Cerimonia) -> 2 (Credenziali & Accesso) -> 'setup' (Modalità) -> 'share' (Codice pronto)
  let wizardStep = $state(1);

  // Step 1: Nomi & Cerimonia
  let spouse1 = $state('');
  let spouse2 = $state('');
  let eventDate = $state(new Date().toISOString().split('T')[0]);
  let eventLocation = $state('');
  let enableTimer = $state(false);

  // Orari inizio e fine sfide: Giorno + Ora separati sia per inizio che per fine (nessun overflow su mobile!)
  let startDate = $state(new Date().toISOString().split('T')[0]);
  let startTime = $state('12:00');
  let endDate = $state(new Date().toISOString().split('T')[0]);
  let endTime = $state('23:30');

  // Step 2: Credenziali
  const isPreAuthenticated = $derived(appState.hasAccount && appState.account);
  let coupleFirst = $state(appState.account?.display_name?.split(' ')[0] || '');
  let coupleLast = $state(appState.account?.display_name?.split(' ').slice(1).join(' ') || '');
  let coupleEmail = $state(appState.account?.email || '');
  let couplePassword = $state('');
  let couplePhone = $state('');
  let coupleVerificationCode = $state('');
  let coupleEmailVerified = $state(false);
  let showPassword = $state(false);
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

  // Anteprima codice automatico
  const generatedCodePreview = $derived.by(() => {
    const s1 = spouse1.trim().replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'ELENA';
    const s2 = spouse2.trim().replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'DAV';
    const year = eventDate ? eventDate.split('-')[0].slice(-2) : '26';
    return `${s1}-${s2}-${year}`;
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

  async function goToStep2(e) {
    e.preventDefault();
    if (!spouse1.trim() || !spouse2.trim()) {
      appState.showToast('Inserisci il nome di entrambi gli sposi.', 'error');
      return;
    }
    if (!coupleFirst.trim()) coupleFirst = spouse1.trim();
    if (!coupleLast.trim()) coupleLast = spouse2.trim();

    wizardStep = 2;
    await tick();
    scrollToTopInstant();
  }

  async function goToStep1() {
    wizardStep = 1;
    await tick();
    scrollToTopInstant();
  }

  async function handleFinalSubmit(e) {
    e.preventDefault();

    if (!spouse1.trim() || !spouse2.trim()) {
      wizardStep = 1;
      await tick();
      scrollToTopInstant();
      appState.showToast('Inserisci il nome di entrambi gli sposi.', 'error');
      return;
    }

    if (!isPreAuthenticated) {
      if (!coupleEmail.trim()) {
        appState.showToast('Inserisci l\'email degli sposi.', 'error');
        return;
      }
      if (!coupleEmailVerified && (!coupleVerificationCode || coupleVerificationCode.trim().length !== 6)) {
        appState.showToast('Verifica la tua email inserendo il codice a 6 cifre inviato.', 'error');
        return;
      }
      if (!couplePassword.trim() || couplePassword.trim().length < 6) {
        appState.showToast('La password deve contenere almeno 6 caratteri.', 'error');
        return;
      }
    }

    let startIso = null;
    let endIso = null;
    if (enableTimer) {
      if (!startDate || !startTime || !endDate || !endTime) {
        appState.showToast('Imposta sia giorno che ora di inizio e di chiusura delle sfide.', 'error');
        return;
      }
      const dStart = new Date(`${startDate}T${startTime}`);
      const dEnd = new Date(`${endDate}T${endTime}`);
      if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
        appState.showToast('Date e orari non validi.', 'error');
        return;
      }
      if (dEnd <= dStart) {
        appState.showToast('La chiusura delle sfide deve essere successiva all\'inizio.', 'error');
        return;
      }
      startIso = dStart.toISOString();
      endIso = dEnd.toISOString();
    }

    isSubmitting = true;
    const res = await appState.createEvent({
      spouse1_name: spouse1.trim(),
      spouse2_name: spouse2.trim(),
      enable_timer: enableTimer,
      start_time: startIso,
      end_time: endIso,
      couple_first_name: coupleFirst.trim() || spouse1.trim(),
      couple_last_name: coupleLast.trim() || spouse2.trim(),
      couple_email: !isPreAuthenticated ? coupleEmail.trim().toLowerCase() : undefined,
      couple_password: !isPreAuthenticated ? couplePassword.trim() : undefined,
      verification_code: !isPreAuthenticated && coupleVerificationCode.trim() ? coupleVerificationCode.trim() : undefined
    });
    isSubmitting = false;

    if (!res.success) {
      appState.showToast(res.error || 'Impossibile creare il matrimonio.', 'error');
    } else {
      currentStep = 'setup';
      await tick();
      scrollToTopInstant();
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
          <button type="button" class="submit-action-btn" onclick={() => appState.finishOnboarding('manage')}>
            <span>Apri Console Sposi</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          <button type="button" class="secondary-plain-btn" onclick={() => appState.finishOnboarding('home')}>
            Vedi l'anteprima invitati
          </button>
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- WIZARD STEP 1 & 2 -->
  <div class="wizard-screen">
    <!-- STICKY HEADER COMPATTA E SENZA SPAZIO MORTO -->
    <div class="sticky-step-header">
      <div class="sticky-inner">
        <header class="wizard-topbar">
          <button
            type="button"
            class="top-icon-btn"
            onclick={() => {
              if (wizardStep === 2) goToStep1();
              else appState.setAuthView('entry');
            }}
            aria-label="Torna indietro"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>

          <div class="top-nav-center">
            <span class="sub-brand">FANTA MATRIMONIO</span>
            <span class="step-pill-indicator">
              Passo {wizardStep} di 3 • {wizardStep === 1 ? 'Gli Sposi' : 'Dettagli Evento'}
            </span>
          </div>

          <div class="top-nav-right">
            <span class="step-percent-tag">{wizardStep === 1 ? '33%' : '66%'}</span>
            <button
              type="button"
              class="top-icon-btn user-avatar-pill"
              onclick={() => appState.setAuthView('login-secure')}
              aria-label="Accedi"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Barra di avanzamento continua -->
        <div class="step-progress-wrapper">
          <div class="step-progress-bar" style="width: {wizardStep === 1 ? '33%' : '66%'}"></div>
        </div>
      </div>
    </div>

    <!-- CONTENITORE FORM -->
    <div class="wizard-container">
      {#if wizardStep === 1}
        <!-- ================= PASSO 1: NOMI E CERIMONIA ================= -->
        <div class="wizard-header">
          <h1 class="wizard-title font-serif">Chi sono i festeggiati?</h1>
          <p class="wizard-subtitle">
            Questi nomi compariranno nell'app degli invitati, nelle classifiche delle sfide e nelle foto condivise.
          </p>
        </div>

        <form class="wizard-form" onsubmit={goToStep2}>
          <!-- Card Nomi Sposi -->
          <div class="clean-card">
            <div class="card-section-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
              <span>GLI SPOSI</span>
            </div>

            <div class="spouses-inputs-row">
              <div class="field-block flex-1">
                <label for="spouse1" class="field-sublabel">NOME SPOSO/A 1</label>
                <div class="input-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    id="spouse1"
                    type="text"
                    class="clean-input"
                    placeholder="Elena"
                    bind:value={spouse1}
                    required
                  />
                </div>
              </div>

              <div class="ampersand-divider">
                <span>&amp;</span>
              </div>

              <div class="field-block flex-1">
                <label for="spouse2" class="field-sublabel">NOME SPOSO/A 2</label>
                <div class="input-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    id="spouse2"
                    type="text"
                    class="clean-input"
                    placeholder="Davide"
                    bind:value={spouse2}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Card Dettagli Cerimonia -->
          <div class="clean-card">
            <div class="card-section-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
              </svg>
              <span>DETTAGLI CERIMONIA</span>
            </div>

            <div class="desktop-row-2col">
              <div class="field-block flex-1">
                <label for="eventDate" class="field-sublabel">DATA DELL'EVENTO</label>
                <div class="input-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                  </svg>
                  <input
                    id="eventDate"
                    type="date"
                    class="clean-input"
                    bind:value={eventDate}
                    required
                  />
                </div>
                {#if readableDate}
                  <p class="field-hint capital-first">{readableDate}</p>
                {/if}
              </div>

              <div class="field-block flex-1">
                <div class="label-row">
                  <label for="eventLocation" class="field-sublabel">LUOGO / LOCATION</label>
                  <span class="field-tag-muted">Facoltativo</span>
                </div>
                <div class="input-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <input
                    id="eventLocation"
                    type="text"
                    class="clean-input"
                    placeholder="Villa dei Fiori, Roma"
                    bind:value={eventLocation}
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Card Orario di apertura giochi (con Giorno e Ora sia per inizio che per fine, senza overflow!) -->
          <div class="clean-card timer-toggle-card">
            <div class="timer-card-head">
              <div class="clock-icon-bubble">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div class="timer-head-copy">
                <strong>Orario di apertura giochi</strong>
                <p>Attiva le missioni e il quiz solo durante il ricevimento per evitare spoiler prima del brindisi.</p>
              </div>
              <label class="clean-switch">
                <input type="checkbox" bind:checked={enableTimer} />
                <span class="slider"></span>
              </label>
            </div>

            {#if enableTimer}
              <div class="timer-full-fields">
                <!-- Inizio Sfide -->
                <div class="timer-range-card">
                  <div class="timer-range-header">
                    <span class="timer-dot start"></span>
                    <span class="field-sublabel">INIZIO SFIDE</span>
                  </div>
                  <div class="timer-inputs-grid">
                    <div class="field-block">
                      <label for="startDateInput" class="mini-label">Giorno inizio</label>
                      <input
                        id="startDateInput"
                        type="date"
                        class="clean-input timer-cell-input"
                        bind:value={startDate}
                      />
                    </div>
                    <div class="field-block">
                      <label for="startTimeInput" class="mini-label">Ora inizio</label>
                      <input
                        id="startTimeInput"
                        type="time"
                        class="clean-input timer-cell-input"
                        bind:value={startTime}
                      />
                    </div>
                  </div>
                </div>

                <!-- Chiusura Sfide -->
                <div class="timer-range-card">
                  <div class="timer-range-header">
                    <span class="timer-dot end"></span>
                    <span class="field-sublabel">CHIUSURA SFIDE E VOTI</span>
                  </div>
                  <div class="timer-inputs-grid">
                    <div class="field-block">
                      <label for="endDateInput" class="mini-label">Giorno fine</label>
                      <input
                        id="endDateInput"
                        type="date"
                        class="clean-input timer-cell-input"
                        bind:value={endDate}
                      />
                    </div>
                    <div class="field-block">
                      <label for="endTimeInput" class="mini-label">Ora fine</label>
                      <input
                        id="endTimeInput"
                        type="time"
                        class="clean-input timer-cell-input"
                        bind:value={endTime}
                      />
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Card Anteprima Codice Invito -->
          <div class="clean-card preview-code-card">
            <div class="preview-code-left">
              <div class="qr-icon-bubble">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="6" height="6" x="3" y="3" rx="1"/><rect width="6" height="6" x="15" y="3" rx="1"/><rect width="6" height="6" x="3" y="15" rx="1"/><path d="m15 15 3 3M15 21l6-6"/>
                </svg>
              </div>
              <div>
                <span class="field-sublabel">ANTEPRIMA CODICE INVITO</span>
                <strong class="code-preview-text font-serif">{generatedCodePreview}</strong>
              </div>
            </div>
            <span class="auto-tag">Automatico</span>
          </div>

          <!-- Bottone Continua -->
          <button type="submit" class="submit-action-btn">
            <span>Continua: Crea Account Sposi</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          <p class="bottom-safe-note">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Potrai modificare questi dettagli in qualsiasi momento dalle impostazioni.
          </p>
        </form>

      {:else}
        <!-- ================= PASSO 2: CREDENZIALI SPOSI ================= -->
        <div class="wizard-header">
          <div class="gold-pill-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>AREA RISERVATA AGLI SPOSI</span>
          </div>

          <h1 class="wizard-title font-serif">Create il vostro accesso</h1>
          <p class="wizard-subtitle">
            Servirà a voi due per accedere alla Console di Regia, proiettare la classifica e scaricare tutte le foto ad alta risoluzione a fine serata.
          </p>
        </div>

        <form class="wizard-form" onsubmit={handleFinalSubmit}>
          <div class="clean-card">
            {#if isPreAuthenticated}
              <div class="preauth-notice">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div>
                  <strong>Account già collegato</strong>
                  <span>State creando il matrimonio con <strong>{appState.account?.email}</strong></span>
                </div>
              </div>
            {:else}
              <!-- Verifica Email con codice OTP -->
              <div class="email-verify-wrapper">
                <EmailVerificationField
                  bind:email={coupleEmail}
                  bind:verificationCode={coupleVerificationCode}
                  bind:verified={coupleEmailVerified}
                  purpose="register_couple"
                  label="Email degli sposi"
                  placeholder="es. marco.elena@matrimonio.it"
                  disabled={isSubmitting}
                />
              </div>

              <!-- Password di gestione -->
              <div class="field-block">
                <div class="label-row">
                  <label for="couplePassword" class="field-sublabel">PASSWORD DI GESTIONE</label>
                  <span class="field-tag-muted">Min. 8 caratteri</span>
                </div>

                <div class="input-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    id="couplePassword"
                    type={showPassword ? 'text' : 'password'}
                    class="clean-input"
                    placeholder="Scegliete una chiave d'accesso"
                    bind:value={couplePassword}
                    minlength="6"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    class="eye-btn"
                    onclick={() => showPassword = !showPassword}
                    aria-label={showPassword ? 'Nascondi' : 'Mostra'}
                  >
                    {#if showPassword}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    {/if}
                  </button>
                </div>
              </div>

              <!-- WhatsApp di riferimento -->
              <div class="field-block">
                <div class="label-row">
                  <label for="couplePhone" class="field-sublabel">WHATSAPP DI RIFERIMENTO</label>
                  <span class="field-tag-muted">FACOLTATIVO</span>
                </div>

                <div class="input-with-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <input
                    id="couplePhone"
                    type="tel"
                    class="clean-input"
                    placeholder="+39 340 123 4567"
                    bind:value={couplePhone}
                  />
                </div>
                <p class="field-hint">Per ricevere il backup istantaneo del link della console e gli avvisi live durante i festeggiamenti.</p>
              </div>
            {/if}
          </div>

          <!-- Card Nessun costo nascosto -->
          <div class="clean-card transparency-card">
            <div class="sparkle-bubble">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
              </svg>
            </div>
            <div>
              <strong>Nessun costo nascosto</strong>
              <p>I primi 20 invitati sono <strong>completamente gratuiti</strong> con tutte le funzionalità incluse: upload foto illimitato, quiz e tabellone proiettabile.</p>
            </div>
          </div>

          <!-- Bottone finale -->
          <button type="submit" class="submit-action-btn" disabled={isSubmitting}>
            {#if isSubmitting}
              <span class="spinner spinner-white"></span>
              <span>Creazione evento in corso...</span>
            {:else}
              <span>Continua: Scegli le modalità</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            {/if}
          </button>

          <button type="button" class="back-link-btn" onclick={goToStep1}>
            ‹ Indietro
          </button>
        </form>
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
</style>
