/**
 * EasyTune Main Application
 * Entry point integrating all modules
 * 
 * Modules:
 * - config.js: Central configuration
 * - utils.js: Utility functions
 * - transpose-module.js: Transposition logic
 * - chords-module.js: Chord management
 * - metronome-module.js: Metronome timing
 */

import { CONFIG, BASE_CHORDS } from './config.js';
import {
  escapeHtml,
  isPwaInstalled,
  getElement,
  getElements,
  getLocalStorage,
  setLocalStorage,
  addEventListener
} from './utils.js';
import { initTranspose, renderOutputText } from './transpose-module.js';
import { initChords, chordSvg } from './chords-module.js';
import {
  initMetronome,
  startMetronome,
  stopMetronome,
  getMetroState
} from './metronome-module.js';

// Application state
let currentView = 'home';
let deferredInstallPrompt = null;

/* ============================================
   INITIALIZATION
   ============================================ */

/**
 * Sync PWA install buttons visibility
 */
function syncInstallButtons() {
  const installed = isPwaInstalled();
  document.documentElement.classList.toggle('pwa-installed', installed);
  getElements('[data-pwa-install]').forEach(btn => {
    btn.hidden = installed;
    btn.setAttribute('aria-hidden', installed ? 'true' : 'false');
  });
}

/**
 * Load manifest version from web manifest
 */
async function loadManifestVersion() {
  const versionEl = getElement(CONFIG.SELECTORS.VERSION);
  if (!versionEl) return;

  try {
    const res = await fetch('manifest.webmanifest');
    const manifest = await res.json();
    versionEl.textContent = `v${manifest.version || CONFIG.APP_VERSION}`;
  } catch {
    versionEl.textContent = `v${CONFIG.APP_VERSION}`;
  }
}

/**
 * Show main app and hide splash screen
 */
function showApp() {
  const app = getElement(CONFIG.SELECTORS.APP);
  const splash = getElement(CONFIG.SELECTORS.SPLASH);

  if (app) app.hidden = false;
  if (splash) {
    setTimeout(() => splash.classList.add('is-hidden'), CONFIG.TIMINGS.SPLASH_HIDE);
    setTimeout(() => splash.remove(), CONFIG.TIMINGS.SPLASH_REMOVE);
  }
}

/* ============================================
   VIEW RENDERING
   ============================================ */

/**
 * Render home view
 */
function homeHtml() {
  return `<section class="start-panel home-screen" aria-label="Ekran startowy">
    <div class="home-card-bg" aria-hidden="true"></div>
    ${toolCard('transpose', 'Transpozycja', 'Zmień tonację utworu', 'transpose')}
    ${toolCard('chords', 'Akordy', 'Diagramy chwytów gitarowych', 'chords')}
    ${toolCard('metronome', 'Metronom', 'BPM, metrum, rytm', 'metronome')}
  </section>`;
}

/**
 * Render tool card
 */
function toolCard(view, title, desc, type) {
  const dots =
    type === 'transpose'
      ? '<span class="dot dot-a"></span><span class="dot dot-b"></span>'
      : type === 'chords'
      ? '<span class="dot dot-a"></span><span class="dot dot-b"></span><span class="dot dot-c"></span>'
      : '<span class="dot dot-green"></span>';

  return `<button class="tool-card tool-card-${type}" type="button" data-view="${view}" aria-label="${escapeHtml(title)} — ${escapeHtml(desc)}">
    <span class="tool-copy"><span class="tool-title">${escapeHtml(title)}</span><span class="tool-desc">${escapeHtml(desc)}</span></span>
    <span class="fret-art fret-art-${type}" aria-hidden="true">${dots}</span>
    <span class="tool-arrow" aria-hidden="true">›</span>
  </button>`;
}

/**
 * Render transpose view
 */
function transposeHtml() {
  return `<section class="start-panel view-screen">
    <div class="view-head"><button class="back-btn" type="button" data-view="home" aria-label="Wróć">‹</button><h1 class="view-title">Transpozycja</h1><span></span></div>
    <div class="view-card">
      <div class="form-label-row"><label class="form-label" for="songInput">Tekst z akordami</label><button class="small-action" type="button" id="clearSong" aria-label="Wyczyść tekst">Wyczyść</button></div>
      <textarea id="songInput" class="song-input" spellcheck="false" wrap="off" placeholder="Np. C G a F&#10;Zaśpiewaj tutaj tekst..."></textarea>
      <span class="form-label transpose-section-label">Transpozycja (półtony)</span>
      <div class="transpose-controls"><button class="round-btn" type="button" id="stepDown">−</button><div class="transpose-value"><span>Półtony</span><strong id="transposeValue">0</strong></div><button class="round-btn" type="button" id="stepUp">+</button></div>
      <div class="transpose-actions transpose-reset-row"><button class="ghost-btn" type="button" id="resetTranspose">Reset</button></div>
    </div>
    <div class="view-card"><div class="form-label-row result-label-row"><span class="form-label">Wynik</span><button class="info-dot" type="button" id="transposeResultInfo" aria-label="Informacja"></button></div>
    <div id="songOutput" class="output-box"></div>
    <div class="transpose-actions"><button class="primary-btn" type="button" id="copyResult">Skopiuj wynik</button></div>
    </div>
  </section>`;
}

