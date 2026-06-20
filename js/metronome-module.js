/**
 * EasyTune Metronome Module
 * Handles metronome timing, visuals and audio
 */

import { CONFIG } from './config.js';
import { getElement, getElements, setLocalStorage, getLocalStorage } from './utils.js';

// State
const metroState = {
  running: false,
  bpm: 100,
  meter: 4,
  accentMode: 'first',
  visualMode: 'both',
  beatIndex: 0,
  lastEndpoint: 0
};

// Timers and RAF
let audioCtx = null;
let rafId = null;
let runSerial = 0;
let runStart = 0;
let scheduledTimers = [];

/**
 * Load metronome settings from storage
 */
function loadMetroSettings() {
  metroState.bpm = Number(
    getLocalStorage(CONFIG.STORAGE_KEYS.METRO_BPM, CONFIG.METRONOME.BPM_DEFAULT)
  );
  metroState.meter = Number(
    getLocalStorage(CONFIG.STORAGE_KEYS.METRO_METER, CONFIG.METRONOME.METER_DEFAULT)
  );
  metroState.accentMode = getLocalStorage(
    CONFIG.STORAGE_KEYS.METRO_ACCENT,
    'first'
  );
  metroState.visualMode = getLocalStorage(
    CONFIG.STORAGE_KEYS.METRO_VISUAL_MODE,
    'both'
  );
}

/**
 * Save metronome settings to storage
 */
function saveMetroSettings() {
  setLocalStorage(CONFIG.STORAGE_KEYS.METRO_BPM, String(metroState.bpm));
  setLocalStorage(CONFIG.STORAGE_KEYS.METRO_METER, String(metroState.meter));
  setLocalStorage(CONFIG.STORAGE_KEYS.METRO_ACCENT, metroState.accentMode);
  setLocalStorage(CONFIG.STORAGE_KEYS.METRO_VISUAL_MODE, metroState.visualMode);
}

/**
 * Get beat duration in milliseconds
 */
function beatMs() {
  return Math.max(CONFIG.METRONOME.BEAT_MIN_MS, 60000 / metroState.bpm);
}

/**
 * Get metronome needle maximum angle
 */
function maxAngle() {
  return CONFIG.METRONOME.MAX_ANGLE;
}

/**
 * Angle for given endpoint
 */
function angleForEndpoint(endpoint) {
  return endpoint % 2 === 0 ? -maxAngle() : maxAngle();
}

/**
 * Angle at elapsed time
 */
function angleAtElapsed(elapsed) {
  return -maxAngle() * Math.cos((Math.PI * elapsed) / beatMs());
}

/**
 * Get needle element
 */
function getNeedle() {
  return getElement('.metro-clean-pendulum');
}

/**
 * Get visual container
 */
function getVisual() {
  return getElement('#metroCleanVisual');
}

/**
 * Set needle angle
 */
function setNeedleAngle(angle) {
  const needle = getNeedle();
  if (!needle) return;
  
  needle.style.setProperty('animation', 'none', 'important');
  needle.style.setProperty('transition', 'none', 'important');
  needle.style.setProperty('transform-origin', '50% 100%', 'important');
  needle.style.setProperty(
    'transform',
    `translateX(-50%) rotate(${angle.toFixed(3)}deg)`,
    'important'
  );
}

/**
 * Set needle to left extreme
 */
function setNeedleLeft() {
  setNeedleAngle(-maxAngle());
}

/**
 * Clear all metronome clocks
 */
function clearAllClocks() {
  runSerial += 1;
  
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  scheduledTimers.forEach(id => clearTimeout(id));
  scheduledTimers = [];
}

/**
 * Ensure audio context is initialized
 */
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Schedule audio click
 */
