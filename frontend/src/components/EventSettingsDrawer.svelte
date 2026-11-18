<script>
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { untrack } from 'svelte';
  import { api } from '../lib/api.js';
  import { appState } from '../lib/state.svelte.js';
  import TimerFields from './TimerFields.svelte';

  // Pannello da destra della dashboard: nomi degli sposi e orario dei giochi.
  // `event` è l'evento del dettaglio (con game_started); `onSaved` riceve l'evento aggiornato.
  let { open = $bindable(false), event, onSaved } = $props();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULT_START = '12:00';
  const DEFAULT_END = '23:30';

  let spouse1 = $state('');
  let spouse2 = $state('');
  let enabled = $state(false);
  let startDate = $state('');
  let startTime = $state('');
  let endDate = $state('');
  let endTime = $state('');
  let saving = $state(false);
  let panel = $state();

  const pad = (n) => String(n).padStart(2, '0');
  const toDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const combine = (date, time) => new Date(`${date}T${time}`);

  // A partita iniziata il server blocca timer e inizio: li mostriamo disattivati
  const started = $derived(!!event?.game_started);

  // Ad ogni apertura i campi ripartono dai valori salvati. Solo `open` fa da trigger:
  // un aggiornamento live dell'evento non deve cancellare quello che si sta scrivendo.
  $effect(() => {
    if (open) untrack(fillFromEvent);
  });

  function fillFromEvent() {
    if (!event) return;
    const start = event.start_time ? new Date(event.start_time) : null;
    const end = event.end_time ? new Date(event.end_time) : null;
    const today = toDate(new Date());
    spouse1 = event.spouse1_name || '';
    spouse2 = event.spouse2_name || '';
    enabled = !!event.enable_timer;
    startDate = start ? toDate(start) : today;
    startTime = start ? toTime(start) : DEFAULT_START;
    endDate = end ? toDate(end) : startDate;
    endTime = end ? toTime(end) : DEFAULT_END;
  }

  // Focus nel pannello all'apertura, Esc per chiudere
  $effect(() => {
    if (!open) return;
    const returnFocus = document.activeElement;
    queueMicrotask(() => panel?.querySelector('input:not([disabled])')?.focus({ preventScroll: true }));
    const onKey = (e) => { if (e.key === 'Escape' && !saving) open = false; };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      returnFocus?.focus?.({ preventScroll: true });
    };
  });

  const close = () => { if (!saving) open = false; };

  const sameInstant = (date, iso) => !!iso && date.getTime() === new Date(iso).getTime();

  /** Solo i campi cambiati: rimandare timer o inizio invariati a partita iniziata darebbe errore. */
  function buildChanges() {
    const changes = {};
    if (spouse1.trim() !== event.spouse1_name) changes.spouse1_name = spouse1.trim();
    if (spouse2.trim() !== event.spouse2_name) changes.spouse2_name = spouse2.trim();
    if (!started && enabled !== !!event.enable_timer) changes.enable_timer = enabled;
    if (enabled) {
      const start = combine(startDate, startTime);
      const end = combine(endDate, endTime);
      if (!started && !sameInstant(start, event.start_time)) changes.start_time = start.toISOString();
      if (!sameInstant(end, event.end_time)) changes.end_time = end.toISOString();
    }
    return changes;
  }

  function validationError() {
    if (!spouse1.trim() || !spouse2.trim()) return 'Inserisci il nome di entrambi gli sposi.';
    if (!enabled) return null;
    if (!startDate || !startTime || !endDate || !endTime) return 'Imposta giorno e ora di inizio e di chiusura dei giochi.';
    const start = combine(startDate, startTime);
    const end = combine(endDate, endTime);
    if (isNaN(start) || isNaN(end)) return 'Date e orari non validi.';
    if (end <= start) return "La chiusura dei giochi deve essere successiva all'inizio.";
    if (started && end <= new Date()) return "L'orario di chiusura è già passato: scegline uno futuro.";
    return null;
  }

  /** Avvisi per le modifiche che aprono subito i giochi: false se gli sposi annullano. */
  async function confirmEffects(changes) {
    if (changes.enable_timer === false) {
      return appState.confirm('Senza orario i giochi sono subito aperti agli invitati.', {
        title: 'Togliere l\'orario?',
        confirmText: 'Togli l\'orario'
      });
    }
    if ((changes.start_time || changes.enable_timer) && combine(startDate, startTime) <= new Date()) {
      return appState.confirm(
        "L'inizio è già passato: la partita parte subito e le sfide non saranno più modificabili.",
        { title: 'Aprire subito i giochi?', confirmText: 'Apri i giochi' }
      );
    }
    return true;
  }

  async function save(e) {
    e.preventDefault();
    const error = validationError();
    if (error) {
      appState.showToast(error, 'error');
      return;
    }
    const changes = buildChanges();
    if (Object.keys(changes).length === 0) {
      open = false;
      return;
    }
    if (!(await confirmEffects(changes))) return;

    saving = true;
    try {
      const updated = await api.updateDashboardEvent(event.id, changes);
      onSaved?.(updated);
      appState.showToast('Modifiche salvate.', 'success');
      saving = false;
      open = false;
    } catch (err) {
      appState.showToast(err.message || 'Salvataggio non riuscito. Riprova.', 'error');
    } finally {
      saving = false;
    }
  }
