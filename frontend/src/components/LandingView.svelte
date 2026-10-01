<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';

  // ---- Demo live della classifica nell'hero (un solo momento animato) ----
  const ROW_H = 62;

  let players = $state([
    { name: 'Giulia', score: 1240, hue: 340 },
    { name: 'Marco', score: 1115, hue: 28 },
    { name: 'Zia Pina', score: 980, hue: 160 },
    { name: 'Luca', score: 870, hue: 250 }
  ]);
  let ranked = $derived([...players].sort((a, b) => b.score - a.score));
  let showToast = $state(false);

  const fmt = (n) => Math.round(n).toLocaleString('it-IT');

  onMount(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let timer = 0;

    function run() {
      showToast = true;
      if (reduced) {
        players[1].score = 1265;
        return;
      }
      const from = 1115;
      const to = 1265;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / 900, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        players[1].score = from + (to - from) * eased;
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    timer = window.setTimeout(run, reduced ? 0 : 1500);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  });

  const steps = [
    { title: 'Create l\'evento', text: 'Date un nome alla festa, scegliete le sfide e ricevete il codice invito.' },
    { title: 'Condividete il codice', text: 'Gli ospiti entrano dal telefono con il codice che avete mandato loro.' },
    { title: 'Giocate fino a fine serata', text: 'Foto, punti e classifica si aggiornano mentre la festa va avanti.' }
  ];

  const missions = [
    { text: 'Brindisi con gli sposi', pts: 150, done: true },
    { text: 'Selfie con il fotografo', pts: 100, done: true },
    { text: 'Trova chi porta le scarpe da ginnastica', pts: 80, done: false },
    { text: 'Un ballo con la nonna', pts: 120, done: false }
  ];

  const quizOptions = [
    { text: 'A una cena tra amici', state: '' },
    { text: 'In montagna, d\'estate', state: 'right' },
    { text: 'Al lavoro', state: '' }
  ];
</script>