function scheduleAudio(accented, endpointDelayMs) {
  ensureAudio();
  
  const startWhen =
    audioCtx.currentTime +
    Math.max(0, endpointDelayMs - CONFIG.METRONOME.CLICK_DUR_MS / 2) / 1000;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'square';
  osc.frequency.setValueAtTime(
    accented ? CONFIG.METRONOME.ACCENT_FREQ : CONFIG.METRONOME.REGULAR_FREQ,
    startWhen
  );
  
  gain.gain.setValueAtTime(0.0001, startWhen);
  gain.gain.exponentialRampToValueAtTime(
    accented ? 0.22 : 0.13,
    startWhen + 0.006
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startWhen + CONFIG.METRONOME.CLICK_DUR_MS / 1000
  );
  
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startWhen);
  osc.stop(startWhen + (CONFIG.METRONOME.CLICK_DUR_MS + 8) / 1000);
}

/**
 * Apply beat UI
 */
function applyBeatUi(accented) {
  if (!metroState.running) return;
  
  renderBeats();
  
  const visual = getVisual();
  if (visual) {
    visual.classList.remove('beat-hit', 'accent-hit');
    
    if (accented) {
      void visual.offsetWidth;
      visual.classList.add('accent-hit');
      
      const timer = setTimeout(
        () => visual.classList.remove('accent-hit'),
        CONFIG.METRONOME.ACCENT_FLASH_MS
      );
      scheduledTimers.push(timer);
    }
  }
  
  metroState.beatIndex = (metroState.beatIndex + 1) % metroState.meter;
}

/**
 * Schedule endpoint beat
 */
function scheduleEndpoint(endpoint, endpointDelayMs) {
  const accented =
    metroState.accentMode === 'all' ||
    (metroState.accentMode === 'first' && metroState.beatIndex === 0);
  
  scheduleAudio(accented, endpointDelayMs);
  
  const dotStart = Math.max(0, endpointDelayMs - CONFIG.METRONOME.DOT_TRANSITION_MS / 2);
  const timer = setTimeout(() => applyBeatUi(accented), dotStart);
  scheduledTimers.push(timer);
}

/**
 * Animation frame handler
 */
function frame(mySerial, now) {
  if (!metroState.running || mySerial !== runSerial) return;
  
  const elapsed = Math.max(0, now - runStart);
  setNeedleAngle(angleAtElapsed(elapsed));
  
  const endpointDelay = metroState.lastEndpoint * beatMs() - elapsed;
  
  while (endpointDelay <= CONFIG.METRONOME.SCHED_LOOKAHEAD_MS) {
    if (metroState.lastEndpoint >= 1) {
      scheduleEndpoint(
        metroState.lastEndpoint,
        metroState.lastEndpoint * beatMs() - elapsed
      );
    }
    metroState.lastEndpoint += 1;
    if (metroState.lastEndpoint * beatMs() - elapsed > CONFIG.METRONOME.SCHED_LOOKAHEAD_MS) {
      break;
    }
  }
  
  rafId = requestAnimationFrame(t => frame(mySerial, t));
}

/**
 * Start metronome
 */
export function startMetronome() {
  ensureAudio();
  clearAllClocks();
  
  metroState.running = true;
  metroState.beatIndex = 0;
  metroState.lastEndpoint = 1;
  
  const mySerial = runSerial;
  const visual = getVisual();
  
  if (visual) {
    visual.classList.add('running');
    visual.classList.remove('beat-hit', 'accent-hit');
    visual.style.setProperty('--metro-duration', `${beatMs()}ms`);
  }
  
  setNeedleLeft();
  renderBeats();
  syncCleanMetronomeUi();
  
  requestAnimationFrame(t => {
    if (!metroState.running || mySerial !== runSerial) return;
    runStart = t;
    setNeedleLeft();
    rafId = requestAnimationFrame(tt => frame(mySerial, tt));
  });
}

/**
 * Stop metronome
 */
export function stopMetronome() {
  metroState.running = false;
  clearAllClocks();
  metroState.beatIndex = 0;
  
  const visual = getVisual();
  if (visual) visual.classList.remove('running', 'beat-hit', 'accent-hit');
  
  setNeedleLeft();
  syncCleanMetronomeUi();
  renderBeats();
}

/**
 * Set BPM
 */
