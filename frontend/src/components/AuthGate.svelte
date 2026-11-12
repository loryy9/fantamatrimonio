<script>
  import SecureLoginView from './SecureLoginView.svelte';

  // Schermata "Entra nel matrimonio" senza account: Registrati (chiede il codice) oppure Accedi (non lo chiede).
  const intro = {
    title: 'Entra nella festa',
    lead: 'Nuovo? Registrati con il codice matrimonio che ti hanno dato gli sposi. Hai già un account? Accedi, il codice te lo chiediamo subito dopo.'
  };
</script>

<SecureLoginView embedded joinMode initialMode="register" {intro} />
