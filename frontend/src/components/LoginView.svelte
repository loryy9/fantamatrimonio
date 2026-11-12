<script>
    import { slide } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { onMount } from "svelte";
    import { appState } from "../lib/state.svelte.js";
    import { api } from "../lib/api.js";
    import QrScannerModal from "./QrScannerModal.svelte";
    import PageIntro from "./PageIntro.svelte";
    import SpouseCard from "./SpouseCard.svelte";

    const cardTransition = {
        duration: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240,
        easing: cubicOut,
    };

    function getCodeFromUrl() {
        if (typeof window === "undefined") return "";
        return (new URLSearchParams(window.location.search).get("code") || "")
            .trim()
            .toUpperCase();
    }

    let inviteCode = $state(getCodeFromUrl());
    let nickname = $state("");
    let isSubmitting = $state(false);
    let showQrModal = $state(false);

    // Errore nickname già in uso nel matrimonio
    let duplicateNickError = $state("");

    const defaultNick = $derived(
        appState.account?.nickname ||
            appState.account?.first_name ||
            appState.account?.display_name ||
            "",
    );

    let eventPreview = $state(null);
    let previewLoading = $state(false);
    let previewError = $state("");

    let checkTimer = null;
    let nickInputEl = $state(null);
    let inviteInputEl = $state(null);

    async function checkPreview(code) {
        const c = (code || "").trim().toUpperCase();
        if (c.length < 4) {
            eventPreview = null;
            previewError = "";
            return;
        }
        previewLoading = true;
        try {
            const res = await api.getEventPreview(c);
            eventPreview = res;
            previewError = "";
        } catch {
            eventPreview = null;
            if (c.length >= 6) {
                previewError =
                    "Codice matrimonio non trovato. Controlla il codice ricevuto.";
            }
        } finally {
            previewLoading = false;
        }
    }

    onMount(() => {
        function onLocation() {
            const c = getCodeFromUrl();
            if (c) inviteCode = c;
        }
        window.addEventListener("popstate", onLocation);
        window.addEventListener("hashchange", onLocation);

        const urlCode = getCodeFromUrl();
        if (urlCode) inviteCode = urlCode;

        return () => {
            window.removeEventListener("popstate", onLocation);
            window.removeEventListener("hashchange", onLocation);
            clearTimeout(checkTimer);
        };
    });

    $effect(() => {
        const code = inviteCode.trim().toUpperCase();
        clearTimeout(checkTimer);
        if (code.length >= 4) {
            checkTimer = setTimeout(() => {
                checkPreview(code);
            }, 150);
        } else {
            eventPreview = null;
            previewError = "";
        }
    });

    function handleQrScanResult(scannedCode) {
        if (scannedCode) {
            inviteCode = scannedCode.trim().toUpperCase();
            duplicateNickError = "";
            checkPreview(inviteCode);
            appState.showToast(`Codice ${inviteCode} rilevato!`, "success");
        }
    }

    async function handlePaste() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                    const match = text.match(/[A-Za-z0-9\-_]{4,12}/);
                    if (match) {
                        inviteCode = match[0].toUpperCase();
                        checkPreview(inviteCode);
                        appState.showToast(
                            `Codice ${inviteCode} incollato!`,
                            "info",
                        );
                        return;
                    }
                }
            }
        } catch {
            // ignore
        }
        inviteInputEl?.focus();
        appState.showToast(
            "Digita il codice stampato sul tableau o segnaposto",
            "info",
        );
    }

    function handleChangeNickname() {
        duplicateNickError = "";
        setTimeout(() => {
            nickInputEl?.focus();
            nickInputEl?.select();
        }, 50);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        duplicateNickError = "";

        if (!inviteCode.trim()) {
            appState.showToast("Inserisci il codice del matrimonio.", "error");
            inviteInputEl?.focus();
            return;
        }

        isSubmitting = true;
        try {
            const res = await appState.join(
                inviteCode.trim().toUpperCase(),
                nickname.trim(),
            );

            if (!res.success) {
                if (res.code === "NICKNAME_TAKEN") {
                    duplicateNickError = res.error;
                    handleChangeNickname();
                } else {
                    appState.showToast(
                        res.error ||
                            "Accesso non riuscito. Controlla il codice.",
                        "error",
                    );
                }
            }
        } catch (err) {
            appState.showToast(
                err.message || "Errore di connessione.",
                "error",
            );
        } finally {
            isSubmitting = false;
        }
    }