export function setBpm(value, opts = { restart: true }) {
  metroState.bpm = Math.max(
    CONFIG.METRONOME.BPM_MIN,
    Math.min(CONFIG.METRONOME.BPM_MAX, Math.round(value))
  );
  
  saveMetroSettings();
  syncCleanMetronomeUi();
  
  const bpmElements = getElements('.preset-bpm');
  bpmElements.forEach(b =>
    b.classList.toggle('active', Number(b.dataset.bpm) === metroState.bpm)
  );
  
  if (opts.restart && metroState.running) {
    stopMetronome();
    startMetronome();
  }
}

/**
 * Reset metronome settings
 */
export function resetMetronomeSettings() {
  stopMetronome();
  
  metroState.bpm = CONFIG.METRONOME.BPM_DEFAULT;
  metroState.meter = CONFIG.METRONOME.METER_DEFAULT;
  metroState.accentMode = 'first';
  metroState.visualMode = 'both';
  metroState.beatIndex = 0;
  
  saveMetroSettings();
  renderMetroControls();
  syncCleanMetronomeUi();
}

/**
 * Render beats indicator
 */
export function renderBeats() {
  const beats = getElement('#beats');
  if (!beats) return;
  
  beats.innerHTML = Array.from({ length: metroState.meter }, (_, i) => {
    const active = i === metroState.beatIndex;
    const accent =
      metroState.accentMode === 'all' ||
      (metroState.accentMode === 'first' && i === 0);
    
    return `<span class="beat-wrap"><span class="beat-number${active ? ' active' : ''}">${i + 1}</span><span class="beat${active ? ' active' : ''}${accent ? ' accent' : ''}"></span></span>`;
  }).join('');
}

/**
 * Render metronome controls
 */
function renderMetroControls() {
  const presets = [60, 80, 100, 120, 140, 160];
  const meterLabel = metroState.meter === 6 ? '6/8' : `${metroState.meter}/4`;
  const accentLabel =
    metroState.accentMode === 'off'
      ? 'Brak'
      : metroState.accentMode === 'all'
      ? 'Każdy'
      : 'Pierwszy';
  
  // Preset grid
  const presetGrid = getElement('#presetGrid');
  if (presetGrid) {
    presetGrid.innerHTML = presets
      .map(v => `<button class="preset-bpm${v === metroState.bpm ? ' active' : ''}" data-bpm="${v}" type="button">${v}</button>`)
      .join('');
    
    presetGrid.onclick = e => {
      const btn = e.target.closest('[data-bpm]');
      if (!btn) return;
      setBpm(Number(btn.dataset.bpm));
      renderMetroControls();
    };
  }
  
  // Meter buttons
  const meterButtons = getElement('#meterButtons');
  if (meterButtons) {
    meterButtons.innerHTML = [2, 3, 4, 5, 6]
      .map(v => `<button class="meter-btn${v === metroState.meter ? ' active' : ''}" data-meter="${v}" type="button">${v}${v === 6 ? '/8' : '/4'}</button>`)
      .join('');
    
    meterButtons.onclick = e => {
      const btn = e.target.closest('[data-meter]');
      if (!btn) return;
      metroState.meter = Number(btn.dataset.meter);
      metroState.beatIndex = 0;
      saveMetroSettings();
      renderMetroControls();
      renderBeats();
      syncCleanMetronomeUi();
    };
  }
  
  // Accent buttons
  const accentButtons = getElement('#accentButtons');
  if (accentButtons) {
    accentButtons.innerHTML = [
      ['first', 'Pierwszy'],
      ['all', 'Każdy'],
      ['off', 'Brak']
    ]
      .map(
        ([v, l]) => `<button class="accent-btn${v === metroState.accentMode ? ' active' : ''}" data-accent="${v}" type="button">${l}</button>`
      )
      .join('');
    
    accentButtons.onclick = e => {
      const btn = e.target.closest('[data-accent]');
      if (!btn) return;
      metroState.accentMode = btn.dataset.accent;
      metroState.beatIndex = 0;
      saveMetroSettings();
      renderMetroControls();
      renderBeats();
      syncCleanMetronomeUi();
    };
  }
  
  renderBeats();
}

/**
 * Sync metronome UI with state
 */
