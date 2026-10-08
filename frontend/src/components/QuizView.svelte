<script>
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import { eventTimer } from '../lib/timer.svelte.js';
  import LockedChallenges from './LockedChallenges.svelte';

  let answeringId = $state(null);
  let votingId = $state(null);
  let quizResults = $state({}); // challengeId -> { is_correct, correct_answer, selected }

  const quizChallenges = $derived(
    appState.challenges.filter(c => c.challenge_type === 'quiz' && c.active !== false)
  );

  const voteChallenges = $derived(
    appState.challenges.filter(c => c.challenge_type === 'vote' && c.active !== false)
  );

  async function handleQuizAnswer(challengeId, optionId, quizPoints = 30) {
    if (eventTimer.status === 'ended') {
      appState.showToast('Il tempo per rispondere ai quiz è terminato!', 'info');
      return;
    }
    if (answeringId || appState.mySubmissionsByChallenge[challengeId] || quizResults[challengeId]) return;

    answeringId = challengeId;
    try {
      const res = await api.submitQuiz(challengeId, optionId);
      quizResults[challengeId] = {
        is_correct: res.is_correct,
        correct_answer: res.correct_answer,
        selected: optionId,
        points_awarded: res.points_awarded
      };

      const pts = res.points_awarded || quizPoints;
      if (res.is_correct) {
        appState.showToast(`Risposta corretta, hai guadagnato ${pts} punti!`, 'success', pts);
      } else {
        appState.showToast('Risposta sbagliata', 'error');
      }

      await Promise.all([
        appState.refreshUser(true),
        appState.refreshMySubmissions(),
        appState.refreshLeaderboard(),
        appState.refreshChallenges()
      ]);
    } catch (err) {
      appState.showToast(err.message || 'Errore durante la risposta al quiz', 'error');
    } finally {
      answeringId = null;
    }
  }

  let textDrafts = $state({});

  async function handleTextSubmit(challengeId, votePoints = 3, savedAnswer = '') {
    if (eventTimer.status === 'ended') {
      appState.showToast('Il tempo per modificare i momenti è terminato!', 'info');
      return;
    }
    const text = (textDrafts[challengeId] !== undefined ? textDrafts[challengeId] : (savedAnswer || '')).trim();
    if (!text) {
      appState.showToast('Scrivi il tuo momento prima di salvare!', 'error');
      return;
    }

    votingId = challengeId;
    try {
      const res = await api.submitVote(challengeId, text);
      const isFirstTime = res.status === 'created';
      if (isFirstTime) {
        const pts = res.points_awarded || votePoints;
        appState.showToast(`Momento salvato! Hai guadagnato ${pts} punti!`, 'success', pts);
      } else {
        appState.showToast('Momento aggiornato con successo!', 'success');
      }

      await Promise.all([
        appState.refreshUser(true),
        appState.refreshMySubmissions(),
        appState.refreshLeaderboard(),
        appState.refreshChallenges()
      ]);
    } catch (err) {
      appState.showToast(err.message || 'Errore durante il salvataggio', 'error');
    } finally {
      votingId = null;
    }
  }

  async function handleVote(challengeId, optionId, votePoints = 5) {
    if (eventTimer.status === 'ended') {
      appState.showToast('Il tempo per votare è terminato!', 'info');
      return;
    }
    if (votingId) return;
    votingId = challengeId;
    try {
      await api.submitVote(challengeId, optionId);
      appState.showToast('Voto registrato con successo!', 'success', votePoints);
      await Promise.all([
        appState.refreshUser(true),
        appState.refreshMySubmissions(),
        appState.refreshLeaderboard(),
        appState.refreshChallenges()
      ]);
    } catch (err) {
      appState.showToast(err.message || 'Errore durante il voto', 'error');
    } finally {
      votingId = null;
    }
  }
</script>

