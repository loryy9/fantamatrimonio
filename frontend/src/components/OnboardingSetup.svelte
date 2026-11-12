<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { api } from '../lib/api.js';
  import {
    DEFAULT_PHOTO_CHALLENGES,
    PRESET_QUIZZES,
    PRESET_HUNTS,
    PRESET_MOMENTS
  } from '../lib/challengePresets.js';

  let { onComplete, onCancel, editMode = false, initialChallenges = null } = $props();

  let activeSection = $state('quiz'); // 'quiz' | 'hunt' | 'moments'
  let isSaving = $state(false);
  let isLoadingData = $state(false);
  let errorMessage = $state('');
  let savedChallengeSnapshot = $state(null);

  // Cloni locali modificabili dei preset
  let quizzes = $state(
    PRESET_QUIZZES.map(q => ({
      ...q,
      selected: true,
      vote_options: [...q.vote_options]
    }))
  );

  let hunts = $state(
    PRESET_HUNTS.map(h => ({
      ...h,
      selected: true
    }))
  );

  let moments = $state(
    PRESET_MOMENTS.map(m => ({
      ...m,
      selected: true
    }))
  );

  function getChallengeSnapshot() {
    return {
      quizzes: quizzes.map(item => ({ ...item, vote_options: [...item.vote_options] })),
      hunts: hunts.map(item => ({ ...item })),
      moments: moments.map(item => ({ ...item }))
    };
  }

  const hasChallengeChanges = $derived.by(() =>
    savedChallengeSnapshot !== null && JSON.stringify(getChallengeSnapshot()) !== JSON.stringify(savedChallengeSnapshot)
  );

  onMount(async () => {
    if (!editMode) {
      savedChallengeSnapshot = getChallengeSnapshot();
      return;
    }
    isLoadingData = true;
    try {
      const existing = initialChallenges !== null ? initialChallenges : await api.getChallenges(true);
      quizzes = existing.filter(ch => ch.type === 'quiz').map(ch => ({
        ...ch, id: ch.id, selected: ch.active !== false,
        vote_options: Array.isArray(ch.vote_options) ? [...ch.vote_options] : []
      }));
      hunts = existing.filter(ch => ch.type === 'hunt').map(ch => ({ ...ch, id: ch.id, selected: ch.active !== false }));
      moments = existing.filter(ch => ch.type === 'vote').map(ch => ({ ...ch, id: ch.id, selected: ch.active !== false }));
      savedChallengeSnapshot = getChallengeSnapshot();
    } catch (err) {
      errorMessage = err.message || 'Errore nel caricamento delle sfide.';
    } finally {
      isLoadingData = false;
    }
  });

  // Contatori
  const selectedQuizCount = $derived(quizzes.filter(q => q.selected).length);
  const selectedHuntCount = $derived(hunts.filter(h => h.selected).length);
  const selectedMomentsCount = $derived(moments.filter(m => m.selected).length);

  function selectSection(sec, event) {
    activeSection = sec;
    if (event?.currentTarget) {
      event.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function resetChallenges() {
    if (!hasChallengeChanges || !savedChallengeSnapshot) return;
    if (!confirm('Confermi di voler ripristinare le opzioni alla versione precedente?')) return;

    if (savedChallengeSnapshot) {
      quizzes = savedChallengeSnapshot.quizzes.map(item => ({ ...item, vote_options: [...item.vote_options] }));
      hunts = savedChallengeSnapshot.hunts.map(item => ({ ...item }));
      moments = savedChallengeSnapshot.moments.map(item => ({ ...item }));
    }
    appState.showToast('Impostazioni ripristinate.', 'success');
  }

  // --- Drawer laterale per la creazione di nuove sfide ---
  let drawerOpen = $state(false);
  let drawerType = $state('quiz'); // 'quiz' | 'hunt' | 'vote'
  let drawerEditing = $state(null);
  let dTitle = $state('');
  let dDesc = $state('');
  let dPoints = $state(30);
  let dOptions = $state(['', '', '']);
  let dCorrect = $state('');

  $effect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') drawerOpen = false; };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  });

  function openDrawer(type, item = null) {
    drawerType = type;
    drawerEditing = item;
    dTitle = item?.title || '';
    dDesc = item?.description || '';
    dPoints = item?.points ?? (type === 'quiz' ? 30 : type === 'hunt' ? 25 : 10);
    dOptions = item?.vote_options ? [...item.vote_options] : type === 'quiz' ? ['', '', ''] : [];
    dCorrect = item?.correct_answer || '';
    drawerOpen = true;
  }

  function addDrawerOption() {
    if (dOptions.length < 6) dOptions.push('');
  }

  function removeDrawerOption(i) {
    if (dOptions.length <= 2) return;
    const removed = dOptions[i];
    dOptions.splice(i, 1);
    if (dCorrect === removed) dCorrect = '';
  }

  function saveDrawer() {
    const title = dTitle.trim();
    if (!title) {
      appState.showToast('Inserisci il titolo o la domanda.', 'error');
      return;
    }
    const base = {
      title,
      description: dDesc.trim(),
      points: Number(dPoints) || 0,
      type: drawerType,
      active: drawerEditing ? !!drawerEditing.selected : true,
      selected: drawerEditing ? !!drawerEditing.selected : true
    };

    let updated;
    if (drawerType === 'quiz') {
      const opts = dOptions.map(o => o.trim()).filter(Boolean);
      if (opts.length < 2) {
        appState.showToast('Inserisci almeno due opzioni di risposta.', 'error');
        return;
      }
      if (!dCorrect || !opts.includes(dCorrect.trim())) {
        appState.showToast('Seleziona la risposta corretta.', 'error');
        return;
      }
      updated = { ...base, id: drawerEditing?.id || `custom_q_${Date.now()}`, vote_options: opts, correct_answer: dCorrect.trim() };
      quizzes = drawerEditing ? quizzes.map(item => item.id === drawerEditing.id ? updated : item) : [updated, ...quizzes];
    } else if (drawerType === 'hunt') {
      updated = { ...base, id: drawerEditing?.id || `custom_h_${Date.now()}` };
      hunts = drawerEditing ? hunts.map(item => item.id === drawerEditing.id ? updated : item) : [updated, ...hunts];
    } else {
      updated = { ...base, id: drawerEditing?.id || `custom_m_${Date.now()}` };
      moments = drawerEditing ? moments.map(item => item.id === drawerEditing.id ? updated : item) : [updated, ...moments];
    }
    drawerOpen = false;
  }

  // Aggiungi nuova opzione a un quiz
  function addOptionToQuiz(quiz) {
    if (quiz.vote_options.length >= 6) return;
    const newOpt = `Opzione ${quiz.vote_options.length + 1}`;
    quiz.vote_options.push(newOpt);
  }

  // Rimuovi opzione da un quiz
  function removeOptionFromQuiz(quiz, index) {
    if (quiz.vote_options.length <= 2) return;
    const removed = quiz.vote_options[index];
    quiz.vote_options.splice(index, 1);
    if (quiz.correct_answer === removed) {
      quiz.correct_answer = quiz.vote_options[0] || '';
    }
  }

  // Salva tutte le sfide selezionate
  async function handleSave(useAllDefaults = false) {
    isSaving = true;

    try {
      if (editMode) {
        const newChallenges = [];
        for (const item of [...quizzes, ...hunts, ...moments]) {
          const type = item.type || (quizzes.includes(item) ? 'quiz' : hunts.includes(item) ? 'hunt' : 'vote');
          const options = type === 'quiz' ? (item.vote_options || []).map(o => o.trim()).filter(Boolean) : undefined;
          if (typeof item.id === 'number') {
            await api.updateChallenge(item.id, {
              title: item.title.trim(),
              description: (item.description || '').trim(),
              points: Number(item.points) || 0,
              active: !!item.selected,
              ...(type === 'quiz' ? { vote_options: options, correct_answer: item.correct_answer || options[0] || '' } : {})
            });
          } else if (item.selected) {
            newChallenges.push({
              title: item.title.trim(),
              description: (item.description || '').trim(),
              points: Number(item.points) || 0,
              type,
              active: true,
              ...(type === 'quiz' ? { vote_options: options, correct_answer: item.correct_answer || options[0] || '' } : {})
            });
          }
        }
        if (newChallenges.length) await api.createChallengesBulk(newChallenges);
        await appState.refreshChallenges();
        appState.showToast('Sfide aggiornate con successo!', 'success');
        onComplete?.();
        return;
      }

      const challengesToCreate = [
        // Sfide foto di base (sempre incluse per la galleria)
        ...DEFAULT_PHOTO_CHALLENGES.map(p => ({
          title: p.title,
          description: p.description,
          points: p.points,
          type: 'photo',
          active: true
        }))
      ];

      const activeQuizzes = useAllDefaults ? PRESET_QUIZZES : quizzes.filter(q => q.selected);
      for (const q of activeQuizzes) {
        if (!q.title.trim()) continue;
        const validOptions = (q.vote_options || []).map(o => o.trim()).filter(Boolean);
        const correct = q.correct_answer && validOptions.includes(q.correct_answer)
          ? q.correct_answer
          : validOptions[0] || '';

        challengesToCreate.push({
          title: q.title.trim(),
          description: (q.description || '').trim(),
          points: Number(q.points) || 30,
          type: 'quiz',
          active: true,
          vote_options: validOptions,
          correct_answer: correct
        });
      }

      const activeHunts = useAllDefaults ? PRESET_HUNTS : hunts.filter(h => h.selected);
      for (const h of activeHunts) {
        if (!h.title.trim()) continue;
        challengesToCreate.push({
          title: h.title.trim(),
          description: (h.description || '').trim(),
          points: Number(h.points) || 25,
          type: 'hunt',
          active: true
        });
      }

      const activeMoments = useAllDefaults ? PRESET_MOMENTS : moments.filter(m => m.selected);
      for (const m of activeMoments) {
        if (!m.title.trim()) continue;
        challengesToCreate.push({
          title: m.title.trim(),
          description: (m.description || '').trim(),
          points: Number(m.points) || 10,
          type: 'vote',
          active: true
        });
      }

      // Invio in blocco al backend
      await api.createChallengesBulk(challengesToCreate);
      await appState.refreshChallenges();

      appState.showToast('Attività del matrimonio configurate con successo!', 'success');
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      appState.showToast(err.message || 'Errore durante il salvataggio delle attività.', 'error');
    } finally {
      isSaving = false;
    }
  }

  let isCancelling = $state(false);

  async function handleCancelCreation() {
    if (editMode) {
      onCancel?.();
      return;
    }
    const ok = confirm(
      "Sei sicuro di voler annullare la creazione del matrimonio?\n\n" +
      "L'evento e tutti i record salvati finora verranno eliminati definitivamente dal database."
    );
    if (!ok) return;

    isCancelling = true;
    try {
      await appState.cancelEventCreation();
    } catch (err) {
      alert("Errore durante l'eliminazione: " + (err.message || err));
    } finally {
      isCancelling = false;
    }
  }
</script>

<div class="onboarding-wrapper">
  <header class="onboarding-header">
    <h1 class="page-title font-serif">
      Personalizzate i giochi del vostro <span class="setup-title-accent">matrimonio</span>
    </h1>
    <p class="page-lead">
      {editMode
        ? 'Gestisci quiz, missioni fotografiche e momenti del matrimonio. Le modifiche saranno visibili agli invitati.'
        : 'Abbiamo già preparato i quiz e le missioni più divertenti. Puoi scegliere quali includere, modificare le opzioni o indicare la risposta corretta. Potrai sempre modificarle dalla dashboard.'}
    </p>
  </header>

  {#if editMode && isLoadingData}
    <div class="setup-loading-overlay" role="status"><div class="spinner"></div><span>Caricamento sfide...</span></div>
  {/if}

  {#if errorMessage}
    <div class="form-error" role="alert">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      <span>{errorMessage}</span>
    </div>
  {/if}

  <!-- Navigazione Sezioni Sticky sotto all'header -->
  <div class="sticky-tabs-container">
    {#if !editMode}<div class="setup-progress" role="progressbar" aria-label="Avanzamento configurazione matrimonio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span></span></div>{/if}
    <div class="tabs-scroll-container">
      <div class="section-tabs" aria-label="Sezioni dei giochi">
        <button
          class="tab-btn {activeSection === 'quiz' ? 'active' : ''}"
          onclick={(e) => selectSection('quiz', e)}
        >
          <span class="tab-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <span class="tab-title">Quiz Sposi ({selectedQuizCount})</span>
        </button>

        <button
          class="tab-btn {activeSection === 'hunt' ? 'active' : ''}"
          onclick={(e) => selectSection('hunt', e)}
        >
          <span class="tab-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </span>
          <span class="tab-title">Caccia al Tesoro ({selectedHuntCount})</span>
        </button>

        <button
          class="tab-btn {activeSection === 'moments' ? 'active' : ''}"
          onclick={(e) => selectSection('moments', e)}
        >
          <span class="tab-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </span>
          <span class="tab-title">Momenti Migliori ({selectedMomentsCount})</span>
        </button>
      </div>

    </div>
  </div>

  <!-- CONTENUTO SEZIONE: QUIZ -->
  {#if activeSection === 'quiz'}
    <div class="section-content">
      <div class="section-helper">
        <div class="helper-info">
          <strong>Quiz a risposta multipla:</strong> gli invitati accumulano punti indovinando la risposta corretta.
          Clicca sul pallino verde per impostare la risposta esatta!
        </div>
        <button class="btn btn-secondary btn-sm" onclick={() => openDrawer('quiz')}>
          + Aggiungi Domanda Quiz
        </button>
      </div>

      <div class="cards-grid">
        {#each quizzes as quiz, idx (quiz.id)}
          <article class="setup-card glass-card compact-quiz {quiz.selected ? 'card-selected' : 'card-disabled'}">
            <div class="compact-quiz-main">
              <div class="compact-quiz-meta">
                <span class="compact-quiz-number">Domanda {idx + 1}</span>
                <span class="compact-quiz-points">+{quiz.points} PT</span>
              </div>
              <h3 class="compact-quiz-title font-serif">{quiz.title || 'Domanda senza titolo'}</h3>
              <div class="compact-options" aria-label="Opzioni di risposta">
                {#each quiz.vote_options as opt}
                  <span class="compact-option" class:option-correct={quiz.correct_answer === opt}>
                    {#if quiz.correct_answer === opt}<span aria-hidden="true">✓</span>{/if}
                    {opt}
                  </span>
                {/each}
              </div>
            </div>
            <div class="compact-quiz-actions">
              <label class="checkbox-label compact-checkbox" title="Includi questa domanda nel matrimonio">
                <input type="checkbox" bind:checked={quiz.selected} />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Includi</span>
              </label>
              <button type="button" class="btn btn-secondary btn-sm" onclick={() => openDrawer('quiz', quiz)}>Modifica</button>
            </div>
          </article>
        {/each}
      </div>
    </div>

  <!-- CONTENUTO SEZIONE: CACCIA AL TESORO -->
  {:else if activeSection === 'hunt'}
    <div class="section-content">
      <div class="section-helper">
        <div class="helper-info">
          <strong>Caccia al tesoro fotografica:</strong> missioni che gli invitati completano scattando o caricando una foto a tema durante il ricevimento.
        </div>
        <button class="btn btn-secondary btn-sm" onclick={() => openDrawer('hunt')}>
          + Aggiungi Missione Fotografica
        </button>
      </div>

      <div class="cards-grid">
        {#each hunts as hunt (hunt.id)}
          <article class="setup-card glass-card compact-quiz {hunt.selected ? 'card-selected' : 'card-disabled'}">
            <div class="compact-quiz-main">
              <div class="compact-quiz-meta">
                <span class="compact-quiz-number">Missione fotografica</span>
                <span class="compact-quiz-points">+{hunt.points} PT</span>
              </div>
              <h3 class="compact-quiz-title font-serif">{hunt.title || 'Missione senza titolo'}</h3>
              {#if hunt.description}<p class="compact-activity-desc">{hunt.description}</p>{/if}
            </div>
            <div class="compact-quiz-actions">
              <label class="checkbox-label compact-checkbox" title="Includi questa missione nel matrimonio">
                <input type="checkbox" bind:checked={hunt.selected} />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Includi</span>
              </label>
              <button type="button" class="btn btn-secondary btn-sm" onclick={() => openDrawer('hunt', hunt)}>Modifica</button>
            </div>
          </article>
        {/each}
      </div>
    </div>

  <!-- CONTENUTO SEZIONE: MOMENTI MIGLIORI -->
  {:else if activeSection === 'moments'}
    <div class="section-content">
      <div class="section-helper">
        <div class="helper-info">
          <strong>Momenti migliori &amp; dediche:</strong> domande aperte o pronostici in cui gli invitati lasciano pensieri speciali, aneddoti o auguri per gli sposi.
        </div>
        <button class="btn btn-secondary btn-sm" onclick={() => openDrawer('vote')}>
          + Aggiungi Nuovo Momento
        </button>
      </div>

      <div class="cards-grid">
        {#each moments as moment (moment.id)}
          <article class="setup-card glass-card compact-quiz {moment.selected ? 'card-selected' : 'card-disabled'}">
            <div class="compact-quiz-main">
              <div class="compact-quiz-meta">
                <span class="compact-quiz-number">Momento migliore</span>
                <span class="compact-quiz-points">+{moment.points} PT</span>
              </div>
              <h3 class="compact-quiz-title font-serif">{moment.title || 'Domanda senza titolo'}</h3>
              {#if moment.description}<p class="compact-activity-desc">{moment.description}</p>{/if}
            </div>
            <div class="compact-quiz-actions">
              <label class="checkbox-label compact-checkbox" title="Includi questo momento nel matrimonio">
                <input type="checkbox" bind:checked={moment.selected} />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Includi</span>
              </label>
              <button type="button" class="btn btn-secondary btn-sm" onclick={() => openDrawer('vote', moment)}>Modifica</button>
            </div>
          </article>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Footer con azioni di salvataggio -->
  <footer class="onboarding-footer glass-card">
    <button type="button" class="setup-action-cancel" disabled={isSaving || isCancelling} onclick={handleCancelCreation}>
      {isCancelling ? 'Annullamento…' : 'Annulla'}
    </button>
    <button type="button" class="setup-action-reset" disabled={isSaving || isCancelling || isLoadingData || !hasChallengeChanges} onclick={resetChallenges}>Ripristina</button>
    <button type="button" class="btn btn-primary btn-lg setup-action-save" disabled={isSaving || isCancelling || isLoadingData || !!errorMessage} onclick={() => handleSave(false)}>
      {#if isSaving}
        <span class="spinner-sm"></span> Salvataggio…
      {:else}
        Salva
      {/if}
    </button>
  </footer>
</div>

<!-- DRAWER NUOVA SFIDA (da destra) -->
{#if drawerOpen}
  <div class="drawer-backdrop" transition:fade={{ duration: 180 }} onclick={() => drawerOpen = false} role="presentation"></div>
  <div class="drawer" role="dialog" aria-modal="true" aria-label={drawerEditing ? 'Modifica sfida' : 'Nuova sfida'} transition:fly={{ x: 520, duration: 260, easing: cubicOut, opacity: 1 }}>
    <div class="drawer-head">
      <h3 class="drawer-title font-serif">
        {drawerEditing ? 'Modifica' : 'Nuova'} {drawerType === 'quiz' ? 'Domanda Quiz' : drawerType === 'hunt' ? 'Missione Fotografica' : 'Momento'}
      </h3>
      <button type="button" class="drawer-close" onclick={() => drawerOpen = false} aria-label="Chiudi pannello">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <div class="drawer-body">
      <div class="input-group">
        <label for="d-title" class="input-label">{drawerType === 'quiz' ? 'Domanda' : 'Titolo'}</label>
        <input id="d-title" type="text" class="input-field" bind:value={dTitle}
          placeholder={drawerType === 'quiz' ? 'Es. Dove si sono conosciuti gli sposi?' : drawerType === 'hunt' ? 'Es. Selfie con la sposa' : 'Es. Un augurio speciale per gli sposi'} />
      </div>

      {#if drawerType !== 'quiz' || drawerEditing}
        <div class="input-group">
          <label for="d-desc" class="input-label">Descrizione (opzionale)</label>
          <textarea id="d-desc" class="input-field" rows="3" bind:value={dDesc}
            placeholder="Suggerimento o istruzioni per gli invitati..."></textarea>
        </div>
      {/if}

      <div class="input-group drawer-points">
        <label for="d-points" class="input-label">Punti assegnati</label>
        <input id="d-points" type="number" class="input-field" bind:value={dPoints} min="0" max="200" />
      </div>

      {#if drawerType === 'quiz'}
        <div class="drawer-options">
          <span class="input-label">Opzioni (tocca il cerchio per la risposta corretta)</span>
          {#each dOptions as opt, i}
            {@const isCorrect = dCorrect === opt && opt.trim() !== ''}
            <div class="drawer-opt-row">
              <button type="button" class="drawer-radio {isCorrect ? 'active' : ''}"
                onclick={() => dCorrect = opt} aria-label="Imposta come corretta">
                {#if isCorrect}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {/if}
              </button>
              <input type="text" class="input-field" bind:value={dOptions[i]}
                oninput={(e) => { if (isCorrect) dCorrect = e.target.value; }}
                placeholder={`Opzione ${i + 1}`} />
              <button type="button" class="drawer-remove" disabled={dOptions.length <= 2}
                onclick={() => removeDrawerOption(i)} aria-label="Rimuovi opzione">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          {/each}
          {#if dOptions.length < 6}
            <button type="button" class="add-opt-link" onclick={addDrawerOption}>+ Aggiungi un'altra opzione</button>
          {/if}
        </div>
      {/if}
    </div>

    <div class="drawer-foot">
      <button type="button" class="btn btn-secondary" onclick={() => drawerOpen = false}>Annulla</button>
      <button type="button" class="btn btn-primary" onclick={saveDrawer}>{drawerEditing ? 'Salva modifiche' : 'Aggiungi'}</button>
    </div>
  </div>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(36, 28, 32, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000;
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(100%, 480px);
    height: 100dvh;
    z-index: 1001;
    background: #fff;
    box-shadow: -24px 0 60px -24px rgba(106, 32, 55, 0.45);
    display: flex;
    flex-direction: column;
    overscroll-behavior: contain;
  }

  .drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: max(16px, env(safe-area-inset-top, 0px)) 16px 14px 20px;
    border-bottom: 1px solid rgba(36, 28, 32, 0.07);
  }

  .drawer-title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    line-height: 1.15;
  }

  .drawer-close {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    background: #f7f3f1;
    color: #6b5f64;
    cursor: pointer;
  }

  .drawer-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px 20px;
  }

  .drawer .input-field {
    font-size: 16px;
    min-height: 48px;
    width: 100%;
    box-sizing: border-box;
  }

  .drawer textarea.input-field {
    resize: vertical;
    font-family: inherit;
  }

  .drawer-points {
    max-width: 160px;
  }

  .drawer-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: 20px;
    background: #fbf9f8;
    border: 1px solid rgba(36, 28, 32, 0.07);
  }

  .drawer-opt-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .drawer-radio {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid #7d6f76;
    background: #fff;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drawer-radio.active {
    background: #2f7a55;
    border-color: #2f7a55;
    box-shadow: 0 0 0 3px rgba(47, 122, 85, 0.22);
  }

  .drawer-remove {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #6b5f64;
    cursor: pointer;
  }

  .drawer-remove:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .drawer-foot {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 10px;
    padding: 12px 20px max(14px, env(safe-area-inset-bottom, 0px));
    border-top: 1px solid rgba(36, 28, 32, 0.07);
  }

  .drawer-foot .btn {
    min-height: 48px;
    justify-content: center;
  }

  .onboarding-wrapper {
    max-width: 1080px;
    margin: 0 auto;
    padding: 16px 24px 128px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .onboarding-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }

  .setup-progress {
    width: 100%;
    height: 3px;
    margin: 0 0 8px;
    background: rgba(140, 47, 75, 0.12);
    border-radius: 99px;
    overflow: hidden;
  }

  .setup-progress span {
    display: block;
    width: 100%;
    height: 100%;
    background: #a63552;
  }

  .header-top-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
    position: relative;
    width: 100%;
  }

  .btn-cancel-header {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 14px;
    border-radius: 9999px;
    background: rgba(166, 53, 82, 0.07);
    border: 1px solid rgba(166, 53, 82, 0.25);
    color: #a63552;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  @media (hover: hover) {
    .btn-cancel-header:hover:not(:disabled) {
      background: rgba(166, 53, 82, 0.14);
      border-color: rgba(166, 53, 82, 0.45);
    }
  }

  .btn-cancel-header:disabled,
  .btn-cancel-footer:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-cancel-footer {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 14px;
    border-radius: 9999px;
    background: transparent;
    border: 1px dashed rgba(166, 53, 82, 0.4);
    color: #a63552;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  @media (hover: hover) {
    .btn-cancel-footer:hover:not(:disabled) {
      background: rgba(166, 53, 82, 0.07);
      border-color: rgba(166, 53, 82, 0.65);
    }
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 9999px;
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.15);
    color: var(--wine);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .page-title {
    font-size: clamp(2rem, 4vw, 2.8rem);
    line-height: 1.08;
    margin: 0;
    color: var(--wine);
  }

  .page-title::after {
    content: none;
  }

  .setup-title-accent {
    color: var(--wine);
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 400;
    background: none;
    -webkit-text-fill-color: currentColor;
    border-bottom: 2px solid #ecd189;
    padding-bottom: 1px;
  }

  .page-lead {
    max-width: 680px;
    color: #6b5f64;
    font-family: var(--font-sans);
    font-style: normal;
    font-size: 1rem;
    line-height: 1.55;
    margin: 0;
  }

  .page-lead strong {
    color: var(--wine);
    font-weight: 600;
  }

  /* Sticky navigation tabs */
  .sticky-tabs-container {
    position: -webkit-sticky;
    position: sticky;
    top: 50px;
    z-index: 60;
    background: var(--bg-primary);
    padding: 8px 0 10px;
    margin: 0 0 16px;
    border-bottom: 1px solid rgba(36, 28, 32, 0.07);
  }

  .tabs-scroll-container {
    position: relative;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .scroll-fade-edge {
    position: absolute;
    top: 2px;
    bottom: 2px;
    z-index: 26;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    background: transparent;
    padding: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .scroll-fade-edge.left {
    left: 2px;
    width: 44px;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.98) 60%, transparent);
    border-radius: 9999px 0 0 9999px;
    justify-content: flex-start;
    padding-left: 4px;
  }

  .scroll-fade-edge.right {
    right: 2px;
    width: 76px;
    background: linear-gradient(to left, rgba(255, 255, 255, 0.98) 60%, transparent);
    border-radius: 0 9999px 9999px 0;
    justify-content: flex-end;
    padding-right: 4px;
  }

  .scroll-arrow-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 28px;
    padding: 0 8px;
    border-radius: 9999px;
    background: var(--wine);
    box-shadow: 0 2px 10px rgba(106, 32, 55, 0.35);
    color: #ffffff;
    font-size: 0.74rem;
    font-weight: 700;
    line-height: 1;
    animation: bounce-subtle 1.8s infinite ease-in-out;
  }

  .scroll-fade-edge.left .scroll-arrow-chip {
    padding: 0 6px;
    min-height: 26px;
    width: 26px;
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.2);
    color: var(--wine);
    animation: none;
  }

  .scroll-chip-text {
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  @keyframes bounce-subtle {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(3px); }
  }

  .tabs-swipe-indicator {
    display: none;
  }

  .section-tabs {
    display: flex;
    gap: 8px;
    padding: 6px;
    background: #f1ece8;
    border: 1px solid rgba(36, 28, 32, 0.06);
    border-radius: 18px;
    overflow-x: auto;
    scrollbar-width: none;
    box-shadow: 0 4px 14px rgba(140, 47, 75, 0.06);
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x proximity;
  }

  .section-tabs::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 640px) {
    .section-tabs {
      gap: 6px;
      padding: 5px;
      scrollbar-width: thin;
      scrollbar-color: rgba(140, 47, 75, 0.28) transparent;
    }
    .section-tabs::-webkit-scrollbar { height: 3px; }
    .section-tabs::-webkit-scrollbar-thumb { background: rgba(140, 47, 75, 0.28); border-radius: 99px; }
  }

  .tab-btn {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 16px;
    border: none;
    border-radius: 13px;
    background: transparent;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.22s, color 0.22s, box-shadow 0.22s;
    white-space: nowrap;
  }

  @media (hover: hover) {
    .tab-btn:hover:not(.active) {
      color: var(--wine);
      background: var(--wine-tint);
    }
  }

  .tab-btn:focus-visible,
  .btn-cancel-header:focus-visible,
  .btn-cancel-footer:focus-visible,
  .add-opt-link:focus-visible,
  .remove-opt-btn:focus-visible,
  .correct-radio-btn:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  .tab-btn.active {
    background: var(--wine);
    color: #fff;
    font-weight: 700;
    box-shadow: 0 6px 14px rgba(140, 47, 75, 0.28);
  }

  .tab-icon {
    display: inline-flex;
  }

  /* Section helper */
  .section-helper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 18px;
    border-radius: 22px;
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.12);
    margin-bottom: 18px;
  }

  .helper-info {
    font-size: 0.9rem;
    color: #6b5f64;
    line-height: 1.45;
  }

  .helper-info strong {
    color: var(--wine-deep);
  }

  /* Cards grid */
  .cards-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setup-card {
    padding: 22px;
    border-radius: 28px;
    border: 1px solid rgba(36, 28, 32, 0.07);
    background: #fff;
    transition: border-color 0.2s, box-shadow 0.2s, opacity 0.2s;
  }

  .setup-card.card-selected {
    border-color: rgba(140, 47, 75, 0.28);
    box-shadow: 0 10px 28px rgba(140, 47, 75, 0.09);
  }

  .setup-card.card-disabled {
    opacity: 0.6;
    background: var(--bg-primary);
  }

  .compact-quiz {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 16px 20px;
    border-radius: 20px;
  }
  .compact-quiz-main { flex: 1; min-width: 0; }
  .compact-quiz-meta { display: flex; align-items: center; gap: 9px; margin-bottom: 5px; }
  .compact-quiz-number {
    color: var(--text-muted);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .compact-quiz-points {
    color: var(--wine);
    background: rgba(140, 47, 75, 0.08);
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 0.68rem;
    font-weight: 800;
  }
  .compact-quiz-title { margin: 0 0 10px; color: var(--text-main); font-size: 1.12rem; line-height: 1.3; }
  .compact-activity-desc { margin: -3px 0 0; color: #6b5f64; font-size: 0.86rem; line-height: 1.45; }
  .compact-options { display: flex; flex-wrap: wrap; gap: 7px; }
  .compact-option {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    padding: 5px 10px;
    border: 1px solid rgba(36, 28, 32, 0.09);
    border-radius: 999px;
    background: #fff;
    color: #6b5f64;
    font-size: 0.78rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .compact-option.option-correct {
    border-color: rgba(45, 125, 86, 0.28);
    background: rgba(45, 125, 86, 0.08);
    color: #246b48;
    font-weight: 700;
  }
  .compact-quiz-actions { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
  .compact-checkbox { gap: 7px; }
  .compact-checkbox .checkbox-custom { width: 19px; height: 19px; }
  .compact-checkbox .checkbox-text { font-size: 0.8rem; }
  .setup-loading-overlay {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: rgba(250, 247, 242, 0.88);
    color: var(--text-main);
    font-weight: 700;
    backdrop-filter: blur(5px);
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(36, 28, 32, 0.07);
    margin-bottom: 16px;
  }

  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .checkbox-custom {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: 2px solid var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    transition: background 0.15s;
  }

  .checkbox-label input:checked + .checkbox-custom {
    background: var(--wine);
  }

  .checkbox-label input:focus-visible + .checkbox-custom {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  .checkbox-label input:checked + .checkbox-custom::after {
    content: '';
    width: 5px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-bottom: 2px;
  }

  .checkbox-text {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-main);
  }

  .points-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .points-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .points-field {
    width: 72px;
    padding: 6px 8px;
    font-size: 1rem;
    border-radius: 9999px;
    border: 1px solid rgba(36, 28, 32, 0.12);
    background: #fff;
    font-weight: 700;
    text-align: center;
    color: var(--wine);
  }

  .points-field:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .question-field {
    font-size: 1.05rem;
    font-weight: 600;
  }

  /* Options block */
  .options-edit-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 20px;
    background: var(--bg-primary);
    border: 1px solid rgba(36, 28, 32, 0.05);
  }

  .options-header-label {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    border-radius: 9999px;
    background: #fff;
    border: 1px solid rgba(36, 28, 32, 0.08);
    transition: border-color 0.15s, background 0.15s;
  }

  .option-row.is-correct {
    border-color: #3f7a5f;
    background: #eef6f1;
  }

  .correct-radio-btn {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid rgba(36, 28, 32, 0.2);
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    transition: background 0.15s, border-color 0.15s;
    flex-shrink: 0;
    padding: 0;
  }

  .correct-radio-btn.active {
    background: #3f7a5f;
    border-color: #3f7a5f;
  }

  .option-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    padding: 6px 4px;
    font-size: 1rem;
    box-shadow: none;
  }

  .option-input:focus {
    outline: none;
    box-shadow: none;
  }

  .correct-badge {
    padding: 3px 10px;
    border-radius: 9999px;
    background: #dceee4;
    color: #2f6049;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .remove-opt-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: inline-flex;
    transition: color 0.15s;
  }

  @media (hover: hover) {
    .remove-opt-btn:hover:not(:disabled) {
      color: #a63552;
    }
  }

  .remove-opt-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .add-opt-link {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--wine);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 9999px;
  }

  @media (hover: hover) {
    .add-opt-link:hover:not(:disabled) {
      background: var(--wine-tint);
    }
  }

  /* Footer */
  .onboarding-footer {
    display: grid;
    grid-template-columns: 1fr 1fr 1.25fr;
    align-items: center;
    gap: 10px;
    width: min(100%, 720px);
    margin: 0 auto;
    padding: 12px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.97);
    border: 1px solid rgba(36, 28, 32, 0.08);
    box-shadow: 0 8px 28px rgba(74, 31, 51, 0.14);
    position: sticky;
    bottom: max(10px, env(safe-area-inset-bottom, 0px));
    z-index: 50;
  }

  .setup-action-cancel,
  .setup-action-reset {
    min-height: 48px;
    padding: 10px 12px;
    border: 1px solid rgba(36, 28, 32, 0.1);
    border-radius: 14px;
    background: #f8f5f2;
    color: #5f5158;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 650;
    cursor: pointer;
  }

  .setup-action-reset { background: #fff; }
  .setup-action-save { min-height: 48px; justify-content: center; border-radius: 14px; padding: 10px 12px; }
  .setup-action-cancel:disabled,
  .setup-action-reset:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (hover: hover) {
    .setup-action-cancel:hover:not(:disabled),
    .setup-action-reset:hover:not(:disabled) { border-color: rgba(140, 47, 75, 0.28); color: var(--wine); }
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner-sm {
      animation-duration: 2s;
    }
    .setup-card,
    .tab-btn,
    .option-row {
      transition: none;
    }
  }

  @media (max-width: 768px) {
    .onboarding-wrapper {
      padding: 14px 20px 112px;
      gap: 18px;
    }

    .page-title {
      font-size: clamp(2rem, 7.5vw, 2.55rem);
    }

    .page-lead {
      font-size: 0.96rem;
      max-width: 42ch;
    }

    .setup-card {
      padding: 18px;
      border-radius: 24px;
    }

    .compact-quiz {
      align-items: stretch;
      flex-direction: column;
      gap: 13px;
      padding: 15px;
      border-radius: 20px;
    }
    .compact-quiz-actions { justify-content: space-between; }

    .onboarding-footer {
      grid-template-columns: 0.85fr 0.85fr 1.2fr;
      gap: 8px;
      padding: 9px;
      border-radius: 19px;
    }

    .setup-action-cancel,
    .setup-action-reset,
    .setup-action-save { min-height: 46px; padding: 9px 6px; font-size: 0.84rem; }

    .section-helper {
      flex-direction: column;
      align-items: stretch;
    }
  }

  @media (max-width: 380px) {
    .onboarding-wrapper { padding-left: 14px; padding-right: 14px; }
    .setup-progress { margin-left: -14px; margin-right: -14px; }
    .tab-btn { padding: 10px 12px; font-size: 0.82rem; }
  }

</style>
