<script>
  import { appState } from '../lib/state.svelte.js';
  import OnboardingSetup from './OnboardingSetup.svelte';
  import EmailVerificationField from './EmailVerificationField.svelte';

  let spouse1 = $state('');
  let spouse2 = $state('');
  let enableTimer = $state(false);
  let startTime = $state('');
  let endTime = $state('');
  
  // Se l'utente ha già un account attivo (es. ha fatto login prima di creare)
  const isPreAuthenticated = $derived(appState.hasAccount && appState.account);

  let coupleFirst = $state(appState.account?.display_name?.split(' ')[0] || '');
  let coupleLast = $state(appState.account?.display_name?.split(' ').slice(1).join(' ') || '');
  let coupleEmail = $state(appState.account?.email || '');
  let couplePassword = $state('');
  let coupleConfirmPassword = $state('');
  let coupleVerificationCode = $state('');
  let coupleEmailVerified = $state(false);
  let showPassword = $state(false);
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let copied = $state('');

  // Modal di orientamento / istruzioni dopo la creazione
  let showSuccessModal = $state(false);

  // 'form' (creazione) | 'setup' (onboarding quiz/caccia/momenti) | 'share' (codice invito)
  let currentStep = $state('form');

  const inviteLink = $derived(
    appState.pendingInvite ? `${window.location.origin}/?code=${appState.pendingInvite}` : ''
  );

  async function handleSubmit(e) {
    e.preventDefault();

    if (!spouse1.trim() || !spouse2.trim()) {
      appState.showToast('Inserisci il nome di entrambi gli sposi.', 'error');
      return;
    }
    if (enableTimer) {
      if (!startTime || !endTime) {
        appState.showToast('Imposta sia l\'orario di inizio che quello di fine.', 'error');
        return;
      }
      if (new Date(endTime) <= new Date(startTime)) {
        appState.showToast('L\'orario di fine deve essere successivo a quello di inizio.', 'error');
        return;
      }
    }
    if (!coupleFirst.trim() || !coupleLast.trim()) {
      appState.showToast('Inserisci il nome e cognome del referente per l\'account sposi.', 'error');
      return;
    }

    if (!isPreAuthenticated) {
      if (!coupleEmail.trim() || !couplePassword.trim()) {
        appState.showToast('Email e password sono obbligatorie per creare l\'account con cui gestirete il matrimonio.', 'error');
        return;
      }
      if (couplePassword.trim().length < 6) {
        appState.showToast('La password deve contenere almeno 6 caratteri.', 'error');
        return;
      }
      if (couplePassword !== coupleConfirmPassword) {
        appState.showToast('Le password non coincidono.', 'error');
        return;
      }
      if (!coupleVerificationCode.trim() || coupleVerificationCode.trim().length !== 6) {
        appState.showToast('Inserisci il codice di verifica a 6 cifre inviato alla tua email.', 'error');
        return;
      }
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
      couple_email: !isPreAuthenticated ? coupleEmail.trim().toLowerCase() : undefined,
      couple_password: !isPreAuthenticated ? couplePassword.trim() : undefined,
      verification_code: !isPreAuthenticated ? coupleVerificationCode.trim() : undefined
    });
    isSubmitting = false;

    if (!res.success) {
      appState.showToast(res.error || 'Non è stato possibile creare il matrimonio.', 'error');
    } else {
      // Mostra popup con istruzioni chiare e mini-navbar con pulsante 'Accedi' evidenziato
      showSuccessModal = true;
    }
  }

  function proceedToSetup() {
    showSuccessModal = false;
    currentStep = 'setup';
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <button class="btn btn-primary btn-lg" onclick={() => appState.finishOnboarding('manage')}>
        Apri Console Sposi (Gestione) →
      </button>
      <button class="btn btn-secondary" onclick={() => appState.finishOnboarding('home')}>
        👀 Guarda come vedono la festa gli invitati
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
        <li><span class="step-num">1</span><div><strong>I vostri nomi</strong><span>Compariranno nel gioco e nella classifica.</span></div></li>
        <li><span class="step-num">2</span><div><strong>Le tempistiche</strong><span>Facoltative: limita i giochi a una finestra oraria.</span></div></li>
        <li><span class="step-num">3</span><div><strong>Il vostro account Sposi</strong><span>Email e password per accedere e gestire il matrimonio.</span></div></li>
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

      {#if !isPreAuthenticated}
        <fieldset class="account-section email-first-step">
          <legend><span class="step-num">1</span> Verifica prima la tua email</legend>
          <p class="section-note">
            Per continuare devi prima confermare il tuo indirizzo email. Inseriscilo e premi <strong>Invia codice</strong>: dopo averlo verificato potrai completare il matrimonio.
          </p>
          <EmailVerificationField
            bind:email={coupleEmail}
            bind:verificationCode={coupleVerificationCode}
            bind:verified={coupleEmailVerified}
            purpose="register_couple"
            label="Email degli sposi"
            placeholder="es. giulia.rossi@email.com"
            disabled={isSubmitting}
          />
        </fieldset>
      {/if}

      {#if isPreAuthenticated || coupleEmailVerified}
      <fieldset>
        <legend><span class="step-num">{isPreAuthenticated ? '1' : '2'}</span> I vostri nomi</legend>
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
        <legend><span class="step-num">{isPreAuthenticated ? '2' : '3'}</span> Le tempistiche</legend>
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

      <fieldset class="account-section">
        <legend><span class="step-num">{isPreAuthenticated ? '3' : '4'}</span> Il vostro account Sposi</legend>

        {#if isPreAuthenticated}
          <div class="preauth-box">
            <div class="preauth-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Account collegato</span>
            </div>
            <p class="preauth-text">
              Stai creando il matrimonio con il tuo account <strong>{appState.account?.email}</strong>. Sarà immediatamente accessibile nella tua Dashboard Utente.
            </p>
          </div>
        {/if}

        <div class="row">
          <div class="input-group">
            <label for="coupleFirst" class="input-label">Nome referente</label>
            <input id="coupleFirst" type="text" class="input-field" placeholder="Es. Giulia" bind:value={coupleFirst} autocomplete="given-name" required />
          </div>
          <div class="input-group">
            <label for="coupleLast" class="input-label">Cognome referente</label>
            <input id="coupleLast" type="text" class="input-field" placeholder="Es. Rossi" bind:value={coupleLast} autocomplete="family-name" required />
          </div>
        </div>

        {#if !isPreAuthenticated}
          <div class="input-group">
            <label for="couplePassword" class="input-label">Password sposi</label>
            <div class="pwd-input-wrap">
              <input
                id="couplePassword"
                type={showPassword ? 'text' : 'password'}
                class="input-field"
                placeholder="Almeno 6 caratteri"
                bind:value={couplePassword}
                autocomplete="new-password"
                minlength="6"
                required
                disabled={!coupleEmailVerified || isSubmitting}
              />
              <button
                type="button"
                class="btn-toggle-pwd"
                onclick={() => showPassword = !showPassword}
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                disabled={!coupleEmailVerified || isSubmitting}
              >
                {#if showPassword}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {/if}
              </button>
            </div>
            <span class="field-hint">Userete queste credenziali per accedere da qualsiasi dispositivo.</span>
          </div>

          <div class="input-group">
            <label for="coupleConfirmPassword" class="input-label">Conferma password sposi</label>
            <input
              id="coupleConfirmPassword"
              type={showPassword ? 'text' : 'password'}
              class="input-field"
              placeholder="Ripeti la password"
              bind:value={coupleConfirmPassword}
              autocomplete="new-password"
              minlength="6"
              required
              disabled={!coupleEmailVerified || isSubmitting}
            />
          </div>
        {/if}
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
      {:else}
        <div class="verification-required-note" role="status">
          <strong>Un passaggio alla volta</strong>
          <span>Verifica l’email qui sopra per sbloccare i dati del matrimonio.</span>
        </div>
      {/if}
    </form>
  </div>
{/if}

<!-- POPUP ISTRUZIONI DI SUCCESSO E ORIENTAMENTO SPOSI -->
{#if showSuccessModal}
  <div class="guide-modal-overlay">
    <div class="guide-modal-card glass-card">
      <div class="guide-sparkle-icon">💍</div>
      
      <div class="guide-modal-header">
        <span class="guide-eyebrow">Matrimonio &amp; Account Creati con Successo!</span>
        <h2 class="guide-title font-serif">
          Benvenuti, <span class="gold-gradient-text">{spouse1} &amp; {spouse2}</span>!
        </h2>
        <p class="guide-lead-text">
          Nella prossima pagina potrete personalizzare le domande dei quiz, le sfide fotografiche e i momenti speciali della festa.
        </p>
      </div>

      <div class="guide-instruction-card">
        <div class="guide-instruction-intro">
          <div class="guide-info-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
          <div>
            <h4 class="guide-info-title">Come riaccedere in qualsiasi momento al vostro matrimonio:</h4>
            <p class="guide-info-sub">
              Per rientrare e gestire il matrimonio quando volete, da qualsiasi dispositivo, vi basterà cliccare sul pulsante <strong>"Accedi"</strong> in alto nella barra di navigazione ed inserire la vostra email e password.
            </p>
          </div>
        </div>

        <!-- NAVBAR DEL SITO RIMPICCIOLITA CON PULSANTE ACCEDI EVIDENZIATO -->
        <div class="mini-navbar-wrapper">
          <div class="mini-navbar-tag">Barra del sito:</div>
          <div class="mini-navbar-bar">
            <div class="mini-nav-brand">
              <span class="mini-rings-svg">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>
              </span>
              <span class="mini-brand-title">Fanta Matrimonio</span>
            </div>

            <div class="mini-nav-links">
              <span class="mini-nav-anchor">Come funziona</span>
              <span class="mini-nav-anchor">I giochi</span>

              <!-- SPOTLIGHT SUL PULSANTE ACCEDI -->
              <div class="spotlight-accedi-wrap">
                <div class="spotlight-balloon">
                  <span class="balloon-arrow">↓</span>
                  <span>Clicca qui per riaccedere!</span>
                </div>
                <div class="mini-accedi-pill">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>Accedi</span>
                </div>
              </div>

              <span class="mini-btn-code">Codice</span>
              <span class="mini-btn-crea">Crea</span>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-actions">
        <button type="button" class="btn btn-primary btn-lg guide-btn-next" onclick={proceedToSetup}>
          <span>Ho capito, personalizziamo il matrimonio!</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .create-layout {
    display: grid;
    grid-template-columns: minmax(0, 380px) 1fr;
    gap: 56px;
    align-items: start;
  }

  .verification-required-note {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(201, 169, 110, 0.1);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--text-main);
  }

  .verification-required-note span {
    color: #6b5f64;
    font-size: 0.9rem;
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

  .account-section {
    border-top: 1px dashed rgba(201, 169, 110, 0.4);
    padding-top: 20px;
    margin-top: 4px;
  }

  .section-note {
    font-size: 0.88rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin: -6px 0 10px;
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

  /* Password with toggle button */
  .pwd-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .pwd-input-wrap .input-field {
    padding-right: 42px;
    width: 100%;
  }

  .btn-toggle-pwd {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    transition: color 0.15s ease;
  }

  .btn-toggle-pwd:hover {
    color: var(--wine);
  }

  /* Preauth Box */
  .preauth-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 18px;
    border-radius: 14px;
    background: rgba(201, 169, 110, 0.08);
    border: 1px solid rgba(201, 169, 110, 0.28);
    margin-bottom: 16px;
  }

  .preauth-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #8c2f4b;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .preauth-text {
    font-size: 0.88rem;
    color: #4a4045;
    margin: 0;
    line-height: 1.45;
  }

  /* Guide Modal Overlay & Card */
  .guide-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(20, 10, 15, 0.68);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.25s ease-out;
  }

  .guide-modal-card {
    background: #ffffff;
    max-width: 640px;
    width: 100%;
    border-radius: 28px;
    padding: 36px 32px 32px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.22);
    border: 1px solid rgba(201, 169, 110, 0.35);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(24px) scale(0.97); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  .guide-sparkle-icon {
    font-size: 2.8rem;
    line-height: 1;
    margin-bottom: 12px;
    animation: pulseGlow 2s infinite ease-in-out;
  }

  @keyframes pulseGlow {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(201, 169, 110, 0.4)); }
    50% { transform: scale(1.1); filter: drop-shadow(0 0 12px rgba(201, 169, 110, 0.8)); }
  }

  .guide-modal-header {
    margin-bottom: 22px;
  }

  .guide-eyebrow {
    display: inline-block;
    font-size: 0.76rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--wine);
    background: var(--wine-tint);
    padding: 4px 12px;
    border-radius: 9999px;
    margin-bottom: 10px;
  }

  .guide-title {
    font-size: clamp(1.5rem, 4vw, 1.9rem);
    font-weight: 800;
    color: #241c20;
    margin: 0 0 8px;
    line-height: 1.25;
  }

  .guide-lead-text {
    font-size: 1rem;
    color: #5d5257;
    margin: 0;
    line-height: 1.5;
  }

  /* Instruction Card with Mini Navbar */
  .guide-instruction-card {
    width: 100%;
    background: #faf7f2;
    border: 1px solid rgba(201, 169, 110, 0.28);
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 26px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .guide-instruction-intro {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .guide-info-badge {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--wine-tint);
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .guide-info-title {
    font-size: 0.98rem;
    font-weight: 700;
    color: #241c20;
    margin: 0 0 4px;
  }

  .guide-info-sub {
    font-size: 0.88rem;
    color: #63575c;
    margin: 0;
    line-height: 1.45;
  }

  /* Mini Navbar Preview Container */
  .mini-navbar-wrapper {
    background: #ffffff;
    border-radius: 14px;
    border: 1px solid rgba(201, 169, 110, 0.35);
    padding: 12px 14px 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }

  .mini-navbar-tag {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8c8286;
    margin-bottom: 10px;
  }

  .mini-navbar-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    background: #ffffff;
    border-radius: 10px;
    border: 1px solid rgba(0, 0, 0, 0.07);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    overflow-x: auto;
  }

  .mini-nav-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #8c2f4b;
    white-space: nowrap;
  }

  .mini-rings-svg {
    color: var(--gold-primary);
    display: flex;
  }

  .mini-nav-links {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    padding-top: 18px;
  }

  .mini-nav-anchor {
    font-size: 0.72rem;
    color: #8a7e84;
    white-space: nowrap;
  }

  /* Spotlight sul pulsante Accedi */
  .spotlight-accedi-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .spotlight-balloon {
    position: absolute;
    top: -24px;
    white-space: nowrap;
    background: #8c2f4b;
    color: #ffffff;
    font-size: 0.68rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 6px;
    box-shadow: 0 3px 10px rgba(140, 47, 75, 0.35);
    display: flex;
    align-items: center;
    gap: 3px;
    animation: bounceTooltip 1.6s infinite ease-in-out;
  }

  @keyframes bounceTooltip {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  .balloon-arrow {
    font-size: 0.7rem;
    line-height: 1;
  }

  .mini-accedi-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 8px;
    background: #fffdf8;
    color: #8c2f4b;
    font-size: 0.75rem;
    font-weight: 800;
    border: 2px solid var(--gold-primary);
    box-shadow: 0 0 12px rgba(201, 169, 110, 0.6);
    animation: goldPulse 2s infinite ease-in-out;
    white-space: nowrap;
  }

  @keyframes goldPulse {
    0%, 100% { box-shadow: 0 0 6px rgba(201, 169, 110, 0.4); border-color: var(--gold-primary); }
    50% { box-shadow: 0 0 16px rgba(201, 169, 110, 0.85); border-color: #e9c98f; }
  }

  .mini-btn-code {
    font-size: 0.68rem;
    font-weight: 600;
    color: #63575c;
    background: #f2edf0;
    padding: 3px 7px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .mini-btn-crea {
    font-size: 0.68rem;
    font-weight: 700;
    color: #241c20;
    background: var(--gold-primary);
    padding: 3px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .guide-actions {
    width: 100%;
  }

  .guide-btn-next {
    width: 100%;
    padding: 15px 24px;
    font-size: 1.05rem;
    justify-content: center;
    box-shadow: 0 6px 20px rgba(201, 169, 110, 0.35);
  }

  @media (max-width: 520px) {
    .row { grid-template-columns: 1fr; gap: 0; }
    :global(.auth-card) { padding: 24px; }
    .guide-modal-card { padding: 24px 18px 22px; border-radius: 20px; }
    .mini-nav-anchor { display: none; }
  }
</style>
