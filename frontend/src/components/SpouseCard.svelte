<script>
  import { appState } from '../lib/state.svelte.js';

  let { loggedIn = false, onLogin = () => {} } = $props();
</script>

<div class="spouse-card">
  <div class="heart-bubble" aria-hidden="true">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  </div>
  <div class="spouse-card-body">
    <h2>Siete gli sposi?</h2>
    <p>Gestite missioni, foto degli invitati e la classifica in tempo reale dalla vostra dashboard.</p>
    <button type="button" onclick={() => loggedIn ? appState.openDashboard() : onLogin()}>
      {loggedIn ? 'Vai ai miei matrimoni' : 'Accedi alla dashboard'}
    </button>
    <p class="create-prompt">
      Non avete ancora un Fanta Matrimonio?
      <button type="button" class="inline-link" onclick={() => appState.setAuthView('create')}>Crealo ora</button>
    </p>
  </div>
</div>

<style>
  .spouse-card {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid rgba(220, 205, 195, 0.35);
    border-radius: 20px;
    background: #f5f0ec;
    padding: 20px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .heart-bubble {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #fae0ea;
    color: var(--wine);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spouse-card-body {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  h2 {
    margin: 0;
    color: #2b1f24;
    font-size: 0.88rem;
    line-height: 1.3;
  }

  p {
    margin: 0;
    color: #6b5d63;
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .spouse-card-body > button {
    width: 100%;
    max-width: 320px;
    margin-top: 4px;
    padding: 11px 20px;
    border: 1px solid rgba(74, 14, 46, 0.12);
    border-radius: 999px;
    background: #fff;
    color: #2b1f24;
    font-size: 0.86rem;
    font-weight: 700;
    cursor: pointer;
  }

  .spouse-card-body > button:hover {
    background: #faf7f2;
    border-color: var(--wine);
  }

  .create-prompt {
    margin-top: 4px;
  }

  .inline-link {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--wine);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