</script>

{#if open && event}
  <div
    class="drawer-backdrop open"
    transition:fade={{ duration: reduceMotion ? 0 : 180 }}
    onclick={close}
    role="presentation"
  ></div>
  <form
    bind:this={panel}
    class="drawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="event-settings-title"
    onsubmit={save}
    transition:fly={{ x: 520, duration: reduceMotion ? 0 : 260, easing: cubicOut, opacity: 1 }}
  >
    <div class="drawer-head">
      <h2 id="event-settings-title" class="drawer-title font-serif">Nomi e orari</h2>
      <button type="button" class="drawer-close" onclick={close} aria-label="Chiudi pannello">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <div class="drawer-body">
      <fieldset class="names">
        <legend class="section-label">Gli sposi</legend>
        <div class="name-row">
          <div class="input-group">
            <label for="settings-spouse1" class="input-label">Primo sposo</label>
            <input id="settings-spouse1" class="input-field" bind:value={spouse1} autocomplete="off" maxlength="60" required />
          </div>
          <div class="input-group">
            <label for="settings-spouse2" class="input-label">Secondo sposo</label>
            <input id="settings-spouse2" class="input-field" bind:value={spouse2} autocomplete="off" maxlength="60" required />
          </div>
        </div>
      </fieldset>

      <div class="timer-section">
        <span class="section-label">Quando si gioca</span>
        {#if started}
          <p class="locked-note" role="note">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>
              {#if enabled}
                La partita è iniziata: puoi solo spostare l'orario di chiusura.
              {:else}
                La partita è iniziata senza orario: i giochi restano aperti.
              {/if}
            </span>
          </p>
        {/if}
        <TimerFields
          bind:enabled
          bind:startDate
          bind:startTime
          bind:endDate
          bind:endTime
          startLocked={started}
          idPrefix="settings-timer"
        />
      </div>
    </div>

    <div class="drawer-foot">
      <button type="button" class="btn btn-secondary" onclick={close} disabled={saving}>Annulla</button>
      <button type="submit" class="btn btn-primary" disabled={saving}>
        {#if saving}
          <span class="spinner-sm"></span> Salvataggio…
        {:else}
          Salva
        {/if}
      </button>
    </div>
  </form>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(36, 28, 32, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000;
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(100%, 480px);
    height: 100dvh;
    z-index: 1001;
    background: #fff;
    box-shadow: -24px 0 60px -24px rgba(106, 32, 55, 0.45);
    display: flex;
    flex-direction: column;
    overscroll-behavior: contain;
  }

  .drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: max(16px, env(safe-area-inset-top, 0px)) 16px 14px 20px;
    border-bottom: 1px solid rgba(36, 28, 32, 0.07);
  }

  .drawer-title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    line-height: 1.15;
  }

  .drawer-close {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    background: #f7f3f1;
    color: #6b5f64;
    cursor: pointer;
  }

  .drawer-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
  }

  .section-label {
    display: block;
    margin-bottom: 10px;
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    color: var(--text-main);
  }

  .names {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }

  .name-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .input-field {
    min-height: 48px;
  }

  .locked-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0 0 10px;
    font-size: var(--fs-base);
    line-height: 1.4;
    color: var(--gold-dark);
  }

  .locked-note svg {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .drawer-foot {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 10px;
    padding: 12px 20px max(14px, env(safe-area-inset-bottom, 0px));
    border-top: 1px solid rgba(36, 28, 32, 0.07);
  }

  .drawer-foot .btn {
    min-height: 48px;
    justify-content: center;
  }

  .spinner-sm {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 420px) {
    .name-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
