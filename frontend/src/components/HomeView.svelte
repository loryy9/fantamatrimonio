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

  // overall completion, drawn as the ring next to the score
  const doneAll = $derived(
    appState.challenges.filter(c => appState.mySubmissionsByChallenge[c.id]).length
  );
  const totalAll = $derived(appState.challenges.length);
  const overall = $derived(totalAll ? doneAll / totalAll : 0);
  const RING = 2 * Math.PI * 34;

  const rawSpouse1 = appState.event?.spouse1_name || import.meta.env.VITE_SPOUSE_1 || import.meta.env.VITE_NOME_1 || '';
  const rawSpouse2 = appState.event?.spouse2_name || import.meta.env.VITE_SPOUSE_2 || import.meta.env.VITE_NOME_2 || '';
  const spouse1 = formatName(rawSpouse1);
  const spouse2 = formatName(rawSpouse2);
  const coupleNames = spouse1 && spouse2 ? `${spouse1} & ${spouse2}` : (spouse1 || spouse2 || 'Gli Sposi');

  const beforeStart = $derived(eventTimer.status === 'before_start');
  const lockedBadge = $derived(`Alle ${eventTimer.startTimeFormatted || '12:00'}`);

  const tiles = $derived([
    {
      id: 'hunt',
      title: 'Caccia al Tesoro',
      subtitle: 'Trova gli indizi sparsi alla festa',
      badge: beforeStart ? lockedBadge : `${completedHunts}/${totalHunts} fatte`,
      progress: beforeStart || !totalHunts ? null : completedHunts / totalHunts,
      accent: '#e9c98f',
      icon: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>',
      go: () => { appState.setGameTab('hunt'); }
    },
    {
      id: 'gallery',
      title: 'Galleria Foto',
      subtitle: 'Carica i tuoi scatti',
      badge: beforeStart ? lockedBadge : '+10 pt cad.',
      progress: null,
      accent: '#c9627f',
      icon: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
      go: () => { appState.setGameTab('gallery'); }
    },
    {
      id: 'quiz',
      title: 'Quiz Sposi',
      subtitle: 'Quanto conosci gli sposi?',
      badge: beforeStart ? lockedBadge : `${completedQuiz}/${totalQuiz} risolti`,
      progress: beforeStart || !totalQuiz ? null : completedQuiz / totalQuiz,
      accent: '#c9a96e',
      icon: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
      go: () => { appState.quizSubTab = 'quiz'; appState.setGameTab('quiz'); }
    },
    {
      id: 'vote',
      title: 'Momenti Migliori',
      subtitle: 'Condividi un ricordo',
      badge: beforeStart ? lockedBadge : (hasVoted ? 'Compilato' : 'Da compilare'),
      progress: null,
      accent: '#7fa994',
      icon: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
      go: () => { appState.quizSubTab = 'vote'; appState.setGameTab('quiz'); }
    }
  ]);
</script>

