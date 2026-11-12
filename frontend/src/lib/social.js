// Caricamento degli SDK social e ottenimento dei token da inviare al backend.
// Google: Google Identity Services -> ID token (JWT). Facebook: Facebook JS SDK -> access token.

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.id = id;
    el.src = src;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Impossibile caricare il servizio di accesso. Controlla la connessione.'));
    document.head.appendChild(el);
  });
}

/**
 * Mostra il pulsante ufficiale "Accedi con Google" dentro `container`.
 * `onCredential(idToken)` viene chiamato dopo il consenso dell'utente.
 */
export async function renderGoogleButton(container, clientId, onCredential) {
  await loadScript('https://accounts.google.com/gsi/client', 'google-gsi');
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      if (response?.credential) onCredential(response.credential);
    },
    ux_mode: 'popup'
  });
  container.innerHTML = '';
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: Math.min(360, Math.max(240, container.clientWidth || 320))
  });
}

let facebookReady = null;

function initFacebook(appId) {
  if (!facebookReady) {
    facebookReady = new Promise((resolve, reject) => {
      window.fbAsyncInit = () => {
        window.FB.init({ appId, cookie: false, xfbml: false, version: 'v21.0' });
        resolve();
      };
      loadScript('https://connect.facebook.net/it_IT/sdk.js', 'facebook-sdk').catch((err) => {
        facebookReady = null;
        reject(err);
      });
    });
  }
  return facebookReady;
}

/** Apre il popup di Facebook e ritorna l'access token. */
export async function facebookLogin(appId) {
  await initFacebook(appId);
  return new Promise((resolve, reject) => {
    window.FB.login(
      (response) => {
        if (response?.authResponse?.accessToken) resolve(response.authResponse.accessToken);
        else reject(new Error('Accesso con Facebook annullato.'));
      },
      { scope: 'public_profile,email' }
    );
  });
}