<div class="games-container">
  <!-- Sub-navigation Pill -->
  <div class="sub-nav">
    <button
      class="sub-btn {appState.quizSubTab === 'quiz' ? 'active' : ''}"
      onclick={() => appState.quizSubTab = 'quiz'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
      Quiz Sposi 
    </button>
    <button
      class="sub-btn {appState.quizSubTab === 'vote' ? 'active' : ''}"
      onclick={() => appState.quizSubTab = 'vote'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 2 4 4-10 10H8v-4L18 2z"/><path d="m15 5 3 3"/></svg>
      Momenti Migliori 
    </button>
  </div>

  {#if appState.quizSubTab === 'quiz'}
    <!-- QUIZ SECTION -->
    <div class="section-box">
      <div class="header-box">
        <h1 class="page-title font-serif">Quiz sugli Sposi</h1>
        <p class="page-desc">Rispondi alle domande e dimostra quanto conosci gli sposi!</p>
      </div>

      {#if appState.isCouple}
        <div class="couple-hint-banner glass-card">
          <span class="hint-text">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-svg-icon"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
            <strong>Area Sposi:</strong> vuoi aggiungere, disattivare o modificare le domande quiz?
          </span>
          <button class="btn btn-secondary btn-sm" onclick={() => appState.setGameTab('manage')}>
            Pannello Sposi →
          </button>
        </div>
      {/if}

      {#if eventTimer.status === 'ended'}
        <div class="ended-banner glass-card">
          <div class="ended-banner-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="ended-banner-text">
            <strong>Tempo per i quiz concluso!</strong>
            <span>Puoi consultare le domande e le risposte date. I quiz sono ora chiusi.</span>
          </div>
        </div>
      {/if}

      {#if eventTimer.status === 'before_start'}
        <LockedChallenges
          title="Quiz sugli Sposi Bloccato"
          subtitle="Le domande del quiz saranno svelate all'inizio dei giochi."
        />
      {:else}
        <div class="cards-list">
        {#if quizChallenges.length === 0}
          <div class="empty-state glass-card">
            <div class="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
            </div>
            <div class="empty-title">Nessun quiz attivo</div>
            <p class="empty-desc">I quiz verranno sbloccati durante il ricevimento!</p>
          </div>
        {:else}
          {#each quizChallenges as quiz (quiz.id)}
            {@const submission = appState.mySubmissionsByChallenge[quiz.id]}
            {@const result = quizResults[quiz.id]}
            {@const isDone = !!submission || !!result || !!quiz.completed}
            {@const myAnswer = result?.selected ?? submission?.answer_text ?? quiz.my_answer}
            {@const correctAnswer = result?.correct_answer ?? submission?.correct_answer ?? quiz.correct_answer}
            {@const isCorrect = result?.is_correct ?? submission?.is_correct ?? quiz.is_correct ?? ((submission?.points_awarded ?? quiz.points_awarded ?? 0) > 0)}
            {@const options = quiz.config?.options || []}
            {@const myOptionObj = options.find(o => o.id === myAnswer)}

            <div class="game-card glass-card {isDone ? 'quiz-done' : ''}">
              <div class="card-top-row">
                <span class="badge badge-gold">+{quiz.points} pt</span>
                {#if isDone}
                  <span class="badge {isCorrect ? 'badge-green' : 'badge-rose'}">
                    {#if isCorrect}
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Risposta esatta (+{quiz.points} pt)
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Risposta errata (0 pt)
                    {/if}
                  </span>
                {:else if eventTimer.status === 'ended'}
                  <span class="badge badge-neutral">Tempo scaduto</span>
                {/if}
              </div>

              <h3 class="quiz-question font-serif">{quiz.title}</h3>
              {#if quiz.description}
                <p class="quiz-subtext">{quiz.description}</p>
              {/if}

              {#if isDone}
                <div class="quiz-recap-box {isCorrect ? 'recap-correct' : 'recap-incorrect'}">
                  <div class="recap-icon">
                    {#if isCorrect}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    {/if}
                  </div>
                  <div class="recap-content">
                    <div class="recap-title">
                      La tua risposta: <strong>{myOptionObj?.text || myAnswer || 'N/D'}</strong>
                    </div>
                    <div class="recap-sub">
                      {#if isCorrect}
                        Risposta esatta! Punti assegnati: +{quiz.points} pt
                      {:else}
                        Risposta non corretta. Quella corretta era: <strong>{correctAnswer || 'N/D'}</strong>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Options Grid -->
              <div class="options-list">
                {#each options as opt, optIdx}
                  {@const letter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || (optIdx + 1)}
                  {@const isSelected = myAnswer === opt.id}
                  {@const isCorrectOpt = correctAnswer === opt.id}
                  
                  <button
                    class="option-btn
                      {isDone || eventTimer.status === 'ended' ? 'done-locked' : ''}
                      {isSelected ? 'selected' : ''}
                      {isDone && isCorrectOpt ? 'correct' : ''}
                      {isDone && isSelected && !isCorrect ? 'incorrect' : ''}"
                    disabled={isDone || answeringId === quiz.id || eventTimer.status === 'ended'}
                    onclick={() => handleQuizAnswer(quiz.id, opt.id, quiz.points)}
                  >
                    <span class="opt-letter">{letter}</span>
                    <span class="opt-text">{opt.text}</span>
                    {#if isDone}
                      {#if isSelected && isCorrect}
                        <span class="opt-status-tag tag-green">
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          La tua risposta
                        </span>
                      {:else if isSelected && !isCorrect}
                        <span class="opt-status-tag tag-rose">
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          La tua risposta
                        </span>
                      {:else if isCorrectOpt}
                        <span class="opt-status-tag tag-green">
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Risposta corretta
                        </span>
                      {/if}
                    {/if}
                  </button>
                {/each}
              </div>

              {#if !isDone && eventTimer.status === 'ended'}
                <div class="ended-notice-inline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Tempo scaduto · Non è più possibile inviare la risposta</span>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
      {/if}
    </div>
  {:else}
    <!-- MOMENTS & THOUGHTS SECTION (TEXT-ONLY) -->
    <div class="section-box">
      <div class="header-box">
        <h1 class="page-title font-serif">Momenti Migliori</h1>
        <p class="page-desc">Condividi pensieri, ricordi ed emozioni della festa! Puoi compilare e modificare le risposte fino alla fine dell'evento.</p>
      </div>

      {#if appState.isCouple}
        <div class="couple-hint-banner glass-card">
          <span class="hint-text">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-svg-icon"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
            <strong>Area Sposi:</strong> vuoi aggiungere o modificare le domande dei momenti?
          </span>
          <button class="btn btn-secondary btn-sm" onclick={() => appState.setGameTab('manage')}>
            Pannello Sposi →
          </button>
        </div>
      {/if}

      {#if eventTimer.status === 'ended'}
        <div class="ended-banner glass-card">
          <div class="ended-banner-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="ended-banner-text">
            <strong>Tempo per Momenti Migliori concluso!</strong>
            <span>Puoi visualizzare i pensieri e ricordi che hai condiviso. Le risposte sono ora in sola lettura.</span>
          </div>
        </div>
      {/if}

      {#if eventTimer.status === 'before_start'}
        <LockedChallenges
          title="Momenti Migliori Bloccati"
          subtitle="I Momenti Migliori della serata saranno sbloccati all'inizio dei giochi."
        />
      {:else}
        <div class="cards-list">
        {#if voteChallenges.length === 0}
          <div class="empty-state glass-card">
            <div class="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 2 4 4-10 10H8v-4L18 2z"/><path d="m15 5 3 3"/></svg>
            </div>
            <div class="empty-title">Nessuna domanda attiva</div>
            <p class="empty-desc">I Momenti Migliori appariranno a breve!</p>
          </div>
        {:else}
          {#each voteChallenges as vote (vote.id)}
            {@const submission = appState.mySubmissionsByChallenge[vote.id]}
            {@const savedAnswer = submission?.answer_text || vote.my_vote || ''}
            {@const currentDraft = textDrafts[vote.id] !== undefined ? textDrafts[vote.id] : savedAnswer}
            {@const isAnswered = !!savedAnswer.trim()}
            {@const hasUnsavedChanges = isAnswered && currentDraft.trim() !== savedAnswer.trim()}

            <div class="game-card glass-card {isAnswered ? 'moment-card-answered' : ''}">
              <div class="card-top-row">
                <span class="badge badge-gold">+{vote.points} pt</span>
                {#if isAnswered}
                  <span class="badge badge-green">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Risposta salvata
                  </span>
                {:else if eventTimer.status === 'ended'}
                  <span class="badge badge-neutral">Tempo scaduto</span>
                {:else}
                  <span class="badge badge-neutral">Da compilare</span>
                {/if}
              </div>

              <h3 class="quiz-question font-serif">{vote.title}</h3>
              {#if vote.description}
                <p class="quiz-subtext">{vote.description}</p>
              {/if}

              <div class="moment-input-box">
                <textarea
                  class="moment-textarea {eventTimer.status === 'ended' ? 'moment-textarea-locked' : ''}"
                  placeholder={eventTimer.status === 'ended' ? (isAnswered ? '' : 'Nessuna risposta fornita prima del termine dei giochi.') : 'Scrivi qui la tua risposta...'}
                  rows="3"
                  maxlength="500"
                  value={currentDraft}
                  oninput={(e) => textDrafts[vote.id] = e.target.value}
                  disabled={votingId === vote.id || eventTimer.status === 'ended'}
                  readonly={eventTimer.status === 'ended'}
                ></textarea>

                <div class="moment-footer">
                  <div class="moment-info">
                    {#if eventTimer.status === 'ended'}
                      <span class="moment-hint {isAnswered ? 'hint-saved' : ''}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {isAnswered ? 'Risposta registrata · Sola lettura' : 'Tempo scaduto · Risposte chiuse'}
                      </span>
                    {:else}
                      {#if isAnswered}
                        {#if hasUnsavedChanges}
                          <span class="moment-hint hint-editing">● Modifiche non salvate</span>
                        {:else}
                          <span class="moment-hint hint-saved">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Salvato · modificabile fino a fine evento
                          </span>
                        {/if}
                      {:else}
                        <span class="moment-hint">Puoi modificare il testo anche in seguito</span>
                      {/if}
                    {/if}
                  </div>

                  {#if eventTimer.status !== 'ended'}
                    {#if !isAnswered}
                      <button
                        class="btn-primary moment-action-btn"
                        disabled={votingId === vote.id || !currentDraft.trim()}
                        onclick={() => handleTextSubmit(vote.id, vote.points, savedAnswer)}
                      >
                        {#if votingId === vote.id}
                          <span class="btn-spinner"></span> Salvataggio...
                        {:else}
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
                          Invia risposta
                        {/if}
                      </button>
                    {:else if hasUnsavedChanges}
                      <button
                        class="btn-primary moment-action-btn btn-save-modifications"
                        disabled={votingId === vote.id || !currentDraft.trim()}
                        onclick={() => handleTextSubmit(vote.id, vote.points, savedAnswer)}
                      >
                        {#if votingId === vote.id}
                          <span class="btn-spinner"></span> Salvataggio...
                        {:else}
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
                          Salva modifiche
                        {/if}
                      </button>
                    {/if}
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .games-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Sub-navigation pill */
  .sub-nav {
    display: flex;
    gap: 4px;
    background: #fff;
    padding: 4px;
    border-radius: 999px;
    border: 1px solid rgba(36, 28, 32, 0.07);
    box-shadow: 0 14px 28px -22px rgba(106, 32, 55, 0.4);
    max-width: 480px;
  }

  .sub-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 11px 14px;
    border-radius: 999px;
    background: transparent;
    border: none;
    color: #6b5f64;
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }

  .sub-btn.active {
    background: var(--wine);
    color: #fff;
    font-weight: 700;
    box-shadow: 0 10px 18px -10px rgba(140, 47, 75, 0.6);
  }

  .sub-btn:focus-visible,
  .option-btn:focus-visible,
  .moment-textarea:focus-visible,
  .moment-action-btn:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  @media (hover: hover) {
    .sub-btn:not(.active):hover {
      background: var(--wine-tint);
      color: var(--wine);
    }
  }

  .section-box {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* Editorial header */
  .header-box {
    padding: 4px 4px 0;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 2.3rem;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--text-main);
  }

  .page-title::after {
    content: '';
    display: block;
    width: 44px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin-top: 12px;
  }

  .page-desc {
    font-size: 0.95rem;
    font-style: italic;
    color: #6b5f64;
    margin-top: 12px;
    line-height: 1.5;
    max-width: 52ch;
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .game-card {
    padding: 22px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: #fff;
    border-radius: 28px;
  }

  .card-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .quiz-question {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-main);
    line-height: 1.2;
  }

  .quiz-subtext {
    font-size: 0.88rem;
    color: #6b5f64;
    line-height: 1.5;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 2px;
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #fff;
    border: 1px solid rgba(36, 28, 32, 0.1);
    border-radius: 18px;
    color: var(--text-main);
    font-family: var(--font-sans);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
  }

  @media (hover: hover) {
    .option-btn:not(:disabled):hover {
      border-color: rgba(140, 47, 75, 0.45);
      background: var(--wine-tint);
    }
  }

  .option-btn:not(:disabled):active {
    transform: scale(0.985);
    border-color: var(--wine);
  }

  .opt-letter {
    width: 30px;
    min-width: 30px;
    max-width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--wine-tint);
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1rem;
    flex-shrink: 0;
    overflow: hidden;
    line-height: 1;
    text-align: center;
  }

  .opt-text {
    font-size: 0.92rem;
    font-weight: 500;
    flex: 1;
  }

  .option-btn.selected {
    border-color: var(--wine);
    background: var(--wine-tint);
  }

  .option-btn.selected .opt-letter {
    background: var(--wine);
    color: #fff;
  }

  .option-btn.correct {
    background: rgba(127, 169, 148, 0.14);
    border-color: rgba(127, 169, 148, 0.7);
    color: #2f5f4a;
  }

  .option-btn.correct .opt-letter {
    background: #7fa994;
    color: #fff;
  }

  .option-btn.incorrect {
    background: rgba(168, 74, 74, 0.08);
    border-color: rgba(168, 74, 74, 0.45);
    color: #8a3a3f;
  }

  .option-btn.incorrect .opt-letter {
    background: #a84a4a;
    color: #fff;
  }

  /* Vote options (kept for compatibility) */
  .vote-option-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: #fff;
    border: 1px solid rgba(36, 28, 32, 0.1);
    border-radius: 18px;
    color: var(--text-main);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  @media (hover: hover) {
    .vote-option-btn:not(:disabled):hover {
      border-color: rgba(140, 47, 75, 0.45);
      background: var(--wine-tint);
    }
  }

  .vote-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .vote-radio {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--text-dim);
    background: transparent;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .vote-radio.radio-filled {
    border-color: var(--wine);
    background: var(--wine);
    box-shadow: inset 0 0 0 3px #fff;
  }

  .vote-text {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .vote-chosen {
    border-color: var(--wine);
    background: var(--wine-tint);
  }

  .chosen-tag {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--wine);
    background: var(--wine-tint);
    padding: 3px 8px;
    border-radius: 999px;
  }

  .empty-state {
    text-align: center;
    padding: 44px 20px;
  }

  .empty-icon {
    color: var(--wine);
    margin-bottom: 10px;
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 1.45rem;
    font-weight: 600;
  }

  .empty-desc {
    font-size: 0.88rem;
    color: #6b5f64;
    margin-top: 4px;
  }

  /* Quiz recap box */
  .quiz-recap-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 20px;
    margin: 2px 0 4px 0;
  }

  .quiz-recap-box.recap-correct {
    background: rgba(127, 169, 148, 0.14);
    border: 1px solid rgba(127, 169, 148, 0.4);
    color: #2f5f4a;
  }

  .quiz-recap-box.recap-incorrect {
    background: rgba(168, 74, 74, 0.08);
    border: 1px solid rgba(168, 74, 74, 0.28);
    color: #8a3a3f;
  }

  .recap-icon {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .recap-correct .recap-icon {
    background: #7fa994;
    color: #fff;
  }

  .recap-incorrect .recap-icon {
    background: #a84a4a;
    color: #fff;
  }

  .recap-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.9rem;
  }

  .recap-title {
    font-weight: 600;
  }

  .recap-sub {
    font-size: 0.83rem;
    opacity: 0.9;
  }

  .opt-status-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    margin-left: auto;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .opt-status-tag.tag-green {
    background: rgba(127, 169, 148, 0.2);
    color: #2f5f4a;
    border: 1px solid rgba(127, 169, 148, 0.45);
  }

  .opt-status-tag.tag-rose {
    background: rgba(168, 74, 74, 0.12);
    color: #8a3a3f;
    border: 1px solid rgba(168, 74, 74, 0.3);
  }

  .option-btn.done-locked {
    cursor: default;
  }

  .game-card.quiz-done .option-btn:not(.selected):not(.correct) {
    opacity: 0.5;
    background: rgba(36, 28, 32, 0.02);
    border-color: rgba(36, 28, 32, 0.07);
  }

  /* Moment free text input */
  .moment-input-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .moment-textarea {
    width: 100%;
    padding: 14px 16px;
    background: #fff;
    border: 1px solid rgba(36, 28, 32, 0.12);
    border-radius: 20px;
    color: var(--text-main);
    font-family: var(--font-sans);
    font-size: 0.94rem;
    line-height: 1.5;
    resize: vertical;
    min-height: 96px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-sizing: border-box;
  }

  .moment-textarea:focus {
    outline: none;
    border-color: var(--wine);
    box-shadow: 0 0 0 3px rgba(140, 47, 75, 0.14);
  }

  .moment-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 40px;
    flex-wrap: wrap;
  }

  .moment-info {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .moment-hint {
    font-size: 0.8rem;
    color: #6b5f64;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .moment-hint.hint-saved {
    color: #3f7a60;
    font-weight: 600;
  }

  .moment-hint.hint-editing {
    color: var(--wine);
    font-weight: 600;
  }

  .moment-action-btn {
    padding: 10px 20px;
    font-size: 0.86rem;
    font-weight: 700;
    cursor: pointer;
    border: none;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    transition: filter 0.2s ease, opacity 0.2s ease;
  }

  .moment-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-save-modifications {
    background: var(--grad-gold-rose);
    box-shadow: 0 12px 22px -10px rgba(140, 47, 75, 0.55);
  }

  .badge-neutral {
    background: rgba(36, 28, 32, 0.05);
    color: #6b5f64;
    border: 1px solid rgba(36, 28, 32, 0.08);
  }

  .btn-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-right: 6px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .ended-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: linear-gradient(135deg, rgba(233, 201, 143, 0.22) 0%, var(--paper) 80%);
    border: 1px solid rgba(201, 169, 110, 0.35);
    border-radius: 22px;
  }

  .ended-banner-icon {
    color: #a07a35;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ended-banner-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.83rem;
    color: #6b5f64;
  }

  .ended-banner-text strong {
    font-size: 0.9rem;
    color: var(--text-main);
  }

  .ended-notice-inline {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.82rem;
    color: #6b5f64;
    padding: 9px 14px;
    background: rgba(36, 28, 32, 0.04);
    border-radius: 999px;
    font-weight: 500;
  }

  .moment-textarea-locked {
    background: rgba(36, 28, 32, 0.03) !important;
    border-color: rgba(36, 28, 32, 0.08) !important;
    cursor: default;
    color: var(--text-main);
  }

  .couple-hint-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 22px;
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.18);
    box-shadow: none;
    font-size: 0.88rem;
    color: var(--wine-deep);
  }

  .inline-svg-icon {
    vertical-align: -3px;
    color: var(--wine);
  }

  @media (min-width: 900px) {
    .page-title { font-size: 3rem; }
    .cards-list { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    .game-card { padding: 26px; }
  }

  @media (max-width: 600px) {
    .couple-hint-banner {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn-spinner { animation-duration: 2s; }
    .option-btn, .sub-btn { transition: none; }
  }
</style>
