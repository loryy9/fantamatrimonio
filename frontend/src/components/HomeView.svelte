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

  const rawSpouse1 = appState.event?.spouse1_name || import.meta.env.VITE_SPOUSE_1 || import.meta.env.VITE_NOME_1 || '';
  const rawSpouse2 = appState.event?.spouse2_name || import.meta.env.VITE_SPOUSE_2 || import.meta.env.VITE_NOME_2 || '';
  const spouse1 = formatName(rawSpouse1);
  const spouse2 = formatName(rawSpouse2);
  const coupleNames = spouse1 && spouse2 ? `${spouse1} & ${spouse2}` : (spouse1 || spouse2 || 'Gli Sposi');

  const beforeStart = $derived(eventTimer.status === 'before_start');
  const lockedBadge = $derived(`Alle ${eventTimer.startTimeFormatted || '12:00'}`);

  const tiles = $derived([
    {
      id: 'gallery',
      title: 'Galleria Foto',
      subtitle: 'Carica i tuoi scatti',
      badge: beforeStart ? lockedBadge : '+10 pt cad.',
      accent: '#d4849a',
      icon: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
      go: () => { appState.activeTab = 'gallery'; }
    },
    {
      id: 'hunt',
      title: 'Caccia al Tesoro',
      subtitle: 'Trova gli indizi',
      badge: beforeStart ? lockedBadge : `${completedHunts}/${totalHunts} fatte`,
      accent: '#c9a96e',
      icon: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>',
      go: () => { appState.activeTab = 'hunt'; }
    },
    {
      id: 'quiz',
      title: 'Quiz Sposi',
      subtitle: 'Metti alla prova la memoria',
      badge: beforeStart ? lockedBadge : `${completedQuiz}/${totalQuiz} risolti`,
      accent: '#f0d8a8',
      icon: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
      go: () => { appState.quizSubTab = 'quiz'; appState.activeTab = 'quiz'; }
    },
    {
      id: 'vote',
      title: 'Momenti Migliori',
      subtitle: 'Condividi un ricordo',
      badge: beforeStart ? lockedBadge : (hasVoted ? 'Compilato' : 'Da compilare'),
      accent: '#e8a0b4',
      icon: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
      go: () => { appState.quizSubTab = 'vote'; appState.activeTab = 'quiz'; }
    }
  ]);

  let carouselEl = $state(null);
  let activeSlide = $state(0);

  function onCarouselScroll() {
    if (!carouselEl) return;
    const first = carouselEl.firstElementChild;
    if (!first) return;
    const step = first.getBoundingClientRect().width + 14;
    activeSlide = Math.max(0, Math.min(tiles.length - 1, Math.round(carouselEl.scrollLeft / step)));
  }
</script>

