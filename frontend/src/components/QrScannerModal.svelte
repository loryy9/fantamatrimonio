<script>
  import { onMount, onDestroy } from 'svelte';
  import jsQR from 'jsqr';

  let { isOpen = false, onScan = () => {}, onClose = () => {} } = $props();

  let videoEl = $state(null);
  let canvasEl = $state(null);
  let fileInputEl = $state(null);
  let stream = null;
  let animId = null;
  let cameraError = $state('');
  let isDecoding = $state(false);

  function extractCode(raw) {
    if (!raw) return '';
    const text = String(raw).trim();
    // 1. Try URL parameter ?code=...
    try {
      if (text.includes('?')) {
        const url = new URL(text, window.location.origin);
        const codeParam = url.searchParams.get('code');
        if (codeParam) return codeParam.trim().toUpperCase();
      }
    } catch {
      // not a full URL, continue
    }

    // 2. Try match after ?code= or /join/ or /
    const urlMatch = text.match(/[?&]code=([A-Za-z0-9\-_]+)/i);
    if (urlMatch && urlMatch[1]) return urlMatch[1].toUpperCase();

    // 3. Match code alphanumeric with optional hyphens (4 to 16 chars)
    const directMatch = text.match(/[A-Za-z0-9\-_]{4,16}/);
    if (directMatch) return directMatch[0].toUpperCase();

    return text.toUpperCase();
  }

  function handleFoundCode(code) {
    if (!code) return;
    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch {}
    stopCamera();
    onScan(code);
    onClose();
  }

  async function startCamera() {
    cameraError = '';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraError = 'La fotocamera diretta richiede una connessione sicura (HTTPS) o supporto browser. Puoi comunque scattare o caricare una foto del QR qui sotto!';
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', 'true');
        await videoEl.play();
        scanFrame();
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      cameraError = 'Impossibile avviare la fotocamera diretta. Puoi scattare o scegliere una foto del QR code con il pulsante qui sotto.';
    }
  }

  function scanFrame() {
    if (!videoEl || !canvasEl || !stream) return;

    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      const w = videoEl.videoWidth;
      const h = videoEl.videoHeight;
      if (w > 0 && h > 0) {
        canvasEl.width = w;
        canvasEl.height = h;
        const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            const parsed = extractCode(code.data);
            if (parsed) {
              handleFoundCode(parsed);
              return;
            }
          }
        }
      }
    }

    animId = requestAnimationFrame(scanFrame);
  }

  function stopCamera() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    if (stream) {
      try {
        stream.getTracks().forEach((track) => track.stop());
      } catch {}
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    isDecoding = true;
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        const parsed = extractCode(code.data);
        if (parsed) {
          handleFoundCode(parsed);
          return;
        }
      }
      alert('Nessun codice QR valido rilevato nella foto. Prova ad avvicinarti o inserisci il codice a mano.');
    } catch (err) {
      alert('Errore durante la lettura dell\'immagine. Riprova o inserisci il codice a mano.');
    } finally {
      isDecoding = false;
      if (fileInputEl) fileInputEl.value = '';
    }
  }

  $effect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
  });

  onDestroy(() => {
    stopCamera();
  });
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal-card">
      <div class="modal-header">
        <div class="header-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="6" height="6" x="3" y="3" rx="1"/>
            <rect width="6" height="6" x="15" y="3" rx="1"/>
            <rect width="6" height="6" x="3" y="15" rx="1"/>
            <path d="m15 15 3 3M15 21l6-6"/>
          </svg>
          <span>Scansiona Codice QR</span>
        </div>
        <button type="button" class="close-btn" onclick={onClose} aria-label="Chiudi">✕</button>
      </div>

      <div class="scanner-body">
        <canvas bind:this={canvasEl} style="display: none;"></canvas>

        {#if !cameraError}
          <div class="video-container">
            <!-- svelte-ignore a11y_media_has_caption -->
            <video bind:this={videoEl} playsinline muted></video>
            <div class="scanner-reticle">
              <div class="reticle-corner tl"></div>
              <div class="reticle-corner tr"></div>
              <div class="reticle-corner bl"></div>
              <div class="reticle-corner br"></div>
              <div class="reticle-laser"></div>
            </div>
            <p class="scan-prompt">Inquadra il QR code sul tableau o segnaposto</p>
          </div>
        {:else}
          <div class="fallback-camera-box">
            <div class="fallback-icon">📷</div>
            <p class="fallback-text">{cameraError}</p>
          </div>
        {/if}

        <div class="scanner-actions">
          <label class="btn-photo-upload" class:loading={isDecoding}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
            <span>{isDecoding ? 'Decodifica foto in corso...' : 'Scatta o Scegli foto del QR'}</span>
            <input
              bind:this={fileInputEl}
              type="file"
              accept="image/*"
              capture="environment"
              onchange={handleFileSelected}
              disabled={isDecoding}
              style="display: none;"
            />
          </label>

          <button type="button" class="btn-cancel" onclick={onClose}>
            Inserisci codice a mano
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(18, 8, 12, 0.78);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-card {
    width: 100%;
    max-width: 440px;
    background: #ffffff;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(220, 205, 195, 0.4);
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    background: #faf7f2;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.02rem;
    font-weight: 700;
    color: var(--wine);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.05);
    color: #555;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .scanner-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .video-container {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    max-height: 290px;
    background: #000000;
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .scanner-reticle {
    position: absolute;
    width: 72%;
    height: 72%;
    pointer-events: none;
  }

  .reticle-corner {
    position: absolute;
    width: 28px;
    height: 28px;
    border-color: #f7d070;
    border-style: solid;
    border-width: 0;
  }

  .reticle-corner.tl { top: 0; left: 0; border-top-width: 3.5px; border-left-width: 3.5px; border-top-left-radius: 10px; }
  .reticle-corner.tr { top: 0; right: 0; border-top-width: 3.5px; border-right-width: 3.5px; border-top-right-radius: 10px; }
  .reticle-corner.bl { bottom: 0; left: 0; border-bottom-width: 3.5px; border-left-width: 3.5px; border-bottom-left-radius: 10px; }
  .reticle-corner.br { bottom: 0; right: 0; border-bottom-width: 3.5px; border-right-width: 3.5px; border-bottom-right-radius: 10px; }

  .reticle-laser {
    position: absolute;
    top: 10%;
    left: 4%;
    right: 4%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #ff4d79, transparent);
    box-shadow: 0 0 10px #ff4d79;
    animation: laserScan 2s ease-in-out infinite alternate;
  }

  @keyframes laserScan {
    from { top: 10%; }
    to { top: 88%; }
  }

  .scan-prompt {
    position: absolute;
    bottom: 10px;
    background: rgba(0, 0, 0, 0.65);
    color: #ffffff;
    font-size: 0.76rem;
    padding: 4px 12px;
    border-radius: 999px;
    letter-spacing: 0.02em;
  }

  .fallback-camera-box {
    width: 100%;
    padding: 24px 16px;
    background: #fdf8f4;
    border: 1.5px dashed rgba(200, 160, 120, 0.4);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }

  .fallback-icon {
    font-size: 2.2rem;
  }

  .fallback-text {
    font-size: 0.84rem;
    color: #6b5c62;
    line-height: 1.45;
  }

  .scanner-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-photo-upload {
    width: 100%;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--wine);
    color: #ffffff;
    padding: 13px 18px;
    border-radius: 999px;
    font-size: 0.92rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(140, 47, 75, 0.25);
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .btn-photo-upload:hover {
    background: var(--wine-deep);
  }

  .btn-photo-upload:active {
    transform: scale(0.98);
  }

  .btn-photo-upload.loading {
    opacity: 0.7;
    pointer-events: none;
  }

  .btn-cancel {
    background: transparent;
    border: none;
    color: #7b6d74;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 8px;
    cursor: pointer;
  }

  .btn-cancel:hover {
    color: var(--wine);
    text-decoration: underline;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(16px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
