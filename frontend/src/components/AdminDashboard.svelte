<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { appState } from '../lib/state.svelte.js';
  import { formatName } from '../lib/formatters.js';

  let { onExit } = $props();

  // Auth State
  let adminToken = $state(sessionStorage.getItem('fm_admin_token') || '');
  let isAuthenticated = $state(false);
  let isCheckingAuth = $state(true);

  // Login Form
  let username = $state('admin');
  let password = $state('admin');
  let loginError = $state('');
  let isLoggingIn = $state(false);

  // Events Data
  let events = $state([]);
  let isLoadingEvents = $state(false);
  let loadError = $state('');
  let searchQuery = $state('');

  // Delete Modal
  let eventToDelete = $state(null);
  let isDeleting = $state(false);
  let deleteError = $state('');

  // Copy Feedback
  let copiedEventId = $state(null);

  // Stats Derived
  const filteredEvents = $derived(
    events.filter(e => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const names = `${e.spouse1_name} ${e.spouse2_name}`.toLowerCase();
      const code = (e.invite_code || '').toLowerCase();
      return names.includes(q) || code.includes(q);
    })
  );

  const totalGuests = $derived(events.reduce((sum, e) => sum + (e.guest_count || 0), 0));
  const totalChallenges = $derived(events.reduce((sum, e) => sum + (e.challenge_count || 0), 0));
  const totalPhotos = $derived(events.reduce((sum, e) => sum + (e.photo_count || 0), 0));

  onMount(async () => {
    if (adminToken) {
      try {
        await api.adminVerify(adminToken);
        isAuthenticated = true;
        await loadEvents();
      } catch {
        sessionStorage.removeItem('fm_admin_token');
        adminToken = '';
        isAuthenticated = false;
      }
    }
    isCheckingAuth = false;
  });

  async function handleLogin(e) {
    if (e) e.preventDefault();
    loginError = '';
    isLoggingIn = true;

    try {
      const res = await api.adminLogin(username, password);
      adminToken = res.token;
      sessionStorage.setItem('fm_admin_token', res.token);
      isAuthenticated = true;
      await loadEvents();
      appState.showToast('Accesso amministratore eseguito!', 'success');
    } catch (err) {
      loginError = err.message || 'Credenziali non valide.';
    } finally {
      isLoggingIn = false;
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('fm_admin_token');
    adminToken = '';
    isAuthenticated = false;
    events = [];
    appState.showToast('Sessione amministratore terminata.', 'info');
  }

  async function loadEvents() {
    if (!adminToken) return;
    isLoadingEvents = true;
    loadError = '';

    try {
      const res = await api.adminGetEvents(adminToken);
      events = res.events || [];
    } catch (err) {
      loadError = err.message || 'Errore nel caricamento dei matrimoni.';
      if (err.status === 401) {
        handleLogout();
      }
    } finally {
      isLoadingEvents = false;
    }
  }

  async function confirmDelete() {
    if (!eventToDelete) return;
    isDeleting = true;
    deleteError = '';

    try {
      await api.adminDeleteEvent(eventToDelete.id, adminToken);
      const deletedName = `${eventToDelete.spouse1_name} & ${eventToDelete.spouse2_name}`;
      events = events.filter(e => e.id !== eventToDelete.id);
      eventToDelete = null;
      appState.showToast(`Matrimonio di ${deletedName} eliminato con successo!`, 'success');
    } catch (err) {
      deleteError = err.message || 'Errore durante l\'eliminazione del matrimonio.';
    } finally {
      isDeleting = false;
    }
  }

  function copyCode(eventId, code) {
    if (!code) return;
    navigator.clipboard.writeText(code);
    copiedEventId = eventId;
    setTimeout(() => {
      if (copiedEventId === eventId) copiedEventId = null;
    }, 2000);
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return 'N/D';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  }
</script>

<div class="admin-page">
  {#if isCheckingAuth}
    <div class="loading-box">
      <div class="spinner-admin"></div>
      <span>Verifica credenziali in corso...</span>
    </div>

  {:else if !isAuthenticated}
    <!-- LOGIN SCREEN -->
    <div class="login-wrapper">
      <div class="login-card glass-card">
        <div class="login-header">
          <div class="admin-badge-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M12 8v4"/><path d="M12 16h.01"/>
            </svg>
          </div>
          <h1 class="login-title font-serif">Pannello Amministrazione</h1>
          <p class="login-subtitle">Accesso globale per la gestione dei matrimoni</p>
        </div>

        {#if loginError}
          <div class="error-banner" role="alert">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{loginError}</span>
          </div>
        {/if}

        <form class="login-form" onsubmit={handleLogin}>
          <div class="form-group">
            <label for="admin-user" class="form-label">Nome Utente</label>
            <input
              id="admin-user"
              type="text"
              class="form-input"
              bind:value={username}
              placeholder="admin"
              required
            />
          </div>

          <div class="form-group">
            <label for="admin-pass" class="form-label">Password</label>
            <input
              id="admin-pass"
              type="password"
              class="form-input"
              bind:value={password}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" disabled={isLoggingIn}>
            {#if isLoggingIn}
              <div class="spinner-tiny"></div>
              <span>Accesso in corso...</span>
            {:else}
              Accedi alla Console
            {/if}
          </button>
        </form>

        <div class="login-footer">
          <button class="btn-text-link" onclick={() => onExit ? onExit() : (window.location.href = '/')}>
            ← Torna al sito principale
          </button>
        </div>
      </div>
    </div>

  {:else}
    <!-- ADMIN DASHBOARD -->
    <div class="dashboard-wrapper">
      <!-- Top Navigation Bar -->
      <header class="admin-topbar glass-card">
        <div class="topbar-left">
          <div class="admin-logo-mark">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div class="brand-title font-serif">Fanta Matrimonio · Admin</div>
            <div class="brand-role">Accesso Super Amministratore</div>
          </div>
        </div>

        <div class="topbar-right">
          <button class="btn btn-secondary btn-sm" onclick={loadEvents} disabled={isLoadingEvents} title="Ricarica lista matrimoni">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={isLoadingEvents ? 'spinning' : ''}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span>Aggiorna</span>
          </button>

          <button class="btn btn-secondary btn-sm" onclick={() => onExit ? onExit() : (window.location.href = '/')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Torna al Gioco</span>
          </button>

          <button class="btn btn-secondary btn-sm btn-logout" onclick={handleLogout}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Esci</span>
          </button>
        </div>
      </header>

      <!-- Global Metrics -->
      <section class="metrics-grid">
        <div class="metric-card glass-card">
          <div class="metric-icon gold">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-val">{events.length}</span>
            <span class="metric-lbl">Matrimoni Totali</span>
          </div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon green">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-val">{totalGuests}</span>
            <span class="metric-lbl">Invitati Registrati</span>
          </div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon purple">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-val">{totalChallenges}</span>
            <span class="metric-lbl">Sfide Configurate</span>
          </div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon rose">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
          <div class="metric-info">
            <span class="metric-val">{totalPhotos}</span>
            <span class="metric-lbl">Foto Caricate</span>
          </div>
        </div>
      </section>

      <!-- Main Section: Weddings Table / List -->
      <section class="events-section glass-card">
        <div class="section-toolbar">
          <div class="toolbar-title-box">
            <h2 class="section-title font-serif">Matrimoni Presenti nel Database</h2>
            <p class="section-desc">Visualizza i dettagli temporali, i codici di accesso e gestisci la cancellazione completa.</p>
          </div>

          <div class="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              class="search-input"
              bind:value={searchQuery}
              placeholder="Cerca per sposi o codice..."
            />
            {#if searchQuery}
              <button class="clear-search" onclick={() => searchQuery = ''}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            {/if}
          </div>
        </div>

        {#if loadError}
          <div class="error-banner" role="alert">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{loadError}</span>
          </div>
        {/if}

        {#if isLoadingEvents}
          <div class="loading-state">
            <div class="spinner-admin"></div>
            <span>Caricamento dei matrimoni in corso...</span>
          </div>
        {:else if filteredEvents.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
            <h3>Nessun matrimonio trovato</h3>
            <p>{searchQuery ? 'Nessun risultato corrisponde alla ricerca impostata.' : 'Nessun matrimonio registrato nel database.'}</p>
          </div>
        {:else}
          <div class="table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Sposi</th>
                  <th>Codice Invito</th>
                  <th>Finestra Temporale (Inizio - Fine)</th>
                  <th>Statistiche</th>
                  <th>Data Creazione</th>
                  <th class="text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredEvents as ev (ev.id)}
                  <tr>
                    <!-- Sposi -->
                    <td class="col-spouses">
                      <div class="spouses-name font-serif">
                        {formatName(ev.spouse1_name)} <span class="amp">&amp;</span> {formatName(ev.spouse2_name)}
                      </div>
                      <div class="event-id-sub">ID: {ev.id}</div>
                    </td>

                    <!-- Codice Invito -->
                    <td class="col-code">
                      <button
                        type="button"
                        class="code-pill {copiedEventId === ev.id ? 'copied' : ''}"
                        onclick={() => copyCode(ev.id, ev.invite_code)}
                        title="Clicca per copiare il codice"
                      >
                        <span class="code-text font-serif">{ev.invite_code || '---'}</span>
                        {#if copiedEventId === ev.id}
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {:else}
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        {/if}
                      </button>
                    </td>

                    <!-- Finestra Temporale -->
                    <td class="col-timing">
                      {#if ev.enable_timer && (ev.start_time || ev.end_time)}
                        <div class="timing-badge active">
                          <span class="timing-status-dot"></span>
                          <span class="timing-label">Timer Attivo</span>
                        </div>
                        <div class="timing-details">
                          <div><strong>Inizio:</strong> {formatDateTime(ev.start_time)}</div>
                          <div><strong>Fine:</strong> {formatDateTime(ev.end_time)}</div>
                        </div>
                      {:else}
                        <div class="timing-badge inactive">
                          <span class="timing-status-dot grey"></span>
                          <span>Sempre Aperto (Nessun Timer)</span>
                        </div>
                      {/if}
                    </td>

                    <!-- Statistiche -->
                    <td class="col-stats">
                      <div class="stats-tags">
                        <span class="stat-badge" title="Ospiti registrati">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                          {ev.guest_count} Ospiti
                        </span>
                        <span class="stat-badge" title="Sfide create">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          {ev.challenge_count} Sfide
                        </span>
                        <span class="stat-badge" title="Foto in galleria">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          {ev.photo_count} Foto
                        </span>
                      </div>
                    </td>

                    <!-- Data Creazione -->
                    <td class="col-created">
                      <span class="created-text">{formatDateTime(ev.created_at)}</span>
                    </td>

                    <!-- Azioni -->
                    <td class="col-actions text-right">
                      <button
                        class="btn-delete-event"
                        onclick={() => { eventToDelete = ev; deleteError = ''; }}
                        title="Elimina definitivamente questo matrimonio"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>Elimina</span>
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    </div>
  {/if}

  <!-- CONFIRM DELETE MODAL -->
  {#if eventToDelete}
    <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget && !isDeleting) eventToDelete = null; }}>
      <div class="modal-dialog glass-card">
        <div class="modal-icon-danger">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </div>

        <h3 class="modal-title font-serif">Conferma Eliminazione Matrimonio</h3>

        <div class="modal-event-summary">
          <div class="summary-names font-serif">
            {formatName(eventToDelete.spouse1_name)} &amp; {formatName(eventToDelete.spouse2_name)}
          </div>
          <div class="summary-code">Codice Invito: <strong>{eventToDelete.invite_code}</strong></div>
        </div>

        <p class="modal-warning">
          <strong>Attenzione:</strong> Questa azione è <u>irreversibile</u>. Verranno eliminati definitivamente tutti gli account degli invitati, le sfide create, le foto caricate e tutte le risposte associate a questo matrimonio.
        </p>

        {#if deleteError}
          <div class="error-banner" role="alert">
            <span>{deleteError}</span>
          </div>
        {/if}

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={() => eventToDelete = null} disabled={isDeleting}>
            Annulla
          </button>
          <button class="btn btn-danger" onclick={confirmDelete} disabled={isDeleting}>
            {#if isDeleting}
              <div class="spinner-tiny"></div>
              <span>Eliminazione in corso...</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Elimina Definitivamente</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-main);
    display: flex;
    flex-direction: column;
    padding: max(20px, env(safe-area-inset-top, 20px)) 20px max(24px, env(safe-area-inset-bottom, 24px));
    box-sizing: border-box;
  }

  /* Loading State */
  .loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 80vh;
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .spinner-admin {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(201, 169, 110, 0.25);
    border-top-color: var(--gold-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinning {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Login Screen */
  .login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 85vh;
  }

  .login-card {
    width: 100%;
    max-width: 420px;
    padding: 36px 32px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
    border: 1px solid var(--border-subtle);
  }

  .login-header {
    text-align: center;
    margin-bottom: 26px;
  }

  .admin-badge-icon {
    width: 58px;
    height: 58px;
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(201, 169, 110, 0.2) 0%, rgba(201, 169, 110, 0.05) 100%);
    color: var(--gold-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    border: 1px solid rgba(201, 169, 110, 0.35);
  }

  .login-title {
    font-size: 1.5rem;
    margin: 0 0 6px;
    color: var(--text-main);
  }

  .login-subtitle {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin: 0;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .form-input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    background: #fff;
    font-size: 0.95rem;
    color: var(--text-main);
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--gold-primary);
    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.2);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #dc2626;
    font-size: 0.86rem;
    font-weight: 600;
    margin-bottom: 18px;
  }

  .login-footer {
    text-align: center;
    margin-top: 20px;
  }

  /* Dashboard Screen */
  .dashboard-wrapper {
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .admin-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px 24px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid var(--border-subtle);
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .admin-logo-mark {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: var(--gold-dark);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(184, 134, 11, 0.25);
  }

  .brand-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .brand-role {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-logout:hover {
    color: #dc2626;
    border-color: rgba(220, 38, 38, 0.4);
    background: rgba(220, 38, 38, 0.05);
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .metric-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid var(--border-subtle);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.03);
  }

  .metric-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .metric-icon.gold { background: rgba(201, 169, 110, 0.15); color: var(--gold-dark); }
  .metric-icon.green { background: rgba(16, 185, 129, 0.15); color: #059669; }
  .metric-icon.purple { background: rgba(139, 92, 246, 0.15); color: #7c3aed; }
  .metric-icon.rose { background: rgba(212, 132, 154, 0.15); color: var(--rose-primary); }

  .metric-info {
    display: flex;
    flex-direction: column;
  }

  .metric-val {
    font-size: 1.6rem;
    font-weight: 800;
    line-height: 1.1;
    color: var(--text-main);
  }

  .metric-lbl {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 600;
    margin-top: 2px;
  }

  /* Events Section */
  .events-section {
    padding: 24px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid var(--border-subtle);
  }

  .section-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 22px;
  }

  .toolbar-title-box {
    max-width: 600px;
  }

  .section-title {
    font-size: 1.35rem;
    margin: 0 0 4px;
    color: var(--text-main);
  }

  .section-desc {
    font-size: 0.86rem;
    color: var(--text-muted);
    margin: 0;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: #fff;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    width: 100%;
    max-width: 320px;
    color: var(--text-muted);
  }

  .search-input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 0.9rem;
    width: 100%;
    color: var(--text-main);
  }

  .clear-search {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
  }

  /* Table */
  .table-container {
    overflow-x: auto;
    border-radius: 14px;
    border: 1px solid var(--border-subtle);
    background: #fff;
  }

  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    text-align: left;
  }

  .admin-table th {
    background: rgba(0, 0, 0, 0.02);
    padding: 14px 16px;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--border-subtle);
    white-space: nowrap;
  }

  .admin-table td {
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
  }

  .admin-table tr:last-child td {
    border-bottom: none;
  }

  .admin-table tr:hover {
    background: rgba(201, 169, 110, 0.03);
  }

  .text-right {
    text-align: right;
  }

  /* Table Columns */
  .col-spouses {
    min-width: 200px;
  }

  .spouses-name {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .spouses-name .amp {
    color: var(--gold-dark);
  }

  .event-id-sub {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-family: monospace;
    margin-top: 3px;
  }

  /* Code Pill */
  .code-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 10px;
    border: 1px solid rgba(201, 169, 110, 0.4);
    background: rgba(201, 169, 110, 0.08);
    color: var(--gold-dark);
    cursor: pointer;
    transition: all 0.15s ease;
    font-weight: 700;
  }

  .code-pill:hover {
    background: rgba(201, 169, 110, 0.18);
    border-color: var(--gold-dark);
  }

  .code-pill.copied {
    background: rgba(16, 185, 129, 0.15);
    border-color: #10b981;
    color: #059669;
  }

  .code-text {
    font-size: 0.95rem;
    letter-spacing: 0.06em;
  }

  /* Timing Badge */
  .col-timing {
    min-width: 240px;
  }

  .timing-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 999px;
    margin-bottom: 4px;
  }

  .timing-badge.active {
    background: rgba(16, 185, 129, 0.12);
    color: #047857;
  }

  .timing-badge.inactive {
    background: rgba(0, 0, 0, 0.05);
    color: var(--text-muted);
  }

  .timing-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
  }

  .timing-status-dot.grey {
    background: var(--text-dim);
  }

  .timing-details {
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* Stats Tags */
  .stats-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.04);
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .created-text {
    font-size: 0.82rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* Delete Action */
  .btn-delete-event {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(220, 38, 38, 0.25);
    background: rgba(220, 38, 38, 0.05);
    color: #dc2626;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .btn-delete-event:hover {
    background: #dc2626;
    color: #fff;
    border-color: #dc2626;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
  }

  /* Empty / Loading States */
  .empty-state, .loading-state {
    padding: 60px 20px;
    text-align: center;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.03);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
  }

  /* Delete Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(15, 12, 8, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-dialog {
    width: 100%;
    max-width: 480px;
    padding: 32px;
    border-radius: 24px;
    background: #fff;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .modal-icon-danger {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    background: rgba(220, 38, 38, 0.1);
    color: #dc2626;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }

  .modal-title {
    font-size: 1.35rem;
    margin: 0;
    color: var(--text-main);
  }

  .modal-event-summary {
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--border-subtle);
  }

  .summary-names {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .summary-code {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .modal-warning {
    font-size: 0.88rem;
    color: #b91c1c;
    background: rgba(239, 68, 68, 0.08);
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    margin: 0;
    text-align: left;
    line-height: 1.45;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .btn-danger {
    background: #dc2626;
    color: #fff;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn-danger:hover:not(:disabled) {
    background: #b91c1c;
    box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
  }

  @media (max-width: 768px) {
    .admin-topbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .topbar-right {
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .section-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      max-width: none;
    }
  }
</style>