<div class="home-container">
  <!-- Dark hero (app: _HeroHeader) -->
  <section class="hero">
    <div class="glow glow-rose"></div>
    <div class="glow glow-gold"></div>

    <div class="hero-inner">
      <div class="hero-top">
        <div class="hero-text">
          <div class="hero-couple">{coupleNames}</div>
          <h1 class="hero-title font-serif">
            Ciao, {formatName(appState.user?.first_name) || 'Invitato'}!
          </h1>
        </div>
        <button class="rules-btn glass-dark" onclick={() => appState.showInstructionsModal = true} title="Rivedi le regole e le istruzioni">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          <span>Regole</span>
        </button>
      </div>

      {#if beforeStart}
        <div class="status-card gold-glass">
          <div class="status-label">I giochi inizieranno tra</div>
          <div class="countdown-grid">
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
        </div>
      {:else}
        <div class="status-card gold-glass status-row">
          <div>
            <div class="status-label">Il Tuo Punteggio</div>
            <div class="score">{appState.user?.total_points || 0}</div>
            {#if eventTimer.status === 'in_progress'}
              <div class="status-note">Termina tra {eventTimer.toEnd.formatted}</div>
            {:else if eventTimer.status === 'ended'}
              <div class="status-note strong">Tempo scaduto 🏆</div>
            {/if}
          </div>
          <button class="rank-btn" onclick={() => appState.activeTab = 'leaderboard'}>
            {#if appState.myRank}{appState.myRank}° · {/if}Classifica →
          </button>
        </div>
      {/if}
    </div>
  </section>

  <!-- Activities carousel (app: _ActivityCarousel) -->
  <section class="activities">
    <h2 class="section-title font-serif">Le Tue Attività</h2>
    <p class="section-sub">Scegli dove giocare adesso</p>

    <div class="carousel" bind:this={carouselEl} onscroll={onCarouselScroll}>
      {#each tiles as tile, i (tile.id)}
        <button
          class="activity-card"
          class:dim={i !== activeSlide}
          style="--accent: {tile.accent}"
          onclick={tile.go}
        >
          <span class="card-glow"></span>
          <svg class="watermark" xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">{@html tile.icon}</svg>

          <div class="card-top">
            <span class="icon-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">{@html tile.icon}</svg>
            </span>
            <svg class="card-arrow" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
          </div>

          <div class="card-bottom">
            <span class="card-title font-serif">{tile.title}</span>
            <span class="card-subtitle">{tile.subtitle}</span>
            <span class="card-chip">{tile.badge}</span>
          </div>
        </button>
      {/each}
    </div>

    <div class="dots">
      {#each tiles as tile, i (tile.id)}
        <span class="dot" class:on={i === activeSlide}></span>
      {/each}
    </div>
  </section>
</div>

<style>
  .home-container {
    display: flex;
    flex-direction: column;
    gap: 26px;
  }

  /* ---------- Hero ---------- */
  .hero {
    position: relative;
    overflow: hidden;
    /* bleed out of .main-content's 16px padding, up under the floating navbar */
    margin: -16px -16px 0;
    padding: calc(64px + var(--safe-top)) 20px 22px;
    background: var(--grad-dusk);
    border-radius: 0 0 36px 36px;
  }

  .glow {
    position: absolute;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    pointer-events: none;
  }

  .glow-rose {
    top: -50px;
    right: -40px;
    background: radial-gradient(circle, rgba(255, 111, 156, 0.35), rgba(255, 111, 156, 0));
  }

  .glow-gold {
    bottom: -60px;
    left: -30px;
    background: radial-gradient(circle, rgba(240, 216, 168, 0.35), rgba(240, 216, 168, 0));
  }

  .hero-inner {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hero-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }

  .hero-text {
    min-width: 0;
  }

  .hero-couple {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    letter-spacing: 0.03em;
  }

  .hero-title {
    font-size: 2.25rem;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .rules-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    padding: 7px 13px;
    border-radius: 14px;
    color: var(--gold-bright);
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease;
  }

  .rules-btn:active {
    transform: scale(0.95);
  }

  .status-card {
    border-radius: 24px;
    padding: 18px;
  }

  .gold-glass {
    background: rgba(201, 169, 110, 0.16);
    border: 1px solid rgba(201, 169, 110, 0.4);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .status-label {
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.8rem;
  }

  .score {
    color: #fff;
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .status-note {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.72rem;
  }

  .status-note.strong {
    color: #fff;
  }

  .rank-btn {
    padding: 10px 16px;
    border: none;
    border-radius: 14px;
    background: var(--grad-gold-rose);
    color: #fff;
    font-family: var(--font-sans);
    font-size: 0.82rem;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .rank-btn:active {
    transform: scale(0.96);
  }

  .countdown-grid {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }

  .countdown-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 58px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--night-hairline);
    border-radius: 14px;
  }

  .countdown-value {
    color: #fff;
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1;
  }

  .countdown-label {
    margin-top: 3px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .countdown-sep {
    color: var(--gold-bright);
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 12px;
    opacity: 0.8;
  }

  /* ---------- Activities ---------- */
  .section-title {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .section-sub {
    margin: 4px 0 18px;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .carousel {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    /* let the next card peek past the page gutter */
    margin: 0 -16px;
    padding: 4px 16px 14px;
    scroll-padding: 0 16px;
  }

  .carousel::-webkit-scrollbar {
    display: none;
  }

  .activity-card {
    position: relative;
    flex: 0 0 84%;
    height: 208px;
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 20px;
    overflow: hidden;
    text-align: left;
    cursor: pointer;
    color: #fff;
    font-family: var(--font-sans);
    background: var(--grad-dusk);
    border: 1px solid rgba(255, 255, 255, 0.08);
    /* asymmetric corner cut, like the app */
    border-radius: 34px 34px 8px 34px;
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.22);
    transition: transform 0.16s ease, opacity 0.25s ease;
  }

  .activity-card:active {
    transform: scale(0.97);
  }

  .activity-card.dim {
    opacity: 0.75;
  }

  .card-glow {
    position: absolute;
    top: -36px;
    right: -36px;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(circle, var(--accent), transparent 70%);
    opacity: 0.32;
  }

  .watermark {
    position: absolute;
    right: -22px;
    bottom: -28px;
    color: rgba(255, 255, 255, 0.07);
    pointer-events: none;
  }

  .card-top {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: var(--accent);
    background: rgba(255, 255, 255, 0.08);
    border: 1.2px solid color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .card-arrow {
    color: rgba(255, 255, 255, 0.35);
  }

  .card-bottom {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .card-title {
    font-size: 1.4rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .card-subtitle {
    margin-top: 4px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.8rem;
  }

  .card-chip {
    margin-top: 10px;
    padding: 4px 9px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.88);
    font-size: 0.66rem;
    font-weight: 600;
  }

  .dots {
    display: flex;
    justify-content: center;
    gap: 6px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 4px;
    background: rgba(138, 126, 118, 0.28);
    transition: width 0.22s cubic-bezier(0.16, 1, 0.3, 1), background 0.22s ease;
  }

  .dot.on {
    width: 20px;
    background: var(--gold-primary);
  }
</style>
