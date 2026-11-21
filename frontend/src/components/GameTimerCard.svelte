<script>
  import { slide } from 'svelte/transition';
  import { onDestroy } from 'svelte';
  import { api } from '../lib/api.js';
  import { appState } from '../lib/state.svelte.js';

  /** event: evento della dashboard (con game_started). onSaved(evento aggiornato). */
  let { event, onSaved } = $props();

  const pad = (n) => String(n).padStart(2, '0');
  const toDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmt = (d) => d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  let enabled = $state(false);
  let startDate = $state('');
  let startTime = $state('');
  let endDate = $state('');
  let endTime = $state('');
  let saving = $state(false);
  let dirty = $state(false);

  let now = $state(new Date());
  const clock = setInterval(() => { now = new Date(); }, 15000);
  onDestroy(() => clearInterval(clock));

  function syncFrom(ev) {
    enabled = !!ev.enable_timer;
    const fallbackStart = new Date();
    const start = ev.start_time ? new Date(ev.start_time) : fallbackStart;
    const end = ev.end_time ? new Date(ev.end_time) : new Date(start.getTime() + 4 * 3600_000);
    startDate = toDate(start);
    startTime = toTime(start);
    endDate = toDate(end);
    endTime = toTime(end);
    dirty = false;
  }

  // Riallinea quando l'evento cambia (apertura, salvataggio, aggiornamento live) se non ci sono modifiche in corso.
  $effect(() => {
    const ev = event;
    if (!dirty) syncFrom(ev);
  });

  const gameStarted = $derived(!!event.game_started);
  const start = $derived(new Date(`${startDate}T${startTime}`));
  const end = $derived(new Date(`${endDate}T${endTime}`));
  const savedStart = $derived(event.start_time ? new Date(event.start_time) : null);
  const savedEnd = $derived(event.end_time ? new Date(event.end_time) : null);

  // A partita iniziata l'inizio non si sposta più (al massimo resta quello già passato).
  const startLocked = $derived(gameStarted && event.enable_timer && savedStart && savedStart <= now);

  const status = $derived.by(() => {
    if (!event.enable_timer || (!savedStart && !savedEnd)) return { key: 'off', label: 'Timer disattivato', detail: 'Le sfide restano aperte senza limiti di orario.' };
    if (savedStart && now < savedStart) return { key: 'before', label: 'In attesa', detail: `Le sfide si aprono ${fmt(savedStart)}` };
    if (savedEnd && now >= savedEnd) return { key: 'ended', label: 'Sfide chiuse', detail: `Chiuse ${fmt(savedEnd)}` };
    return { key: 'live', label: 'Sfide aperte', detail: savedEnd ? `Chiudono ${fmt(savedEnd)}` : 'Nessun orario di chiusura' };
  });

  const error = $derived.by(() => {
    if (!enabled) return null;
    if (!startDate || !startTime || !endDate || !endTime) return 'Imposta giorno e ora di inizio e di chiusura.';
    if (isNaN(start) || isNaN(end)) return 'Date e orari non validi.';
    if (end <= start) return "La chiusura deve essere successiva all'inizio.";
    if (gameStarted && start > now) return "La partita è già iniziata: l'inizio non può essere nel futuro.";
    return null;
  });

  function edit(fn) {
    now = new Date();
    fn();
    dirty = true;
  }

  function toggle(e) {
    const on = e.currentTarget.checked;
    edit(() => {
      enabled = on;
      // Attivando a partita in corso l'inizio non può stare nel futuro: parte da adesso.
      if (on && gameStarted && start > new Date()) {
        const n = new Date();
        startDate = toDate(n);
        startTime = toTime(n);
      }
      if (on && end <= start) {
        const e2 = new Date(start.getTime() + 4 * 3600_000);
        endDate = toDate(e2);
        endTime = toTime(e2);
      }
    });
  }

  function extend(minutes) {
    edit(() => {
      enabled = true;
      // Se le sfide sono già chiuse si riparte da adesso, altrimenti si allunga la chiusura attuale.
      const base = isNaN(end) || end < new Date() ? new Date() : end;
      const next = new Date(base.getTime() + minutes * 60_000);
      endDate = toDate(next);
      endTime = toTime(next);
    });
  }

  async function save() {
    if (error || saving) return;
    const payload = enabled
      ? { enable_timer: true, end_time: end.toISOString(), ...(startLocked ? {} : { start_time: start.toISOString() }) }
      : { enable_timer: false };

    if (enabled && !gameStarted && start <= new Date()) {
      const ok = await appState.confirm(
        "L'orario di inizio è già passato: le sfide si apriranno subito agli invitati e non potrai più modificarle.",
        { title: 'Avviare subito la partita?', confirmText: 'Avvia', cancelText: 'Annulla' }
      );
      if (!ok) return;
    }

    await send(payload, 'Orari delle sfide aggiornati');
  }

  async function send(payload, successMessage) {
    saving = true;
    try {
      const updated = await api.updateDashboardEvent(event.id, payload);
      dirty = false;
      onSaved?.(updated);
      appState.showToast(successMessage, 'success');
    } catch (err) {
      appState.showToast(err?.message || 'Impossibile aggiornare gli orari.', 'error');
    } finally {
      saving = false;
    }
  }

  /** Toglie del tutto il limite di orario, salvando subito. */
  async function disableTimer() {
    if (saving) return;
    // Timer mai salvato: basta annullare le modifiche locali.
    if (!event.enable_timer) {
      syncFrom(event);
      return;
    }
    const ok = await appState.confirm(
      'Le sfide resteranno aperte senza orario di inizio né di chiusura. Potrai riattivare il timer quando vuoi.',
      { title: 'Disattivare il timer?', confirmText: 'Disattiva', cancelText: 'Annulla' }
    );
    if (!ok) return;
    await send({ enable_timer: false }, 'Timer disattivato: le sfide non hanno più limiti di orario');
  }
