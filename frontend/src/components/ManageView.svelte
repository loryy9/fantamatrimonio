<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import { PRESET_QUIZZES, PRESET_HUNTS, PRESET_MOMENTS } from '../lib/challengePresets.js';

  let activeTab = $state('quiz'); // 'quiz' | 'hunt' | 'moments' | 'settings'
  let challenges = $state([]);
  let isLoading = $state(true);
  let stats = $state({ guests_count: 0, photos_count: 0, quiz_count: 0, moments_count: 0 });

  // Stato per dialog editor modale
  let showModal = $state(false);
  let editingChallenge = $state(null); // null = nuova sfida
  let modalType = $state('quiz'); // 'quiz' | 'hunt' | 'vote'
  let modalTitle = $state('');
  let modalDesc = $state('');
  let modalPoints = $state(30);
  let modalOptions = $state(['', '']);
  let modalCorrectAnswer = $state('');
  let isSaving = $state(false);
  let modalError = $state('');

  // Stato per impostazioni evento
  let spouse1 = $state('');
  let spouse2 = $state('');
  let enableTimer = $state(false);
  let startTime = $state('');
  let endTime = $state('');
  let isSavingEvent = $state(false);
  let eventMessage = $state('');
  let copied = $state('');
  let inviteCode = $state(appState.event?.invite_code || '');

  const inviteLink = $derived(
    inviteCode ? `${window.location.origin}/?code=${inviteCode}` : ''
  );

  const quizChallenges = $derived(challenges.filter(c => c.challenge_type === 'quiz' || c.type === 'quiz'));
  const huntChallenges = $derived(challenges.filter(c => c.challenge_type === 'hunt' || c.type === 'hunt'));
  const momentChallenges = $derived(challenges.filter(c => c.challenge_type === 'vote' || c.type === 'vote'));

  async function loadData() {
    isLoading = true;
    try {
      const [challengesData, statsData, inviteData] = await Promise.allSettled([
        api.getChallenges(true), // include inattivi
        api.getEventStats(),
        api.getEventInvite()
      ]);

      if (challengesData.status === 'fulfilled') {
        challenges = challengesData.value || [];
      }
      if (statsData.status === 'fulfilled') {
        stats = statsData.value || stats;
      }
      if (inviteData.status === 'fulfilled' && inviteData.value?.invite_code) {
        inviteCode = inviteData.value.invite_code;
        if (appState.event) {
          appState.event.invite_code = inviteCode;
        }
      } else if (appState.event?.invite_code) {
        inviteCode = appState.event.invite_code;
      }

      // Inizializza form impostazioni evento
      if (appState.event) {
        spouse1 = appState.event.spouse1_name || '';
        spouse2 = appState.event.spouse2_name || '';
        enableTimer = !!appState.event.enable_timer;
        startTime = appState.event.start_time ? appState.event.start_time.slice(0, 16) : '';
        endTime = appState.event.end_time ? appState.event.end_time.slice(0, 16) : '';
      }
    } catch (err) {
      appState.showToast(err.message || 'Errore caricamento console', 'error');
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadData();
  });

  // Toggle attivo / disattivo
  async function toggleActive(challenge) {
    const nextState = !challenge.active;
    challenge.active = nextState;
    try {
      await api.updateChallenge(challenge.id, { active: nextState });
      appState.showToast(
        nextState ? `"${challenge.title}" attivata` : `"${challenge.title}" disattivata`,
        'info'
      );
      await appState.refreshChallenges();
    } catch (err) {
      challenge.active = !nextState; // rollback
      appState.showToast(err.message || 'Errore aggiornamento stato', 'error');
    }
  }

  // Elimina sfida con conferma
  async function handleDelete(challenge) {
    const confirmed = confirm(
      `Vuoi davvero eliminare "${challenge.title}"?\nSe gli invitati vi hanno già risposto, i punti assegnati verranno rimossi.`
    );
    if (!confirmed) return;

    try {
      await api.deleteChallenge(challenge.id);
      challenges = challenges.filter(c => c.id !== challenge.id);
      appState.showToast('Sfida eliminata con successo', 'success');
      await appState.refreshChallenges();
    } catch (err) {
      appState.showToast(err.message || 'Errore durante l\'eliminazione', 'error');
    }
  }

  // Apri modal per creazione o modifica
  function openEditor(type, existing = null) {
    modalError = '';
    editingChallenge = existing;
    modalType = type;

    if (existing) {
      modalTitle = existing.title || '';
      modalDesc = existing.description || '';
      modalPoints = existing.points || 10;
      
      const rawOpts = existing.vote_options || existing.config?.options || [];
      if (rawOpts.length > 0) {
        modalOptions = rawOpts.map(o => typeof o === 'string' ? o : o.text || o.id || '');
      } else {
        modalOptions = ['', ''];
      }
      modalCorrectAnswer = existing.correct_answer || modalOptions[0] || '';
    } else {
      modalTitle = '';
      modalDesc = '';
      modalPoints = type === 'quiz' ? 30 : type === 'hunt' ? 25 : 10;
      modalOptions = type === 'quiz' ? ['', '', '', ''] : [];
      modalCorrectAnswer = '';
    }

    showModal = true;
  }

  function addModalOption() {
    if (modalOptions.length >= 6) return;
    modalOptions.push('');
  }

  function removeModalOption(index) {
    if (modalOptions.length <= 2) return;
    const removed = modalOptions[index];
    modalOptions.splice(index, 1);
    if (modalCorrectAnswer === removed) {
      modalCorrectAnswer = modalOptions[0] || '';
    }
  }

  async function handleSaveModal() {
    if (!modalTitle.trim()) {
      appState.showToast('Inserisci il titolo o la domanda.', 'error');
      return;
    }

    if (modalType === 'quiz') {
      const validOpts = modalOptions.map(o => o.trim()).filter(Boolean);
      if (validOpts.length < 2) {
        appState.showToast('Inserisci almeno due opzioni di risposta per il quiz.', 'error');
        return;
      }
      if (!modalCorrectAnswer || !validOpts.includes(modalCorrectAnswer.trim())) {
        appState.showToast('Seleziona quale tra le opzioni è la risposta corretta.', 'error');
        return;
      }
    }

    isSaving = true;
    try {
      const payload = {
        title: modalTitle.trim(),
        description: modalDesc.trim(),
        points: Number(modalPoints) || 0,
        type: modalType,
        active: true
      };

      if (modalType === 'quiz') {
        payload.vote_options = modalOptions.map(o => o.trim()).filter(Boolean);
        payload.correct_answer = modalCorrectAnswer.trim();
      }

      if (editingChallenge) {
        const updated = await api.updateChallenge(editingChallenge.id, payload);
        const idx = challenges.findIndex(c => c.id === editingChallenge.id);
        if (idx !== -1) {
          challenges[idx] = { ...challenges[idx], ...updated, active: updated.active ?? true };
        }
        appState.showToast('Sfida aggiornata con successo!', 'success');
      } else {
        const created = await api.createChallenge(payload);
        challenges = [...challenges, created];
        appState.showToast('Nuova sfida creata!', 'success');
      }

      await appState.refreshChallenges();
      showModal = false;
    } catch (err) {
      appState.showToast(err.message || 'Errore durante il salvataggio.', 'error');
    } finally {
      isSaving = false;
    }
  }

  // Salva impostazioni generali evento
  async function handleSaveEvent(e) {
    e.preventDefault();
    if (!spouse1.trim() || !spouse2.trim()) {
      appState.showToast('Inserisci entrambi i nomi degli sposi.', 'error');
      return;
    }
    if (enableTimer) {
      if (!startTime || !endTime) {
        appState.showToast('Imposta sia l\'orario di inizio che di fine.', 'error');
        return;
      }
      if (new Date(endTime) <= new Date(startTime)) {
        appState.showToast('L\'orario di fine deve essere successivo a quello di inizio.', 'error');
        return;
      }
    }

    isSavingEvent = true;
    try {
      const updated = await api.updateEvent({
        spouse1_name: spouse1.trim(),
        spouse2_name: spouse2.trim(),
        enable_timer: enableTimer,
        start_time: enableTimer && startTime ? new Date(startTime).toISOString() : null,
        end_time: enableTimer && endTime ? new Date(endTime).toISOString() : null
      });

      appState.event = updated;
      appState.showToast('Impostazioni matrimonio aggiornate!', 'success');
    } catch (err) {
      appState.showToast(err.message || 'Errore durante l\'aggiornamento delle impostazioni.', 'error');
    } finally {
      isSavingEvent = false;
    }
  }

  async function copy(kind, text) {
    try {
      await navigator.clipboard.writeText(text);
      copied = kind;
      setTimeout(() => { if (copied === kind) copied = ''; }, 2000);
    } catch {
      appState.showToast('Copia fallita, seleziona a mano.', 'error');
    }
  }

  async function share() {
    const text = `Unisciti al nostro Fanta Matrimonio! Codice invito: ${appState.event?.invite_code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Fanta Matrimonio', text, url: inviteLink });
      } catch { /* dismissed */ }
    } else {
      copy('link', inviteLink);
    }
  }
</script>

<div class="manage-container">
  <!-- Top Bar / Header Sposi -->
  <header class="manage-header glass-card">
    <div class="manage-header-top">
      <div class="badge-role">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crown-icon"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
        Area Riservata Sposi
      </div>
      <button class="btn btn-secondary btn-sm" onclick={() => appState.setGameTab('home')}>
        ← Torna alla vista gioco
      </button>
    </div>

    <h1 class="page-title font-serif">
      Gestione Matrimonio <span class="gold-gradient-text">{appState.event?.spouse1_name} &amp; {appState.event?.spouse2_name}</span>
    </h1>
    <p class="manage-subtitle">
      Da questa console potete aggiungere o modificare le domande del quiz, le missioni fotografiche e le regole del gioco.
    </p>

    <!-- Quick Stats Hub -->
    <div class="stats-hub">
      <div class="stat-card">
        <span class="stat-num">{stats.guests_count || 0}</span>
        <span class="stat-label">Invitati iscritti</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{stats.photos_count || 0}</span>
        <span class="stat-label">Foto caricate</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{stats.quiz_count || 0}</span>
        <span class="stat-label">Quiz risposti</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{stats.moments_count || 0}</span>
        <span class="stat-label">Momenti condivisi</span>
      </div>
    </div>
  </header>

  <!-- Sub Navigation Tabs -->
  <nav class="sub-nav-tabs">
    <button
      class="nav-tab-btn {activeTab === 'quiz' ? 'active' : ''}"
      onclick={() => activeTab = 'quiz'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
      Quiz Sposi ({quizChallenges.length})
    </button>
    <button
      class="nav-tab-btn {activeTab === 'hunt' ? 'active' : ''}"
      onclick={() => activeTab = 'hunt'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
      Caccia al Tesoro ({huntChallenges.length})
    </button>
    <button
      class="nav-tab-btn {activeTab === 'moments' ? 'active' : ''}"
      onclick={() => activeTab = 'moments'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 2 4 4-10 10H8v-4L18 2z"/><path d="m15 5 3 3"/></svg>
      Momenti Migliori ({momentChallenges.length})
    </button>
    <button
      class="nav-tab-btn {activeTab === 'settings' ? 'active' : ''}"
      onclick={() => activeTab = 'settings'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Codice Invito &amp; Timer
    </button>
  </nav>

  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Caricamento console sposi...</span>
    </div>
  {:else}

    <!-- TAB 1: QUIZ SPOSI -->
    {#if activeTab === 'quiz'}
      <section class="manage-section">
        <div class="section-actions-bar">
          <div>
            <h2 class="section-heading font-serif">Domande del Quiz</h2>
            <p class="section-desc">Domande a risposta multipla su di voi: gli ospiti guadagnano punti indovinando!</p>
          </div>
          <button class="btn btn-primary" onclick={() => openEditor('quiz')}>
            + Nuova Domanda Quiz
          </button>
        </div>

        {#if quizChallenges.length === 0}
          <div class="empty-box glass-card">
            <p>Nessun quiz creato per ora.</p>
            <button class="btn btn-secondary" onclick={() => openEditor('quiz')}>Crea la prima domanda</button>
          </div>
        {:else}
          <div class="challenge-list">
            {#each quizChallenges as quiz (quiz.id)}
              <div class="challenge-card glass-card {!quiz.active ? 'is-inactive' : ''}">
                <div class="card-left">
                  <div class="card-meta">
                    <span class="badge badge-purple">+{quiz.points} PT</span>
                    <button
                      type="button"
                      class="toggle-active-btn {quiz.active ? 'active' : 'inactive'}"
                      onclick={() => toggleActive(quiz)}
                      title="Attiva o disattiva la visibilità di questa sfida agli invitati"
                    >
                      <span class="toggle-dot"></span>
                      {quiz.active ? 'Attiva' : 'Disattivata'}
                    </button>
                  </div>

                  <h3 class="challenge-title font-serif">{quiz.title}</h3>
                  {#if quiz.description}
                    <p class="challenge-desc">{quiz.description}</p>
                  {/if}

                  <!-- Opzioni quiz con indicazione della risposta corretta -->
                  <div class="options-preview">
                    {#each (quiz.config?.options || quiz.vote_options || []) as opt}
                      {@const optText = typeof opt === 'string' ? opt : opt.text || opt.id}
                      {@const isCorr = (quiz.correct_answer || '').trim().toLowerCase() === (optText || '').trim().toLowerCase()}
                      <span class="opt-tag {isCorr ? 'opt-correct' : ''}">
                        {#if isCorr}
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {/if}
                        {optText}
                      </span>
                    {/each}
                  </div>
                </div>

                <div class="card-right-actions">
                  <button class="btn-action edit" onclick={() => openEditor('quiz', quiz)} title="Modifica domanda">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Modifica
                  </button>
                  <button class="btn-action delete" onclick={() => handleDelete(quiz)} title="Elimina domanda">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Elimina
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

    <!-- TAB 2: CACCIA AL TESORO -->
    {:else if activeTab === 'hunt'}
      <section class="manage-section">
        <div class="section-actions-bar">
          <div>
            <h2 class="section-heading font-serif">Missioni Fotografiche</h2>
            <p class="section-desc">Gli invitati completano la missione scattando o caricando la foto richiesta.</p>
          </div>
          <button class="btn btn-primary" onclick={() => openEditor('hunt')}>
            + Nuova Missione Caccia
          </button>
        </div>

        {#if huntChallenges.length === 0}
          <div class="empty-box glass-card">
            <p>Nessuna missione fotografica creata.</p>
            <button class="btn btn-secondary" onclick={() => openEditor('hunt')}>Crea la prima missione</button>
          </div>
        {:else}
          <div class="challenge-list">
            {#each huntChallenges as hunt (hunt.id)}
              <div class="challenge-card glass-card {!hunt.active ? 'is-inactive' : ''}">
                <div class="card-left">
                  <div class="card-meta">
                    <span class="badge badge-gold">+{hunt.points} PT</span>
                    <button
                      type="button"
                      class="toggle-active-btn {hunt.active ? 'active' : 'inactive'}"
                      onclick={() => toggleActive(hunt)}
                    >
                      <span class="toggle-dot"></span>
                      {hunt.active ? 'Attiva' : 'Disattivata'}
                    </button>
                  </div>

                  <h3 class="challenge-title font-serif">{hunt.title}</h3>
                  {#if hunt.description}
                    <p class="challenge-desc">{hunt.description}</p>
                  {/if}
                </div>

                <div class="card-right-actions">
                  <button class="btn-action edit" onclick={() => openEditor('hunt', hunt)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Modifica
                  </button>
                  <button class="btn-action delete" onclick={() => handleDelete(hunt)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Elimina
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

    <!-- TAB 3: MOMENTI MIGLIORI -->
    {:else if activeTab === 'moments'}
      <section class="manage-section">
        <div class="section-actions-bar">
          <div>
            <h2 class="section-heading font-serif">Momenti Migliori &amp; Dediche</h2>
            <p class="section-desc">Domande aperte, auguri o pronostici da condividere durante la festa.</p>
          </div>
          <button class="btn btn-primary" onclick={() => openEditor('vote')}>
            + Nuovo Momento
          </button>
        </div>

        {#if momentChallenges.length === 0}
          <div class="empty-box glass-card">
            <p>Nessun momento configurato.</p>
            <button class="btn btn-secondary" onclick={() => openEditor('vote')}>Aggiungi un momento</button>
          </div>
        {:else}
          <div class="challenge-list">
            {#each momentChallenges as moment (moment.id)}
              <div class="challenge-card glass-card {!moment.active ? 'is-inactive' : ''}">
                <div class="card-left">
                  <div class="card-meta">
                    <span class="badge badge-rose">+{moment.points} PT</span>
                    <button
                      type="button"
                      class="toggle-active-btn {moment.active ? 'active' : 'inactive'}"
                      onclick={() => toggleActive(moment)}
                    >
                      <span class="toggle-dot"></span>
                      {moment.active ? 'Attiva' : 'Disattivata'}
                    </button>
                  </div>

                  <h3 class="challenge-title font-serif">{moment.title}</h3>
                  {#if moment.description}
                    <p class="challenge-desc">{moment.description}</p>
                  {/if}
                </div>

                <div class="card-right-actions">
                  <button class="btn-action edit" onclick={() => openEditor('vote', moment)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Modifica
                  </button>
                  <button class="btn-action delete" onclick={() => handleDelete(moment)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Elimina
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

    <!-- TAB 4: IMPOSTAZIONI EVENTO & CODICE INVITO -->
    {:else if activeTab === 'settings'}
      <section class="manage-section settings-grid">
        <!-- Card Codice Invito -->
        <div class="settings-card glass-card">
          <h2 class="settings-card-title font-serif">Codice Invito &amp; Condivisione</h2>
          <p class="section-desc">Condividete questo codice con i vostri invitati per farli entrare nell'app.</p>

          <div class="invite-code-display font-serif">{inviteCode || '---'}</div>

          <div class="invite-actions">
            <button class="btn btn-secondary" onclick={() => copy('code', inviteCode)}>
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
                Copia link
              {/if}
            </button>
            <button class="btn btn-primary" onclick={share}>
              Condividi invito
            </button>
          </div>

          <div class="link-preview">{inviteLink}</div>
        </div>

        <!-- Form Dati Matrimonio & Timer -->
        <form class="settings-card glass-card" onsubmit={handleSaveEvent}>
          <h2 class="settings-card-title font-serif">Dettagli del Matrimonio</h2>

          {#if eventMessage}
            <div class="form-error" role="alert"><span>{eventMessage}</span></div>
          {/if}

          <div class="input-row">
            <div class="input-group">
              <label for="m-sp1" class="input-label">Sposo/a 1</label>
              <input id="m-sp1" type="text" class="input-field" bind:value={spouse1} required />
            </div>
            <div class="input-group">
              <label for="m-sp2" class="input-label">Sposo/a 2</label>
              <input id="m-sp2" type="text" class="input-field" bind:value={spouse2} required />
            </div>
          </div>

          <div class="timer-section">
            <label class="switch-row">
              <input type="checkbox" bind:checked={enableTimer} />
              <span class="switch-track"><span class="switch-thumb"></span></span>
              <span class="switch-text">
                <strong>Limita i giochi a un orario (Timer)</strong>
                <small>Blocca le risposte e il caricamento foto prima e dopo la finestra stabilita.</small>
              </span>
            </label>

            {#if enableTimer}
              <div class="timer-inputs">
                <div class="input-group">
                  <label for="m-start" class="input-label">Inizio evento</label>
                  <input id="m-start" type="datetime-local" class="input-field" bind:value={startTime} required={enableTimer} />
                </div>
                <div class="input-group">
                  <label for="m-end" class="input-label">Fine evento</label>
                  <input id="m-end" type="datetime-local" class="input-field" bind:value={endTime} required={enableTimer} />
                </div>
              </div>
            {/if}
          </div>

          <button type="submit" class="btn btn-primary" disabled={isSavingEvent}>
            {isSavingEvent ? 'Salvataggio...' : 'Salva Modifiche Matrimonio'}
          </button>
        </form>
      </section>
    {/if}
  {/if}
</div>

<!-- MODAL DI CREAZIONE / MODIFICA SFIDA -->
{#if showModal}
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) showModal = false; }}>
    <div class="modal-content glass-card">
      <div class="modal-header">
        <h3 class="modal-title font-serif">
          {editingChallenge ? 'Modifica' : 'Nuova'} {modalType === 'quiz' ? 'Domanda Quiz' : modalType === 'hunt' ? 'Missione Fotografica' : 'Domanda Momenti'}
        </h3>
        <button class="modal-close-btn" onclick={() => showModal = false} aria-label="Chiudi modale">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {#if modalError}
        <div class="form-error" role="alert"><span>{modalError}</span></div>
      {/if}

      <div class="modal-body">
        <div class="input-group">
          <label for="modal-title" class="input-label">{modalType === 'quiz' ? 'Domanda' : 'Titolo'}</label>
          <input
            id="modal-title"
            type="text"
            class="input-field"
            bind:value={modalTitle}
            placeholder={modalType === 'quiz' ? 'Es. Dove si sono conosciuti gli sposi?' : 'Es. Selfie con la sposa'}
          />
        </div>

        <div class="input-group">
          <label for="modal-desc" class="input-label">Descrizione / Suggerimento (opzionale)</label>
          <textarea
            id="modal-desc"
            class="input-field textarea-field"
            bind:value={modalDesc}
            rows="2"
            placeholder="Dettagli utili per gli invitati..."
          ></textarea>
        </div>

        <div class="input-group points-group">
          <label for="modal-points" class="input-label">Punti assegnati</label>
          <input
            id="modal-points"
            type="number"
            class="input-field points-field"
            bind:value={modalPoints}
            min="0"
            max="200"
          />
        </div>

        <!-- Sezione opzioni solo per QUIZ -->
        {#if modalType === 'quiz'}
          <div class="quiz-options-editor">
            <label class="input-label">Opzioni di risposta (clicca il pallino verde per impostare la corretta):</label>
            <div class="options-editor-list">
              {#each modalOptions as opt, i}
                {@const isCorrect = modalCorrectAnswer === opt && opt.trim() !== ''}
                <div class="option-edit-row {isCorrect ? 'is-correct' : ''}">
                  <button
                    type="button"
                    class="radio-circle {isCorrect ? 'active' : ''}"
                    onclick={() => modalCorrectAnswer = opt}
                    title="Imposta come risposta corretta"
                  >
                    {#if isCorrect}
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {/if}
                  </button>

                  <input
                    type="text"
                    class="input-field"
                    bind:value={modalOptions[i]}
                    oninput={(e) => {
                      if (isCorrect) modalCorrectAnswer = e.target.value;
                    }}
                    placeholder={`Opzione ${i + 1}`}
                  />

                  {#if isCorrect}
                    <span class="correct-badge">Corretta</span>
                  {/if}

                  <button
                    type="button"
                    class="remove-opt-btn"
                    disabled={modalOptions.length <= 2}
                    onclick={() => removeModalOption(i)}
                    aria-label="Rimuovi opzione"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              {/each}
            </div>

            {#if modalOptions.length < 6}
              <button type="button" class="btn-text-link" onclick={addModalOption}>
                + Aggiungi opzione
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick={() => showModal = false}>
          Annulla
        </button>
        <button type="button" class="btn btn-primary" disabled={isSaving} onclick={handleSaveModal}>
          {isSaving ? 'Salvataggio...' : 'Salva'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .manage-container {
    --ink: #241c20;
    --ink-soft: #6b5f64;
    --hair: rgba(36, 28, 32, 0.07);
    --card-shadow: 0 18px 34px -24px rgba(106, 32, 55, 0.4);
    --brick: #a63552;
    --brick-tint: rgba(166, 53, 82, 0.09);
    --sage: #5f8f77;
    --sage-tint: rgba(127, 169, 148, 0.18);
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 90px;
  }

  .manage-container button:focus-visible,
  .modal-content button:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  /* Header editoriale */
  .manage-header,
  .manage-header.glass-card {
    padding: 8px 2px 4px;
    border-radius: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .manage-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .badge-role {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.18);
    color: var(--wine-deep);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .page-title {
    margin: 0 0 8px 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: clamp(2.3rem, 9vw, 3.1rem);
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .manage-subtitle {
    position: relative;
    margin: 0 0 22px 0;
    padding-bottom: 16px;
    color: var(--ink-soft);
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.15rem;
  }

  .manage-subtitle::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 36px;
    height: 1px;
    background: var(--wine);
    opacity: 0.6;
  }

  /* Stats */
  .stats-hub {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
  }

  .stat-card {
    padding: 14px 16px;
    border-radius: 22px;
    background: #fff;
    border: 1px solid var(--hair);
    box-shadow: var(--card-shadow);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .stat-num {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--wine);
  }

  .stat-label {
    font-size: 0.78rem;
    color: var(--ink-soft);
    font-weight: 500;
  }

  /* Tab pill */
  .sub-nav-tabs {
    position: -webkit-sticky;
    position: sticky;
    top: calc(64px + var(--safe-top));
    z-index: 25;
    display: flex;
    gap: 6px;
    padding: 5px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--hair);
    border-radius: 999px;
    box-shadow: var(--card-shadow);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .sub-nav-tabs::-webkit-scrollbar {
    display: none;
  }

  .nav-tab-btn {
    flex: 1;
    min-width: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--ink-soft);
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    white-space: nowrap;
  }

  .nav-tab-btn.active {
    background: var(--wine);
    color: #fff;
    font-weight: 700;
  }

  @media (hover: hover) {
    .nav-tab-btn:not(.active):hover {
      background: var(--wine-tint);
      color: var(--wine-deep);
    }
  }

  .tab-emoji {
    font-size: 1.05rem;
  }

  /* Sezioni */
  .manage-section {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .section-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .section-heading {
    margin: 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .section-desc {
    color: var(--ink-soft);
    font-size: 0.88rem;
    margin: 2px 0 0 0;
  }

  /* Card sfide */
  .challenge-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .challenge-card,
  .challenge-card.glass-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 22px;
    border-radius: 24px;
    background: #fff;
    border: 1px solid var(--hair);
    box-shadow: var(--card-shadow);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    transition: box-shadow 0.2s, opacity 0.2s;
  }

  .challenge-card.is-inactive {
    opacity: 0.65;
    background: #fbf9f8;
    box-shadow: none;
  }

  .card-left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toggle-active-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-family: var(--font-sans);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .toggle-active-btn.active {
    background: var(--sage-tint);
    border-color: rgba(127, 169, 148, 0.4);
    color: #3f7058;
  }

  .toggle-active-btn.inactive {
    background: rgba(36, 28, 32, 0.05);
    border-color: var(--hair);
    color: var(--ink-soft);
  }

  .toggle-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  .challenge-title {
    margin: 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 600;
    line-height: 1.15;
  }

  .challenge-desc {
    font-size: 0.88rem;
    color: var(--ink-soft);
    margin: 0;
  }

  .options-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .opt-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    background: rgba(36, 28, 32, 0.045);
    color: var(--ink-soft);
  }

  .opt-tag.opt-correct {
    background: var(--sage-tint);
    color: #3f7058;
    font-weight: 700;
    border: 1px solid rgba(127, 169, 148, 0.4);
  }

  .card-right-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--hair);
    background: #fff;
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  @media (hover: hover) {
    .btn-action.edit:hover {
      background: var(--wine-tint);
      border-color: rgba(140, 47, 75, 0.35);
      color: var(--wine-deep);
    }

    .btn-action.delete:hover {
      background: var(--brick-tint);
      border-color: rgba(166, 53, 82, 0.4);
      color: var(--brick);
    }
  }

  .empty-box,
  .empty-box.glass-card {
    padding: 40px 20px;
    text-align: center;
    border-radius: 24px;
    background: #fff;
    border: 1px dashed rgba(140, 47, 75, 0.25);
    box-shadow: none;
    color: var(--ink-soft);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  /* Impostazioni */
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .settings-card,
  .settings-card.glass-card {
    padding: 24px;
    border-radius: 26px;
    background: #fff;
    border: 1px solid var(--hair);
    box-shadow: var(--card-shadow);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .settings-card-title {
    margin: 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 600;
  }

  /* Unico elemento solido: il codice invito */
  .invite-code-display {
    padding: 18px 16px;
    border-radius: 22px;
    background: var(--wine);
    color: #fff;
    font-family: var(--font-display);
    font-size: 2.4rem;
    font-weight: 600;
    text-align: center;
    letter-spacing: 0.22em;
    user-select: all;
  }

  .invite-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .link-preview {
    font-size: 0.8rem;
    color: var(--ink-soft);
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--wine-tint);
    overflow-wrap: anywhere;
    text-align: center;
  }

  .input-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .timer-section {
    padding: 14px;
    border-radius: 20px;
    background: #fbf9f8;
    border: 1px solid var(--hair);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .timer-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  /* Modale */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(36, 28, 32, 0.45);
    backdrop-filter: blur(6px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-content,
  .modal-content.glass-card {
    width: 100%;
    max-width: 580px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 26px;
    border-radius: 28px;
    background: #fff;
    border: 1px solid var(--hair);
    box-shadow: 0 30px 60px -24px rgba(106, 32, 55, 0.45);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    margin: 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 600;
  }

  .modal-close-btn {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: transparent;
    border: none;
    font-size: 1.1rem;
    color: var(--ink-soft);
    cursor: pointer;
  }

  @media (hover: hover) {
    .modal-close-btn:hover {
      background: var(--wine-tint);
      color: var(--wine);
    }
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .textarea-field {
    resize: vertical;
    font-family: inherit;
  }

  .points-group {
    max-width: 160px;
  }

  .quiz-options-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: 20px;
    background: #fbf9f8;
    border: 1px solid var(--hair);
  }

  .options-editor-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-edit-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .radio-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid rgba(36, 28, 32, 0.2);
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: #fff;
    flex-shrink: 0;
  }

  .radio-circle.active {
    background: var(--sage);
    border-color: var(--sage);
  }

  .btn-text-link {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--wine);
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 999px;
    text-decoration: underline;
    text-decoration-color: rgba(140, 47, 75, 0.35);
    text-underline-offset: 4px;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 0;
    color: var(--ink-soft);
  }

  @media (max-width: 900px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 600px) {
    .challenge-card,
    .challenge-card.glass-card {
      flex-direction: column;
      align-items: stretch;
    }

    .card-right-actions {
      justify-content: flex-end;
      padding-top: 10px;
      border-top: 1px solid var(--hair);
    }

    .modal-content,
    .modal-content.glass-card {
      padding: 20px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .manage-container *,
    .modal-content * {
      transition: none !important;
    }
  }
</style>