/**
 * Render chords view
 */
function chordsHtml() {
  return `<section class="start-panel view-screen"><div class="view-head chords-view-head"><button class="back-btn" type="button" data-view="home" aria-label="Wróć">‹</button><h1 class="view-title">Akordy</h1><button class="small-action" type="button" id="resetChords" aria-label="Resetuj filtry">Reset</button></div>
    <div class="view-card chords-panel">
      <div class="letter-filter-row" id="letterFilterRow" aria-label="Filtruj akordy po literze">
        <button class="letter-chip" data-letter="C">C</button><button class="letter-chip" data-letter="D">D</button><button class="letter-chip" data-letter="E">E</button><button class="letter-chip" data-letter="F">F</button><button class="letter-chip" data-letter="G">G</button><button class="letter-chip" data-letter="A">A</button><button class="letter-chip" data-letter="B">B</button><button class="letter-chip" data-letter="H">H</button>
      </div>
      <div class="filter-row type-filter-row" id="filterRow" aria-label="Filtruj akordy po typie"><button class="filter-chip" data-filter="major">Dur</button><button class="filter-chip" data-filter="minor">Mol</button><button class="filter-chip" data-filter="sharp">#</button><button class="filter-chip" data-filter="7">7</button><button class="filter-chip" data-filter="maj7">maj7</button></div>
      <div id="chordGrid" class="chord-grid"></div>
    </div></section>`;
}

/**
 * Render metronome view
 */
function metronomeHtml() {
  return `<section class="start-panel view-screen metro-clean-screen">
    <div class="view-head">
      <button class="back-btn" type="button" data-view="home" aria-label="Wróć">‹</button>
      <h1 class="view-title">Metronom</h1>
      <button id="metroResetTop" class="small-action" type="button">Reset</button>
    </div>

    <div class="metro-clean-main" id="metroCleanMain">
      <div class="metro-clean-visual" id="metroCleanVisual" aria-label="Wizualizacja metronomu">
        <div class="metro-clean-scale" aria-hidden="true"></div>
        <div class="metro-clean-pendulum" aria-hidden="true"><span></span></div>
        <button id="metroCleanBpmButton" class="metro-clean-bpm" type="button" aria-label="Zmień tempo">
          <strong id="bpmValue">100</strong>
          <span>BPM</span>
        </button>
      </div>

      <div class="metro-clean-beats" id="beats" role="button" tabindex="0" aria-label="Uderzenia taktu"></div>

      <div class="metro-clean-meta">
        <button id="openTempoModal" type="button"><span>Tempo</span><strong id="metroTempoMeta">100 BPM</strong></button>
        <button id="openMeterModal" type="button"><span>Metrum</span><strong id="meterInDial">4/4</strong></button>
        <button id="openAccentModal" type="button"><span>Akcent</span><strong id="metroAccentMeta">Pierwszy</strong></button>
      </div>
    </div>

    <div class="metro-clean-actions">
      <button id="startMetro" class="primary-btn metro-start" type="button">Start</button>
    </div>

    <div id="metroTempoModal" class="metro-settings-modal" aria-hidden="true" role="dialog" aria-label="Ustaw tempo">
      <div class="metro-settings-card">
        <button class="metro-settings-close" type="button" data-close-metro-settings aria-label="Zamknij">×</button>
        <h2>Tempo</h2>
        <div class="metro-bpm-stepper">
          <button id="metroBpmDown" type="button">−</button>
          <strong id="metroModalBpm">100</strong>
          <button id="metroBpmUp" type="button">+</button>
        </div>
        <input id="bpmSlider" class="bpm-slider" type="range" min="40" max="240" value="100">
        <div id="presetGrid" class="preset-grid"></div>
        <div class="metro-tap-row">
          <button id="metroTapInModal" class="ghost-btn metro-tap-modal-btn" type="button">Tap Tempo</button>
          <button id="metroTapInfoClean" class="metro-tap-info-btn" type="button" aria-label="Informacja o Tap Tempo">i</button>
        </div>
      </div>
    </div>

    <div id="tapHelpModal" class="tap-help-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Informacja o Tap Tempo">
      <div class="tap-help-card">
        <button id="tapHelpClose" class="tap-help-close" type="button" aria-label="Zamknij">×</button>
        <h2>Tap Tempo</h2>
        <p>Wystukaj żądane tempo, klikając kilka razy przycisk „Tap Tempo" w rytmie utworu. EasyTune automatycznie rozpozna i ustawi odpowiednią wartość BPM.</p>
      </div>
    </div>

    <div id="metroMeterModal" class="metro-settings-modal" aria-hidden="true" role="dialog" aria-label="Ustaw metrum">
      <div class="metro-settings-card">
        <button class="metro-settings-close" type="button" data-close-metro-settings aria-label="Zamknij">×</button>
        <h2>Metrum</h2>
        <div id="meterButtons" class="meter-buttons"></div>
      </div>
    </div>

    <div id="metroAccentModal" class="metro-settings-modal" aria-hidden="true" role="dialog" aria-label="Ustaw akcent">
      <div class="metro-settings-card">
        <button class="metro-settings-close" type="button" data-close-metro-settings aria-label="Zamknij">×</button>
        <h2>Akcent</h2>
        <div id="accentButtons" class="accent-buttons"></div>
      </div>
    </div>
  </section>`;
}