</script>

<div class="guest-screen">
    <div class="guest-container">
        <!-- Hero Header -->
        <div class="guest-hero">
            <div class="guest-intro-slot">
                <PageIntro before="Entra nella" accent="festa" lead="Inserisci il codice del matrimonio per iniziare a giocare, scattare foto e votare con gli sposi." />
            </div>
            <div class="spouse-card-slot">
                <SpouseCard loggedIn />
            </div>
        </div>

        <div class="guest-form-column">
            <!-- Main Card -->
            <form class="clean-card" onsubmit={handleSubmit}>
                <!-- Campo Codice Invito -->
                <div class="field-block">
                    <div class="field-header">
                        <label for="inviteCode" class="field-label"
                            >CODICE INVITO MATRIMONIO</label
                        >
                        <span class="field-tag required">Obbligatorio</span>
                    </div>
                    <div class="field-input-box">
                        <input
                            id="inviteCode"
                            bind:this={inviteInputEl}
                            type="text"
                            class="clean-input code-style"
                            placeholder="ES. PK9YMD"
                            bind:value={inviteCode}
                            oninput={(e) => {
                                inviteCode = e.target.value.toUpperCase();
                                duplicateNickError = "";
                            }}
                            autocomplete="off"
                            autocapitalize="characters"
                            spellcheck="false"
                            required
                        />
                        <div class="code-action-btns">
                            <button
                                type="button"
                                class="scan-btn"
                                onclick={() => (showQrModal = true)}
                                title="Scansiona codice QR con fotocamera o foto"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
                                    />
                                    <rect
                                        width="6"
                                        height="6"
                                        x="9"
                                        y="9"
                                        rx="1"
                                    />
                                </svg>
                                <span>Scansiona QR</span>
                            </button>
                            <button
                                type="button"
                                class="paste-btn"
                                onclick={handlePaste}
                                title="Incolla dagli appunti"
                            >
                                Incolla
                            </button>
                        </div>
                    </div>
                    <p class="field-hint">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" /><path
                                d="M12 16v-4M12 8h.01"
                            />
                        </svg>
                        Lo trovi stampato sul segnaposto o nel tableau
                    </p>

                    <!-- Preview feedback se il codice è valido -->
                    {#if eventPreview}
                        <div class="code-confirmed-pill" transition:slide|local={cardTransition}>
                            <span class="check-icon">✓</span>
                            <span
                                >Matrimonio di <strong
                                    >{eventPreview.spouse1_name} &amp; {eventPreview.spouse2_name}</strong
                                ></span
                            >
                        </div>
                    {:else if previewError}
                        <div class="code-error-pill" transition:slide|local={cardTransition}>
                            <span>{previewError}</span>
                        </div>
                    {/if}
                </div>

                <!-- Campo Nome / Nickname -->
                <div class="field-block">
                    <div class="field-header">
                        <label for="guestNick" class="field-label"
                            >NICKNAME</label
                        >
                        <span class="field-tag muted">Facoltativo</span>
                    </div>
                    <div class="field-input-box">
                        <input
                            id="guestNick"
                            bind:this={nickInputEl}
                            type="text"
                            class="clean-input"
                            class:input-has-error={!!duplicateNickError}
                            placeholder={defaultNick
                                ? `Se vuoto: ${defaultNick}`
                                : "es. Zia Pina, Marco, Vale e Luca..."}
                            bind:value={nickname}
                            oninput={() => (duplicateNickError = "")}
                            disabled={isSubmitting}
                        />
                    </div>
                    <p class="field-hint">
                        Come vuoi comparire nella classifica e sull'album di
                        nozze. Se lo lasci vuoto usiamo il tuo nome.
                    </p>
                </div>

                <!-- Conflitto Nickname -->
                {#if duplicateNickError}
                    <div class="conflict-box">
                        <strong>Nickname già in uso</strong>
                        <p>{duplicateNickError}</p>
                    </div>
                {/if}

                <!-- Pulsante Entra nel gioco -->
                <button
                    type="submit"
                    class="submit-action-btn"
                    disabled={isSubmitting}
                >
                    {#if isSubmitting}
                        <span class="spinner spinner-white"></span>
                        <span>Accesso in corso...</span>
                    {:else}
                        <span>Entra nel gioco</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    {/if}
                </button>

                <div class="secure-badge-note">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span
                        >Stai entrando come {appState.account?.display_name ||
                            "ospite"}</span
                    >
                </div>

            </form>
        </div>
    </div>

    <QrScannerModal
        isOpen={showQrModal}
        onScan={handleQrScanResult}
        onClose={() => (showQrModal = false)}
    />
</div>

<style>
    .guest-screen {
        min-height: 100vh;
        min-height: 100dvh;
        background-color: var(--bg-primary);
        padding-bottom: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* Main Container */
    .guest-container {
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        padding: 0 0 32px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
        gap: 56px;
        align-items: start;
    }

    .guest-form-column {
        width: 100%;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    /* Hero */
    .guest-hero {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
        margin-top: 0;
        margin-bottom: 8px;
        gap: 12px;
    }

    .badge-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fae9f0;
        color: var(--wine);
        border-radius: 999px;
        padding: 5px 14px;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-bottom: 12px;
    }

    /* Clean Card */
    .clean-card {
        width: 100%;
        min-width: 0;
        align-self: stretch;
        background: #ffffff;
        border-radius: 24px;
        padding: 24px 22px;
        box-shadow:
            0 4px 20px rgba(140, 47, 75, 0.05),
            0 1px 4px rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(220, 205, 195, 0.35);
        display: flex;
        flex-direction: column;
        gap: 18px;
    }

    .minimal-footer {
        grid-column: 1 / -1;
    }

    @media (max-width: 900px) {
        .guest-container {
            max-width: 560px;
            padding: 10px 0 32px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }

        .guest-hero {
            align-items: center;
            text-align: center;
            margin-top: 4px;
        }

        .guest-hero {
            display: contents;
        }

        .guest-intro-slot {
            order: 1;
        }

        .guest-form-column {
            order: 2;
        }

        .spouse-card-slot {
            order: 3;
        }

    }

    @media (max-width: 480px) {
        .guest-container {
            padding: 0 0 24px;
        }
    }

    .field-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .field-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.06em;
    }

    .field-label {
        display: flex;
        align-items: center;
        color: #4a3b42;
        text-transform: uppercase;
    }

    .field-tag.required {
        color: #a88438;
        font-weight: 700;
    }

    .field-tag.muted {
        color: #8c7882;
        font-weight: 500;
        text-transform: none;
        letter-spacing: normal;
    }

    .field-input-box {
        position: relative;
        display: flex;
        align-items: center;
    }

    .clean-input {
        width: 100%;
        background: #f4efe9;
        border: 1.5px solid transparent;
        border-radius: 14px;
        padding: 13px 16px;
        font-family: var(--font-sans);
        font-size: 16px !important; /* Prevents auto zoom on iOS */
        color: var(--text-main);
        transition: all 0.2s ease;
        outline: none;
    }

    .clean-input:focus {
        background: #ffffff;
        border-color: var(--wine);
        box-shadow: 0 0 0 3px rgba(140, 47, 75, 0.12);
    }

    .clean-input.code-style {
        font-size: 16px !important;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding-right: 180px;
        text-transform: uppercase;
    }

    .clean-input.pin-input {
        letter-spacing: 0.3em;
        font-size: 18px !important;
        font-weight: 700;
        padding-right: 48px;
    }

    .clean-input::placeholder {
        color: #9c8e94;
        font-weight: 400;
        letter-spacing: normal;
    }

    .code-action-btns {
        position: absolute;
        right: 6px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    .scan-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #ffffff;
        border: 1px solid rgba(140, 47, 75, 0.2);
        border-radius: 9px;
        padding: 6px 9px;
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--wine);
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        white-space: nowrap;
        transition: all 0.15s ease;
    }

    .scan-btn:hover {
        background: #faedf2;
        border-color: var(--wine);
    }

    .scan-btn:active {
        transform: scale(0.96);
    }

    .paste-btn {
        display: inline-flex;
        align-items: center;
        background: #f7f2ed;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 9px;
        padding: 6px 9px;
        font-size: 0.72rem;
        font-weight: 700;
        color: #55484f;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;
    }

    .paste-btn:hover {
        background: #eee8e0;
    }

    .paste-btn:active {
        transform: scale(0.96);
    }

    .eye-btn {
        position: absolute;
        right: 12px;
        background: transparent;
        border: none;
        color: #7b6d74;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 4px;
    }

    .field-hint {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.74rem;
        color: #756970;
        line-height: 1.35;
        margin-top: 2px;
    }

    .code-confirmed-pill {
        display: flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        gap: 6px;
        background: #eef7f2;
        border: 1px solid #c2e5d3;
        color: #246845;
        padding: 7px 12px;
        border-radius: 10px;
        font-size: 0.78rem;
        margin-top: 4px;
    }

    .code-confirmed-pill .check-icon {
        font-weight: 800;
        color: #1e7045;
    }

    .code-error-pill {
        background: #fdf2f2;
        border: 1px solid #f8cdcd;
        color: #a83232;
        padding: 7px 12px;
        border-radius: 10px;
        font-size: 0.76rem;
        margin-top: 4px;
    }

    .submit-action-btn {
        width: 100%;
        min-height: 48px;
        background: var(--wine);
        color: #ffffff;
        border: none;
        border-radius: 999px;
        font-family: var(--font-sans);
        font-size: 0.98rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(74, 14, 46, 0.28);
        transition:
            background 0.15s ease,
            transform 0.15s ease,
            box-shadow 0.15s ease;
        margin-top: 6px;
    }

    .submit-action-btn:hover {
        background: var(--wine-deep);
        box-shadow: 0 8px 22px rgba(74, 14, 46, 0.35);
    }

    .submit-action-btn:active {
        transform: scale(0.98);
    }

    .secure-badge-note {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 0.73rem;
        color: #6a5e64;
        font-weight: 500;
        margin-top: -4px;
    }

    .secure-badge-note svg {
        color: #5b9b7a;
    }

    /* Sub cards */
    .sub-card {
        width: 100%;
        border-radius: 20px;
        padding: 16px 18px;
        display: flex;
        gap: 14px;
        border: 1px solid rgba(220, 205, 195, 0.35);
    }

    .whatsapp-card {
        background: #fcf9f2;
        align-items: flex-start;
    }

    .yellow-bubble {
        background: #f8e596;
        color: #614d0a;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .sub-card-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .sub-card-title {
        font-size: 0.88rem;
        font-weight: 700;
        color: #2b1f24;
        line-height: 1.3;
    }

    .sub-card-text {
        font-size: 0.78rem;
        color: #6b5d63;
        line-height: 1.45;
    }

    /* Footer */
    .minimal-footer {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        margin-top: 14px;
        text-align: center;
    }

    .footer-divider {
        color: #c59e58;
        opacity: 0.6;
    }

    .footer-copy {
        font-size: 0.74rem;
        color: #8c7d84;
    }

    .spinner-white {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .conflict-box {
        background: #fdf5f5;
        border: 1px solid #f6cfcf;
        border-radius: 12px;
        padding: 12px;
        font-size: 0.82rem;
        color: #661818;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .conflict-actions {
        display: flex;
        gap: 8px;
        margin-top: 4px;
    }
</style>
