<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';

  function getCodeFromUrl() {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('code') || '').trim().toUpperCase();
  }

  let inviteCode = $state(getCodeFromUrl());
  let nickname = $state('');
  let pin = $state('');
  let isSubmitting = $state(false);

  // Errore specifico per nickname già esistente con PIN errato
  let duplicateNickError = $state('');
  let duplicateNickName = $state('');

  const isAccountJoin = $derived(appState.hasAccount);

  let eventPreview = $state(null);
  let previewLoading = $state(false);
  let previewError = $state('');

  let checkTimer = null;
  let pinInputEl = $state(null);
  let nickInputEl = $state(null);

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
      if (c) {
        inviteCode = c;
      }
    }
    window.addEventListener('popstate', onLocation);
    window.addEventListener('hashchange', onLocation);

    // Se l'utente ha già un account registrato, precompila il nickname
    if (appState.account && !nickname && appState.account.display_name) {
      nickname = appState.account.display_name;
    }

    const urlCode = getCodeFromUrl();
    if (urlCode) {
      inviteCode = urlCode;
    }

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
      return;
    }

    if (!nickname.trim()) {
      appState.showToast('Inserisci il tuo nickname (es. Zia Pina, Nonno Bruno).', 'error');
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
          duplicateNickError = res.error || `Per questo matrimonio c'è già un "${duplicateNickName}". Se sei tu che stai accedendo da un altro dispositivo, inserisci il tuo PIN corretto. Altrimenti, cambia nickname.`;
        } else {
          appState.showToast(res.error || 'Accesso non riuscito. Controlla il codice o i dati inseriti.', 'error');
        }
      }
    } catch (err) {
      appState.showToast(err.message || 'Errore di connessione.', 'error');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="join-layout">
  <div class="join-intro">
    <span class="eyebrow">Invitati</span>
    <h1 class="page-title">Entra nel <span class="gold-gradient-text">matrimonio</span></h1>
    <p class="page-lead">
      {#if isAccountJoin}
        Inserisci il codice del matrimonio e il nickname con cui vuoi partecipare. Il tuo account verrà collegato automaticamente.
      {:else}
        Bastano solo il tuo nickname e un PIN a 4 cifre per iniziare a giocare all'istante, caricare foto e scalare la classifica!
      {/if}
    </p>

    <ul class="tips">
      <li><strong>Accesso immediato:</strong> niente password complesse né email obbligatorie.</li>
      <li><strong>Il tuo PIN personale:</strong> 4 cifre facili da ricordare (es. anno di nascita) per accedere da qualsiasi tuo dispositivo.</li>
      <li><strong>I tuoi ricordi al sicuro:</strong> durante la festa potrai salvare tutto creando un account permanente con un solo clic.</li>
    </ul>

    <div class="sposi-notice-box">
      <div class="sposi-notice-header">
        <span class="sposi-notice-ring">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-0.125em">
            <circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>
          </svg>
        </span>
        <strong>Siete gli sposi o hai già un account?</strong>
      </div>
      <p class="sposi-notice-p">
        Se hai già registrato il tuo account con email e password, o se sei una coppia di sposi:
      </p>
      <button
        type="button"
        class="btn btn-secondary btn-sm sposi-login-btn"
        onclick={() => appState.setAuthView('login-secure')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span>Accedi con Email e Password</span>
      </button>
      <div class="sposi-create-link-wrap">
        <span>Non avete ancora un matrimonio?</span>
        <button type="button" class="link-btn" onclick={() => appState.setAuthView('create')}>
          Crea matrimonio
        </button>
      </div>
    </div>
  </div>

  <form class="auth-card join-form" onsubmit={handleSubmit}>
    <h2 class="form-title font-serif">Partecipa alla festa</h2>

    {#if previewLoading}
      <div class="preview-banner preview-loading">
        <span class="preview-badge-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </span>
        <div class="preview-badge-body">
          <span class="preview-badge-label">Verifica codice</span>
          <strong class="preview-badge-names">Ricerca matrimonio in corso...</strong>
        </div>
      </div>
    {:else if eventPreview}
      <div class="preview-banner">
        <span class="preview-badge-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>
          </svg>
        </span>
        <div class="preview-badge-body">
          <span class="preview-badge-label">Matrimonio confermato</span>
          <strong class="preview-badge-names">{eventPreview.spouse1_name} &amp; {eventPreview.spouse2_name}</strong>
        </div>
        <span class="preview-badge-check" title="Codice valido">✓</span>
      </div>
    {:else if previewError}
      <div class="preview-warning" role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>{previewError}</span>
      </div>
    {/if}

    <!-- NICKNAME CONFLICT ALERT -->
    {#if duplicateNickError}
      <div class="duplicate-alert" role="alert">
        <div class="duplicate-alert-header">
          <div class="duplicate-alert-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <strong>Nome già presente per questo matrimonio</strong>
        </div>
        <p class="duplicate-alert-message">
          Per questo matrimonio c'è già un <strong>"{duplicateNickName || nickname}"</strong>.
          Se sei tu che stai accedendo da un altro dispositivo inserisci il tuo PIN corretto, altrimenti cambia nickname.
        </p>
        <div class="duplicate-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick={handleRetryPin}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Inserisci PIN corretto</span>
          </button>
          <button type="button" class="btn btn-ghost btn-sm" onclick={handleChangeNickname}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span>Cambia nickname</span>
          </button>
        </div>
      </div>
    {/if}

    <!-- CODICE INVITO -->
    <div class="input-group">
      <label for="inviteCode" class="input-label">Codice invito matrimonio</label>
      <input
        id="inviteCode"
        type="text"
        class="input-field code-input"
        placeholder="Es. K7M2QX"
        bind:value={inviteCode}
        oninput={(e) => { inviteCode = e.target.value.toUpperCase(); duplicateNickError = ''; }}
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        required
      />
    </div>

    <!-- NICKNAME -->
    <div class="input-group">
      <label for="guestNick" class="input-label">Il tuo nickname</label>
      <input
        id="guestNick"
        bind:this={nickInputEl}
        type="text"
        class="input-field"
        class:input-field-error={!!duplicateNickError}
        placeholder="es. Zia Pina, Nonno Bruno, Matteo..."
        bind:value={nickname}
        oninput={() => duplicateNickError = ''}
        required
        disabled={isSubmitting}
      />
      <span class="field-hint">Il nome con cui ti riconosceranno sposi e invitati.</span>
    </div>

    {#if isAccountJoin}
      <div class="account-join-notice" role="status">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <div>
          <strong>Sei autenticato con il tuo account</strong>
          <span>Il PIN non è richiesto: l'accesso avverrà automaticamente con il tuo profilo.</span>
        </div>
      </div>
    {:else}
      <!-- PIN 4 CIFRE -->
      <div class="input-group">
        <div class="label-with-badge">
          <label for="guestPin" class="input-label">PIN di 4 cifre</label>
          <span class="badge-pin-hint">Es. anno di nascita</span>
        </div>
        <input
          id="guestPin"
          bind:this={pinInputEl}
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="4"
          class="input-field pin-field"
          class:input-field-error={!!duplicateNickError}
          placeholder="••••"
          bind:value={pin}
          oninput={(e) => {
            // Accetta solo numeri, max 4 cifre
            pin = e.target.value.replace(/\D/g, '').slice(0, 4);
            duplicateNickError = '';
          }}
          autocomplete="current-password"
          required
          disabled={isSubmitting}
        />
        <span class="field-hint">Serve per rientrare nella partita dal tuo telefono o da un altro dispositivo.</span>
      </div>
    {/if}

    <button type="submit" class="btn btn-primary btn-lg btn-block submit-btn" disabled={isSubmitting}>
      {#if isSubmitting}
        <div class="spinner spinner-on-dark"></div>
        <span>Entrando in pista...</span>
      {:else}
        <span>Entra nel gioco</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
        </svg>
      {/if}
    </button>
  </form>
</div>

<style>
  .join-layout {
    display: grid;
    grid-template-columns: 1fr minmax(0, 480px);
    gap: 56px;
    align-items: start;
  }

  .join-intro {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    position: sticky;
    top: 96px;
  }

  .join-intro .page-title {
    font-size: clamp(2.2rem, 4vw, 3.1rem);
    line-height: 1.05;
    color: var(--text-main);
    margin: 0;
  }

  .join-intro .page-title::after {
    content: '';
    display: block;
    width: 40px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin-top: 14px;
  }

  .join-intro .page-lead {
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
    margin: 0;
  }

  .tips {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 0.9rem;
    color: var(--text-muted);
    padding: 0;
    margin: 4px 0 0;
  }

  .tips li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.45;
  }

  .tips li::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--gold-primary);
    flex-shrink: 0;
    margin-top: 7px;
  }

  .join-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-title {
    font-size: 1.55rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .code-input {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-weight: 700;
  }

  .label-with-badge {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .badge-pin-hint {
    font-size: 0.75rem;
    color: var(--gold-dark);
    font-weight: 600;
  }

  .pin-field {
    letter-spacing: 0.35em;
    font-size: 1.25rem;
    font-weight: 700;
  }

  .input-field-error {
    border-color: #e53e3e !important;
    background: rgba(229, 62, 62, 0.04) !important;
  }

  /* Duplicate nickname alert card */
  .duplicate-alert {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 14px;
    background: #fff8f5;
    border: 1.5px solid #f6ad55;
    color: #7b341e;
    animation: fadeIn 0.25s ease-out;
  }

  .duplicate-alert-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.92rem;
    color: #9c4221;
  }

  .duplicate-alert-icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(221, 107, 32, 0.15);
    color: #c05621;
    flex-shrink: 0;
  }

  .duplicate-alert-message {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.45;
    color: #652b19;
  }

  .duplicate-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
  }

  .account-join-notice {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(72, 187, 120, 0.1);
    border: 1px solid rgba(72, 187, 120, 0.3);
    color: #22543d;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .account-join-notice strong {
    display: block;
    color: #1c4532;
    margin-bottom: 2px;
  }

  .submit-btn {
    margin-top: 6px;
  }

  .spinner-on-dark {
    border-color: rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
  }

  @media (max-width: 900px) {
    .join-layout {
      grid-template-columns: 1fr;
      gap: 28px;
    }
    .join-intro {
      position: static;
    }
  }

  @media (max-width: 520px) {
    :global(.auth-card) { padding: 24px; }
  }

  /* Live Preview Box */
  .preview-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 16px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.4);
    margin-bottom: 4px;
  }

  .preview-loading {
    opacity: 0.85;
  }

  .preview-badge-icon {
    font-size: 1.4rem;
    line-height: 1;
  }

  .preview-badge-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .preview-badge-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--gold-dark);
  }

  .preview-badge-names {
    font-size: 1.05rem;
    color: var(--text-main);
  }

  .preview-badge-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #2e7d32;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .preview-warning {
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #b91c1c;
    font-size: 0.86rem;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .sposi-notice-box {
    width: 100%;
    margin-top: 20px;
    padding: 16px 18px;
    border-radius: 16px;
    background: #ffffff;
    border: 1px solid rgba(201, 169, 110, 0.35);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sposi-notice-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--wine);
  }

  .sposi-notice-p {
    font-size: 0.86rem;
    color: #63575c;
    margin: 0;
    line-height: 1.45;
  }

  .sposi-login-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-weight: 700;
  }

  .sposi-create-link-wrap {
    font-size: 0.82rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
