<script>
  import SecureLoginView from './SecureLoginView.svelte';

  // Schermata "Entra nel matrimonio" senza account: Registrati (chiede il codice) oppure Accedi (non lo chiede).
</script>

<SecureLoginView embedded joinMode initialMode="register" intro />