<!-- ===================== HERO ===================== -->
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1 class="hero-title">Il vostro matrimonio, i vostri ricordi </h1>
      <p class="hero-lead">
        Gli invitati scattano foto, completano missioni e rispondono ai quiz sugli sposi.
        Voi create l'evento in pochi minuti e condividete un codice.
      </p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" onclick={() => appState.setAuthView('create')}>Crea il matrimonio</button>
        <button class="btn btn-secondary btn-lg" onclick={() => appState.setAuthView('join')}>Ho un codice invito</button>
      </div>
      <p class="hero-note">Siete ospiti? Il codice ve lo danno gli sposi.</p>
    </div>

    <div class="hero-stage" aria-hidden="true">
      <svg class="rings" viewBox="0 0 400 260" fill="none" stroke="currentColor" stroke-width="1.2">
        <circle cx="145" cy="130" r="110"></circle>
        <circle cx="255" cy="130" r="110"></circle>
      </svg>

      <div class="phone">
        <div class="phone-notch"></div>
        <div class="phone-head">
          <div>
            <div class="phone-title">Classifica</div>
            <div class="phone-sub">Elena e Davide</div>
          </div>
          <span class="live"><span class="pulse-dot"></span>In diretta</span>
        </div>

        <ul class="board" style="height: {players.length * ROW_H}px">
          {#each players as p (p.name)}
            {@const pos = ranked.findIndex((r) => r.name === p.name)}
            <li class="row" class:lead={pos === 0} style="transform: translateY({pos * ROW_H}px)">
              <span class="rank">{pos + 1}</span>
              <span class="avatar" style="--h: {p.hue}">{p.name[0]}</span>
              <span class="pname">{p.name}</span>
              <span class="pscore">{fmt(p.score)}</span>
            </li>
          {/each}
        </ul>

        <div class="toast-slot">
          <div class="mini-toast" class:show={showToast}>
            <span class="mini-toast-check">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
            </span>
            <span class="mini-toast-text">
              <strong>Marco</strong> ha completato<br />Brindisi con gli sposi
            </span>
            <span class="mini-toast-pts">+150</span>
          </div>
        </div>

        <div class="phone-tabs">
          <span>Home</span><span>Foto</span><span>Giochi</span><span class="on">Classifica</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===================== COME FUNZIONA ===================== -->
<section class="section" id="come-funziona">
  <div class="wrap">
    <h2 class="section-title">Tre passaggi, poi tocca agli ospiti</h2>
    <p class="section-lead">Non c'è nulla da gestire durante la festa: il gioco va avanti da solo.</p>

    <ol class="steps">
      {#each steps as s, i (s.title)}
        <li class="step">
          <span class="step-n">{i + 1}</span>
          <h3 class="step-title">{s.title}</h3>
          <p class="step-text">{s.text}</p>
        </li>
      {/each}
    </ol>
  </div>
</section>

<!-- ===================== GIOCHI ===================== -->
<section class="section section-tint" id="giochi">
  <div class="wrap">
    <h2 class="section-title">Quattro modi di partecipare</h2>
    <p class="section-lead">Ognuno fa guadagnare punti. Ognuno si gioca dal telefono, al proprio ritmo.</p>

    <div class="bento">
      <!-- Galleria -->
      <article class="tile tile-photos">
        <div class="mosaic" aria-hidden="true">
          <span class="ph ph1"><i>Giulia</i></span>
          <span class="ph ph2"><i>Marco</i></span>
          <span class="ph ph3"></span>
          <span class="ph ph4"><i>Zia Pina</i></span>
          <span class="ph ph5"></span>
          <span class="ph ph6"><i>Luca</i></span>
        </div>
        <h3 class="tile-title">Galleria condivisa</h3>
        <p class="tile-text">Ogni invitato carica i propri scatti in un unico album, e voi rivivete la festa dal punto di vista di tutti.</p>
      </article>

      <!-- Caccia -->
      <article class="tile tile-hunt">
        <ul class="missions" aria-hidden="true">
          {#each missions as m (m.text)}
            <li class="mission" class:done={m.done}>
              <span class="tick">
                {#if m.done}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
                {/if}
              </span>
              <span class="mission-text">{m.text}</span>
              <span class="mission-pts">+{m.pts}</span>
            </li>
          {/each}
        </ul>
        <h3 class="tile-title">Caccia al tesoro</h3>
        <p class="tile-text">Missioni da completare fotografando la festa. Più ne trovi, più punti porti a casa.</p>
      </article>

      <!-- Quiz -->
      <article class="tile tile-quiz">
        <div class="quiz" aria-hidden="true">
          <p class="quiz-q">Dove si sono conosciuti gli sposi?</p>
          {#each quizOptions as o (o.text)}
            <div class="quiz-opt" class:right={o.state === 'right'}>{o.text}</div>
          {/each}
        </div>
        <h3 class="tile-title">Quiz sugli sposi</h3>
        <p class="tile-text">Quanto li conoscono davvero? Le domande le scrivete voi, i punti li guadagna chi risponde giusto.</p>
      </article>

      <!-- Classifica -->
      <article class="tile tile-podium">
        <div class="podium" aria-hidden="true">
          <div class="pod pod2"><span class="pod-name">Marco</span><span class="pod-bar"><b>2</b></span></div>
          <div class="pod pod1"><span class="pod-name">Giulia</span><span class="pod-bar"><b>1</b></span></div>
          <div class="pod pod3"><span class="pod-name">Zia Pina</span><span class="pod-bar"><b>3</b></span></div>
        </div>
        <h3 class="tile-title">Classifica in tempo reale</h3>
        <p class="tile-text">I punteggi si aggiornano mentre la serata va avanti, così il primo posto resta in palio fino all'ultimo brindisi.</p>
      </article>
    </div>
  </div>
</section>

<!-- ===================== SCELTA FINALE ===================== -->
<section class="finale">
  <div class="wrap">
    <h2 class="finale-title">Siete gli sposi o siete invitati?</h2>

    <div class="choices">
      <button class="choice choice-create" onclick={() => appState.setAuthView('create')}>
        <span class="choice-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </span>
        <span class="choice-body">
          <span class="choice-title">Crea il vostro matrimonio</span>
          <span class="choice-text">Configurate l'evento e ricevete il codice da condividere con gli ospiti.</span>
        </span>
        <span class="choice-go">Inizia</span>
      </button>

      <button class="choice choice-join" onclick={() => appState.setAuthView('join')}>
        <span class="choice-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>
        </span>
        <span class="choice-body">
          <span class="choice-title">Ho un codice invito</span>
          <span class="choice-text">Entra nell'evento con il codice che ti hanno dato gli sposi.</span>
        </span>
        <span class="choice-go choice-go-soft">Entra</span>
      </button>
    </div>
  </div>
</section>

<style>
  /* ---------- Struttura ---------- */
  .wrap {
    width: 100%;
    max-width: 1160px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .section {
    padding-block: clamp(56px, 9vw, 112px);
  }

  .section-tint {
    background: linear-gradient(180deg, rgba(245, 241, 236, 0.75) 0%, rgba(245, 241, 236, 0.4) 100%);
    border-block: 1px solid rgba(201, 169, 110, 0.16);
  }

  .section-title {
    font-weight: 600;
    font-size: clamp(2rem, 4.6vw, 3.2rem);
    line-height: 1.08;
    max-width: 18ch;
    color: var(--text-main);
  }

  .section-lead {
    margin-top: 14px;
    max-width: 50ch;
    color: var(--text-muted);
    font-size: 1.05rem;
  }

  /* ---------- Hero ---------- */
  .hero {
    padding-block: clamp(32px, 6vw, 88px) clamp(48px, 7vw, 96px);
    overflow: clip;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    align-items: center;
    gap: clamp(32px, 6vw, 72px);
  }

  .hero-title {
    font-weight: 600;
    font-size: clamp(2.75rem, 7.2vw, 5.4rem);
    line-height: 1;
    letter-spacing: -0.015em;
    color: var(--text-main);
    max-width: 11ch;
    text-wrap: balance;
  }

  .hero-lead {
    margin-top: 22px;
    max-width: 46ch;
    font-size: clamp(1.02rem, 1.6vw, 1.2rem);
    line-height: 1.6;
    color: var(--text-muted);
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 32px;
  }

  .hero-note {
    margin-top: 16px;
    font-size: 0.88rem;
    color: var(--text-dim);
  }

  /* ---------- Telefono ---------- */
  .hero-stage {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 12px 0;
  }

  .rings {
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(150%, 620px);
    transform: translate(-50%, -50%);
    color: rgba(201, 169, 110, 0.45);
    pointer-events: none;
  }

  .phone {
    position: relative;
    width: min(100%, 308px);
    padding: 34px 18px 14px;
    border-radius: 42px;
    background: var(--grad-dusk);
    border: 1px solid var(--night-hairline);
    box-shadow:
      0 40px 80px rgba(28, 23, 18, 0.32),
      0 0 0 8px rgba(255, 253, 251, 0.7),
      0 0 90px rgba(212, 132, 154, 0.25);
    color: #fff;
  }

  .phone-notch {
    position: absolute;
    top: 12px;
    left: 50%;
    width: 78px;
    height: 7px;
    transform: translateX(-50%);
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.12);
  }

  .phone-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 16px;
  }

  .phone-title {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 700;
    line-height: 1;
    color: var(--gold-bright);
  }

  .phone-sub {
    margin-top: 4px;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.55);
  }

  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 99px;
    font-size: 0.7rem;
    font-weight: 700;
    color: #bfe8d4;
    background: rgba(123, 184, 158, 0.16);
    border: 1px solid rgba(123, 184, 158, 0.3);
  }

  .board {
    position: relative;
    list-style: none;
  }

  .row {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 54px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(240, 216, 168, 0.1);
    transition: transform 0.85s cubic-bezier(0.22, 1, 0.36, 1), background 0.5s, border-color 0.5s;
  }

  .row.lead {
    background: rgba(240, 216, 168, 0.14);
    border-color: rgba(240, 216, 168, 0.4);
  }

  .rank {
    width: 16px;
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    text-align: center;
    color: var(--gold-bright);
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    font-size: 0.82rem;
    font-weight: 700;
    color: #fff;
    background: hsl(var(--h) 45% 48%);
  }

  .pname {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pscore {
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--gold-bright);
  }

  .toast-slot {
    margin-top: 14px;
    min-height: 62px;
  }

  .mini-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 16px;
    background: var(--paper);
    color: var(--text-main);
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.35);
    opacity: 0;
    transform: translateY(14px) scale(0.97);
    transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .mini-toast.show {
    opacity: 1;
    transform: none;
  }

  .mini-toast-check {
    display: grid;
    place-items: center;
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: #fff;
    background: var(--accent-emerald);
  }

  .mini-toast-text {
    flex: 1;
    font-size: 0.74rem;
    line-height: 1.35;
    color: var(--text-muted);
  }

  .mini-toast-text strong {
    color: var(--text-main);
  }

  .mini-toast-pts {
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--gold-dark);
  }

  .phone-tabs {
    display: flex;
    justify-content: space-between;
    margin-top: 14px;
    padding: 10px 6px 4px;
    border-top: 1px solid rgba(240, 216, 168, 0.14);
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.45);
  }

  .phone-tabs .on {
    color: var(--gold-bright);
    font-weight: 700;
  }

  /* ---------- Passi ---------- */
  .steps {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(24px, 4vw, 56px);
    margin-top: clamp(32px, 5vw, 56px);
    counter-reset: none;
  }

  .step {
    position: relative;
    padding-top: 26px;
    border-top: 1px solid rgba(201, 169, 110, 0.4);
  }

  .step-n {
    position: absolute;
    top: -19px;
    left: 0;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 700;
    color: #fff;
    background: var(--grad-gold-rose);
    box-shadow: 0 8px 18px rgba(212, 132, 154, 0.35);
  }

  .step-title {
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .step-text {
    margin-top: 8px;
    max-width: 34ch;
    color: var(--text-muted);
  }

  /* ---------- Giochi (bento) ---------- */
  .bento {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 20px;
    margin-top: clamp(32px, 5vw, 56px);
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 24px;
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  .tile-photos { grid-column: span 7; background: var(--paper); border: 1px solid rgba(201, 169, 110, 0.25); box-shadow: 0 16px 34px rgba(138, 109, 59, 0.1); }
  .tile-hunt { grid-column: span 5; background: linear-gradient(160deg, #fbeef1 0%, #fff8f3 100%); border: 1px solid rgba(212, 132, 154, 0.25); }
  .tile-quiz { grid-column: span 5; background: var(--grad-dusk); color: #fff; border: 1px solid var(--night-hairline); box-shadow: 0 18px 38px rgba(28, 23, 18, 0.25); }
  .tile-podium { grid-column: span 7; background: linear-gradient(135deg, #f6e7c6 0%, #f1d2d9 100%); border: 1px solid rgba(201, 169, 110, 0.35); }

  .tile-title {
    margin-top: 14px;
    font-size: 1.85rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .tile-text {
    max-width: 42ch;
    font-size: 0.97rem;
    color: var(--text-muted);
  }

  .tile-quiz .tile-text { color: rgba(255, 255, 255, 0.68); }
  .tile-podium .tile-text { color: #6b5a48; }

  /* mosaico foto */
  .mosaic {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 92px;
    gap: 8px;
  }

  .ph {
    position: relative;
    border-radius: 14px;
    overflow: hidden;
  }

  .ph i {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 2px 9px;
    border-radius: 99px;
    font-style: normal;
    font-size: 0.68rem;
    font-weight: 600;
    color: #fff;
    background: rgba(28, 23, 18, 0.5);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  .ph1 { grid-row: span 2; background: radial-gradient(circle at 30% 25%, #ffe2c2 0 18%, transparent 19%), linear-gradient(160deg, #d4849a 0%, #8a4d63 100%); }
  .ph2 { background: radial-gradient(circle at 70% 35%, #fff3d6 0 14%, transparent 15%), linear-gradient(180deg, #e8c98f 0%, #b48a4a 100%); }
  .ph3 { background: linear-gradient(135deg, #9b8ec4 0%, #5e5390 100%); }
  .ph4 { grid-row: span 2; background: radial-gradient(circle at 50% 30%, #fff 0 10%, transparent 11%), linear-gradient(200deg, #7bb89e 0%, #3f7a62 100%); }
  .ph5 { background: linear-gradient(135deg, #f0d8a8 0%, #d4849a 100%); }
  .ph6 { background: radial-gradient(circle at 30% 70%, #ffe9c9 0 12%, transparent 13%), linear-gradient(160deg, #7da8d4 0%, #46688f 100%); }

  /* missioni */
  .missions {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mission {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(212, 132, 154, 0.2);
    font-size: 0.88rem;
    font-weight: 600;
  }

  .tick {
    display: grid;
    place-items: center;
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid rgba(138, 126, 118, 0.4);
    color: #fff;
  }

  .mission.done .tick {
    background: var(--accent-emerald);
    border-color: var(--accent-emerald);
  }

  .mission.done .mission-text {
    color: var(--text-muted);
    text-decoration: line-through;
    text-decoration-color: rgba(138, 126, 118, 0.5);
  }

  .mission-text { flex: 1; min-width: 0; }

  .mission-pts {
    font-size: 0.82rem;
    font-weight: 800;
    color: var(--rose-primary);
  }

  /* quiz */
  .quiz {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .quiz-q {
    margin-bottom: 4px;
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--gold-bright);
  }

  .quiz-opt {
    padding: 11px 14px;
    border-radius: 14px;
    font-size: 0.9rem;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(240, 216, 168, 0.14);
  }

  .quiz-opt.right {
    background: rgba(123, 184, 158, 0.22);
    border-color: rgba(123, 184, 158, 0.6);
    font-weight: 700;
  }

  /* podio */
  .podium {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 10px;
    height: 150px;
  }

  .pod {
    flex: 1;
    max-width: 120px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    height: 100%;
    justify-content: flex-end;
    text-align: center;
  }

  .pod-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: #5b4a38;
  }

  .pod-bar {
    display: grid;
    place-items: start center;
    padding-top: 8px;
    border-radius: 14px 14px 4px 4px;
    background: var(--paper);
    box-shadow: 0 8px 18px rgba(138, 109, 59, 0.18);
  }

  .pod-bar b {
    font-family: var(--font-display);
    font-size: 1.6rem;
    line-height: 1;
    color: var(--gold-dark);
  }

  .pod1 .pod-bar { height: 92px; background: var(--grad-gold-rose); }
  .pod1 .pod-bar b { color: #fff; }
  .pod2 .pod-bar { height: 66px; }
  .pod3 .pod-bar { height: 48px; }

  /* ---------- Finale ---------- */
  .finale {
    padding-block: clamp(56px, 9vw, 112px);
    background: var(--grad-dusk);
    color: #fff;
  }

  .finale-title {
    max-width: 16ch;
    font-weight: 600;
    font-size: clamp(2rem, 4.8vw, 3.4rem);
    line-height: 1.08;
    color: var(--gold-bright);
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    margin-top: clamp(28px, 4vw, 48px);
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 18px;
    padding: 30px;
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-xl);
    font-family: var(--font-sans);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .choice:hover { transform: translateY(-3px); }
  .choice:active { transform: scale(0.99); }

  .choice-create {
    background: var(--paper);
    border: 1px solid rgba(201, 169, 110, 0.4);
    color: var(--text-main);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
  }

  .choice-join {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--night-hairline);
    color: #fff;
  }

  .choice-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
  }

  .choice-create .choice-icon {
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.14);
    border: 1px solid rgba(201, 169, 110, 0.3);
  }

  .choice-join .choice-icon {
    color: var(--gold-bright);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(240, 216, 168, 0.3);
  }

  .choice-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .choice-title {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .choice-text {
    font-size: 0.95rem;
    line-height: 1.5;
    opacity: 0.72;
  }

  .choice-go {
    padding: 10px 22px;
    border-radius: 14px;
    font-weight: 700;
    font-size: 0.92rem;
    color: #fff;
    background: var(--grad-gold-rose);
    box-shadow: 0 8px 18px rgba(212, 132, 154, 0.35);
  }

  .choice-go-soft {
    color: var(--night-ink);
    background: var(--gold-bright);
    box-shadow: none;
  }

  /* ---------- Focus ---------- */
  .choice:focus-visible,
  .hero-actions :global(.btn:focus-visible) {
    outline: 3px solid var(--gold-primary);
    outline-offset: 3px;
  }

  /* ---------- Responsive ---------- */
  @media (max-width: 999px) {
    .tile-photos, .tile-podium { grid-column: span 12; }
    .tile-hunt, .tile-quiz { grid-column: span 6; }
  }

  @media (max-width: 860px) {
    .hero-grid { grid-template-columns: minmax(0, 1fr); }
    .hero-title { max-width: 13ch; }
    .hero-stage { margin-top: 16px; }
    .steps { grid-template-columns: minmax(0, 1fr); gap: 40px; }
    .step { padding-top: 22px; }
  }

  @media (max-width: 680px) {
    .wrap { padding: 0 20px; }
    .tile-hunt, .tile-quiz { grid-column: span 12; }
    .choices { grid-template-columns: minmax(0, 1fr); }
    .hero-actions :global(.btn) { flex: 1 1 100%; }
    .mosaic { grid-auto-rows: 78px; }
    .tile { padding: 20px; }
    .choice { padding: 24px; }
    .tile-title { font-size: 1.6rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .row, .mini-toast, .choice { transition: none; }
  }
</style>
