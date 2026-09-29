<script>
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import {
    DEFAULT_PHOTO_CHALLENGES,
    PRESET_QUIZZES,
    PRESET_HUNTS,
    PRESET_MOMENTS
  } from '../lib/challengePresets.js';

  let { onComplete } = $props();

  let activeSection = $state('quiz'); // 'quiz' | 'hunt' | 'moments'
  let isSaving = $state(false);
  let errorMessage = $state('');

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

  // Contatori
  const selectedQuizCount = $derived(quizzes.filter(q => q.selected).length);
  const selectedHuntCount = $derived(hunts.filter(h => h.selected).length);
  const selectedMomentsCount = $derived(moments.filter(m => m.selected).length);

  // Aggiungi nuova domanda quiz
  function addCustomQuiz() {
    quizzes.push({
      id: `custom_q_${Date.now()}`,
      title: 'Nuova domanda sugli sposi...',
      description: '',
      points: 30,
      type: 'quiz',
      active: true,
      selected: true,
      vote_options: ['Opzione A', 'Opzione B', 'Opzione C'],
      correct_answer: 'Opzione A'
    });
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

  // Aggiungi nuova missione caccia
  function addCustomHunt() {
    hunts.push({
      id: `custom_h_${Date.now()}`,
      title: 'Nuova missione fotografica...',
      description: 'Descrivi cosa devono fotografare gli invitati',
      points: 25,
      type: 'hunt',
      active: true,
      selected: true
    });
  }

  // Aggiungi nuovo momento
  function addCustomMoment() {
    moments.push({
      id: `custom_m_${Date.now()}`,
      title: 'Nuovo momento o domanda...',
      description: 'Cosa vuoi chiedere o far condividere agli invitati?',
      points: 10,
      type: 'vote',
      active: true,
      selected: true
    });
  }

  // Salva tutte le sfide selezionate
  async function handleSave(useAllDefaults = false) {
    errorMessage = '';
    isSaving = true;

    try {
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
      errorMessage = err.message || 'Errore durante il salvataggio delle attività.';
    } finally {
      isSaving = false;
    }
  }

  let isCancelling = $state(false);

  async function handleCancelCreation() {
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
  <!-- Header con riepilogo -->
  <header class="onboarding-header">
    <div class="header-top-row">
      <div class="header-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        Passo 2 di 2 · Configurazione Attività
      </div>

      <button
        type="button"
        class="btn-cancel-header"
        disabled={isSaving || isCancelling}
        onclick={handleCancelCreation}
        title="Annulla ed elimina l'evento dal database"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span>{isCancelling ? 'Annullamento...' : 'Annulla creazione'}</span>
      </button>
    </div>

    <h1 class="page-title font-serif">
      Personalizza i giochi di <span class="gold-gradient-text">{appState.event?.spouse1_name || 'Voi'} &amp; {appState.event?.spouse2_name || 'Sposi'}</span>
    </h1>
    <p class="page-lead">
      Abbiamo già preparato i quiz e le missioni più divertenti. Puoi scegliere quali includere, modificare le opzioni o indicare la risposta corretta. Potrai sempre modificarle anche dopo nelle <strong>Impostazioni Sposi</strong>!
    </p>
  </header>

  {#if errorMessage}
    <div class="form-error" role="alert">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      <span>{errorMessage}</span>
    </div>
  {/if}

  <!-- Navigazione Sezioni Sticky sotto all'header -->
  <div class="sticky-tabs-container">
    <div class="section-tabs">
      <button
        class="tab-btn {activeSection === 'quiz' ? 'active' : ''}"
        onclick={() => activeSection = 'quiz'}
      >
        <span class="tab-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </span>
        <span class="tab-title">Quiz Sposi ({selectedQuizCount})</span>
      </button>

      <button
        class="tab-btn {activeSection === 'hunt' ? 'active' : ''}"
        onclick={() => activeSection = 'hunt'}
      >
        <span class="tab-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </span>
        <span class="tab-title">Caccia al Tesoro ({selectedHuntCount})</span>
      </button>

      <button
        class="tab-btn {activeSection === 'moments' ? 'active' : ''}"
        onclick={() => activeSection = 'moments'}
      >
        <span class="tab-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </span>
        <span class="tab-title">Momenti Migliori ({selectedMomentsCount})</span>
      </button>
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
        <button class="btn btn-secondary btn-sm" onclick={addCustomQuiz}>
          + Aggiungi Domanda Quiz
        </button>
      </div>

      <div class="cards-grid">
        {#each quizzes as quiz, idx (quiz.id)}
          <div class="setup-card glass-card {quiz.selected ? 'card-selected' : 'card-disabled'}">
            <div class="card-head">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={quiz.selected} />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Includi nel matrimonio</span>
              </label>

              <div class="points-input-wrap">
                <label for="qp-{idx}" class="points-label">Punti:</label>
                <input id="qp-{idx}" type="number" class="points-field" bind:value={quiz.points} min="5" max="100" />
              </div>
            </div>

            <div class="card-body">
              <div class="input-group">
                <label for="qt-{idx}" class="input-label">Domanda {idx + 1}</label>
                <input
                  id="qt-{idx}"
                  type="text"
                  class="input-field question-field"
                  bind:value={quiz.title}
                  placeholder="Scrivi la domanda..."
                  disabled={!quiz.selected}
                />
              </div>

              <div class="options-edit-block">
                <span class="options-header-label">Opzioni di risposta &amp; Risposta Corretta:</span>
                <div class="options-list">
                  {#each quiz.vote_options as opt, optIdx}
                    {@const isCorrect = quiz.correct_answer === opt}
                    <div class="option-row {isCorrect ? 'is-correct' : ''}">
                      <button
                        type="button"
                        class="correct-radio-btn {isCorrect ? 'active' : ''}"
                        title={isCorrect ? 'Risposta corretta impostata' : 'Clicca per segnare come risposta corretta'}
                        onclick={() => quiz.correct_answer = opt}
                        disabled={!quiz.selected}
                      >
                        {#if isCorrect}
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {/if}
                      </button>

                      <input
                        type="text"
                        class="input-field option-input"
                        bind:value={quiz.vote_options[optIdx]}
                        oninput={(e) => {
                          if (isCorrect) quiz.correct_answer = e.target.value;
                        }}
                        placeholder={`Opzione ${optIdx + 1}`}
                        disabled={!quiz.selected}
                      />

                      {#if isCorrect}
                        <span class="correct-badge">Corretta</span>
                      {/if}

                      <button
                        type="button"
                        class="remove-opt-btn"
                        title="Rimuovi opzione"
                        disabled={!quiz.selected || quiz.vote_options.length <= 2}
                        onclick={() => removeOptionFromQuiz(quiz, optIdx)}
                        aria-label="Rimuovi opzione"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  {/each}
                </div>

                {#if quiz.vote_options.length < 6}
                  <button
                    type="button"
                    class="add-opt-link"
                    disabled={!quiz.selected}
                    onclick={() => addOptionToQuiz(quiz)}
                  >
                    + Aggiungi un'altra opzione
                  </button>
                {/if}
              </div>
            </div>
          </div>
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
        <button class="btn btn-secondary btn-sm" onclick={addCustomHunt}>
          + Aggiungi Missione Fotografica
        </button>
      </div>

      <div class="cards-grid">
        {#each hunts as hunt, idx (hunt.id)}
          <div class="setup-card glass-card {hunt.selected ? 'card-selected' : 'card-disabled'}">
            <div class="card-head">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={hunt.selected} />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Includi missione</span>
              </label>

              <div class="points-input-wrap">
                <label for="hp-{idx}" class="points-label">Punti:</label>
                <input id="hp-{idx}" type="number" class="points-field" bind:value={hunt.points} min="5" max="100" />
              </div>
            </div>

            <div class="card-body">
              <div class="input-group">
                <label for="ht-{idx}" class="input-label">Titolo missione</label>
                <input
                  id="ht-{idx}"
                  type="text"
                  class="input-field"
                  bind:value={hunt.title}
                  placeholder="Es. Selfie con la sposa"
                  disabled={!hunt.selected}
                />
              </div>

              <div class="input-group">
                <label for="hd-{idx}" class="input-label">Descrizione / Istruzioni</label>
                <input
                  id="hd-{idx}"
                  type="text"
                  class="input-field"
                  bind:value={hunt.description}
                  placeholder="Cosa devono fotografare esattamente gli invitati..."
                  disabled={!hunt.selected}
                />
              </div>
            </div>
          </div>
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
        <button class="btn btn-secondary btn-sm" onclick={addCustomMoment}>
          + Aggiungi Nuovo Momento
        </button>
      </div>

      <div class="cards-grid">
        {#each moments as moment, idx (moment.id)}
          <div class="setup-card glass-card {moment.selected ? 'card-selected' : 'card-disabled'}">
            <div class="card-head">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={moment.selected} />
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Includi domanda</span>
              </label>

              <div class="points-input-wrap">
                <label for="mp-{idx}" class="points-label">Punti:</label>
                <input id="mp-{idx}" type="number" class="points-field" bind:value={moment.points} min="5" max="100" />
              </div>
            </div>

            <div class="card-body">
              <div class="input-group">
                <label for="mt-{idx}" class="input-label">Domanda o Titolo</label>
                <input
                  id="mt-{idx}"
                  type="text"
                  class="input-field"
                  bind:value={moment.title}
                  placeholder="Es. Un augurio speciale per gli sposi"
                  disabled={!moment.selected}
                />
              </div>

              <div class="input-group">
                <label for="md-{idx}" class="input-label">Descrizione (opzionale)</label>
                <input
                  id="md-{idx}"
                  type="text"
                  class="input-field"
                  bind:value={moment.description}
                  placeholder="Suggerimento o spiegazione per gli invitati..."
                  disabled={!moment.selected}
                />
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Footer con azioni di salvataggio -->
  <footer class="onboarding-footer glass-card">
    <div class="footer-left">
      <button
        type="button"
        class="btn btn-secondary"
        disabled={isSaving || isCancelling}
        onclick={() => handleSave(true)}
      >
        Usa preset consigliati &amp; continua
      </button>
      <button
        type="button"
        class="btn-cancel-footer"
        disabled={isSaving || isCancelling}
        onclick={handleCancelCreation}
        title="Annulla ed elimina l'evento dal database"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Annulla ed elimina</span>
      </button>
      <span class="footer-hint">Tutto potrà essere modificato in seguito nel pannello Sposi</span>
    </div>

    <button
      type="button"
      class="btn btn-primary btn-lg"
      disabled={isSaving || isCancelling}
      onclick={() => handleSave(false)}
    >
      {#if isSaving}
        <span class="spinner-sm"></span> Salvataggio in corso...
      {:else}
        Salva attività e ottieni il codice invito →
      {/if}
    </button>
  </footer>
</div>

<style>
  .onboarding-wrapper {
    max-width: 960px;
    margin: 0 auto;
    padding: 16px 20px 80px;
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
    padding: 6px 14px;
    border-radius: 20px;
    background: rgba(220, 53, 69, 0.08);
    border: 1px solid rgba(220, 53, 69, 0.25);
    color: #b02a37;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-cancel-header:hover:not(:disabled) {
    background: rgba(220, 53, 69, 0.16);
    border-color: rgba(220, 53, 69, 0.45);
    color: #842029;
  }

  .btn-cancel-header:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-cancel-footer {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 14px;
    border-radius: 12px;
    background: transparent;
    border: 1px dashed rgba(220, 53, 69, 0.35);
    color: #b02a37;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-cancel-footer:hover:not(:disabled) {
    background: rgba(220, 53, 69, 0.08);
    border-color: rgba(220, 53, 69, 0.6);
  }

  .btn-cancel-footer:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    background: rgba(201, 169, 110, 0.14);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--gold-dark);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .page-title {
    font-size: 2.1rem;
    line-height: 1.25;
    margin: 0;
  }

  .page-lead {
    max-width: 720px;
    color: var(--text-muted);
    font-size: 1rem;
    line-height: 1.55;
    margin: 0;
  }

  /* Sticky Navigation Tabs sotto all'header */
  .sticky-tabs-container {
    position: -webkit-sticky;
    position: sticky;
    top: calc(var(--site-header-height, 72px) + var(--safe-top, 0px));
    z-index: 35;
    background: rgba(250, 248, 245, 0.96);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 12px 0 14px;
    margin: 0 0 16px;
    border-bottom: 1px solid rgba(201, 169, 110, 0.2);
    box-shadow: 0 4px 16px rgba(138, 109, 59, 0.05);
  }

  .section-tabs {
    display: flex;
    gap: 8px;
    padding: 6px;
    background: rgba(235, 230, 222, 0.65);
    border: 1px solid rgba(201, 169, 110, 0.22);
    border-radius: 18px;
    overflow-x: auto;
    box-shadow: 0 4px 14px rgba(138, 109, 59, 0.05);
  }

  .tab-btn {
    flex: 1;
    min-width: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    border-radius: 14px;
    background: transparent;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.92rem;
    cursor: pointer;
    transition: all 0.22s ease;
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: var(--text-main);
  }

  .tab-btn.active {
    background: #fff;
    color: var(--text-main);
    font-weight: 700;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
  }

  .tab-icon {
    font-size: 1.15rem;
  }

  /* Section Helper */
  .section-helper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 18px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.65);
    border: 1px solid var(--border-subtle);
    margin-bottom: 18px;
  }

  .helper-info {
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.45;
  }

  .helper-info strong {
    color: var(--text-main);
  }

  /* Cards Grid */
  .cards-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setup-card {
    padding: 20px;
    border-radius: 20px;
    border: 1.5px solid var(--border-subtle);
    background: rgba(255, 255, 255, 0.85);
    transition: border-color 0.2s, box-shadow 0.2s, opacity 0.2s;
  }

  .setup-card.card-selected {
    border-color: rgba(201, 169, 110, 0.5);
    box-shadow: 0 6px 20px rgba(138, 109, 59, 0.08);
  }

  .setup-card.card-disabled {
    opacity: 0.55;
    background: rgba(250, 248, 245, 0.6);
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
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
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 2px solid var(--gold-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    transition: all 0.15s;
  }

  .checkbox-label input:checked + .checkbox-custom {
    background: var(--gold-dark);
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
    width: 68px;
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: #fff;
    font-weight: 700;
    text-align: center;
    color: var(--gold-dark);
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
    padding: 12px;
    border-radius: 14px;
    background: rgba(250, 248, 245, 0.7);
    border: 1px solid rgba(0, 0, 0, 0.04);
  }

  .options-header-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
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
    border-radius: 12px;
    background: #fff;
    border: 1px solid var(--border-subtle);
    transition: all 0.15s;
  }

  .option-row.is-correct {
    border-color: #2e7d32;
    background: rgba(46, 125, 50, 0.05);
  }

  .correct-radio-btn {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid #ccc;
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #fff;
    font-size: 14px;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .correct-radio-btn.active {
    background: #2e7d32;
    border-color: #2e7d32;
  }

  .option-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 6px 4px;
    font-size: 0.93rem;
  }

  .option-input:focus {
    outline: none;
  }

  .correct-badge {
    padding: 3px 8px;
    border-radius: 8px;
    background: rgba(46, 125, 50, 0.15);
    color: #2e7d32;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .remove-opt-btn {
    background: none;
    border: none;
    color: #bbb;
    cursor: pointer;
    padding: 4px;
    font-size: 14px;
    transition: color 0.15s;
  }

  .remove-opt-btn:hover:not(:disabled) {
    color: #d32f2f;
  }

  .remove-opt-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .add-opt-link {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--gold-dark);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 4px 6px;
  }

  .add-opt-link:hover:not(:disabled) {
    text-decoration: underline;
  }

  /* Footer */
  .onboarding-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 24px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid var(--border-subtle);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    position: sticky;
    bottom: 20px;
    z-index: 50;
  }

  .footer-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .footer-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
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

  @media (max-width: 768px) {
    .onboarding-wrapper {
      padding: 12px 14px 100px;
    }

    .page-title {
      font-size: 1.55rem;
    }

    .onboarding-footer {
      flex-direction: column;
      align-items: stretch;
      bottom: 10px;
    }

    .footer-left {
      align-items: center;
      text-align: center;
    }

    .section-helper {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
