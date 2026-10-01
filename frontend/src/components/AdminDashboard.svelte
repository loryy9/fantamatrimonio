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

  // Tab di navigazione admin: 'events' | 'users'
  let activeAdminTab = $state('events');

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

  // Delete Event Modal
  let eventToDelete = $state(null);
  let isDeleting = $state(false);
  let deleteError = $state('');

  // Users Data
  let users = $state([]);
  let isLoadingUsers = $state(false);
  let loadUsersError = $state('');
  let userSearchQuery = $state('');

  // Delete User Modal
  let userToDelete = $state(null);
  let deleteUserCascadeEvents = $state(false);
  let isDeletingUser = $state(false);
  let deleteUserError = $state('');

  // Copy Feedback
  let copiedEventId = $state(null);

  // Stats Derived - Events
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

  // Stats Derived - Users
  const filteredUsers = $derived(
    users.filter(u => {
      const q = userSearchQuery.trim().toLowerCase();
      if (!q) return true;
      const email = (u.email || '').toLowerCase();
      const name = (u.display_name || '').toLowerCase();
      const eventsStr = (u.events || []).map(e => `${e.spouse1_name} ${e.spouse2_name} ${e.invite_code}`).join(' ').toLowerCase();
      return email.includes(q) || name.includes(q) || eventsStr.includes(q);
    })
  );

  const totalCoupleAccounts = $derived(users.filter(u => u.weddings_as_couple > 0).length);
  const totalGuestAccounts = $derived(users.filter(u => u.weddings_as_couple === 0 && u.weddings_as_guest > 0).length);
  const totalStandaloneAccounts = $derived(users.filter(u => u.weddings_as_couple === 0 && u.weddings_as_guest === 0).length);

  onMount(async () => {
    if (adminToken) {
      try {
        await api.adminVerify(adminToken);
        isAuthenticated = true;
        await Promise.all([loadEvents(), loadUsers()]);
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
      await Promise.all([loadEvents(), loadUsers()]);
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
    users = [];
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

  async function loadUsers() {
    if (!adminToken) return;
    isLoadingUsers = true;
    loadUsersError = '';

    try {
      const res = await api.adminGetUsers(adminToken);
      users = res.users || [];
    } catch (err) {
      loadUsersError = err.message || 'Errore nel caricamento degli utenti.';
      if (err.status === 401) {
        handleLogout();
      }
    } finally {
      isLoadingUsers = false;
    }
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return;
    isDeletingUser = true;
    deleteUserError = '';

    try {
      await api.adminDeleteUser(userToDelete.id, adminToken, deleteUserCascadeEvents);
      const deletedEmail = userToDelete.email;
      users = users.filter(u => u.id !== userToDelete.id);
      if (deleteUserCascadeEvents) {
        await loadEvents();
      }
      userToDelete = null;
      deleteUserCascadeEvents = false;
      appState.showToast(`Utente ${deletedEmail} eliminato con successo!`, 'success');
    } catch (err) {
      deleteUserError = err.message || 'Errore durante l\'eliminazione dell\'utente.';
    } finally {
      isDeletingUser = false;
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

      <!-- Tab Navigation Switcher -->
      <div class="admin-tab-nav">
        <button
          type="button"
          class="admin-nav-tab"
          class:active={activeAdminTab === 'events'}
          onclick={() => activeAdminTab = 'events'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>
          <span>Matrimoni ({events.length})</span>
        </button>

        <button
          type="button"
          class="admin-nav-tab"
          class:active={activeAdminTab === 'users'}
          onclick={() => { activeAdminTab = 'users'; if (users.length === 0) loadUsers(); }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Utenti Registrati ({users.length})</span>
        </button>
      </div>

      {#if activeAdminTab === 'events'}
        <!-- Global Metrics: Events -->
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

      {:else}
        <!-- Global Metrics: Users -->
        <section class="metrics-grid">
          <div class="metric-card glass-card">
            <div class="metric-icon gold">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="metric-info">
              <span class="metric-val">{users.length}</span>
              <span class="metric-lbl">Account Registrati</span>
            </div>
          </div>

          <div class="metric-card glass-card">
            <div class="metric-icon purple">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
            </div>
            <div class="metric-info">
              <span class="metric-val">{totalCoupleAccounts}</span>
              <span class="metric-lbl">Account Sposi</span>
            </div>
          </div>

          <div class="metric-card glass-card">
            <div class="metric-icon green">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <div class="metric-info">
              <span class="metric-val">{totalGuestAccounts}</span>
              <span class="metric-lbl">Account Invitati</span>
            </div>
          </div>

          <div class="metric-card glass-card">
            <div class="metric-icon rose">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div class="metric-info">
              <span class="metric-val">{totalStandaloneAccounts}</span>
              <span class="metric-lbl">Senza Eventi</span>
            </div>
          </div>
        </section>

        <!-- Main Section: Users Table -->
        <section class="events-section glass-card">
          <div class="section-toolbar">
            <div class="toolbar-title-box">
              <h2 class="section-title font-serif">Utenti Registrati (Account)</h2>
              <p class="section-desc">Elenco di tutti gli account registrati con email e password, con i matrimoni associati e gestione eliminazione.</p>
            </div>

            <div class="search-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                class="search-input"
                bind:value={userSearchQuery}
                placeholder="Cerca per email, nome o matrimonio..."
              />
              {#if userSearchQuery}
                <button class="clear-search" onclick={() => userSearchQuery = ''}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              {/if}
            </div>
          </div>

          {#if loadUsersError}
            <div class="error-banner" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{loadUsersError}</span>
            </div>
          {/if}

          {#if isLoadingUsers}
            <div class="loading-state">
              <div class="spinner-admin"></div>
              <span>Caricamento utenti registrati in corso...</span>
            </div>
          {:else if filteredUsers.length === 0}
            <div class="empty-state">
              <div class="empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
              </div>
              <h3>Nessun utente registrato trovato</h3>
              <p>{userSearchQuery ? 'Nessun account corrisponde ai criteri di ricerca impostati.' : 'Non ci sono account registrati nel database.'}</p>
            </div>
          {:else}
            <div class="table-container">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Account / Utente</th>
                    <th>Tipo Account</th>
                    <th>Matrimoni Associati</th>
                    <th>Data Registrazione</th>
                    <th class="text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredUsers as u (u.id)}
                    <tr>
                      <!-- Account / Utente -->
                      <td class="col-spouses">
                        <div class="user-row-cell">
                          <div class="user-avatar-badge">
                            {u.display_name ? u.display_name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div class="user-display-name font-serif">
                              {u.display_name || 'Utente'}
                            </div>
                            <div class="user-email-text font-mono">
                              {u.email}
                            </div>
                            <div class="event-id-sub">ID: {u.id}</div>
                          </div>
                        </div>
                      </td>

                      <!-- Tipo Account -->
                      <td>
                        {#if u.weddings_as_couple > 0 && u.weddings_as_guest > 0}
                          <span class="user-type-tag tag-purple">👑 Sposo &amp; 🎉 Ospite</span>
                        {:else if u.weddings_as_couple > 0}
                          <span class="user-type-tag tag-gold">👑 Sposo ({u.weddings_as_couple})</span>
                        {:else if u.weddings_as_guest > 0}
                          <span class="user-type-tag tag-green">🎉 Ospite ({u.weddings_as_guest})</span>
                        {:else}
                          <span class="user-type-tag tag-gray">Registrato</span>
                        {/if}
                      </td>

                      <!-- Matrimoni Associati -->
                      <td>
                        {#if u.events && u.events.length > 0}
                          <div class="user-events-list">
                            {#each u.events as ev}
                              <div class="user-event-pill" class:pill-couple={ev.role === 'couple'}>
                                <span class="pill-icon">{ev.role === 'couple' ? '👑' : '🎉'}</span>
                                <span class="pill-text">{ev.spouse1_name} &amp; {ev.spouse2_name}</span>
                                <code class="pill-code" title="Codice Invito">{ev.invite_code}</code>
                                {#if ev.total_points > 0}
                                  <span class="pill-pts">{ev.total_points} pt</span>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {:else}
                          <span class="text-subtle">Nessun matrimonio collegato</span>
                        {/if}
                      </td>

                      <!-- Data Registrazione -->
                      <td class="col-date">
                        <span class="date-badge">{formatDateTime(u.registered_at || u.created_at)}</span>
                      </td>

                      <!-- Azioni -->
                      <td class="col-actions text-right">
                        <button
                          class="btn-delete-event"
                          onclick={() => {
                            userToDelete = u;
                            deleteUserCascadeEvents = false;
                            deleteUserError = '';
                          }}
                          title="Elimina definitivamente questo account"
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
      {/if}
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

  <!-- CONFIRM DELETE USER MODAL -->
  {#if userToDelete}
    <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget && !isDeletingUser) userToDelete = null; }}>
      <div class="modal-dialog glass-card">
        <div class="modal-icon-danger">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>
          </svg>
        </div>

        <h3 class="modal-title font-serif">Conferma Eliminazione Account Utente</h3>

        <div class="modal-event-summary">
          <div class="summary-names font-serif">
            {userToDelete.display_name || 'Utente'}
          </div>
          <div class="summary-code">Email: <strong>{userToDelete.email}</strong></div>
        </div>

        <p class="modal-warning">
          <strong>Attenzione:</strong> Questa azione eliminerà definitivamente l'account registrato e invaliderà tutte le sue sessioni di accesso attive.
        </p>

        {#if userToDelete.weddings_as_couple > 0}
          <div class="cascade-checkbox-card">
            <label class="cascade-checkbox-label">
              <input type="checkbox" bind:checked={deleteUserCascadeEvents} />
              <div class="cascade-checkbox-text">
                <strong>Elimina anche i {userToDelete.weddings_as_couple} matrimoni creati da questo account</strong>
                <span>Se selezionato, verranno cancellati per sempre anche i matrimoni creati con tutti i quiz, foto e invitati associati. Se non selezionato, i matrimoni rimarranno nel database.</span>
              </div>
            </label>
          </div>
        {/if}

        {#if deleteUserError}
          <div class="error-banner" role="alert">
            <span>{deleteUserError}</span>
          </div>
        {/if}

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick={() => userToDelete = null} disabled={isDeletingUser}>
            Annulla
          </button>
          <button class="btn btn-danger" onclick={confirmDeleteUser} disabled={isDeletingUser}>
            {#if isDeletingUser}
              <div class="spinner-tiny"></div>
              <span>Eliminazione in corso...</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Elimina Account</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-page {
    --ink: #241c20;
    --ink-soft: #6b5f64;
    --hair: rgba(36, 28, 32, 0.07);
    --card-shadow: 0 18px 34px -24px rgba(106, 32, 55, 0.4);
    --brick: #a63552;
    --brick-tint: rgba(166, 53, 82, 0.08);
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    padding: max(20px, env(safe-area-inset-top, 20px)) 16px max(24px, env(safe-area-inset-bottom, 24px));
    box-sizing: border-box;
  }

  .admin-page button:focus-visible,
  .modal-dialog button:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  /* Loading State */
  .loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 80vh;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }

  .spinner-admin {
    width: 36px;
    height: 36px;
    border: 3px solid var(--wine-tint);
    border-top-color: var(--wine);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinning {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner-admin,
    .spinning {
      animation-duration: 2.4s;
    }

    .admin-page *,
    .modal-dialog * {
      transition: none !important;
    }
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
    border-radius: 28px;
    background: #fff;
    box-shadow: var(--card-shadow);
    border: 1px solid var(--hair);
  }

  .login-header {
    text-align: center;
    margin-bottom: 26px;
  }

  .admin-badge-icon {
    width: 58px;
    height: 58px;
    border-radius: 999px;
    background: var(--wine-tint);
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    border: 1px solid rgba(140, 47, 75, 0.18);
  }

  .login-title {
    font-family: var(--font-display);
    font-size: 2.1rem;
    font-weight: 600;
    line-height: 1.05;
    margin: 0 0 8px;
    color: var(--ink);
  }

  .login-subtitle {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.05rem;
    color: var(--ink-soft);
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
    color: var(--ink);
  }

  .form-input {
    width: 100%;
    padding: 12px 16px;
    border-radius: 999px;
    border: 1px solid rgba(36, 28, 32, 0.12);
    background: #fff;
    font-family: var(--font-sans);
    font-size: 0.95rem;
    color: var(--ink);
    box-sizing: border-box;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .form-input:focus,
  .form-input:focus-visible {
    outline: none;
    border-color: var(--wine);
    box-shadow: 0 0 0 3px rgba(140, 47, 75, 0.16);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 18px;
    background: var(--brick-tint);
    border: 1px solid rgba(166, 53, 82, 0.25);
    color: var(--brick);
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
    max-width: 1100px;
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
    padding: 4px 2px 18px;
    border-bottom: 1px solid var(--hair);
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  /* Unico elemento solido della schermata */
  .admin-logo-mark {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: var(--wine);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 20px -10px rgba(106, 32, 55, 0.6);
  }

  .brand-title {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .brand-role {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1rem;
    color: var(--ink-soft);
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  @media (hover: hover) {
    .btn-logout:hover {
      color: var(--brick);
      border-color: rgba(166, 53, 82, 0.4);
      background: var(--brick-tint);
    }
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
  }

  .metric-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border-radius: 24px;
    background: #fff;
    border: 1px solid var(--hair);
    box-shadow: var(--card-shadow);
  }

  .metric-icon {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .metric-icon.gold { background: rgba(233, 201, 143, 0.35); color: #8a6a2c; }
  .metric-icon.green { background: rgba(127, 169, 148, 0.2); color: #3f7058; }
  .metric-icon.purple { background: var(--wine-tint); color: var(--wine); }
  .metric-icon.rose { background: rgba(201, 98, 127, 0.14); color: #b94b68; }

  .metric-info {
    display: flex;
    flex-direction: column;
  }

  .metric-val {
    font-family: var(--font-display);
    font-size: 2.1rem;
    font-weight: 600;
    line-height: 1.05;
    color: var(--ink);
  }

  .metric-lbl {
    font-size: 0.8rem;
    color: var(--ink-soft);
    font-weight: 500;
    margin-top: 2px;
  }

  /* Events Section */
  .events-section {
    padding: 26px;
    border-radius: 28px;
    background: #fff;
    border: 1px solid var(--hair);
    box-shadow: var(--card-shadow);
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
    font-family: var(--font-display);
    font-size: 1.9rem;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--ink);
  }

  .section-desc {
    font-size: 0.86rem;
    color: var(--ink-soft);
    margin: 0;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    background: #fff;
    border: 1px solid rgba(36, 28, 32, 0.12);
    border-radius: 999px;
    width: 100%;
    max-width: 320px;
    color: var(--ink-soft);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .search-box:focus-within {
    border-color: var(--wine);
    box-shadow: 0 0 0 3px rgba(140, 47, 75, 0.16);
  }

  .search-input {
    border: none;
    background: transparent;
    outline: none;
    font-family: var(--font-sans);
    font-size: 0.9rem;
    width: 100%;
    color: var(--ink);
  }

  .clear-search {
    background: none;
    border: none;
    color: var(--ink-soft);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 999px;
  }

  /* Table */
  .table-container {
    overflow-x: auto;
    border-radius: 22px;
    border: 1px solid var(--hair);
    background: #fff;
  }

  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    text-align: left;
  }

  .admin-table th {
    background: #fbf9f8;
    padding: 14px 16px;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--ink-soft);
    border-bottom: 1px solid var(--hair);
    white-space: nowrap;
  }

  .admin-table td {
    padding: 16px;
    border-bottom: 1px solid var(--hair);
    vertical-align: middle;
  }

  .admin-table tr:last-child td {
    border-bottom: none;
  }

  @media (hover: hover) {
    .admin-table tbody tr:hover {
      background: rgba(245, 228, 233, 0.4);
    }
  }

  .text-right {
    text-align: right;
  }

  /* Table Columns */
  .col-spouses {
    min-width: 200px;
  }

  .spouses-name {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--ink);
  }

  .spouses-name .amp {
    color: var(--wine);
    font-style: italic;
  }

  .event-id-sub {
    font-size: 0.72rem;
    color: var(--ink-soft);
    font-family: monospace;
    margin-top: 3px;
  }

  /* Code Pill */
  .code-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid rgba(140, 47, 75, 0.2);
    background: var(--wine-tint);
    color: var(--wine-deep);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    font-weight: 700;
  }

  @media (hover: hover) {
    .code-pill:hover {
      background: #efd4dc;
      border-color: var(--wine);
    }
  }

  .code-pill.copied {
    background: rgba(127, 169, 148, 0.2);
    border-color: #7fa994;
    color: #3f7058;
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
    padding: 3px 10px;
    border-radius: 999px;
    margin-bottom: 4px;
  }

  .timing-badge.active {
    background: rgba(127, 169, 148, 0.2);
    color: #3f7058;
  }

  .timing-badge.inactive {
    background: rgba(36, 28, 32, 0.05);
    color: var(--ink-soft);
  }

  .timing-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #7fa994;
  }

  .timing-status-dot.grey {
    background: var(--text-dim);
  }

  .timing-details {
    font-size: 0.78rem;
    color: var(--ink-soft);
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
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(36, 28, 32, 0.045);
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--ink-soft);
  }

  .created-text {
    font-size: 0.82rem;
    color: var(--ink-soft);
    white-space: nowrap;
  }

  /* Delete Action */
  .btn-delete-event {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid rgba(166, 53, 82, 0.25);
    background: var(--brick-tint);
    color: var(--brick);
    font-family: var(--font-sans);
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.18s ease, color 0.18s ease;
  }

  @media (hover: hover) {
    .btn-delete-event:hover {
      background: var(--brick);
      color: #fff;
      border-color: var(--brick);
    }
  }

  /* Empty / Loading States */
  .empty-state, .loading-state {
    padding: 60px 20px;
    text-align: center;
    color: var(--ink-soft);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--wine-tint);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--wine);
  }

  /* Delete Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(36, 28, 32, 0.5);
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
    border-radius: 28px;
    background: #fff;
    box-shadow: 0 30px 60px -24px rgba(106, 32, 55, 0.5);
    border: 1px solid var(--hair);
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .modal-icon-danger {
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: var(--brick-tint);
    color: var(--brick);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 600;
    margin: 0;
    color: var(--ink);
  }

  .modal-event-summary {
    padding: 12px 16px;
    border-radius: 20px;
    background: #fbf9f8;
    border: 1px solid var(--hair);
  }

  .summary-names {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 600;
  }

  .summary-code {
    font-size: 0.85rem;
    color: var(--ink-soft);
    margin-top: 4px;
  }

  .modal-warning {
    font-size: 0.88rem;
    color: var(--brick);
    background: var(--brick-tint);
    padding: 12px 16px;
    border-radius: 20px;
    border: 1px solid rgba(166, 53, 82, 0.2);
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
    background: var(--brick);
    color: #fff;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn-danger:hover:not(:disabled) {
    background: #8c2a43;
    box-shadow: 0 8px 18px -8px rgba(166, 53, 82, 0.6);
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

    .events-section {
      padding: 18px 14px;
    }

    .login-card,
    .modal-dialog {
      padding: 26px 20px;
    }
  }

  /* Tab Navigation Switcher */
  .admin-tab-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
    background: rgba(36, 28, 32, 0.04);
    padding: 6px;
    border-radius: 16px;
    width: fit-content;
    border: 1px solid rgba(201, 169, 110, 0.2);
  }

  .admin-nav-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 12px;
    border: none;
    background: transparent;
    color: var(--ink-soft);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .admin-nav-tab:hover {
    color: var(--ink);
    background: rgba(255, 255, 255, 0.5);
  }

  .admin-nav-tab.active {
    background: #ffffff;
    color: var(--wine);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(201, 169, 110, 0.35);
  }

  /* User Row Components */
  .user-row-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-avatar-badge {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--gold-primary), #8c2f4b);
    color: #ffffff;
    font-weight: 800;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(140, 47, 75, 0.25);
  }

  .user-display-name {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.25;
  }

  .user-email-text {
    font-size: 0.82rem;
    color: var(--ink-soft);
    margin-top: 2px;
  }

  /* User Type Tags */
  .user-type-tag {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.76rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .tag-purple {
    background: rgba(147, 51, 234, 0.1);
    color: #7e22ce;
    border: 1px solid rgba(147, 51, 234, 0.25);
  }

  .tag-gold {
    background: rgba(201, 169, 110, 0.15);
    color: #8c6a28;
    border: 1px solid rgba(201, 169, 110, 0.35);
  }

  .tag-green {
    background: rgba(46, 125, 50, 0.1);
    color: #2e7d32;
    border: 1px solid rgba(46, 125, 50, 0.25);
  }

  .tag-gray {
    background: rgba(36, 28, 32, 0.06);
    color: var(--ink-soft);
    border: 1px solid rgba(36, 28, 32, 0.1);
  }

  /* User Events Chips */
  .user-events-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 320px;
  }

  .user-event-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(36, 28, 32, 0.04);
    border: 1px solid rgba(36, 28, 32, 0.08);
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-event-pill.pill-couple {
    background: rgba(201, 169, 110, 0.1);
    border-color: rgba(201, 169, 110, 0.3);
  }

  .pill-names {
    font-weight: 600;
    color: var(--ink);
  }

  .pill-code {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    background: #ffffff;
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    color: var(--wine);
    font-weight: 700;
  }

  .pill-pts {
    font-size: 0.72rem;
    color: #2e7d32;
    font-weight: 700;
  }

  .text-subtle {
    font-size: 0.82rem;
    color: var(--ink-soft);
    font-style: italic;
  }

  /* Cascade Checkbox Card */
  .cascade-checkbox-card {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(166, 53, 82, 0.06);
    border: 1px solid rgba(166, 53, 82, 0.25);
    text-align: left;
  }

  .cascade-checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
  }

  .cascade-checkbox-label input[type="checkbox"] {
    margin-top: 3px;
    width: 17px;
    height: 17px;
    accent-color: var(--wine);
    cursor: pointer;
  }

  .cascade-checkbox-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .cascade-checkbox-text strong {
    font-size: 0.86rem;
    color: #8c2a43;
  }

  .cascade-checkbox-text span {
    font-size: 0.78rem;
    color: var(--ink-soft);
    line-height: 1.35;
  }
</style>
