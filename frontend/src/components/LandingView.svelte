<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import QrScannerModal from './QrScannerModal.svelte';

  let inviteCodeInput = $state('');
  let showQrModal = $state(false);

  // ---- Demo live animata della classifica (Marco sorpassa Giulia con toast) ----
  const ROW_H = 60;

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

    timer = window.setTimeout(run, reduced ? 0 : 1300);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  });

  function handleJoinWithCode() {
    const code = inviteCodeInput.trim().toUpperCase();
    if (code) {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('code', code);
        window.history.replaceState({}, '', url);
      }
    }
    appState.setAuthView('join');
  }

  function handleQrScan(scanned) {
    if (scanned) {
      inviteCodeInput = scanned.trim().toUpperCase();
      handleJoinWithCode();
    }
  }

  async function handlePaste() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const match = text.match(/[A-Za-z0-9\-_]{4,12}/);
          if (match) {
            inviteCodeInput = match[0].toUpperCase();
          }
        }
      }
    } catch {
      // ignore
    }
  }
</script>

<div class="landing-page">
  <!-- ===================== HERO SECTION ===================== -->
  <section class="hero-section">
    <div class="wrap hero-grid">
      <!-- Colonna Sinistra (Copy + Azioni) -->
      <div class="hero-copy">
        <div class="badge-pill">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
          </svg>
          <span>IL GIOCO UFFICIALE PER LE NOZZE</span>
        </div>

        <h1 class="landing-title font-serif">
          Il vostro matrimonio, i vostri ricordi più veri.
        </h1>

        <p class="landing-lead">
          Scatta foto, sfida gli invitati e scopri chi conosce meglio gli sposi. Tutto dal tuo smartphone, senza scaricare app.
        </p>

        <!-- BOX ACCESSO RAPIDO OSPITI -->
        <div class="quick-join-card">
          <div class="quick-join-head">
            <span class="card-step-num">01</span>
            <strong class="card-step-title">HAI UN CODICE INVITO?</strong>
            <span class="pill-tag">Ospiti</span>
          </div>
          <p class="quick-join-desc">Inserisci il codice stampato sul cartoncino o via WhatsApp</p>
          
          <div class="quick-input-wrap">
            <input
              type="text"
              class="quick-input"
              placeholder="ES. AM01124"
              bind:value={inviteCodeInput}
              onkeydown={(e) => { if (e.key === 'Enter') handleJoinWithCode(); }}
              autocapitalize="characters"
            />
            <div class="quick-actions-bar">
              <button
                type="button"
                class="quick-scan-btn"
                onclick={() => showQrModal = true}
                title="Inquadra codice QR con la fotocamera"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <rect width="6" height="6" x="9" y="9" rx="1"/>
                </svg>
                <span>QR</span>
              </button>
              <button type="button" class="quick-paste-btn" onclick={handlePaste}>
                Incolla
              </button>
            </div>
          </div>

          <button type="button" class="pill-submit-btn" onclick={handleJoinWithCode}>
            <span>Partecipa alla festa</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- BOX RAPIDO SPOSI -->
        <div class="sposi-prompt-card">
          <div class="heart-round">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </div>
          <div class="sposi-prompt-text">
            <strong>Siete i futuri sposi?</strong>
            <span>Crea il fantamatrimonio in 2 min</span>
          </div>
          <button type="button" class="sposi-cta-btn" onclick={() => appState.setAuthView('create')}>
            Crea evento
          </button>
        </div>
      </div>

      <!-- Colonna Destra: Phone Mockup Animato con Anelli -->
      <div class="hero-stage">
        <svg class="rings" viewBox="0 0 400 260" fill="none" stroke="currentColor" stroke-width="1.2">
          <circle cx="145" cy="130" r="110"></circle>
          <circle cx="255" cy="130" r="110"></circle>
        </svg>

        <div class="phone">
          <div class="phone-notch"></div>
          <div class="phone-head">
            <div>
              <div class="phone-title">Classifica Live</div>
              <div class="phone-sub">Elena e Davide • Tavoli</div>
            </div>
            <span class="live-pill"><span class="pulse-dot"></span>In diretta</span>
          </div>

          <!-- Classifica interattiva animata -->
          <ul class="board" style="height: {players.length * ROW_H}px">
            {#each players as p (p.name)}
              {@const pos = ranked.findIndex((r) => r.name === p.name)}
              <li class="row" class:lead={pos === 0} style="transform: translateY({pos * ROW_H}px)">
                <span class="rank">{pos + 1}</span>
                <span class="avatar" style="--h: {p.hue}">{p.name[0]}</span>
                <span class="pname">{p.name}</span>
                <span class="pscore">{fmt(p.score)} pt</span>
              </li>
            {/each}
          </ul>

          <!-- Toast animato che compare al sorpasso -->
          <div class="toast-slot">
            <div class="mini-toast" class:show={showToast}>
              <span class="mini-toast-check">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
              </span>
              <span class="mini-toast-text">
                <strong>Marco</strong> ha completato<br />Brindisi con gli sposi!
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

  <!-- ===================== TRE PASSAGGI ===================== -->
  <section class="section-block">
    <div class="wrap">
      <span class="section-eyebrow">SEMPLICITÀ ASSOLUTA</span>
      <h2 class="section-heading font-serif">Tre passaggi, poi tocca alla festa</h2>
      <p class="section-sub">Nessuna app da scaricare dagli store: tutto funziona dal browser in 5 secondi per giovani e nonni.</p>

      <div class="steps-flow">
        <div class="step-card">
          <div class="step-circle">1</div>
          <div class="step-card-body">
            <h3>Create l'evento in 2 minuti</h3>
            <p>Scegliete il nome degli sposi, personalizzate le missioni fotografiche e ricevete il vostro codice di accesso personalizzato.</p>
          </div>
        </div>

        <div class="step-card">
          <div class="step-circle gold">2</div>
          <div class="step-card-body">
            <h3>Condividete QR Code o PIN</h3>
            <p>Stampatelo sui segnatavoli col QR code o inviate il link via WhatsApp: gli invitati aprono la schermata di benvenuto con un click.</p>
          </div>
        </div>

        <div class="step-card">
          <div class="step-circle wine">3</div>
          <div class="step-card-body">
            <h3>Giocate, ridete e salvate tutto</h3>
            <p>Foto caricate all'istante in alta risoluzione, quiz durante i tempi morti e podio finale proiettabile anche su maxischermo!</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ===================== QUATTRO MODALITÀ ===================== -->
  <section class="section-block">
    <div class="wrap">
      <span class="section-eyebrow">COINVOLGIMENTO TOTALE</span>
      <h2 class="section-heading font-serif">Quattro modalità di gioco</h2>
      <p class="section-sub">Ognuno partecipa al proprio ritmo, dai più competitivi a chi ama solo guardare le foto.</p>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
          <h3>Galleria Fotografica Condivisa</h3>
          <p>Basta selfie dispersi nelle chat private! Tutti gli scatti della giornata confluiscono in un cloud unico in alta qualità, scaricabile dagli sposi con un solo zip a fine festa.</p>
          <div class="feature-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            <span>Download in risoluzione originale per gli sposi</span>
          </div>
        </div>

        <div class="feature-card">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
            </svg>
          </div>
          <h3>Caccia al Tesoro Fotografica</h3>
          <p>Missioni esilaranti a tempo per tutto l'evento: "Scatta una foto con chi ha la cravatta più sobria", "Trova chi si è cambiato le scarpe" (+150 pt).</p>
          <div class="feature-badge">
            <span>✨ 30 sfide già pronte incluse</span>
          </div>
        </div>

        <div class="feature-card">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12" y1="17" y2="17.01"/>
            </svg>
          </div>
          <h3>Il Grande Quiz sugli Sposi</h3>
          <p>Mettete alla prova parenti e amici con aneddoti veri, prime storiche e curiosità sulla vostra storia d'amore. Punti raddoppiati per le risposte veloci!</p>
          <div class="feature-badge">
            <span>⚡️ Domande programmabili tra le portate del banchetto</span>
          </div>
        </div>

        <div class="feature-card">
          <div class="feature-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
            </svg>
          </div>
          <h3>Live Display &amp; Proiezione Sala</h3>
          <p>Attivate con un tap la visualizzazione panoramica per videoproiettore: le foto degli ospiti compaiono sullo schermo in sala insieme al podio in costante ribaltamento.</p>
          <div class="feature-badge">
            <span>📺 Compatibile con Smart TV, HDMI e videoproiettori</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ===================== BANNER FINALE BORDEAUX ===================== -->
  <section class="banner-section">
    <div class="wrap">
      <div class="cta-wine-banner">
        <div class="cta-sparkle">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
          </svg>
        </div>
        <h2 class="cta-title font-serif">Rendete unico il vostro giorno speciale</h2>
        <p class="cta-sub">
          Configura le missioni in 2 minuti: i primi 20 invitati sono sempre gratuiti, nessun account richiesto per partecipare.
        </p>

        <button type="button" class="cta-gold-btn" onclick={() => appState.setAuthView('create')}>
          <span>Crea l'evento gratuito</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </button>

        <div class="cta-guarantees">
          <span>🛡️ Nessun dato rivenduto</span>
          <span>•</span>
          <span>⚡️ Setup in 1 minuto</span>
        </div>
      </div>
    </div>
  </section>

  <QrScannerModal
    isOpen={showQrModal}
    onScan={handleQrScan}
    onClose={() => showQrModal = false}
  />
</div>

<style>
  .landing-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-primary);
    display: flex;
    flex-direction: column;
    padding-bottom: 70px;
  }

  .wrap {
    width: 100%;
    max-width: 1140px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* Hero Section */
  .hero-section {
    width: 100%;
    padding-top: clamp(24px, 4vw, 48px);
    padding-bottom: clamp(32px, 5vw, 64px);
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    align-items: center;
    gap: clamp(32px, 5vw, 60px);
  }

  .hero-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #fae9f0;
    color: var(--wine);
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  .landing-title {
    font-size: clamp(2.3rem, 4.5vw, 3.4rem);
    color: var(--wine);
    line-height: 1.1;
    font-weight: 700;
    margin-bottom: 14px;
  }

  .landing-lead {
    font-size: 1.05rem;
    color: #6a5e64;
    line-height: 1.55;
    margin-bottom: 24px;
    max-width: 52ch;
  }

  /* Quick join card */
  .quick-join-card {
    width: 100%;
    max-width: 480px;
    background: #ffffff;
    border-radius: 22px;
    padding: 20px 20px;
    box-shadow: 0 4px 20px rgba(140, 47, 75, 0.05);
    border: 1px solid rgba(220, 205, 195, 0.4);
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
  }

  .quick-join-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-step-num {
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--wine);
  }

  .card-step-title {
    font-size: 0.84rem;
    letter-spacing: 0.06em;
    color: #2b1f24;
  }

  .pill-tag {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 700;
    color: #8c7840;
    background: #fbf5e6;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .quick-join-desc {
    font-size: 0.78rem;
    color: #7b6f75;
    margin: 0;
  }

  .quick-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    margin-top: 2px;
  }

  .quick-input {
    width: 100%;
    background: #f4efe9;
    border: 1.5px solid transparent;
    border-radius: 14px;
    padding: 13px 130px 13px 16px;
    font-family: var(--font-sans);
    font-size: 16px !important; /* Prevents auto zoom on iOS */
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-main);
    outline: none;
  }

  .quick-input:focus {
    background: #ffffff;
    border-color: var(--wine);
    box-shadow: 0 0 0 3px rgba(140, 47, 75, 0.12);
  }

  .quick-actions-bar {
    position: absolute;
    right: 6px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .quick-scan-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.2);
    border-radius: 9px;
    padding: 6px 9px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--wine);
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: all 0.15s ease;
  }

  .quick-scan-btn:hover {
    background: #faedf2;
  }

  .quick-scan-btn:active {
    transform: scale(0.96);
  }

  .quick-paste-btn {
    background: #f7f2ed;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 9px;
    padding: 6px 9px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #55484f;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-paste-btn:hover {
    background: #eee8e0;
  }

  .quick-paste-btn:active {
    transform: scale(0.96);
  }

  .pill-submit-btn {
    width: 100%;
    min-height: 48px;
    background: var(--wine);
    color: #ffffff;
    border: none;
    border-radius: 999px;
    font-size: 0.95rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(140, 47, 75, 0.25);
    margin-top: 4px;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .pill-submit-btn:hover {
    background: var(--wine-deep);
  }

  .pill-submit-btn:active {
    transform: scale(0.98);
  }

  /* Sposi prompt card */
  .sposi-prompt-card {
    width: 100%;
    max-width: 480px;
    background: #ffffff;
    border-radius: 20px;
    padding: 14px 16px;
    border: 1px solid rgba(220, 205, 195, 0.35);
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
  }

  .heart-round {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #fae0ea;
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sposi-prompt-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sposi-prompt-text strong {
    font-size: 0.86rem;
    color: #2b1f24;
  }

  .sposi-prompt-text span {
    font-size: 0.76rem;
    color: #7a6e74;
  }

  .sposi-cta-btn {
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.2);
    border-radius: 999px;
    padding: 8px 16px;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--wine);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sposi-cta-btn:hover {
    background: #faf7f2;
    border-color: var(--wine);
  }

  /* Hero Stage (Phone with rings) */
  .hero-stage {
    position: relative;
    display: grid;
    place-items: center;
  }

  .rings {
    position: absolute;
    inset: -20px auto auto -20px;
    width: 110%;
    height: auto;
    color: rgba(201, 169, 110, 0.35);
    pointer-events: none;
    z-index: 0;
  }

  .phone {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 380px;
    background: linear-gradient(145deg, #1f0b17 0%, #2b0f20 60%, #3e122b 100%);
    border-radius: 36px;
    padding: 18px 18px 22px;
    color: #fff;
    box-shadow: 0 24px 55px rgba(35, 10, 25, 0.35), 0 4px 14px rgba(0, 0, 0, 0.15);
    border: 2px solid rgba(240, 216, 168, 0.2);
  }

  .phone-notch {
    width: 110px;
    height: 16px;
    background: #14070f;
    border-radius: 0 0 14px 14px;
    margin: -18px auto 14px;
  }

  .phone-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 10px;
    border-bottom: 1px solid rgba(240, 216, 168, 0.12);
  }

  .phone-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: #ffffff;
  }

  .phone-sub {
    font-size: 0.72rem;
    color: #f0d8a8;
    opacity: 0.85;
  }

  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(240, 216, 168, 0.2);
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 700;
    color: #f0d8a8;
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #5bbf7b;
    box-shadow: 0 0 8px #5bbf7b;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  /* Animated Leaderboard Board */
  .board {
    position: relative;
    list-style: none;
    margin: 14px 0 10px;
    padding: 0;
  }

  .row {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(240, 216, 168, 0.1);
    transition: transform 0.65s cubic-bezier(0.2, 1, 0.3, 1), background 0.4s ease;
  }

  .row.lead {
    background: rgba(240, 216, 168, 0.16);
    border-color: rgba(240, 216, 168, 0.4);
  }

  .rank {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 800;
    color: #ffffff;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: hsl(var(--h), 65%, 55%);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 800;
  }

  .pname {
    flex: 1;
    font-size: 0.86rem;
    font-weight: 600;
  }

  .pscore {
    font-size: 0.86rem;
    font-weight: 700;
    color: #f0d8a8;
  }

  /* Toast Slot & Mini Toast */
  .toast-slot {
    min-height: 54px;
    margin-top: 4px;
  }

  .mini-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(240, 216, 168, 0.3);
    border-radius: 14px;
    padding: 8px 12px;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.4s ease, transform 0.4s ease;
  }

  .mini-toast.show {
    opacity: 1;
    transform: translateY(0);
  }

  .mini-toast-check {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #5bbf7b;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .mini-toast-text {
    flex: 1;
    font-size: 0.72rem;
    line-height: 1.3;
    color: #fcf8f5;
  }

  .mini-toast-pts {
    font-size: 0.82rem;
    font-weight: 800;
    color: #ff94b8;
  }

  .phone-tabs {
    display: flex;
    justify-content: space-around;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.74rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .phone-tabs .on {
    color: #f0d8a8;
    font-weight: 700;
  }

  /* Section blocks */
  .section-block {
    width: 100%;
    margin-bottom: 48px;
    text-align: left;
  }

  .section-eyebrow {
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #8c7840;
    text-transform: uppercase;
    display: block;
    margin-bottom: 4px;
  }

  .section-heading {
    font-size: clamp(1.8rem, 3.5vw, 2.4rem);
    color: var(--wine);
    line-height: 1.15;
    margin-bottom: 6px;
  }

  .section-sub {
    font-size: 0.92rem;
    color: #6a5e64;
    line-height: 1.5;
    margin-bottom: 24px;
  }

  /* Steps Flow (Desktop 3 columns, Mobile 1 column) */
  .steps-flow {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }

  .step-card {
    background: #ffffff;
    border-radius: 20px;
    padding: 22px 20px;
    border: 1px solid rgba(220, 205, 195, 0.35);
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 4px 16px rgba(140, 47, 75, 0.03);
  }

  .step-circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #fae0ea;
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    font-weight: 800;
    flex-shrink: 0;
  }

  .step-circle.gold {
    background: #faeed3;
    color: #7a5814;
  }

  .step-circle.wine {
    background: var(--wine);
    color: #ffffff;
  }

  .step-card-body h3 {
    font-size: 1.05rem;
    color: #2b1f24;
    margin-bottom: 6px;
  }

  .step-card-body p {
    font-size: 0.84rem;
    color: #6b5d63;
    line-height: 1.5;
    margin: 0;
  }

  /* Features Grid (Desktop 2x2, Mobile 1 col) */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }

  .feature-card {
    background: #ffffff;
    border-radius: 22px;
    padding: 24px 22px;
    border: 1px solid rgba(220, 205, 195, 0.35);
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 4px 16px rgba(140, 47, 75, 0.03);
  }

  .feature-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #fbf5ee;
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2px;
  }

  .feature-card h3 {
    font-size: 1.15rem;
    color: var(--wine);
  }

  .feature-card p {
    font-size: 0.86rem;
    color: #6b5d63;
    line-height: 1.5;
    margin: 0;
  }

  .feature-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    font-weight: 600;
    color: #8c7840;
    margin-top: 4px;
  }

  /* Wine Banner CTA */
  .banner-section {
    width: 100%;
    margin-top: 10px;
  }

  .cta-wine-banner {
    width: 100%;
    background: var(--grad-gold-rose);
    border-radius: 28px;
    padding: clamp(36px, 6vw, 56px) 24px;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    box-shadow: 0 16px 36px rgba(140, 47, 75, 0.35);
  }

  .cta-sparkle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    color: #f0d8a8;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2px;
  }

  .cta-title {
    font-size: clamp(1.8rem, 4vw, 2.5rem);
    line-height: 1.15;
    color: #ffffff;
  }

  .cta-sub {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.5;
    max-width: 46ch;
  }

  .cta-gold-btn {
    background: #f4d068;
    color: #4a3400;
    border: none;
    border-radius: 999px;
    padding: 14px 28px;
    font-family: var(--font-sans);
    font-size: 0.95rem;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    margin-top: 6px;
    transition: transform 0.15s ease;
  }

  .cta-gold-btn:hover {
    transform: translateY(-2px);
  }

  .cta-gold-btn:active {
    transform: scale(0.97);
  }

  .cta-guarantees {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.75);
    margin-top: 6px;
  }

  /* Responsive Adjustments */
  @media (max-width: 860px) {
    .hero-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 36px;
    }

    .hero-copy {
      align-items: center;
      text-align: center;
    }

    .hero-stage {
      margin-top: 10px;
    }

    .steps-flow {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }

    .step-card {
      flex-direction: row;
      align-items: flex-start;
      gap: 14px;
    }

    .features-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .row, .mini-toast {
      transition: none;
    }
  }
</style>