/**
 * Render view
 */
function renderView(view) {
  currentView = view;
  stopMetronome();

  const content = getElement(CONFIG.SELECTORS.CONTENT);
  if (!content) return;

  if (view === 'home') content.innerHTML = homeHtml();
  if (view === 'transpose') content.innerHTML = transposeHtml();
  if (view === 'chords') content.innerHTML = chordsHtml();
  if (view === 'metronome') content.innerHTML = metronomeHtml();

  content.focus({ preventScroll: true });

  if (view === 'transpose') initTranspose();
  if (view === 'chords') initChords();
  if (view === 'metronome') initMetronome();
}

/* ============================================
   MODALS
   ============================================ */

/**
 * Open chord modal
 */
function openChordModal(chord) {
  const modal = getElement(CONFIG.SELECTORS.CHORD_MODAL);
  const modalContent = getElement(CONFIG.SELECTORS.CHORD_MODAL_CONTENT);

  if (!modal || !modalContent) return;

  const chordName = chord;
  const chords = BASE_CHORDS;

  if (!chords[chordName]) return;

  modalContent.innerHTML = `<div class="chord-figure modal-chord-figure">
    <div class="modal-chord-title-box chord-title-box">
      <h2 class="modal-chord-title">${escapeHtml(chordName)}</h2>
    </div>
    ${chordSvg(chordName, chords[chordName], true)}
  </div>`;

  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
}

/**
 * Close chord modal
 */
