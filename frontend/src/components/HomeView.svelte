<script>
  import { appState } from '../lib/state.svelte.js';
  import { eventTimer } from '../lib/timer.svelte.js';
  import { formatName } from '../lib/formatters.js';

  const completedHunts = $derived(
    appState.challenges.filter(c => c.challenge_type === 'hunt' && appState.mySubmissionsByChallenge[c.id]).length
  );
  const totalHunts = $derived(
    appState.challenges.filter(c => c.challenge_type === 'hunt').length
  );

  const completedQuiz = $derived(
    appState.challenges.filter(c => c.challenge_type === 'quiz' && appState.mySubmissionsByChallenge[c.id]).length
  );
  const totalQuiz = $derived(
    appState.challenges.filter(c => c.challenge_type === 'quiz').length
  );

  const hasVoted = $derived(
    appState.challenges.some(c => c.challenge_type === 'vote' && appState.mySubmissionsByChallenge[c.id])
  );

  const rawSpouse1 = import.meta.env.VITE_SPOUSE_1 || import.meta.env.VITE_NOME_1 || '';
  const rawSpouse2 = import.meta.env.VITE_SPOUSE_2 || import.meta.env.VITE_NOME_2 || '';
  const spouse1 = formatName(rawSpouse1);
  const spouse2 = formatName(rawSpouse2);
  const weddingTitle = spouse1 && spouse2
    ? `Matrimonio di ${spouse1} & ${spouse2}`
    : (spouse1 || spouse2 ? `Matrimonio di ${spouse1 || spouse2}` : 'Matrimonio degli Sposi');
</script>

