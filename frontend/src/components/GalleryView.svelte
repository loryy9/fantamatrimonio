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
    <h1 class="page-title font-serif">Galleria Condivisa</h1>
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
    <div class="upload-card">
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
          <button class="remove-btn" onclick={() => removePhoto(selectedPhotos[0].id)} title="Rimuovi" aria-label="Rimuovi">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
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
                <button class="multi-remove-btn" onclick={() => removePhoto(item.id)} title="Rimuovi foto" aria-label="Rimuovi foto">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
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
    <span class="badge badge-rose">{appState.galleryPhotos.length} foto</span>
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
      <button class="lightbox-close" onclick={() => activeModalPhoto = null} aria-label="Chiudi">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
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
  .header-box { padding: 0 4px; }
  .header-box::after { content: ''; display: block; width: 44px; height: 2px; border-radius: 2px; background: var(--wine); margin-top: 14px; }
  .page-title { font-family: var(--font-display); font-size: clamp(2rem, 6vw, 2.8rem); font-weight: 600; line-height: 1.05; letter-spacing: -0.01em; color: var(--text-main); }
  .page-desc { font-size: 0.92rem; font-style: italic; color: #6b5f64; margin-top: 8px; line-height: 1.5; max-width: 560px; }

  .gallery-container { display: flex; flex-direction: column; gap: 24px; }
  .upload-card { padding: 18px; border-radius: 26px; background: #fff; border: 1px solid rgba(36,28,32,.07); box-shadow: 0 18px 34px -24px rgba(106,32,55,.4); }
  .upload-placeholder { border: 1.5px dashed rgba(140,47,75,.3); border-radius: 20px; padding: 34px 16px; text-align: center; cursor: pointer; background: var(--wine-tint); transition: background .2s ease, border-color .2s ease; }
  .upload-placeholder:active { border-color: var(--wine); }
  @media (hover: hover) { .upload-placeholder:hover { border-color: var(--wine); background: #f1dae1; } }
  .upload-icon { width: 60px; height: 60px; margin: 0 auto 10px; border-radius: 50%; background: #fff; color: var(--wine); display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px -12px rgba(106,32,55,.5); }
  .upload-cta { font-family: var(--font-display); font-weight: 600; font-size: 1.3rem; color: var(--wine-deep); }
  .upload-subtext { font-size: .76rem; color: #6b5f64; margin-top: 4px; }
  .hidden-file-input { display: none; }
  .preview-area { position: relative; width: 100%; border-radius: 20px; overflow: hidden; margin-bottom: 12px; max-height: 280px; background: var(--bg-surface-elevated); display: flex; justify-content: center; align-items: center; }
  .preview-image { width: 100%; max-height: 280px; object-fit: contain; }
  .remove-btn { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border-radius: 50%; background: rgba(36,28,32,.6); backdrop-filter: blur(6px); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .upload-inputs { display: flex; flex-direction: column; gap: 10px; }
  .multi-preview-container { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
  .multi-preview-header { display: flex; justify-content: space-between; align-items: center; padding: 0 2px; }
  .multi-count-label { font-size: 1.15rem; font-weight: 600; color: var(--text-main); }
  .clear-all-btn { background: none; border: none; color: var(--wine); font-size: .78rem; font-weight: 600; cursor: pointer; padding: 4px 10px; border-radius: 999px; transition: background .15s ease; }
  @media (hover: hover) { .clear-all-btn:hover { background: var(--wine-tint); } }
  .multi-preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; max-height: 210px; overflow-y: auto; padding: 2px; }
  .multi-thumb-wrapper { position: relative; aspect-ratio: 1; border-radius: 16px; overflow: hidden; background: var(--bg-surface-elevated); border: 1px solid rgba(36,28,32,.07); }
  .multi-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .multi-remove-btn { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(36,28,32,.65); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 2; transition: background .15s ease; }
  @media (hover: hover) { .multi-remove-btn:hover { background: var(--wine); } }
  .thumb-loading-overlay { position: absolute; inset: 0; background: rgba(255,253,251,.6); display: flex; align-items: center; justify-content: center; }
  .thumb-size-tag { position: absolute; bottom: 4px; left: 4px; background: rgba(255,255,255,.9); color: #4f7d68; font-size: .62rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; }
  .add-more-thumb { aspect-ratio: 1; border-radius: 16px; border: 1.5px dashed rgba(140,47,75,.35); background: var(--wine-tint); color: var(--wine); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; font-size: .7rem; font-weight: 600; transition: background .15s ease; }
  @media (hover: hover) { .add-more-thumb:hover { background: #f1dae1; } }
  .multi-summary-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .pts-badge-preview { font-size: .78rem; font-weight: 700; color: #7a5a1c; background: rgba(233,201,143,.3); border: 1px solid rgba(201,169,110,.5); padding: 3px 11px; border-radius: 999px; }
  .optimization-pill { display: inline-flex; align-items: center; gap: 6px; font-size: .78rem; font-weight: 600; color: #3f6d58; background: rgba(127,169,148,.16); border: 1px solid rgba(127,169,148,.4); padding: 4px 12px; border-radius: 999px; align-self: flex-start; }
  .optimization-pill.preparing { color: var(--wine); background: var(--wine-tint); border-color: rgba(140,47,75,.2); }
  .spinner-tiny { width: 12px; height: 12px; border: 2px solid rgba(140,47,75,.2); border-top-color: var(--wine); border-radius: 50%; animation: spin .8s linear infinite; }
  .feed-header { display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px; }
  .feed-title { font-size: 1.6rem; font-weight: 600; color: var(--text-main); }
  .empty-state { text-align: center; padding: 44px 20px; border-radius: 26px; }
  .empty-icon { width: 68px; height: 68px; margin: 0 auto 12px; border-radius: 50%; background: var(--wine-tint); color: var(--wine); display: flex; align-items: center; justify-content: center; }
  .empty-title { font-family: var(--font-display); font-size: 1.4rem; font-weight: 600; color: var(--text-main); }
  .empty-desc { font-size: .85rem; color: #6b5f64; margin-top: 4px; }
  .photos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  @media (min-width: 700px) { .photos-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; } }
  @media (min-width: 1000px) { .photos-grid { grid-template-columns: repeat(4, 1fr); } }
  .photo-card { overflow: hidden; cursor: pointer; display: flex; flex-direction: column; border-radius: 24px; background: #fff; border: 1px solid rgba(36,28,32,.07); box-shadow: 0 18px 34px -26px rgba(106,32,55,.4); }
  .photo-img-wrapper { position: relative; width: 100%; aspect-ratio: 1/1; background: var(--bg-surface-elevated); overflow: hidden; }
  .grid-img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s ease; }
  @media (hover: hover) { .photo-card:hover .grid-img { transform: scale(1.04); } }
  .photo-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px 4px; }
  .photo-author { font-size: .78rem; font-weight: 700; color: var(--wine); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .photo-time { font-size: .68rem; color: #6b5f64; flex-shrink: 0; }
  .photo-caption { font-family: var(--font-display); font-style: italic; font-size: .95rem; color: #6b5f64; padding: 0 14px 12px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .photo-meta:last-child { padding-bottom: 12px; }
  .lightbox-overlay { position: fixed; inset: 0; background: rgba(36,28,32,.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: max(12px, env(safe-area-inset-top, 0px)) 16px max(12px, env(safe-area-inset-bottom, 0px)) 16px; animation: fadeIn .2s ease; }
  .lightbox-content { position: relative; max-width: 520px; width: 100%; max-height: min(88dvh, calc(100svh - 24px)); display: flex; flex-direction: column; background: var(--paper); border-radius: 28px; overflow: hidden; border: 1px solid rgba(36,28,32,.07); box-shadow: 0 30px 60px -24px rgba(106,32,55,.55); }
  .lightbox-close { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border-radius: 50%; background: rgba(36,28,32,.55); color: #fff; border: 1px solid rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; }
  .lightbox-img { width: 100%; max-height: 65vh; object-fit: contain; background: var(--bg-surface-elevated); }
  .lightbox-info { padding: 16px 20px 18px; }
  .lightbox-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .lightbox-author { font-family: var(--font-display); font-weight: 600; color: var(--wine); font-size: 1.25rem; }
  .lightbox-time { font-size: .8rem; color: #6b5f64; }
  .lightbox-caption { font-size: .92rem; color: var(--text-main); line-height: 1.45; }
  .photo-card-delete-btn { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border-radius: 50%; background: rgba(255,253,251,.92); color: var(--wine); border: 1px solid rgba(36,28,32,.07); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .2s, color .2s; z-index: 5; box-shadow: 0 6px 12px -6px rgba(106,32,55,.5); }
  @media (hover: hover) { .photo-card-delete-btn:hover { background: var(--wine); color: #fff; } }
  .modal-delete-row { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(36,28,32,.07); display: flex; justify-content: flex-end; }
  .btn-delete-photo { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: .8rem; font-weight: 600; color: var(--wine); background: var(--wine-tint); border: 1px solid rgba(140,47,75,.2); border-radius: 999px; cursor: pointer; transition: background .2s, color .2s; }
  @media (hover: hover) { .btn-delete-photo:hover { background: var(--wine); color: #fff; } }
  .load-more-sentinel { display: flex; justify-content: center; padding: 20px 0 10px; width: 100%; }
  .load-more-btn { background: #fff; border: 1px solid rgba(140,47,75,.25); color: var(--wine); font-weight: 700; font-size: .85rem; padding: 11px 24px; border-radius: 999px; cursor: pointer; transition: background .2s, border-color .2s; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 10px 20px -16px rgba(106,32,55,.5); }
  @media (hover: hover) { .load-more-btn:hover { background: var(--wine-tint); border-color: var(--wine); } }
  .upload-placeholder:focus-visible, .remove-btn:focus-visible, .multi-remove-btn:focus-visible, .clear-all-btn:focus-visible, .add-more-thumb:focus-visible, .photo-card:focus-visible, .photo-card-delete-btn:focus-visible, .lightbox-close:focus-visible, .btn-delete-photo:focus-visible, .load-more-btn:focus-visible { outline: 2px solid var(--wine); outline-offset: 2px; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .lightbox-overlay { animation: none; } .grid-img { transition: none; } .spinner-tiny { animation-duration: 2s; } }
</style>