function closeChordModal() {
  const modal = getElement(CONFIG.SELECTORS.CHORD_MODAL);
  if (!modal) return;
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Open app modal
 */
function openAppModal(kind) {
  const modal = getElement(CONFIG.SELECTORS.APP_MODAL);
  const modalContent = getElement(CONFIG.SELECTORS.APP_MODAL_CONTENT);

  if (!modal || !modalContent) return;

  const installMarkup = isPwaInstalled()
    ? ''
    : '<button class="primary-btn" type="button" data-pwa-install>Zainstaluj aplikację</button>';

  if (kind === 'options') {
    modalContent.innerHTML = `<h2>Opcje</h2><p>EasyTune działa offline po pierwszym uruchomieniu.${
      isPwaInstalled()
        ? ' Aplikacja jest już uruchomiona jako zainstalowane PWA.'
        : ' Aby działała jako pełne PWA, wybierz w menu przeglądarki „Zainstaluj aplikację".'
    }</p>${installMarkup}`;
  } else if (kind === 'about') {
    modalContent.innerHTML = `<h2>EasyTune</h2><p>Transpozycja, akordy i metronom. Wersja PWA offline ${CONFIG.APP_VERSION}.</p>`;
  } else if (kind === 'transpose-result') {
    modalContent.innerHTML =
      '<h2>Wynik transpozycji</h2><p>Kliknij dowolny akord w oknie wyniku, aby otworzyć powiększony diagram tego chwytu.</p>';
  }

  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  syncInstallButtons();
}

/**
 * Close app modal
 */
function closeAppModal() {
  const modal = getElement(CONFIG.SELECTORS.APP_MODAL);
  if (!modal) return;
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
}

/**
 * Close metro settings modals
 */
function closeMetroSettings() {
  getElements('.metro-settings-modal').forEach(m => {
    m.classList.remove('visible');
    m.setAttribute('aria-hidden', 'true');
  });
}

/**
 * Open metro settings modal
 */
function openMetroSettings(id) {
  closeMetroSettings();
  const modal = getElement('#' + id);
  if (!modal) return;
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
}

/* ============================================
   PWA INSTALLATION
   ============================================ */

/**
 * Handle beforeinstallprompt event
 */
function handleBeforeInstallPrompt(e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.documentElement.classList.add('pwa-can-install');
  syncInstallButtons();
}

/**
 * Prompt PWA installation
 */
async function promptPwaInstall() {
  if (isPwaInstalled()) {
    syncInstallButtons();
    return;
  }

  if (!deferredInstallPrompt) {
    alert(
      'Przeglądarka nie zgłosiła jeszcze gotowości instalacji PWA. Upewnij się, że strona działa przez HTTPS lub localhost, odśwież ją raz i wybierz w menu przeglądarki „Zainstaluj aplikację".'
    );
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  document.documentElement.classList.remove('pwa-can-install');
  syncInstallButtons();
}

/* ============================================
   EVENT LISTENERS
   ============================================ */

function setupEventListeners() {
  const menuButton = getElement(CONFIG.SELECTORS.MENU_BUTTON);
  const optionsMenu = getElement(CONFIG.SELECTORS.OPTIONS_MENU);
  const homeLogoBtn = getElement(CONFIG.SELECTORS.HOME_LOGO_BTN);
  const chordModal = getElement(CONFIG.SELECTORS.CHORD_MODAL);
  const appModal = getElement(CONFIG.SELECTORS.APP_MODAL);

  // Menu button
  if (menuButton) {
    menuButton.addEventListener('click', () => {
      const open = !optionsMenu.hidden;
      optionsMenu.hidden = open;
      menuButton.setAttribute('aria-expanded', String(!open));
    });
  }

  // Home logo button
  if (homeLogoBtn) {
    homeLogoBtn.addEventListener('click', () => renderView('home'));
  }

  // Global click handler
  document.addEventListener('click', e => {
    // View navigation
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) {
      renderView(viewBtn.dataset.view);
      if (optionsMenu) optionsMenu.hidden = true;
      if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
      return;
    }

    // Chord modal
    const chordBtn = e.target.closest('[data-chord]');
    if (chordBtn) {
      openChordModal(chordBtn.dataset.chord);
      return;
    }

    // PWA install
    const installBtn = e.target.closest('[data-pwa-install]');
    if (installBtn) {
      if (optionsMenu) optionsMenu.hidden = true;
      if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
      promptPwaInstall();
      return;
    }

    // App modal
    const appBtn = e.target.closest('[data-app-modal]');
    if (appBtn) {
      if (optionsMenu) optionsMenu.hidden = true;
      if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
      openAppModal(appBtn.dataset.appModal);
      return;
    }

    // Close modals
    if (e.target.closest('[data-close-chord]') || e.target === chordModal) closeChordModal();
    if (e.target.closest('[data-close-app-modal]') || e.target === appModal) closeAppModal();
    if (e.target.closest('[data-close-metro-settings]')) closeMetroSettings();

    // Close menu on outside click
    if (optionsMenu && !optionsMenu.hidden && !optionsMenu.contains(e.target) && !menuButton.contains(e.target)) {
      optionsMenu.hidden = true;
      if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeChordModal();
      closeAppModal();
      closeMetroSettings();
    }
  });

  // Metro settings
  getElements('[data-close-metro-settings]').forEach(btn => {
    btn.addEventListener('click', closeMetroSettings);
  });

  getElements('.metro-settings-modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeMetroSettings();
    });
  });

  getElements('[data-open-metro]').forEach(btn => {
    btn.addEventListener('click', e => {
      const modalId = e.target.closest('[data-open-metro]')?.dataset.openMetro;
      if (modalId) openMetroSettings(modalId);
    });
  });
}

/* ============================================
   INITIALIZATION SEQUENCE
   ============================================ */

async function initApp() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        await navigator.serviceWorker.ready;
      } catch (err) {
        console.error('ServiceWorker registration failed:', err);
      }
    });
  }

  // PWA installation events
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.documentElement.classList.remove('pwa-can-install');
    document.documentElement.classList.add('pwa-installed');
    syncInstallButtons();
  });

  window
    .matchMedia?.('(display-mode: standalone)')
    ?.addEventListener?.('change', syncInstallButtons);
  window
    .matchMedia?.('(display-mode: fullscreen)')
    ?.addEventListener?.('change', syncInstallButtons);

  // Setup event listeners
  setupEventListeners();

  // Load and show app
  await loadManifestVersion();
  showApp();
  syncInstallButtons();
  renderView('home');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