<div class="home-container">
  <!-- Greeting Header -->
  <div class="greeting-section">
    <div class="greeting-row">
      <div class="greeting-text">
        <div class="greeting-subtitle">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>
          {weddingTitle}
        </div>
        <h1 class="greeting-title font-serif">
          Ciao, <span class="gold-gradient-text">{formatName(appState.user?.first_name) || 'Invitato'}!</span>
        </h1>
      </div>

      <button class="rules-btn" onclick={() => appState.showInstructionsModal = true} title="Rivedi le regole e le istruzioni">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rules-icon"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        <span>Regole</span>
      </button>
    </div>

    {#if eventTimer.status === 'in_progress'}
      <div class="time-remaining-pill">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="timer-live-icon"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Termina tra <strong class="timer-countdown-text">{eventTimer.toEnd.formatted}</strong></span>
      </div>
    {:else if eventTimer.status === 'ended'}
      <div class="time-remaining-pill pill-ended">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 10"/></svg>
        <span>Tempo scaduto · Giochi conclusi 🏆</span>
      </div>
    {/if}
  </div>

  <!-- Hero Banner: Countdown or Points/Rank Card -->
  {#if eventTimer.status === 'before_start'}
    <div class="glass-card glass-card-gold hero-card countdown-hero-card">
      <div class="hero-bg-glow"></div>
      <div class="countdown-hero-content">
        <div class="countdown-hero-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          In attesa dell'inizio
        </div>
        <h3 class="countdown-hero-title">I giochi inizieranno tra</h3>
        <div class="countdown-timer-grid">
          <div class="countdown-unit">
            <span class="countdown-value font-serif">{eventTimer.toStart.hours}</span>
            <span class="countdown-label">Ore</span>
          </div>
          <span class="countdown-sep">:</span>
          <div class="countdown-unit">
            <span class="countdown-value font-serif">{eventTimer.toStart.minutes}</span>
            <span class="countdown-label">Min</span>
          </div>
          <span class="countdown-sep">:</span>
          <div class="countdown-unit">
            <span class="countdown-value font-serif">{eventTimer.toStart.seconds}</span>
            <span class="countdown-label">Sec</span>
          </div>
        </div>
        <p class="countdown-hero-note">Preparati a sfidare gli altri invitati e scalare la classifica! ✨</p>
      </div>
    </div>
  {:else}
    <div class="glass-card glass-card-gold hero-card">
      <div class="hero-bg-glow"></div>
      <div class="hero-content">
        <div class="hero-left">
          <div class="hero-label">Il Tuo Punteggio</div>
          <div class="hero-points font-serif">
            {appState.user?.total_points || 0}
            <span class="points-text">PT</span>
          </div>
        </div>

        <div class="hero-right">
          {#if appState.myRank}
            <div class="rank-badge rank-{appState.myRank <= 3 ? appState.myRank : 'other'}">
              <span class="rank-icon">
                {#if appState.myRank === 1}
                  🥇
                {:else if appState.myRank === 2}
                  🥈
                {:else if appState.myRank === 3}
                  🥉
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                {/if}
              </span>
              <span class="rank-text">{appState.myRank}° Posto</span>
            </div>
          {:else}
            <div class="rank-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              <span class="rank-text">In Gioco</span>
            </div>
          {/if}
          <button class="rank-link" onclick={() => appState.activeTab = 'leaderboard'}>
            Vedi Classifica →
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Game Modes Grid -->
  <div class="section-header">
    <h2 class="section-title font-serif">Le Tue Attività</h2>
    <span class="badge badge-gold">Guadagna Punti</span>
  </div>

  <div class="games-grid">
    <!-- Foto Libera -->
    <button class="game-card glass-card" onclick={() => appState.activeTab = 'gallery'}>
      <div class="game-icon-wrapper icon-photo">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
      </div>
      <div class="game-info">
        <div class="game-header-row">
          <span class="game-title">Galleria Foto</span>
          {#if eventTimer.status === 'before_start'}
            <span class="badge badge-neutral">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Alle {eventTimer.startTimeFormatted || '12:00'}
            </span>
          {:else}
            <span class="badge badge-gold">+10 pt cad.</span>
          {/if}
        </div>
        <p class="game-desc">Carica selfie e scatti della giornata nella galleria comune.</p>
      </div>
      <div class="game-arrow">→</div>
    </button>

    <!-- Caccia al Tesoro -->
    <button class="game-card glass-card" onclick={() => appState.activeTab = 'hunt'}>
      <div class="game-icon-wrapper icon-hunt">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
      </div>
      <div class="game-info">
        <div class="game-header-row">
          <span class="game-title">Caccia al Tesoro</span>
          {#if eventTimer.status === 'before_start'}
            <span class="badge badge-neutral">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Alle {eventTimer.startTimeFormatted || '12:00'}
            </span>
          {:else}
            <span class="badge badge-purple">{completedHunts}/{totalHunts} Fatte</span>
          {/if}
        </div>
        <p class="game-desc">Trova gli indizi, fotografa gli invitati e completa le missioni.</p>
      </div>
      <div class="game-arrow">→</div>
    </button>

    <!-- Quiz sugli Sposi -->
    <button class="game-card glass-card" onclick={() => { appState.quizSubTab = 'quiz'; appState.activeTab = 'quiz'; }}>
      <div class="game-icon-wrapper icon-quiz">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
      </div>
      <div class="game-info">
        <div class="game-header-row">
          <span class="game-title">Quiz sugli Sposi</span>
          {#if eventTimer.status === 'before_start'}
            <span class="badge badge-neutral">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Alle {eventTimer.startTimeFormatted || '12:00'}
            </span>
          {:else}
            <span class="badge badge-rose">{completedQuiz}/{totalQuiz} Risolti</span>
          {/if}
        </div>
        <p class="game-desc">Dimostra quanto conosci bene gli sposi e vinci fino a 30 pt a quiz!</p>
      </div>
      <div class="game-arrow">→</div>
    </button>

    <!-- Momenti Migliori -->
    <button class="game-card glass-card" onclick={() => { appState.quizSubTab = 'vote'; appState.activeTab = 'quiz'; }}>
      <div class="game-icon-wrapper icon-vote">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
      </div>
      <div class="game-info">
        <div class="game-header-row">
          <span class="game-title">Momenti Migliori</span>
          {#if eventTimer.status === 'before_start'}
            <span class="badge badge-neutral">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Alle {eventTimer.startTimeFormatted || '12:00'}
            </span>
          {:else}
            <span class="badge badge-green">
              {#if hasVoted}
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><polyline points="20 6 9 17 4 12"/></svg>
                Compilato
              {:else}
                Da Compilare
              {/if}
            </span>
          {/if}
        </div>
        <p class="game-desc">Condividi pensieri e ricordi per i momenti più belli ed emozionanti della festa.</p>
      </div>
      <div class="game-arrow">→</div>
    </button>
  </div>
</div>

<style>
  .home-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .inline-icon {
    display: inline;
    vertical-align: -2px;
    margin-right: 2px;
  }

  .greeting-section {
    padding: 6px 4px 0 4px;
  }

  .greeting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .greeting-text {
    flex: 1;
    min-width: 0;
  }

  .rules-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 13px;
    border-radius: var(--radius-full);
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--gold-dark);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(201, 169, 110, 0.08);
  }

  .rules-btn:hover {
    background: rgba(201, 169, 110, 0.22);
    border-color: var(--gold-primary);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(201, 169, 110, 0.22);
  }

  .rules-icon {
    color: var(--gold-primary);
  }

  .greeting-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .greeting-title {
    font-size: 1.65rem;
    font-weight: 800;
  }

  .time-remaining-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 8px;
    padding: 5px 14px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.3);
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    color: var(--gold-dark);
    font-weight: 500;
  }

  .timer-live-icon {
    color: var(--gold-primary);
    animation: pulse-soft 2s infinite ease-in-out;
  }

  .timer-countdown-text {
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-main);
  }

  .pill-ended {
    background: rgba(160, 168, 180, 0.12);
    border-color: rgba(160, 168, 180, 0.25);
    color: var(--text-muted);
  }

  @keyframes pulse-soft {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(0.92); }
  }

  .hero-card {
    position: relative;
    padding: 22px 20px;
    overflow: hidden;
  }

  .countdown-hero-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 26px 20px 22px 20px;
  }

  .countdown-hero-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .countdown-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.14);
    border: 1px solid rgba(201, 169, 110, 0.32);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    margin-bottom: 8px;
  }

  .countdown-hero-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-main);
    margin: 0;
  }

  .countdown-timer-grid {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 16px 0 12px 0;
  }

  .countdown-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 58px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(201, 169, 110, 0.3);
    border-radius: var(--radius-md);
    box-shadow: 0 2px 10px rgba(184, 150, 92, 0.08);
  }

  .countdown-value {
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1;
    color: var(--gold-dark);
  }

  .countdown-label {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-top: 3px;
  }

  .countdown-sep {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--gold-primary);
    line-height: 1;
    margin-bottom: 12px;
    opacity: 0.8;
  }

  .countdown-hero-note {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 4px 0 0 0;
    max-width: 290px;
    line-height: 1.4;
  }

  .hero-bg-glow {
    position: absolute;
    top: -50%;
    right: -20%;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(201, 169, 110, 0.15) 0%, transparent 70%);
    pointer-events: none;
  }

  .hero-content {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .hero-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
    margin-bottom: 4px;
  }

  .hero-points {
    font-size: 2.8rem;
    font-weight: 800;
    line-height: 1;
    color: var(--gold-dark);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .points-text {
    font-size: 1.1rem;
    color: var(--gold-primary);
    font-weight: 700;
  }

  .hero-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .rank-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(201, 169, 110, 0.08);
    border: 1px solid rgba(201, 169, 110, 0.2);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .rank-number {
    font-weight: 800;
    color: var(--gold-dark);
  }

  .rank-1 {
    border-color: rgba(201, 169, 110, 0.5);
    background: rgba(201, 169, 110, 0.12);
    color: var(--gold-dark);
  }

  .rank-2 {
    border-color: rgba(160, 168, 180, 0.4);
    background: rgba(160, 168, 180, 0.08);
    color: var(--text-main);
  }

  .rank-3 {
    border-color: rgba(186, 134, 87, 0.4);
    background: rgba(186, 134, 87, 0.1);
    color: #8a6d3b;
  }

  .rank-other {
    border-color: var(--border-subtle);
    background: var(--bg-surface-elevated);
    color: var(--text-muted);
  }

  .rank-link {
    background: transparent;
    border: none;
    color: var(--gold-dark);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;
    padding: 0 4px;
  }

  .section-title {
    font-size: 1.15rem;
    font-weight: 700;
  }

  .games-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .game-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    text-align: left;
    width: 100%;
    cursor: pointer;
  }

  .game-icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-photo {
    background: rgba(201, 169, 110, 0.1);
    border: 1px solid rgba(201, 169, 110, 0.22);
    color: var(--gold-dark);
  }

  .icon-hunt {
    background: rgba(155, 142, 196, 0.1);
    border: 1px solid rgba(155, 142, 196, 0.22);
    color: var(--accent-purple);
  }

  .icon-quiz {
    background: rgba(212, 132, 154, 0.1);
    border: 1px solid rgba(212, 132, 154, 0.22);
    color: var(--rose-primary);
  }

  .icon-vote {
    background: rgba(123, 184, 158, 0.1);
    border: 1px solid rgba(123, 184, 158, 0.22);
    color: var(--accent-emerald);
  }

  .game-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .game-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .game-title {
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .game-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.35;
  }

  .game-arrow {
    color: var(--text-dim);
    font-size: 1.1rem;
    transition: transform 0.2s;
  }

  .game-card:hover .game-arrow {
    transform: translateX(3px);
    color: var(--gold-primary);
  }
</style>
