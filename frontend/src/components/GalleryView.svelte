<script>
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import { eventTimer } from '../lib/timer.svelte.js';
  import { formatName } from '../lib/formatters.js';
  import { compressImage } from '../lib/imageCompressor.js';
  import LockedChallenges from './LockedChallenges.svelte';

  let selectedPhotos = $state([]);
  let isUploading = $state(false);
  let fileInput = $state(null);
  let caption = $state('');
  let activeModalPhoto = $state(null);

  const isCompressingAny = $derived(
    selectedPhotos.some(p => p.isCompressing)
  );

  // Progressive loading / Infinite scroll (24 photos per batch)
  const PAGE_SIZE = 24;
  let visibleCount = $state(24);
  let sentinelEl = $state(null);

  const visiblePhotos = $derived(
    appState.galleryPhotos.slice(0, visibleCount)
  );

  const hasMore = $derived(
    visibleCount < appState.galleryPhotos.length
  );

  function loadMore() {
    if (hasMore) {
      visibleCount = Math.min(visibleCount + PAGE_SIZE, appState.galleryPhotos.length);
    }
  }

  $effect(() => {
    if (!sentinelEl) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore) {
        loadMore();
      }
    }, { rootMargin: '300px' });

    observer.observe(sentinelEl);
    return () => observer.disconnect();
  });

  function displayName(photo) {
    const u = appState.user;
    if (u && photo.first_name === u.first_name && photo.last_name === u.last_name) {
      return 'Tu';
    }
    return `${formatName(photo.first_name)} ${formatName(photo.last_name)}`;
  }

  function handleFileSelect(e) {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const combinedFiles = [...selectedPhotos.map(p => p.file), ...rawFiles];
    if (combinedFiles.length > 10) {
      appState.showToast('Puoi caricare fino a 10 foto alla volta.', 'info');
      combinedFiles.length = 10;
    }

    selectedPhotos = combinedFiles.map((file, idx) => {
      const existing = selectedPhotos.find(p => p.file === file);
      if (existing) return existing;

      const item = $state({
        id: `sel-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        optimizedFile: null,
        isCompressing: true,
        sizeKb: null
      });

      compressImage(file)
        .then((comp) => {
          item.optimizedFile = comp;
          item.sizeKb = comp.sizeKb || Math.round(comp.size / 1024);
        })
        .catch((err) => {
          console.warn('Compressione non riuscita:', err);
          item.optimizedFile = file;
          item.sizeKb = Math.round(file.size / 1024);
        })
        .finally(() => {
          item.isCompressing = false;
        });

      return item;
    });

    if (fileInput) fileInput.value = '';
  }

  function removePhoto(id) {
    const item = selectedPhotos.find(p => p.id === id);
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    selectedPhotos = selectedPhotos.filter(p => p.id !== id);
    if (selectedPhotos.length === 0) {
      clearSelection();
    }
  }

  function clearSelection() {
    selectedPhotos.forEach(p => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    selectedPhotos = [];
    caption = '';
    if (fileInput) fileInput.value = '';
  }

  function isMyPhoto(photo) {
    if (!photo || !appState.user) return false;
    if (photo.user_id && String(photo.user_id) === String(appState.user.id)) return true;
    return photo.first_name === appState.user.first_name && photo.last_name === appState.user.last_name;
  }

  async function handleUpload() {
    if (selectedPhotos.length === 0) return;

    const isEnded = eventTimer.status === 'ended';
    const uploadCaption = caption;
    const count = selectedPhotos.length;
    const pts = isEnded ? 0 : count * 10;

    isUploading = true;

    try {
      // 1. Assicura che tutti i file siano ottimizzati
      const filesToSend = await Promise.all(
        selectedPhotos.map(async (p) => {
          if (p.optimizedFile) return p.optimizedFile;
          return await compressImage(p.file);
        })
      );

      // 2. Optimistic UI: crea le foto e inseriscile SUBITO nella galleria
      const now = new Date().toISOString();
      const optimisticEntries = selectedPhotos.map((p, idx) => ({
        id: `temp-${Date.now()}-${idx}`,
        user_id: appState.user?.id,
        first_name: appState.user?.first_name || 'Tu',
        last_name: appState.user?.last_name || '',
        photo_url: p.previewUrl,
        caption: uploadCaption,
        created_at: now,
        _optimistic: true
      }));

      // Inserisci tutte le foto in cima alla griglia all'istante (0ms)
      appState.galleryPhotos = [...optimisticEntries, ...appState.galleryPhotos];

      if (isEnded) {
        appState.showToast(count === 1 ? 'Foto aggiunta alla galleria!' : `${count} foto aggiunte alla galleria!`, 'success');
      } else {
        appState.showToast(count === 1 ? 'Foto caricata! +10 PT' : `${count} foto caricate! +${pts} PT`, 'success', pts);
      }

      // Chiudi subito l'area di caricamento per l'utente
      const tempIds = optimisticEntries.map(e => e.id);
      selectedPhotos = [];
      caption = '';
      if (fileInput) fileInput.value = '';
      isUploading = false;

      // 3. Invio effettivo in background verso il server
      api.submitPhotos(filesToSend, uploadCaption, !isEnded)
        .then((res) => {
          const createdSubs = res.submissions || [];
          appState.galleryPhotos = appState.galleryPhotos.map((p) => {
            const tempIdx = tempIds.indexOf(p.id);
            if (tempIdx !== -1 && createdSubs[tempIdx]) {
              return {
                ...p,
                id: createdSubs[tempIdx].id,
                photo_url: createdSubs[tempIdx].image_url,
                _optimistic: false
              };
            }
            return p;
          });

          Promise.all([
            appState.refreshUser(true),
            appState.refreshLeaderboard()
          ]).catch(e => console.warn('Background sync:', e));
        })
        .catch((err) => {
          console.error('Batch upload fallito:', err);
          appState.galleryPhotos = appState.galleryPhotos.filter(p => !tempIds.includes(p.id));
          appState.showToast(err.message || 'Errore durante il caricamento delle foto', 'error');
        });
    } catch (err) {
      appState.showToast(err.message || 'Errore durante l\'ottimizzazione delle foto', 'error');
      isUploading = false;
    }
  }

  async function handleDeletePhoto(photoId) {
    const isEnded = eventTimer.status === 'ended';
    const msg = isEnded
      ? 'Vuoi rimuovere questa foto dalla galleria?'
      : 'Vuoi rimuovere questa foto dalla galleria? Perderai i 10 punti guadagnati con questo scatto.';
    if (!confirm(msg)) return;
    try {
      // Rimozione istantanea dalla UI
      appState.galleryPhotos = appState.galleryPhotos.filter(p => p.id !== photoId);
      if (activeModalPhoto?.id === photoId) {
        activeModalPhoto = null;
      }
      await api.deletePhoto(photoId);
      if (isEnded) {
        appState.showToast('Foto rimossa dalla galleria', 'info');
      } else {
        appState.showToast('Foto rimossa dalla galleria (-10 PT)', 'info');
      }
      await Promise.all([
        appState.refreshUser(true),
        appState.refreshLeaderboard(),
        appState.refreshGallery(true)
      ]);
    } catch (err) {
      appState.showToast(err.message || 'Errore durante la cancellazione della foto', 'error');
      await appState.refreshGallery(true);
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="gallery-container">
  <!-- Section Title -->
  <div class="header-box">
    <h1 class="page-title font-serif gold-gradient-text">Galleria Condivisa</h1>
    <p class="page-desc">
      {#if eventTimer.status === 'ended'}
        I giochi sono conclusi, ma puoi continuare a caricare, visualizzare e gestire le foto della festa!
      {:else}
        Condividi i tuoi momenti con tutti gli invitati e guadagna 10 punti per ogni foto!
      {/if}
    </p>
  </div>

  {#if eventTimer.status === 'before_start'}
    <LockedChallenges
      title="Galleria Foto Bloccata"
      subtitle="La galleria fotografica e la condivisione degli scatti saranno aperte all'inizio dei giochi."
    />
  {:else}
    <!-- Upload Card -->
    <div class="glass-card glass-card-gold upload-card">
    {#if selectedPhotos.length === 0}
      <div class="upload-placeholder" onclick={() => fileInput?.click()}>
        <div class="upload-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/><path d="M12 10v6"/><path d="M9 13h6"/></svg>
        </div>
        <div class="upload-cta">Scatta o Scegli le Foto</div>
        <div class="upload-subtext">Seleziona anche più foto insieme • fino a 10 foto</div>
      </div>
    {:else}
      {#if selectedPhotos.length === 1}
        <div class="preview-area">
          <img src={selectedPhotos[0].previewUrl} alt="Anteprima" class="preview-image" />
          <button class="remove-btn" onclick={() => removePhoto(selectedPhotos[0].id)} title="Rimuovi">✕</button>
        </div>
      {:else}
        <div class="multi-preview-container">
          <div class="multi-preview-header">
            <span class="multi-count-label font-serif">{selectedPhotos.length} Foto Selezionate</span>
            <button class="clear-all-btn" onclick={clearSelection}>Rimuovi tutte</button>
          </div>
          <div class="multi-preview-grid">
            {#each selectedPhotos as item (item.id)}
              <div class="multi-thumb-wrapper">
                <img src={item.previewUrl} alt="Anteprima" class="multi-thumb-img" />
                <button class="multi-remove-btn" onclick={() => removePhoto(item.id)} title="Rimuovi foto">✕</button>
                {#if item.isCompressing}
                  <div class="thumb-loading-overlay">
                    <div class="spinner-tiny"></div>
                  </div>
                {:else if item.sizeKb}
                  <span class="thumb-size-tag">{item.sizeKb}KB</span>
                {/if}
              </div>
            {/each}
            {#if selectedPhotos.length < 10}
              <div class="add-more-thumb" onclick={() => fileInput?.click()} title="Aggiungi altre foto">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Aggiungi</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <div class="upload-inputs">
        <div class="multi-summary-bar">
          <div class="optimization-pill {isCompressingAny ? 'preparing' : ''}">
            {#if isCompressingAny}
              <div class="spinner-tiny"></div>
              <span>Ottimizzazione in corso...</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>{selectedPhotos.length} {selectedPhotos.length === 1 ? 'foto pronta' : 'foto pronte'} (HD)</span>
            {/if}
          </div>
          {#if eventTimer.status !== 'ended'}
            <span class="pts-badge-preview">+{selectedPhotos.length * 10} PT</span>
          {/if}
        </div>

        <input
          type="text"
          class="input-field"
          placeholder="Aggiungi una dedica o una didascalia... (opzionale)"
          bind:value={caption}
          maxlength="200"
        />

        <button class="btn btn-primary btn-block" onclick={handleUpload} disabled={isUploading || isCompressingAny}>
          {#if isUploading}
            <div class="spinner"></div>
            <span>Invio in corso...</span>
          {:else if isCompressingAny}
            <div class="spinner"></div>
            <span>Ottimizzazione foto in corso...</span>
          {:else if eventTimer.status === 'ended'}
            <span>Pubblica {selectedPhotos.length === 1 ? 'Foto' : `${selectedPhotos.length} Foto`} nella Galleria (0 PT)</span>
          {:else}
            <span>Pubblica {selectedPhotos.length === 1 ? 'Foto' : `${selectedPhotos.length} Foto`} (+{selectedPhotos.length * 10} PT)</span>
          {/if}
        </button>
      </div>
    {/if}

    <input
      type="file"
      multiple
      accept="image/*"
      class="hidden-file-input"
      bind:this={fileInput}
      onchange={handleFileSelect}
    />
  </div>

  <!-- Feed Title -->
  <div class="feed-header">
    <h2 class="feed-title font-serif">Gli Scatti della Festa</h2>
    <span class="badge badge-gold">{appState.galleryPhotos.length} Foto</span>
  </div>

  <!-- Photos Grid -->
  {#if appState.galleryPhotos.length === 0}
    <div class="empty-state glass-card">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>
      </div>
      <div class="empty-title">Nessuna foto ancora</div>
      <p class="empty-desc">Sii il primo a scattare e condividere un ricordo del matrimonio!</p>
    </div>
  {:else}
    <div class="photos-grid">
      {#each visiblePhotos as photo (photo.id)}
        {@const isMine = isMyPhoto(photo)}
        <div class="photo-card glass-card" onclick={() => activeModalPhoto = photo}>
          <div class="photo-img-wrapper">
            <img
              src={photo.photo_url}
              alt={photo.caption || 'Foto matrimonio'}
              loading="lazy"
              decoding="async"
              class="grid-img"
            />
            {#if isMine}
              <button
                class="photo-card-delete-btn"
                onclick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                title="Elimina la mia foto (-10 PT)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            {/if}
          </div>
          <div class="photo-meta">
            <div class="photo-author">{displayName(photo)}</div>
            <div class="photo-time">{formatTime(photo.created_at)}</div>
          </div>
          {#if photo.caption}
            <div class="photo-caption">{photo.caption}</div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Infinite Scroll Sentinel / Load More Button -->
    {#if hasMore}
      <div class="load-more-sentinel" bind:this={sentinelEl}>
        <button class="load-more-btn" onclick={loadMore}>
          <span>Mostra altre foto ({appState.galleryPhotos.length - visibleCount} rimanenti)</span>
        </button>
      </div>
    {/if}
  {/if}
  {/if}
</div>

<!-- Photo Lightbox Modal -->
{#if activeModalPhoto}
  {@const isMineModal = isMyPhoto(activeModalPhoto)}
  <div class="lightbox-overlay" onclick={() => activeModalPhoto = null}>
    <div class="lightbox-content" onclick={(e) => e.stopPropagation()}>
      <button class="lightbox-close" onclick={() => activeModalPhoto = null}>✕</button>
      <img src={activeModalPhoto.photo_url} alt="Dettaglio foto" class="lightbox-img" />
      <div class="lightbox-info">
        <div class="lightbox-header">
          <span class="lightbox-author">{displayName(activeModalPhoto)}</span>
          <span class="lightbox-time">{formatTime(activeModalPhoto.created_at)}</span>
        </div>
        {#if activeModalPhoto.caption}
          <div class="lightbox-caption">{activeModalPhoto.caption}</div>
        {/if}
        {#if isMineModal}
          <div class="modal-delete-row">
            <button class="btn-delete-photo" onclick={() => handleDeletePhoto(activeModalPhoto.id)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              Elimina la mia foto
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .gallery-container {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .header-box {
    padding: 0 4px;
  }

  .page-title {
    font-size: 1.7rem;
    font-weight: 700;
  }

  .page-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .upload-card {
    padding: 18px;
  }

  .upload-placeholder {
    border: 1.5px dashed rgba(201, 169, 110, 0.4);
    border-radius: var(--radius-md);
    padding: 30px 16px;
    text-align: center;
    cursor: pointer;
    background: rgba(201, 169, 110, 0.03);
    transition: all 0.2s ease;
  }

  .upload-placeholder:active {
    background: rgba(201, 169, 110, 0.07);
    border-color: var(--gold-primary);
  }

  .upload-icon {
    color: var(--gold-primary);
    margin-bottom: 8px;
  }

  .upload-cta {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--gold-dark);
  }

  .upload-subtext {
    font-size: 0.74rem;
    color: var(--text-dim);
    margin-top: 4px;
  }

  .hidden-file-input {
    display: none;
  }

  .preview-area {
    position: relative;
    width: 100%;
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: 12px;
    max-height: 280px;
    background: var(--bg-surface-elevated);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .preview-image {
    width: 100%;
    max-height: 280px;
    object-fit: contain;
  }

  .remove-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.8rem;
  }

  .upload-inputs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .multi-preview-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
  }

  .multi-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2px;
  }

  .multi-count-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .clear-all-btn {
    background: none;
    border: none;
    color: #ef4444;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.15s ease;
  }

  .clear-all-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .multi-preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    padding: 2px;
  }

  .multi-thumb-wrapper {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #000;
    border: 1px solid var(--border-gold);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  .multi-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .multi-remove-btn {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    border: none;
    font-size: 0.65rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: transform 0.15s ease, background 0.15s ease;
  }

  .multi-remove-btn:hover {
    background: rgba(239, 68, 68, 0.9);
    transform: scale(1.1);
  }

  .thumb-loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .thumb-size-tag {
    position: absolute;
    bottom: 2px;
    left: 2px;
    background: rgba(0, 0, 0, 0.75);
    color: #34d399;
    font-size: 0.62rem;
    font-weight: 600;
    padding: 1px 3px;
    border-radius: 3px;
    backdrop-filter: blur(2px);
  }

  .add-more-thumb {
    aspect-ratio: 1;
    border-radius: 8px;
    border: 1.5px dashed var(--border-gold);
    background: rgba(212, 175, 55, 0.05);
    color: var(--gold-dark);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    font-size: 0.68rem;
    font-weight: 600;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .add-more-thumb:hover {
    background: rgba(212, 175, 55, 0.12);
    border-color: var(--gold-primary);
  }

  .multi-summary-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .pts-badge-preview {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--gold-dark);
    background: rgba(212, 175, 55, 0.12);
    border: 1px solid rgba(212, 175, 55, 0.3);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .optimization-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 500;
    color: #059669;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    padding: 3px 10px;
    border-radius: 999px;
    align-self: flex-start;
  }

  .optimization-pill.preparing {
    color: var(--gold-dark);
    background: rgba(184, 134, 11, 0.08);
    border-color: rgba(184, 134, 11, 0.25);
  }

  .spinner-tiny {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(184, 134, 11, 0.25);
    border-top-color: var(--gold-dark);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .feed-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .feed-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    color: var(--gold-primary);
    margin-bottom: 10px;
  }

  .empty-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .empty-desc {
    font-size: 0.84rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .photos-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .photo-card {
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
  }

  .photo-img-wrapper {
    width: 100%;
    aspect-ratio: 1/1;
    background: var(--bg-surface-elevated);
    overflow: hidden;
  }

  .grid-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .photo-card:hover .grid-img {
    transform: scale(1.04);
  }

  .photo-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 4px 10px;
  }

  .photo-author {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--gold-dark);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .photo-time {
    font-size: 0.68rem;
    color: var(--text-dim);
  }

  .photo-caption {
    font-size: 0.74rem;
    color: var(--text-muted);
    padding: 0 10px 8px 10px;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Lightbox */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 12, 8, 0.78);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top, 0px)) 16px max(12px, env(safe-area-inset-bottom, 0px)) 16px;
    animation: fadeIn 0.2s ease;
  }

  .lightbox-content {
    position: relative;
    max-width: 500px;
    width: 100%;
    max-height: min(88dvh, calc(100svh - 24px));
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .lightbox-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-size: 0.9rem;
    cursor: pointer;
    z-index: 10;
  }

  .lightbox-img {
    width: 100%;
    max-height: 65vh;
    object-fit: contain;
    background: var(--bg-surface-elevated);
  }

  .lightbox-info {
    padding: 14px 16px;
  }

  .lightbox-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .lightbox-author {
    font-weight: 700;
    color: var(--gold-dark);
    font-size: 0.95rem;
  }

  .lightbox-time {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .lightbox-caption {
    font-size: 0.9rem;
    color: var(--text-main);
  }

  .photo-card-delete-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #ff9b9b;
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 5;
  }

  .photo-card-delete-btn:hover {
    background: #d32f2f;
    color: #fff;
    transform: scale(1.1);
  }

  .modal-delete-row {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    justify-content: flex-end;
  }

  .btn-delete-photo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-size: 0.8rem;
    font-weight: 600;
    color: #d32f2f;
    background: rgba(211, 47, 47, 0.08);
    border: 1px solid rgba(211, 47, 47, 0.25);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-delete-photo:hover {
    background: #d32f2f;
    color: #fff;
  }

  .load-more-sentinel {
    display: flex;
    justify-content: center;
    padding: 20px 0 10px 0;
    width: 100%;
  }

  .load-more-btn {
    background: rgba(201, 169, 110, 0.1);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--gold-dark);
    font-weight: 700;
    font-size: 0.85rem;
    padding: 10px 22px;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: var(--shadow-sm);
  }

  .load-more-btn:hover {
    background: rgba(201, 169, 110, 0.2);
    border-color: var(--gold-primary);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
