<script>
  // Orario di apertura dei giochi: interruttore + giorno/ora di inizio e di fine.
  // Usato nella creazione del matrimonio e nel pannello di modifica della dashboard.
  // `startLocked`: a partita iniziata interruttore e inizio non sono più modificabili.
  let {
    enabled = $bindable(false),
    startDate = $bindable(''),
    startTime = $bindable(''),
    endDate = $bindable(''),
    endTime = $bindable(''),
    startLocked = false,
    idPrefix = 'timer'
  } = $props();
</script>

<div class="option-box">
  <div class="option-head">
    <div class="option-copy">
      <strong id="{idPrefix}-title">Orario di apertura giochi</strong>
      <span>Missioni e quiz attivi solo durante il ricevimento, per evitare spoiler prima del brindisi.</span>
    </div>
    <label class="clean-switch" class:is-locked={startLocked}>
      <input type="checkbox" bind:checked={enabled} disabled={startLocked} aria-labelledby="{idPrefix}-title" />
      <span class="slider"></span>
    </label>
  </div>

  {#if enabled}
    <div class="timer-grid">
      <div class="input-group">
        <label for="{idPrefix}-start-date" class="input-label">Giorno inizio</label>
        <input id="{idPrefix}-start-date" type="date" class="input-field" bind:value={startDate} disabled={startLocked} />
      </div>
      <div class="input-group">
        <label for="{idPrefix}-start-time" class="input-label">Ora inizio</label>
        <input id="{idPrefix}-start-time" type="time" class="input-field" bind:value={startTime} disabled={startLocked} />
      </div>
      <div class="input-group">
        <label for="{idPrefix}-end-date" class="input-label">Giorno fine</label>
        <input id="{idPrefix}-end-date" type="date" class="input-field" bind:value={endDate} />
      </div>
      <div class="input-group">
        <label for="{idPrefix}-end-time" class="input-label">Ora fine</label>
        <input id="{idPrefix}-end-time" type="time" class="input-field" bind:value={endTime} />
      </div>
    </div>
  {/if}
</div>

<style>
  .option-box {
    background: rgba(201, 169, 110, 0.08);
    border: 1px solid rgba(201, 169, 110, 0.25);
    border-radius: 16px;
    padding: 14px 16px;
  }

  .option-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .option-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .option-copy span {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
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
    transition: background-color 0.25s;
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
    transition: transform 0.25s;
    border-radius: 50%;
  }

  .clean-switch input:checked + .slider {
    background-color: var(--wine);
  }

  .clean-switch input:checked + .slider:before {
    transform: translateX(20px);
  }

  .clean-switch input:focus-visible + .slider {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  .clean-switch.is-locked .slider {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .timer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 14px;
  }

  .input-group {
    min-width: 0;
    margin-bottom: 0;
  }

  /* Date e orari: altezza fissa e niente sbordo su mobile (iOS li disegna più larghi) */
  input[type="date"],
  input[type="time"] {
    display: block;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    height: 48px;
    min-height: 48px;
    padding: 10px 12px;
    box-sizing: border-box;
    line-height: normal;
    -webkit-appearance: none;
    appearance: none;
  }

  input[type="date"]::-webkit-date-and-time-value,
  input[type="time"]::-webkit-date-and-time-value {
    display: flex;
    align-items: center;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    text-align: left;
  }

  input:disabled {
    background: var(--bg-surface-elevated);
    color: var(--text-dim);
    cursor: not-allowed;
  }

  @media (max-width: 420px) {
    .timer-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
