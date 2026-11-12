<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import QrScannerModal from './QrScannerModal.svelte';

  function getCodeFromUrl() {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('code') || '').trim().toUpperCase();
  }

  let inviteCode = $state(getCodeFromUrl());
  let nickname = $state('');
  let isSubmitting = $state(false);
  let showQrModal = $state(false);

  // Errore nickname già in uso nel matrimonio
  let duplicateNickError = $state('');

  const defaultNick = $derived(
    appState.account?.nickname || appState.account?.first_name || appState.account?.display_name || ''
  );

  let eventPreview = $state(null);
  let previewLoading = $state(false);
  let previewError = $state('');

  let checkTimer = null;
  let nickInputEl = $state(null);
  let inviteInputEl = $state(null);

  async function checkPreview(code) {
    const c = (code || '').trim().toUpperCase();
    if (c.length < 4) {
      eventPreview = null;
      previewError = '';
      return;
    }
    previewLoading = true;
    try {
      const res = await api.getEventPreview(c);
      eventPreview = res;
      previewError = '';
    } catch {
      eventPreview = null;
      if (c.length >= 6) {
        previewError = 'Codice matrimonio non trovato. Controlla il codice ricevuto.';
      }
    } finally {
      previewLoading = false;
    }
  }

  onMount(() => {
    function onLocation() {
      const c = getCodeFromUrl();
      if (c) inviteCode = c;
    }
    window.addEventListener('popstate', onLocation);
    window.addEventListener('hashchange', onLocation);

    const urlCode = getCodeFromUrl();
    if (urlCode) inviteCode = urlCode;

    return () => {
      window.removeEventListener('popstate', onLocation);
      window.removeEventListener('hashchange', onLocation);
      clearTimeout(checkTimer);
    };
  });

  $effect(() => {
    const code = inviteCode.trim().toUpperCase();
    clearTimeout(checkTimer);
    if (code.length >= 4) {
      checkTimer = setTimeout(() => {
        checkPreview(code);
      }, 150);
    } else {
      eventPreview = null;
      previewError = '';
    }
  });

  function handleQrScanResult(scannedCode) {
    if (scannedCode) {
      inviteCode = scannedCode.trim().toUpperCase();
      duplicateNickError = '';
      checkPreview(inviteCode);
      appState.showToast(`Codice ${inviteCode} rilevato!`, 'success');
    }
  }

  async function handlePaste() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const match = text.match(/[A-Za-z0-9\-_]{4,12}/);
          if (match) {
            inviteCode = match[0].toUpperCase();
            checkPreview(inviteCode);
            appState.showToast(`Codice ${inviteCode} incollato!`, 'info');
            return;
          }
        }
      }
    } catch {
      // ignore
    }
    inviteInputEl?.focus();
    appState.showToast('Digita il codice stampato sul tableau o segnaposto', 'info');
  }

  function handleChangeNickname() {
    duplicateNickError = '';
    setTimeout(() => {
      nickInputEl?.focus();
      nickInputEl?.select();
    }, 50);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    duplicateNickError = '';

    if (!inviteCode.trim()) {
      appState.showToast('Inserisci il codice del matrimonio.', 'error');
      inviteInputEl?.focus();
      return;
    }

    isSubmitting = true;
    try {
      const res = await appState.join(inviteCode.trim().toUpperCase(), nickname.trim());

      if (!res.success) {
        if (res.code === 'NICKNAME_TAKEN') {
          duplicateNickError = res.error;
          handleChangeNickname();
        } else {
          appState.showToast(res.error || 'Accesso non riuscito. Controlla il codice.', 'error');
        }
      }
    } catch (err) {
      appState.showToast(err.message || 'Errore di connessione.', 'error');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="guest-screen">
  <div class="guest-container">
    <!-- Hero Header -->
    <div class="guest-hero">
      <div class="badge-pill">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
        </svg>
        <span>ENTRA CON IL CODICE</span>
      </div>

      <h1 class="guest-title font-serif">
        Entra nella <em>festa</em>
      </h1>

      <p class="guest-subtitle">
        Inserisci il codice del matrimonio per iniziare a giocare, scattare foto e votare con gli sposi.
      </p>
    </div>

    <div class="guest-form-column">
    <!-- Main Card -->
    <form class="clean-card" onsubmit={handleSubmit}>
      <!-- Campo Codice Invito -->
      <div class="field-block">
        <div class="field-header">
          <label for="inviteCode" class="field-label">CODICE INVITO MATRIMONIO</label>
          <span class="field-tag required">Obbligatorio</span>
        </div>
        <div class="field-input-box">
          <input
            id="inviteCode"
            bind:this={inviteInputEl}
            type="text"
            class="clean-input code-style"
            placeholder="ES. PK9YMD"
            bind:value={inviteCode}
            oninput={(e) => { inviteCode = e.target.value.toUpperCase(); duplicateNickError = ''; }}
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            required
          />
          <div class="code-action-btns">
            <button
              type="button"
              class="scan-btn"
              onclick={() => showQrModal = true}
              title="Scansiona codice QR con fotocamera o foto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                <rect width="6" height="6" x="9" y="9" rx="1"/>
              </svg>
              <span>Scansiona QR</span>
            </button>
            <button
              type="button"
              class="paste-btn"
              onclick={handlePaste}
              title="Incolla dagli appunti"
            >
              Incolla
            </button>
          </div>
        </div>
        <p class="field-hint">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
          Lo trovi stampato sul segnaposto o nel tableau
        </p>

        <!-- Preview feedback se il codice è valido -->
        {#if eventPreview}
          <div class="code-confirmed-pill">
            <span class="check-icon">✓</span>
            <span>Matrimonio di <strong>{eventPreview.spouse1_name} &amp; {eventPreview.spouse2_name}</strong></span>
          </div>
        {:else if previewError}
          <div class="code-error-pill">
            <span>{previewError}</span>
          </div>
        {/if}
      </div>

      <!-- Campo Nome / Nickname -->
      <div class="field-block">
        <div class="field-header">
          <label for="guestNick" class="field-label">NICKNAME</label>
          <span class="field-tag muted">Facoltativo</span>
        </div>
        <div class="field-input-box">
          <input
            id="guestNick"
            bind:this={nickInputEl}
            type="text"
            class="clean-input"
            class:input-has-error={!!duplicateNickError}
            placeholder={defaultNick ? `Se vuoto: ${defaultNick}` : 'es. Zia Pina, Marco, Vale e Luca...'}
            bind:value={nickname}
            oninput={() => duplicateNickError = ''}
            disabled={isSubmitting}
          />
        </div>
        <p class="field-hint">Come vuoi comparire nella classifica e sull'album di nozze. Se lo lasci vuoto usiamo il tuo nome.</p>
      </div>

      <!-- Conflitto Nickname -->
      {#if duplicateNickError}
        <div class="conflict-box">
          <strong>Nickname già in uso</strong>
          <p>{duplicateNickError}</p>
        </div>
      {/if}

      <!-- Pulsante Entra nel gioco -->
      <button type="submit" class="submit-action-btn" disabled={isSubmitting}>
        {#if isSubmitting}
          <span class="spinner spinner-white"></span>
          <span>Accesso in corso...</span>
        {:else}
          <span>Entra nel gioco</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        {/if}
      </button>

      <div class="secure-badge-note">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
        <span>Stai entrando come {appState.account?.display_name || 'ospite'}</span>
      </div>
    </form>

    <!-- Card WhatsApp -->
    <div class="sub-card whatsapp-card">
      <div class="sub-card-icon yellow-bubble">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 9h8M8 13h4"/>
        </svg>
      </div>
      <div class="sub-card-body">
        <h3 class="sub-card-title">Hai ricevuto il link su WhatsApp?</h3>
        <p class="sub-card-text">
          Cliccandolo, il codice del matrimonio sarà già inserito automaticamente! Chiedilo agli sposi o al tuo tavolo.
        </p>
      </div>
    </div>

    <!-- Card Sposi / Account Console -->
    <div class="sub-card sposi-console-card">
      <div class="sub-card-icon heart-bubble">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </div>
      <div class="sub-card-body text-center">
        <h3 class="sub-card-title">Siete gli sposi?</h3>
        <p class="sub-card-text">
          Gestite missioni, foto degli invitati e la classifica in tempo reale dalla vostra dashboard.
        </p>
        <button
          type="button"
          class="console-btn"
          onclick={() => appState.openDashboard()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Vai ai miei matrimoni</span>
        </button>
        <p class="create-event-prompt">
          Non avete ancora un Fanta Matrimonio?
          <button type="button" class="inline-link" onclick={() => appState.setAuthView('create')}>Crealo ora</button>
        </p>
      </div>
    </div>

    </div>

    <!-- Subtle Footer info -->
    <footer class="minimal-footer">
      <div class="footer-divider">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="12" r="4"/><circle cx="15" cy="12" r="4"/>
        </svg>
      </div>
      <p class="footer-copy">Fanta Matrimonio • Gioca, scatta, vota e celebra l'amore</p>
    </footer>
  </div>

  <QrScannerModal
    isOpen={showQrModal}
    onScan={handleQrScanResult}
    onClose={() => showQrModal = false}
  />
</div>

<style>
  .guest-screen {
    min-height: 100vh;
    min-height: 100dvh;
    background-color: var(--bg-primary);
    padding-bottom: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Main Container */
  .guest-container {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 10px 0 32px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
    align-items: center;
    gap: clamp(32px, 5vw, 64px);
  }

  .guest-form-column {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Hero */
  .guest-hero {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    margin-top: 4px;
    margin-bottom: 8px;
  }

  .badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #fae9f0;
    color: var(--wine);
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .guest-title {
    font-size: clamp(2.3rem, 5vw, 2.85rem);
    color: var(--wine);
    line-height: 1.08;
    margin-bottom: 10px;
    font-weight: 700;
  }

  .guest-title em {
    font-style: italic;
    font-weight: 400;
    border-bottom: 2px solid #ecd189;
    padding-bottom: 1px;
  }

  .guest-subtitle {
    font-size: 0.92rem;
    color: #6a5e64;
    line-height: 1.5;
    max-width: 42ch;
    margin: 0;
  }

  /* Clean Card */
  .clean-card {
    width: 100%;
    background: #ffffff;
    border-radius: 24px;
    padding: 24px 22px;
    box-shadow: 0 4px 20px rgba(140, 47, 75, 0.05), 0 1px 4px rgba(0, 0, 0, 0.03);
    border: 1px solid rgba(220, 205, 195, 0.35);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .minimal-footer {
    grid-column: 1 / -1;
  }

  @media (max-width: 900px) {
    .guest-container {
      max-width: 560px;
      padding: 0 0 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .guest-hero {
      align-items: center;
      text-align: center;
    }

    .guest-subtitle {
      margin: 0 auto;
    }
  }

  @media (max-width: 480px) {
    .guest-container {
      padding: 0 0 24px;
    }
  }

  .field-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .field-label {
    display: flex;
    align-items: center;
    color: #4a3b42;
    text-transform: uppercase;
  }

  .field-tag.required {
    color: #a88438;
    font-weight: 700;
  }

  .field-tag.muted {
    color: #8c7882;
    font-weight: 500;
    text-transform: none;
    letter-spacing: normal;
  }

  .field-input-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  .clean-input {
    width: 100%;
    background: #f4efe9;
    border: 1.5px solid transparent;
    border-radius: 14px;
    padding: 13px 16px;
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

  .clean-input.code-style {
    font-size: 16px !important;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding-right: 180px;
    text-transform: uppercase;
  }

  .clean-input.pin-input {
    letter-spacing: 0.3em;
    font-size: 18px !important;
    font-weight: 700;
    padding-right: 48px;
  }

  .clean-input::placeholder {
    color: #9c8e94;
    font-weight: 400;
    letter-spacing: normal;
  }

  .code-action-btns {
    position: absolute;
    right: 6px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .scan-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.2);
    border-radius: 9px;
    padding: 6px 9px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--wine);
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .scan-btn:hover {
    background: #faedf2;
    border-color: var(--wine);
  }

  .scan-btn:active {
    transform: scale(0.96);
  }

  .paste-btn {
    display: inline-flex;
    align-items: center;
    background: #f7f2ed;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 9px;
    padding: 6px 9px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #55484f;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .paste-btn:hover {
    background: #eee8e0;
  }

  .paste-btn:active {
    transform: scale(0.96);
  }

  .eye-btn {
    position: absolute;
    right: 12px;
    background: transparent;
    border: none;
    color: #7b6d74;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 4px;
  }

  .field-hint {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.74rem;
    color: #756970;
    line-height: 1.35;
    margin-top: 2px;
  }

  .code-confirmed-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #eef7f2;
    border: 1px solid #c2e5d3;
    color: #246845;
    padding: 7px 12px;
    border-radius: 10px;
    font-size: 0.78rem;
    margin-top: 4px;
  }

  .code-confirmed-pill .check-icon {
    font-weight: 800;
    color: #1e7045;
  }

  .code-error-pill {
    background: #fdf2f2;
    border: 1px solid #f8cdcd;
    color: #a83232;
    padding: 7px 12px;
    border-radius: 10px;
    font-size: 0.76rem;
    margin-top: 4px;
  }

  .submit-action-btn {
    width: 100%;
    min-height: 48px;
    background: var(--wine);
    color: #ffffff;
    border: none;
    border-radius: 999px;
    font-family: var(--font-sans);
    font-size: 0.98rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(74, 14, 46, 0.28);
    transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    margin-top: 6px;
  }

  .submit-action-btn:hover {
    background: var(--wine-deep);
    box-shadow: 0 8px 22px rgba(74, 14, 46, 0.35);
  }

  .submit-action-btn:active {
    transform: scale(0.98);
  }

  .secure-badge-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.73rem;
    color: #6a5e64;
    font-weight: 500;
    margin-top: -4px;
  }

  .secure-badge-note svg {
    color: #5b9b7a;
  }

  /* Sub cards */
  .sub-card {
    width: 100%;
    border-radius: 20px;
    padding: 16px 18px;
    display: flex;
    gap: 14px;
    border: 1px solid rgba(220, 205, 195, 0.35);
  }

  .whatsapp-card {
    background: #fcf9f2;
    align-items: flex-start;
  }

  .yellow-bubble {
    background: #f8e596;
    color: #614d0a;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sub-card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .sub-card-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #2b1f24;
    line-height: 1.3;
  }

  .sub-card-text {
    font-size: 0.78rem;
    color: #6b5d63;
    line-height: 1.45;
  }

  /* Sposi Card */
  .sposi-console-card {
    background: #f5f0ec;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 20px 18px;
  }

  .heart-bubble {
    background: #fae0ea;
    color: var(--wine);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .console-btn {
    width: 100%;
    max-width: 320px;
    background: #ffffff;
    color: #2b1f24;
    border: 1px solid rgba(74, 14, 46, 0.12);
    border-radius: 999px;
    padding: 11px 20px;
    font-size: 0.86rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: all 0.15s ease;
    margin-top: 6px;
  }

  .console-btn:hover {
    background: #faf7f2;
    border-color: var(--wine);
  }

  .create-event-prompt {
    font-size: 0.76rem;
    color: #6b5d63;
    margin-top: 4px;
  }

  .inline-link {
    background: transparent;
    border: none;
    color: var(--wine);
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    font-size: inherit;
  }

  /* Footer */
  .minimal-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
    text-align: center;
  }

  .footer-divider {
    color: #c59e58;
    opacity: 0.6;
  }

  .footer-copy {
    font-size: 0.74rem;
    color: #8c7d84;
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

  .conflict-box {
    background: #fdf5f5;
    border: 1px solid #f6cfcf;
    border-radius: 12px;
    padding: 12px;
    font-size: 0.82rem;
    color: #661818;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .conflict-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
</style>
