<script>
  import { appState } from '../lib/state.svelte.js';

  const features = [
    { title: 'Galleria foto', text: 'Ogni invitato carica i propri scatti in un album condiviso.', icon: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>' },
    { title: 'Caccia al tesoro', text: 'Missioni e indizi da completare fotografando la festa.', icon: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>' },
    { title: 'Quiz sugli sposi', text: 'Quanto conoscono davvero gli sposi? Punti a ogni risposta esatta.', icon: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>' },
    { title: 'Classifica live', text: 'Punteggi aggiornati in tempo reale per tutta la serata.', icon: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>' }
  ];
</script>

<section class="hero">
  <span class="eyebrow">Per sempre inizia qui</span>
  <h1 class="page-title hero-title">
    Il gioco del vostro <span class="gold-gradient-text">matrimonio</span>
  </h1>
  <p class="page-lead hero-lead">
    Gioca, esplora e conquista punti mentre celebri il giorno più bello. Crea l'evento in pochi minuti
    e condividi il codice invito con i tuoi ospiti.
  </p>
</section>

<section class="choices">
  <button class="choice choice-join" onclick={() => appState.setAuthView('join')}>
    <span class="choice-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>
    </span>
    <span class="choice-body">
      <span class="choice-title font-serif">Ho un codice invito</span>
      <span class="choice-text">Sei un invitato? Entra nell'evento con il codice ricevuto dagli sposi.</span>
    </span>
    <span class="choice-go">Entra →</span>
  </button>

  <button class="choice choice-create" onclick={() => appState.setAuthView('create')}>
    <span class="choice-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
    </span>
    <span class="choice-body">
      <span class="choice-title font-serif">Crea il vostro matrimonio</span>
      <span class="choice-text">Siete gli sposi? Configurate l'evento e ricevete il codice da condividere.</span>
    </span>
    <span class="choice-go">Inizia →</span>
  </button>
</section>

<section class="features">
  {#each features as f (f.title)}
    <div class="feature">
      <span class="feature-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{@html f.icon}</svg>
      </span>
      <h3 class="feature-title">{f.title}</h3>
      <p class="feature-text">{f.text}</p>
    </div>
  {/each}
</section>

<style>
  .hero {
    max-width: 720px;
    margin: 12px auto 44px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .eyebrow {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--gold-dark);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.3);
  }

  .hero-title {
    font-size: clamp(2.4rem, 6vw, 3.75rem);
  }

  .hero-lead {
    max-width: 580px;
    font-size: 1.1rem;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 56px;
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

  .choice:hover {
    transform: translateY(-3px);
  }

  .choice-join {
    background: var(--paper);
    border: 1px solid rgba(201, 169, 110, 0.3);
    box-shadow: 0 14px 30px rgba(138, 109, 59, 0.1);
    color: var(--text-main);
  }

  .choice-join:hover {
    box-shadow: 0 18px 36px rgba(138, 109, 59, 0.18);
  }

  .choice-create {
    background: var(--grad-dusk);
    border: 1px solid rgba(240, 216, 168, 0.2);
    box-shadow: 0 14px 30px rgba(28, 23, 18, 0.25);
    color: #fff;
  }

  .choice-create:hover {
    box-shadow: 0 18px 36px rgba(28, 23, 18, 0.35);
  }

  .choice-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
  }

  .choice-join .choice-icon {
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.14);
    border: 1px solid rgba(201, 169, 110, 0.3);
  }

  .choice-create .choice-icon {
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
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .choice-text {
    font-size: 0.95rem;
    line-height: 1.5;
    opacity: 0.72;
  }

  .choice-go {
    font-weight: 700;
    font-size: 0.92rem;
    padding: 10px 18px;
    border-radius: 14px;
    background: var(--grad-gold-rose);
    color: #fff;
    box-shadow: 0 8px 18px rgba(212, 132, 154, 0.35);
  }

  .features {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
  }

  .feature {
    padding: 22px;
    border-radius: var(--radius-lg);
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(201, 169, 110, 0.16);
  }

  .feature-icon {
    display: inline-flex;
    color: var(--rose-primary);
    margin-bottom: 12px;
  }

  .feature-title {
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .feature-text {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  @media (max-width: 860px) {
    .features { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 640px) {
    .choices { grid-template-columns: 1fr; }
    .features { grid-template-columns: 1fr; }
    .choice { padding: 24px; }
  }
</style>