export function syncCleanMetronomeUi() {
  const meterLabel = metroState.meter === 6 ? '6/8' : `${metroState.meter}/4`;
  const accentLabel =
    metroState.accentMode === 'off'
      ? 'Brak'
      : metroState.accentMode === 'all'
      ? 'Każdy'
      : 'Pierwszy';
  
  const bpmText = getElement('#bpmValue');
  const modalBpm = getElement('#metroModalBpm');
  const slider = getElement('#bpmSlider');
  const tempoMeta = getElement('#metroTempoMeta');
  const meterMeta = getElement('#meterInDial');
  const accentMeta = getElement('#metroAccentMeta');
  const start = getElement('#startMetro');
  
  if (bpmText) bpmText.textContent = metroState.bpm;
  if (modalBpm) modalBpm.textContent = metroState.bpm;
  if (slider) slider.value = metroState.bpm;
  if (tempoMeta) tempoMeta.textContent = `${metroState.bpm} BPM`;
  if (meterMeta) meterMeta.textContent = meterLabel;
  if (accentMeta) accentMeta.textContent = accentLabel;
  if (start) start.textContent = metroState.running ? 'Stop' : 'Start';
}

/**
 * Handle tap tempo
 */
let tapTimes = [];

export function handleTapTempo() {
  const now = Date.now();
  tapTimes = tapTimes.filter(t => now - t < 2200);
  tapTimes.push(now);
  
  if (tapTimes.length >= 2) {
    const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    setBpm(Math.round(60000 / avg));
  }
}

/**
 * Initialize metronome
 */
export function initMetronome() {
  loadMetroSettings();
  renderMetroControls();
  syncCleanMetronomeUi();
  setBpm(metroState.bpm, { restart: false });
  
  const startBtn = getElement('#startMetro');
  const resetBtn = getElement('#metroResetTop');
  const bpmSlider = getElement('#bpmSlider');
  const tapInModal = getElement('#metroTapInModal');
  const metroBpmDown = getElement('#metroBpmDown');
  const metroBpmUp = getElement('#metroBpmUp');
  const openTempoBtn = getElement('#openTempoModal');
  const openMeterBtn = getElement('#openMeterModal');
  const openAccentBtn = getElement('#openAccentModal');
  const tapInfoBtn = getElement('#metroTapInfoClean');
  const tapHelpClose = getElement('#tapHelpClose');
  const tapHelpModal = getElement('#tapHelpModal');
  
  if (startBtn) {
    startBtn.addEventListener('click', () =>
      metroState.running ? stopMetronome() : startMetronome()
    );
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', resetMetronomeSettings);
  }
  
  if (bpmSlider) {
    bpmSlider.addEventListener('input', e => setBpm(Number(e.target.value)));
  }
  
  if (tapInModal) {
    tapInModal.addEventListener('click', handleTapTempo);
  }
  
  if (metroBpmDown) {
    metroBpmDown.addEventListener('click', () => setBpm(metroState.bpm - 1));
  }
  
  if (metroBpmUp) {
    metroBpmUp.addEventListener('click', () => setBpm(metroState.bpm + 1));
  }
  
  if (tapInfoBtn) {
    tapInfoBtn.addEventListener('click', () => {
      if (tapHelpModal) {
        tapHelpModal.classList.add('open');
        tapHelpModal.setAttribute('aria-hidden', 'false');
      }
    });
  }
  
  if (tapHelpClose) {
    tapHelpClose.addEventListener('click', () => {
      if (tapHelpModal) {
        tapHelpModal.classList.remove('open');
        tapHelpModal.setAttribute('aria-hidden', 'true');
      }
    });
  }
  
  if (tapHelpModal) {
    tapHelpModal.addEventListener('click', e => {
      if (e.target === e.currentTarget) {
        tapHelpModal.classList.remove('open');
        tapHelpModal.setAttribute('aria-hidden', 'true');
      }
    });
  }
}

/**
 * Get metronome state
 */
export function getMetroState() {
  return { ...metroState };
}

/**
 * Reset metronome state
 */
export function resetMetroState() {
  metroState.running = false;
  metroState.beatIndex = 0;
  metroState.lastEndpoint = 0;
  clearAllClocks();
}
