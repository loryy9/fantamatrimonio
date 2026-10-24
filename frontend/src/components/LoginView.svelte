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
  let pin = $state('');
  let showPin = $state(false);
  let isSubmitting = $state(false);
  let showQrModal = $state(false);

  // Errore nickname già esistente
  let duplicateNickError = $state('');
  let duplicateNickName = $state('');

  const isAccountJoin = $derived(appState.hasAccount);

  let eventPreview = $state(null);
  let previewLoading = $state(false);
  let previewError = $state('');

  let checkTimer = null;
  let pinInputEl = $state(null);
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

    if (appState.account && !nickname && appState.account.display_name) {
      nickname = appState.account.display_name;
    }

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

  function handleRetryPin() {
    pin = '';
    duplicateNickError = '';
    setTimeout(() => pinInputEl?.focus(), 50);
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

    if (!nickname.trim()) {
      appState.showToast('Inserisci il tuo nome o nickname.', 'error');
      nickInputEl?.focus();
      return;
    }

    if (!isAccountJoin) {
      const cleanPin = pin.trim();
      if (!cleanPin || cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
        appState.showToast('Inserisci un PIN di 4 cifre (es. il tuo anno di nascita).', 'error');
        pinInputEl?.focus();
        return;
      }
    }

    isSubmitting = true;
    try {
      const res = await appState.login({
        inviteCode: inviteCode.trim().toUpperCase(),
        nickname: nickname.trim(),
        pin: pin.trim(),
      });

      if (!res.success) {
        if (res.code === 'NICKNAME_EXISTS') {
          duplicateNickName = res.detail?.nickname || nickname.trim();
          duplicateNickError = res.error || `Per questo matrimonio c'è già un "${duplicateNickName}". Se sei tu inserisci il tuo PIN, altrimenti usa un altro nome.`;
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
  <!-- Minimal Top Header -->
  <header class="guest-topbar">
    <button
      type="button"
      class="top-icon-btn"
      onclick={() => appState.setAuthView('entry')}
      aria-label="Torna indietro"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>

    <div class="top-title">Guest Login</div>

    <button
      type="button"
      class="top-icon-btn user-avatar-pill"
      onclick={() => appState.setAuthView('login-secure')}
      aria-label="Area Sposi e Account"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
    </button>
  </header>

  <div class="guest-container">
    <!-- Hero Header -->
    <div class="guest-hero">
      <div class="badge-pill">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
        </svg>
        <span>ACCESSO INVITATI</span>
      </div>

      <h1 class="guest-title font-serif">
        Entra nella <em>festa</em>
      </h1>

      <p class="guest-subtitle">
        Nessuna app da scaricare. Inserisci il codice per iniziare a giocare, scattare foto e votare con gli sposi.
      </p>
    </div>

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
          <label for="guestNick" class="field-label">IL TUO NOME O SOPRANNOME</label>
        </div>
        <div class="field-input-box">
          <input
            id="guestNick"
            bind:this={nickInputEl}
            type="text"
            class="clean-input"
            class:input-has-error={!!duplicateNickError}
            placeholder="es. Zia Pina, Marco, Vale e Luca..."
            bind:value={nickname}
            oninput={() => duplicateNickError = ''}
            required
            disabled={isSubmitting}
          />
        </div>
        <p class="field-hint">Come vuoi comparire nella classifica e sull'album di nozze</p>
      </div>

      <!-- Conflitto Nickname -->
      {#if duplicateNickError}
        <div class="conflict-box">
          <strong>Nome già presente</strong>
          <p>Se sei tu inserisci il tuo PIN di 4 cifre per continuare. Altrimenti prova con un soprannome diverso.</p>
          <div class="conflict-actions">
            <button type="button" class="btn btn-secondary btn-sm" onclick={handleRetryPin}>Inserisci PIN</button>
            <button type="button" class="btn btn-sm btn-ghost" onclick={handleChangeNickname}>Cambia nome</button>
          </div>
        </div>
      {/if}

      <!-- Campo PIN 4 Cifre (se non pre-autenticato) -->
      {#if !isAccountJoin}
        <div class="field-block">
          <div class="field-header">
            <label for="guestPin" class="field-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              PIN PERSONALE A 4 CIFRE
            </label>
            <span class="field-tag muted">Es. Anno di nascita</span>
          </div>
          <div class="field-input-box">
            <input
              id="guestPin"
              bind:this={pinInputEl}
              type={showPin ? 'text' : 'password'}
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="4"
              class="clean-input pin-input"
              class:input-has-error={!!duplicateNickError}
              placeholder="••••"
              bind:value={pin}
              oninput={(e) => {
                pin = e.target.value.replace(/\D/g, '').slice(0, 4);
                duplicateNickError = '';
              }}
              autocomplete="current-password"
              required
              disabled={isSubmitting}
            />
            <button
              type="button"
              class="eye-btn"
              onclick={() => showPin = !showPin}
              aria-label={showPin ? 'Nascondi PIN' : 'Mostra PIN'}
            >
              {#if showPin}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              {/if}
            </button>
          </div>
          <p class="field-hint">Ti servirà solo per rientrare se chiudi il browser durante la festa</p>
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
        <span>Nessuna registrazione o password richiesta</span>
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
        <h3 class="sub-card-title">Siete gli sposi o hai già un account?</h3>
        <p class="sub-card-text">
          Gestisci missioni, foto degli invitati e la classifica in tempo reale.
        </p>
        <button
          type="button"
          class="console-btn"
          onclick={() => appState.setAuthView('login-secure')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Accedi alla Console Sposi</span>
        </button>
        <p class="create-event-prompt">
          Non avete ancora un Fanta Matrimonio?
          <button type="button" class="inline-link" onclick={() => appState.setAuthView('create')}>Crealo ora</button>
        </p>
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

  /* Top Minimal Bar */
  .guest-topbar {
    width: 100%;
    max-width: 500px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 16px 2px;
  }

  @media (display-mode: standalone) {
    .guest-topbar {
      padding-top: max(6px, env(safe-area-inset-top, 0px));
    }
  }

  .top-icon-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .top-icon-btn:hover {
    background: rgba(74, 14, 46, 0.06);
  }

  .top-icon-btn:active {
    transform: scale(0.94);
  }

  .top-title {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--wine);
    letter-spacing: -0.01em;
  }

  .user-avatar-pill {
    background: var(--wine);
    color: #ffffff;
    width: 36px;
    height: 36px;
  }

  .user-avatar-pill:hover {
    background: var(--wine-deep);
  }

  /* Main Container */
  .guest-container {
    width: 100%;
    max-width: 520px;
    margin: 10px auto 36px;
    padding: 10px 20px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  /* Hero */
  .guest-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
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
    margin: 0 auto;
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
