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
        appState.showToast(`Risposta corretta, hai guadagnato ${pts} punti! 🎉`, 'success', pts);
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
        appState.showToast(`Momento salvato! Hai guadagnato ${pts} punti! 🎉`, 'success', pts);
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
        <h1 class="page-title font-serif gold-gradient-text">Quiz sugli Sposi</h1>
        <p class="page-desc">Rispondi alle domande e dimostra quanto conosci gli sposi!</p>
      </div>

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
                <span class="badge badge-purple">+{quiz.points} PT</span>
                {#if isDone}
                  <span class="badge {isCorrect ? 'badge-green' : 'badge-rose'}">
                    {isCorrect ? `✓ Risposta Esatta (+${quiz.points} PT)` : '✗ Risposta Errata (0 PT)'}
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
                      La tua risposta: <strong>{myAnswer || 'N/D'}</strong>{myOptionObj ? ` — ${myOptionObj.text}` : ''}
                    </div>
                    <div class="recap-sub">
                      {#if isCorrect}
                        Risposta esatta! Punti assegnati: +{quiz.points} PT
                      {:else}
                        Risposta non corretta. Quella corretta era: <strong>{correctAnswer || 'N/D'}</strong>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Options Grid -->
              <div class="options-list">
                {#each options as opt}
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
                    <span class="opt-letter">{opt.id}</span>
                    <span class="opt-text">{opt.text}</span>
                    {#if isDone}
                      {#if isSelected && isCorrect}
                        <span class="opt-status-tag tag-green">La tua risposta ✓</span>
                      {:else if isSelected && !isCorrect}
                        <span class="opt-status-tag tag-rose">La tua risposta ✗</span>
                      {:else if isCorrectOpt}
                        <span class="opt-status-tag tag-green">Risposta corretta</span>
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
        <h1 class="page-title font-serif rose-gradient-text">Momenti Migliori</h1>
        <p class="page-desc">Condividi pensieri, ricordi ed emozioni della festa! Puoi compilare e modificare le risposte fino alla fine dell'evento.</p>
      </div>

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
                <span class="badge badge-gold">+{vote.points} PT</span>
                {#if isAnswered}
                  <span class="badge badge-green">✓ Risposta salvata</span>
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
    gap: 18px;
  }

  .sub-nav {
    display: flex;
    background: var(--bg-surface);
    padding: 4px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-sm);
  }

  .sub-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sub-btn.active {
    background: linear-gradient(135deg, rgba(201, 169, 110, 0.12) 0%, rgba(201, 169, 110, 0.2) 100%);
    color: var(--gold-dark);
    border: 1px solid rgba(201, 169, 110, 0.3);
    font-weight: 700;
  }

  .section-box {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header-box {
    padding: 0 4px;
  }

  .page-title {
    font-size: 1.55rem;
    font-weight: 800;
  }

  .page-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.4;
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .game-card {
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .quiz-question {
    font-size: 1.15rem;
    color: var(--text-main);
    line-height: 1.35;
  }

  .quiz-subtext {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg-surface-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-main);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }

  .option-btn:not(:disabled):hover {
    border-color: rgba(201, 169, 110, 0.3);
    background: rgba(201, 169, 110, 0.04);
  }

  .option-btn:not(:disabled):active {
    transform: scale(0.98);
    border-color: var(--gold-primary);
  }

  .opt-letter {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.82rem;
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .opt-text {
    font-size: 0.9rem;
    font-weight: 500;
    flex: 1;
  }

  .option-btn.correct {
    background: rgba(123, 184, 158, 0.1);
    border-color: rgba(123, 184, 158, 0.5);
    color: #3a7d5e;
  }

  .option-btn.correct .opt-letter {
    background: var(--accent-emerald);
    color: #fff;
  }

  .option-btn.incorrect {
    background: rgba(212, 132, 154, 0.1);
    border-color: rgba(212, 132, 154, 0.5);
    color: var(--rose-primary);
  }

  .option-btn.incorrect .opt-letter {
    background: var(--rose-primary);
    color: #fff;
  }

  /* Vote options */
  .vote-option-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--bg-surface-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-main);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }

  .vote-option-btn:not(:disabled):hover {
    border-color: rgba(201, 169, 110, 0.3);
    background: rgba(201, 169, 110, 0.04);
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
    border-color: var(--gold-primary);
    background: var(--gold-primary);
    box-shadow: inset 0 0 0 3px #fff;
  }

  .vote-text {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .vote-chosen {
    border-color: rgba(201, 169, 110, 0.4);
    background: linear-gradient(135deg, rgba(201, 169, 110, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%);
    box-shadow: 0 2px 10px rgba(201, 169, 110, 0.1);
  }

  .chosen-tag {
    font-size: 0.72rem;
    font-weight: 800;
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.12);
    padding: 3px 8px;
    border-radius: var(--radius-full);
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    color: var(--accent-purple);
    margin-bottom: 10px;
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .empty-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* Quiz recap box */
  .quiz-recap-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    margin: 2px 0 6px 0;
  }

  .quiz-recap-box.recap-correct {
    background: rgba(123, 184, 158, 0.12);
    border: 1px solid rgba(123, 184, 158, 0.35);
    color: #2b6a4d;
  }

  .quiz-recap-box.recap-incorrect {
    background: rgba(212, 132, 154, 0.12);
    border: 1px solid rgba(212, 132, 154, 0.35);
    color: #9c3f56;
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
    background: #3a7d5e;
    color: #ffffff;
  }

  .recap-incorrect .recap-icon {
    background: var(--rose-primary);
    color: #ffffff;
  }

  .recap-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.88rem;
  }

  .recap-title {
    font-weight: 700;
  }

  .recap-sub {
    font-size: 0.82rem;
    opacity: 0.9;
  }

  .opt-status-tag {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: var(--radius-full);
    margin-left: auto;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .opt-status-tag.tag-green {
    background: rgba(123, 184, 158, 0.2);
    color: #2b6a4d;
    border: 1px solid rgba(123, 184, 158, 0.4);
  }

  .opt-status-tag.tag-rose {
    background: rgba(212, 132, 154, 0.2);
    color: #9c3f56;
    border: 1px solid rgba(212, 132, 154, 0.4);
  }

  .option-btn.done-locked {
    cursor: default;
  }

  .game-card.quiz-done .option-btn:not(.selected):not(.correct) {
    opacity: 0.55;
    background: rgba(0, 0, 0, 0.02);
    border-color: var(--border-subtle);
  }

  /* Moment free text input */
  .moment-input-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 6px;
  }

  .moment-textarea {
    width: 100%;
    padding: 12px 14px;
    background: var(--bg-surface-elevated);
    border: 1.5px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-main);
    font-family: inherit;
    font-size: 0.92rem;
    line-height: 1.45;
    resize: vertical;
    min-height: 90px;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .moment-textarea:focus {
    outline: none;
    border-color: var(--gold-primary);
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.15);
  }

  .moment-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
    min-height: 38px;
    flex-wrap: wrap;
  }

  .moment-info {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .moment-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .moment-hint.hint-saved {
    color: #2b6a4d;
    font-weight: 600;
  }

  .moment-hint.hint-editing {
    color: var(--rose-primary);
    font-weight: 600;
  }

  .moment-action-btn {
    padding: 8px 18px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    border-radius: var(--radius-sm);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    transition: all 0.2s ease;
  }

  .btn-save-modifications {
    background: linear-gradient(135deg, #c9a96e 0%, #b8985e 100%);
    box-shadow: 0 2px 8px rgba(201, 169, 110, 0.25);
  }

  .badge-neutral {
    background: rgba(0, 0, 0, 0.05);
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
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
    padding: 14px 16px;
    background: linear-gradient(135deg, rgba(212, 163, 115, 0.1) 0%, rgba(255, 255, 255, 0.85) 100%);
    border: 1px solid rgba(212, 163, 115, 0.3);
    border-radius: var(--radius-md);
  }

  .ended-banner-icon {
    color: var(--accent-gold);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ended-banner-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.82rem;
    color: var(--text-main);
  }

  .ended-banner-text strong {
    font-size: 0.88rem;
    color: var(--accent-gold);
  }

  .ended-notice-inline {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.82rem;
    color: var(--text-muted);
    padding: 8px 12px;
    background: rgba(140, 120, 110, 0.08);
    border-radius: var(--radius-sm);
    margin-top: 4px;
    font-weight: 500;
  }

  .moment-textarea-locked {
    background: rgba(0, 0, 0, 0.02) !important;
    border-color: rgba(140, 120, 110, 0.2) !important;
    cursor: default;
    color: var(--text-main);
  }
</style>