<div class="home-container">
  {#if appState.isCouple}
    <div class="sposi-preview-banner">
      <div class="sposi-preview-info">
        <span class="sposi-crown">👑</span>
        <div>
          <strong>Modalità Anteprima Sposi</strong>
          <span class="sposi-preview-sub">Stai guardando la festa come la vedono gli invitati</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm sposi-return-btn" onclick={() => appState.setGameTab('manage')}>
        Console Sposi →
      </button>
    </div>
  {/if}

  <section class="intro">
    <div class="intro-text">
      <div class="couple font-serif"><span class="rule"></span>{coupleNames}</div>
      <h1 class="title font-serif">Ciao, {formatName(appState.user?.first_name) || 'Invitato'}!</h1>
      <button class="rules-link" onclick={() => appState.showInstructionsModal = true} title="Rivedi le regole e le istruzioni">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        Come si gioca
      </button>
    </div>

    {#if beforeStart}
      <div class="status">
        <div class="status-label">I giochi iniziano tra</div>
        <div class="countdown">
          <div class="cd-unit">
            <span class="cd-value font-serif">{eventTimer.toStart.hours}</span>
            <span class="cd-label">ore</span>
          </div>
          <div class="cd-unit">
            <span class="cd-value font-serif">{eventTimer.toStart.minutes}</span>
            <span class="cd-label">minuti</span>
          </div>
          <div class="cd-unit">
            <span class="cd-value font-serif">{eventTimer.toStart.seconds}</span>
            <span class="cd-label">secondi</span>
          </div>
        </div>
      </div>
    {:else}
      <div class="status">
        <div class="status-row">
          <div class="ring" role="img" aria-label={`${doneAll} attività su ${totalAll} completate`}>
            <svg viewBox="0 0 80 80" width="76" height="76">
              <circle class="ring-track" cx="40" cy="40" r="34" />
              <circle class="ring-fill" cx="40" cy="40" r="34"
                stroke-dasharray={RING}
                stroke-dashoffset={RING * (1 - overall)} />
            </svg>
            <span class="ring-text font-serif">{Math.round(overall * 100)}%</span>
          </div>
          <div class="score-block">
            <div class="status-label">Il tuo punteggio</div>
            <div class="score font-serif">{appState.user?.total_points || 0}<span class="pt">pt</span></div>
            {#if eventTimer.status === 'in_progress'}
              <div class="status-note">Termina tra {eventTimer.toEnd.formatted}</div>
            {:else if eventTimer.status === 'ended'}
              <div class="status-note strong">Tempo scaduto</div>
            {/if}
          </div>
          <button class="rank-btn" onclick={() => appState.setGameTab('leaderboard')} aria-label="Apri la classifica">
            <span>{#if appState.myRank}{appState.myRank}° · {/if}Classifica</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </button>
        </div>
      </div>
    {/if}
  </section>

  {#if appState.isCouple}
    <div class="couple-admin-banner">
      <div class="banner-left">
        <span class="banner-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
        </span>
        <div>
          <strong class="banner-title">Pannello di Controllo Sposi</strong>
          <p class="banner-sub">Gestisci quiz, caccia fotografica, momenti e impostazioni.</p>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick={() => appState.setGameTab('manage')}>
        Console Sposi →
      </button>
    </div>
  {/if}

  <section class="activities">
    <h2 class="section-title font-serif">Le tue attività</h2>

    <div class="bento">
      {#each tiles as tile (tile.id)}
        <button class="tile tile-{tile.id}" style="--accent: {tile.accent}" onclick={tile.go}>
          <svg class="watermark" xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">{@html tile.icon}</svg>

          <div class="tile-top">
            <span class="icon-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">{@html tile.icon}</svg>
            </span>
            <span class="tile-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
            </span>
          </div>

          <div class="tile-bottom">
            <span class="tile-title font-serif">{tile.title}</span>
            <span class="tile-subtitle">{tile.subtitle}</span>
            <span class="tile-chip">{tile.badge}</span>
            {#if tile.progress !== null}
              <span class="tile-progress" aria-hidden="true"><span style="width: {Math.round(tile.progress * 100)}%"></span></span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .home-container {
    --ink: #241c20;
    --ink-soft: #6b5f64;
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding-top: 8px;
  }

  /* ---------- Intro ---------- */
  .intro {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .couple {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--wine);
    font-style: italic;
    font-size: 1.2rem;
    font-weight: 500;
  }

  .couple .rule {
    flex: none;
    width: 28px;
    height: 1px;
    background: var(--wine);
    opacity: 0.6;
  }

  .title {
    margin-top: 4px;
    color: var(--ink);
    font-size: clamp(3rem, 15vw, 4rem);
    font-weight: 600;
    line-height: 0.96;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
    text-wrap: balance;
  }

  .rules-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
    padding: 0;
    border: none;
    background: none;
    color: var(--ink-soft);
    font-family: var(--font-sans);
    font-size: 0.84rem;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: rgba(140, 47, 75, 0.35);
    text-underline-offset: 4px;
    cursor: pointer;
  }

  .rules-link:hover {
    color: var(--wine);
  }

  .rules-link:focus-visible,
  .rank-btn:focus-visible,
  .tile:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 3px;
  }

  /* ---------- Status ---------- */
  .status {
    padding: 18px;
    border-radius: 26px;
    background: #fff;
    border: 1px solid rgba(36, 28, 32, 0.07);
    box-shadow: 0 18px 36px -24px rgba(106, 32, 55, 0.35);
  }

  .status-label {
    color: var(--ink-soft);
    font-size: 0.82rem;
    font-weight: 500;
  }

  .status-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px 16px;
  }

  .ring {
    position: relative;
    flex: none;
    width: 76px;
    height: 76px;
  }

  .ring svg {
    display: block;
    transform: rotate(-90deg);
  }

  .ring-track,
  .ring-fill {
    fill: none;
    stroke-width: 5;
  }

  .ring-track {
    stroke: var(--wine-tint);
  }

  .ring-fill {
    stroke: var(--wine);
    stroke-linecap: round;
    transition: stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ring-text {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--wine);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .score-block {
    flex: 1 1 120px;
    min-width: 0;
  }

  .score {
    color: var(--ink);
    font-size: 2.8rem;
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: lining-nums tabular-nums;
  }

  .score .pt {
    margin-left: 6px;
    color: var(--wine);
    font-size: 1.15rem;
    font-weight: 500;
    font-style: italic;
  }

  .status-note {
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 0.76rem;
  }

  .status-note.strong {
    color: var(--ink);
    font-weight: 600;
  }

  .rank-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex: 1 1 100%;
    padding: 13px 18px;
    border: none;
    border-radius: 999px;
    background: var(--grad-gold-rose);
    color: #fff;
    font-family: var(--font-sans);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 10px 20px -8px rgba(140, 47, 75, 0.55);
    transition: transform 0.15s ease, box-shadow 0.2s ease;
  }

  .rank-btn svg {
    transition: transform 0.2s ease;
  }

  .rank-btn:active {
    transform: scale(0.97);
  }

  .countdown {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 10px;
  }

  .cd-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 0;
  }

  .cd-unit + .cd-unit {
    border-left: 1px solid rgba(36, 28, 32, 0.1);
  }

  .cd-value {
    color: var(--wine);
    font-size: clamp(2.8rem, 15vw, 3.6rem);
    font-weight: 500;
    line-height: 1;
    font-variant-numeric: lining-nums tabular-nums;
  }

  .cd-label {
    margin-top: 6px;
    color: var(--ink-soft);
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1rem;
  }

  /* one orchestrated entrance */
  @media (prefers-reduced-motion: no-preference) {
    .intro-text,
    .status {
      animation: settle 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .status {
      animation-delay: 0.12s;
    }
  }

  @keyframes settle {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: none; }
  }

  /* ---------- Couple admin banner ---------- */
  .couple-admin-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border-radius: 22px;
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.18);
  }

  .banner-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .banner-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: #fff;
    background: var(--wine);
  }

  .banner-title {
    display: block;
    font-size: 0.98rem;
    color: var(--wine-deep);
  }

  .banner-sub {
    margin: 2px 0 0;
    color: var(--ink-soft);
    font-size: 0.82rem;
  }

  @media (max-width: 600px) {
    .couple-admin-banner {
      flex-direction: column;
      align-items: stretch;
    }
    .couple-admin-banner :global(.btn) {
      width: 100%;
    }
  }

  /* ---------- Activities (bento) ---------- */
  .section-title {
    margin-bottom: 14px;
    color: var(--ink);
    font-size: 2rem;
    font-weight: 600;
    line-height: 1.1;
  }

  .bento {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .tile {
    --tint: color-mix(in srgb, var(--accent) 16%, #fff);
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 22px;
    min-height: 188px;
    padding: 16px;
    overflow: hidden;
    text-align: left;
    cursor: pointer;
    font-family: var(--font-sans);
    color: var(--ink);
    background: linear-gradient(160deg, var(--tint), #fff 80%);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 28px;
    box-shadow: 0 16px 28px -20px color-mix(in srgb, var(--accent) 80%, #3a1a28);
    transition: transform 0.18s ease, box-shadow 0.25s ease;
  }

  .tile:active {
    transform: scale(0.97);
  }

  .tile-hunt,
  .tile-vote {
    grid-column: span 2;
  }

  /* the single bold element: the featured tile is solid wine */
  .tile-hunt {
    min-height: 236px;
    padding: 22px;
    color: #fff;
    background:
      radial-gradient(90% 90% at 100% 0%, rgba(233, 201, 143, 0.28), transparent 62%),
      linear-gradient(150deg, var(--wine-deep), var(--wine) 70%, #a33a58);
    border-color: transparent;
    border-radius: 34px 34px 10px 34px;
    box-shadow: 0 26px 40px -22px rgba(106, 32, 55, 0.8);
  }

  .watermark {
    position: absolute;
    z-index: -1;
    right: -28px;
    bottom: -34px;
    color: var(--accent);
    opacity: 0.16;
    pointer-events: none;
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
  }

  .tile-hunt .watermark {
    right: -20px;
    bottom: -26px;
    width: 220px;
    height: 220px;
    opacity: 0.16;
  }

  .tile-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .icon-badge {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: #fff;
    background: var(--accent);
    box-shadow: 0 8px 16px -6px color-mix(in srgb, var(--accent) 85%, #000);
  }

  .tile-hunt .icon-badge {
    color: var(--wine-deep);
  }

  .tile-arrow {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--ink-soft);
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
  }

  .tile-hunt .tile-arrow {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .tile-bottom {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }

  .tile-title {
    font-size: 1.45rem;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
  }

  .tile-hunt .tile-title {
    font-size: 2.1rem;
    max-width: 12ch;
  }

  .tile-subtitle {
    margin-top: 5px;
    color: var(--ink-soft);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  .tile-hunt .tile-subtitle {
    color: rgba(255, 255, 255, 0.76);
    font-size: 0.88rem;
  }

  .tile-chip {
    margin-top: 12px;
    padding: 5px 11px;
    border-radius: 999px;
    color: var(--ink);
    background: color-mix(in srgb, var(--accent) 22%, #fff);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    font-size: 0.72rem;
    font-weight: 700;
  }

  .tile-hunt .tile-chip {
    color: #fff;
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .tile-progress {
    display: block;
    width: 100%;
    height: 4px;
    margin-top: 12px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    overflow: hidden;
  }

  .tile-hunt .tile-progress {
    background: rgba(255, 255, 255, 0.18);
  }

  .tile-progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: color-mix(in srgb, var(--accent) 85%, #4a2a18);
    transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tile-hunt .tile-progress > span {
    background: var(--accent);
  }

  /* ============================
     MEDIA QUERIES
     ============================ */

  @media (min-width: 900px) {
    .home-container {
      gap: 44px;
      padding-top: 20px;
    }

    .intro {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(340px, 440px);
      align-items: end;
      gap: 48px;
    }

    .title {
      font-size: clamp(4.2rem, 6vw, 6rem);
    }

    .couple {
      font-size: 1.45rem;
    }

    .status {
      padding: 24px;
    }

    .activities {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
    }

    .section-title {
      margin-bottom: 20px;
      font-size: 2.6rem;
    }

    .couple-admin-banner {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
    }

    /* editorial bento: tall featured tile + three smaller ones */
    .bento {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: repeat(2, 200px);
      gap: 20px;
    }

    .tile {
      min-height: 0;
      padding: 22px;
      border-radius: 32px;
    }

    .tile-hunt {
      grid-column: 1 / 3;
      grid-row: 1 / 3;
      padding: 32px;
      border-radius: 44px 44px 12px 44px;
    }

    .tile-gallery {
      grid-column: 3 / 5;
      grid-row: 1;
    }

    .tile-quiz {
      grid-column: 3;
      grid-row: 2;
    }

    .tile-vote {
      grid-column: 4;
      grid-row: 2;
    }

    .tile-title {
      font-size: 1.7rem;
    }

    .tile-hunt .tile-title {
      font-size: 3.2rem;
      max-width: 10ch;
    }

    .tile-hunt .tile-subtitle {
      font-size: 1rem;
    }

    .tile-hunt .watermark {
      width: 340px;
      height: 340px;
    }

    .tile-hunt .icon-badge {
      width: 54px;
      height: 54px;
    }
  }

  /* hover only on real pointers */
  @media (hover: hover) and (min-width: 900px) {
    .tile:hover {
      transform: translateY(-5px);
      box-shadow: 0 28px 40px -20px color-mix(in srgb, var(--accent) 85%, #3a1a28);
    }

    .tile:hover .tile-arrow {
      color: #fff;
      background: var(--accent);
      transform: translate(2px, -2px);
    }

    .tile:hover .watermark {
      opacity: 0.26;
      transform: rotate(-8deg) scale(1.07);
    }

    .rank-btn:hover {
      box-shadow: 0 14px 26px -8px rgba(140, 47, 75, 0.7);
    }

    .rank-btn:hover svg {
      transform: translateX(3px);
    }
  }

  .sposi-preview-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 18px;
    margin-bottom: 24px;
    background: linear-gradient(135deg, rgba(201, 169, 110, 0.16), rgba(140, 47, 75, 0.08));
    border: 1px solid rgba(201, 169, 110, 0.4);
    border-radius: var(--radius-md, 16px);
  }

  .sposi-preview-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sposi-crown {
    font-size: 1.4rem;
  }

  .sposi-preview-sub {
    display: block;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .sposi-return-btn {
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (max-width: 520px) {
    .sposi-preview-banner {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .sposi-return-btn {
      width: 100%;
    }
  }
</style>