</script>

<section class="timer-card" aria-labelledby="timer-card-title">
  <div class="timer-head">
    <div class="timer-copy">
      <h2 id="timer-card-title" class="font-serif">Tempo delle sfide</h2>
      <p class="timer-status">
        <span class="status-dot {status.key}" aria-hidden="true"></span>
        <strong>{status.label}</strong>
        <span class="status-detail">· {status.detail}</span>
      </p>
    </div>
    <label class="clean-switch" title={enabled ? 'Disattiva il timer' : 'Attiva il timer'}>
      <input type="checkbox" checked={enabled} onchange={toggle} aria-label="Timer delle sfide" />
      <span class="slider"></span>
    </label>
  </div>

  {#if enabled}
    <div class="timer-body" transition:slide={{ duration: 180 }}>
      <div class="timer-grid">
        <div class="input-group">
          <label for="tStartDate" class="input-label">Giorno inizio</label>
          <input id="tStartDate" type="date" class="input-field" value={startDate} disabled={startLocked}
            oninput={(e) => edit(() => (startDate = e.currentTarget.value))} />
        </div>
        <div class="input-group">
          <label for="tStartTime" class="input-label">Ora inizio</label>
          <input id="tStartTime" type="time" class="input-field" value={startTime} disabled={startLocked}
            oninput={(e) => edit(() => (startTime = e.currentTarget.value))} />
        </div>
        <div class="input-group">
          <label for="tEndDate" class="input-label">Giorno fine</label>
          <input id="tEndDate" type="date" class="input-field" value={endDate}
            oninput={(e) => edit(() => (endDate = e.currentTarget.value))} />
        </div>
        <div class="input-group">
          <label for="tEndTime" class="input-label">Ora fine</label>
          <input id="tEndTime" type="time" class="input-field" value={endTime}
            oninput={(e) => edit(() => (endTime = e.currentTarget.value))} />
        </div>
      </div>
      {#if startLocked}
        <p class="timer-hint">La partita è iniziata: puoi solo spostare la chiusura.</p>
      {/if}

      <div class="extend-row" role="group" aria-label="Prolunga la chiusura">
        <span class="extend-label">Prolunga</span>
        <button type="button" class="extend-btn" onclick={() => extend(15)}>+15 min</button>
        <button type="button" class="extend-btn" onclick={() => extend(30)}>+30 min</button>
        <button type="button" class="extend-btn" onclick={() => extend(60)}>+1 ora</button>
      </div>

      <button type="button" class="disable-btn" disabled={saving} onclick={disableTimer}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4"/><path d="M9 2h6"/><path d="m4 4 16 16"/></svg>
        <span>{event.enable_timer ? 'Disattiva il timer' : 'Non voglio il timer'}</span>
      </button>
    </div>
  {:else if !event.enable_timer}
    <p class="timer-hint">Nessun limite di orario: gli invitati possono giocare in qualsiasi momento. Attiva l'interruttore per impostare apertura e chiusura delle sfide.</p>
  {/if}

  {#if error && dirty}
    <p class="timer-error" role="alert">{error}</p>
  {/if}

  {#if dirty}
    <div class="timer-actions" transition:slide={{ duration: 160 }}>
      <button type="button" class="btn btn-secondary" disabled={saving} onclick={() => syncFrom(event)}>Annulla</button>
      <button type="button" class="btn btn-primary" disabled={saving || !!error} onclick={save}>
        {saving ? 'Salvataggio...' : 'Salva orari'}
      </button>
    </div>
  {/if}
</section>

<style>
  .timer-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 20px;
    border-radius: 24px;
    background: #ffffff;
    border: 1px solid rgba(140, 47, 75, 0.1);
    box-shadow: 0 8px 20px -12px rgba(106, 32, 55, 0.1);
  }

  .timer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .timer-copy {
    min-width: 0;
  }

  .timer-copy h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-main, #241c20);
    margin: 0 0 2px;
  }

  .timer-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 0.84rem;
    color: var(--text-main, #241c20);
    margin: 0;
  }

  .status-detail {
    color: var(--text-muted, #6e6167);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #b5aaa5;
    flex-shrink: 0;
  }
  .status-dot.live { background: #27ae60; box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.18); }
  .status-dot.before { background: var(--gold-primary, #c9a96e); }
  .status-dot.ended { background: #c0392b; }

  .timer-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .timer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
  }

  .input-group {
    min-width: 0;
    margin-bottom: 0;
  }

  .timer-grid input {
    display: block;
    width: 100%;
    min-width: 0;
    height: 46px;
    padding: 10px 12px;
    box-sizing: border-box;
    font-size: 16px;
    -webkit-appearance: none;
    appearance: none;
  }

  .timer-grid input:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .timer-hint {
    font-size: 0.78rem;
    color: var(--text-muted, #6e6167);
    margin: 0;
  }

  .extend-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .extend-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted, #6e6167);
  }

  .extend-btn {
    min-height: var(--control-sm, 36px);
    padding: 0 14px;
    border-radius: 999px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--gold-dark, #8a6d3b);
    font-size: var(--fs-sm, 0.85rem);
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .extend-btn:hover {
    background: rgba(201, 169, 110, 0.22);
  }

  .disable-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--control-sm, 36px);
    padding: 0 4px;
    background: none;
    border: none;
    color: #a93226;
    font-size: var(--fs-sm, 0.85rem);
    font-weight: 600;
    cursor: pointer;
  }

  .disable-btn:hover:not(:disabled) {
    text-decoration: underline;
  }

  .disable-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .timer-error {
    font-size: 0.82rem;
    color: #c0392b;
    margin: 0;
  }

  .timer-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .clean-switch {
    position: relative;
    display: inline-block;
    width: 46px;
    height: 26px;
    flex-shrink: 0;
  }

  .clean-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .clean-switch .slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: #d1c7c2;
    transition: 0.25s;
    border-radius: 26px;
  }

  .clean-switch .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.25s;
    border-radius: 50%;
  }

  .clean-switch input:checked + .slider {
    background-color: var(--wine, #8c2f4b);
  }

  .clean-switch input:checked + .slider:before {
    transform: translateX(20px);
  }

  .clean-switch input:focus-visible + .slider {
    outline: 2px solid var(--wine, #8c2f4b);
    outline-offset: 2px;
  }

  @media (max-width: 420px) {
    .timer-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .clean-switch .slider,
    .clean-switch .slider:before {
      transition: none;
    }
  }
</style>
