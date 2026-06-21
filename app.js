const splash = document.querySelector('#splash');
const app = document.querySelector('#app');
const content = document.querySelector('#content');
const versionEl = document.querySelector('#splash-version');
let appVersion = '1.2';
const menuButton = document.querySelector('.options-button');
const optionsMenu = document.querySelector('#options-menu');
const homeLogoBtn = document.querySelector('#homeLogoBtn');
const chordModal = document.querySelector('#chord-modal');
const chordModalContent = document.querySelector('#chord-modal-content');
const appModal = document.querySelector('#app-modal');
const appModalContent = document.querySelector('#app-modal-content');
const metroVisualModal = document.querySelector('#metro-visual-modal');

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','H'];
const FLATS = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#', B:'A#' };
const BASE_CHORDS = {
  C:'x32010', c:'x35543', C7:'x32310', Cmaj7:'x32000', c7:'x35343', 'C#':'x46664', 'c#':'x46654', 'C#7':'x46464', 'C#maj7':'x46564', 'c#7':'x46454',
  D:'xx0232', d:'xx0231', D7:'xx0212', Dmaj7:'xx0222', d7:'xx0211', 'D#':'x68886', 'd#':'x68876', 'D#7':'x68686', 'D#maj7':'x68786', 'd#7':'x68676',
  E:'022100', e:'022000', E7:'020100', Emaj7:'021100', e7:'020000',
  F:'133211', f:'133111', F7:'131211', Fmaj7:'xx3210', f7:'131111', 'F#':'244322', 'f#':'244222', 'F#7':'242322', 'F#maj7':'243322', 'f#7':'242222',
  G:'320003', g:'355333', G7:'320001', Gmaj7:'320002', g7:'353333', 'G#':'466544', 'g#':'466444', 'G#7':'464544', 'G#maj7':'465544', 'g#7':'464444',
  A:'x02220', a:'x02210', A7:'x02020', Amaj7:'x02120', a7:'x02010', 'A#':'x13331', 'a#':'x13321', 'A#7':'x13131', 'A#maj7':'x13231', 'a#7':'x13121',
  B:'x13331', b:'x13321', B7:'x13131', Bmaj7:'x13231', b7:'x13121',
  H:'x24442', h:'x24432', H7:'x21202', Hmaj7:'x24342', h7:'x24232'
};

const CHORD_RE = /^[A-Ha-h](?:#|b|is|es)?(?:maj7|7)?(?:\/[A-Ha-h](?:#|b|is|es)?)?$/;
let currentView = 'home';
let transposeSteps = 0;
let chordFilters = { letters: new Set(), types: new Set() };
let audioCtx = null;
let metroTimer = null;
let metroRunning = false;
let bpm = Number(localStorage.getItem('easytune-metro-bpm')) || 100;
let meter = Number(localStorage.getItem('easytune-metro-meter')) || 4;
let accentMode = localStorage.getItem('easytune-metro-accent') || 'first';
let beatIndex = 0;
let metroVisualMode = localStorage.getItem('easytune-metro-visual-mode') || 'both';
let tapTimes = [];
let dialPointerActive = false;
let dialPointerMoved = false;

function escapeHtml(str){
  return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function isPwaInstalled(){
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;
}
function syncInstallButtons(){
  const installed = isPwaInstalled();
  document.documentElement.classList.toggle('pwa-installed', installed);
  document.querySelectorAll('[data-pwa-install]').forEach(btn => {
    btn.hidden = installed;
    btn.setAttribute('aria-hidden', installed ? 'true' : 'false');
  });
}
function normalizeRoot(root){
  if(!root) return '';
  let value = root.replace('is','#').replace('es','b');
  const first = value[0] ? value[0].toUpperCase() : '';
  value = first + value.slice(1);
  return FLATS[value] || value;
}
function cleanChordToken(token){return String(token||'').trim().replace(/^[\[(]+/,'').replace(/[\]),;:.!?]+$/,'');}
function mainChord(token){return cleanChordToken(token).split('/')[0];}
function isChordToken(token){
  const clean = cleanChordToken(token);
  return CHORD_RE.test(clean) && !!BASE_CHORDS[mainChord(clean)];
}
function parseChord(chord){
  const clean = mainChord(chord);
  const m = clean.match(/^([A-Ha-h](?:#|b|is|es)?)(.*)$/);
  if(!m) return null;
  const root = normalizeRoot(m[1]);
  const suffix = m[2] || '';
  const idx = NOTES.indexOf(root);
  if(idx < 0) return null;
  return { root, suffix, idx, minor: clean[0] === clean[0].toLowerCase() };
}
function transposeRoot(idx, minor){
  const root = NOTES[(idx + 1200) % 12];
  return minor ? root.toLowerCase() : root;
}
function transposeChord(chord, steps){
  const clean = cleanChordToken(chord);
  const slash = clean.includes('/') ? clean.split('/') : null;
  const main = slash ? slash[0] : clean;
  const bass = slash ? slash[1] : null;
  const parsed = parseChord(main);
  if(!parsed) return chord;
  let out = transposeRoot(parsed.idx + steps, parsed.minor) + parsed.suffix;
  if(bass){
    const b = parseChord(bass);
    if(b) out += '/' + transposeRoot(b.idx + steps, b.minor);
  }
  return out;
}
function splitWordsAndSpaces(line){ return String(line).split(/(\s+)/); }
function transposeOneToken(token, steps){
  const prefix = String(token).match(/^[\[(]*/)?.[0] || '';
  const suffix = String(token).match(/[\]),;:.!?]*$/)?.[0] || '';
  const core = cleanChordToken(token);
  return prefix + transposeChord(core, steps) + suffix;
}
function renderChordText(segment, steps = 0){
  return splitWordsAndSpaces(segment).map(part => {
    if(/^\s+$/.test(part)) return part;
    if(!isChordToken(part)) return escapeHtml(part);
    const label = transposeOneToken(part, steps);
    const chord = cleanChordToken(label);
    return `<button type="button" class="chord-token" data-chord="${escapeHtml(chord)}">${escapeHtml(label)}</button>`;
  }).join('');
}
function renderOutputText(source, steps){
  const lines = String(source||'').split('\n');
  if(!source.trim()) return '<p class="empty-state">Wklej tekst z akordami, a rozpoznane akordy będzie można kliknąć.</p>';
  return lines.map(line => `<div class="output-line">${renderChordText(line, steps) || '&nbsp;'}</div>`).join('');
}
function chordNotes(name){
  const main = mainChord(name);
  const p = parseChord(main);
  if(!p) return '';
  const intervals = p.suffix === 'maj7'
    ? (p.minor ? [0,3,7,11] : [0,4,7,11])
    : p.suffix === '7'
      ? (p.minor ? [0,3,7,10] : [0,4,7,10])
      : (p.minor ? [0,3,7] : [0,4,7]);
  return intervals.map(step => NOTES[(p.idx + step) % NOTES.length]).join(' • ');
}

function chordFullName(name){
  const clean = mainChord(name);
  const p = parseChord(clean);
  if(!p) return clean;
  const root = String(p.root || '').replace('#','is');
  const quality = p.minor ? 'mol' : 'dur';
  if(p.suffix === 'maj7') return `${root} ${quality} maj7`;
  if(p.suffix === '7') return `${root} ${quality} 7`;
  return `${root} ${quality}`;
}
function chordDisplayName(name){
  return `${name} (${chordFullName(name)})`;
}
function romanFretNumber(n){return ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][n] || String(n);}
function chordSvg(name, frets, big=false){
  const nums = [...frets].map(ch => ch === 'x' ? 'x' : Number(ch));
  const played = nums.filter(v => Number.isFinite(v) && v > 0);
  const min = played.length ? Math.min(...played) : 1;
  const max = played.length ? Math.max(...played) : 4;
  const startFret = max > 4 ? min : 1;
  const w = big ? 260 : 170;
  const h = big ? 326 : 178;
  const stringGap = big ? 38 : 22;
  const left = big ? 36 : 30;
  const top = big ? 42 : 30;
  const fretGap = big ? 64 : 34;
  const markerR = big ? 13 : 7.5;
  const stateR = big ? 3.4 : 2.45;
  const xHalf = stateR * 0.58;
  const stateY = top - (big ? 16 : 12);
  const right = left + 5 * stringGap;
  const bottom = top + 4 * fretGap;
  let svg = `<svg class="${big ? 'modal-diagram' : 'diagram'}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Diagram akordu ${escapeHtml(name)}">`;
  for(let f=0; f<4; f++){
    const fretNo = startFret + f;
    svg += `<text class="fret-number" x="${left-(big ? 14 : 8)}" y="${top + (f + .5) * fretGap + 5}">${fretNo}</text>`;
  }
  for(let i=0;i<6;i++) svg += `<line class="string" x1="${left+i*stringGap}" y1="${top}" x2="${left+i*stringGap}" y2="${bottom}" />`;
  for(let f=0;f<5;f++) svg += `<line class="fret" x1="${left}" y1="${top+f*fretGap}" x2="${right}" y2="${top+f*fretGap}" />`;
  if(startFret === 1) svg += `<line class="nut" x1="${left}" y1="${top}" x2="${right}" y2="${top}" />`;
  nums.forEach((fret, i) => {
    const x = left + i*stringGap;
    if(fret === 'x') {
      svg += `<g class="string-state state-muted" aria-label="struna niegrana"><line x1="${x-xHalf}" y1="${stateY-xHalf}" x2="${x+xHalf}" y2="${stateY+xHalf}" /><line x1="${x+xHalf}" y1="${stateY-xHalf}" x2="${x-xHalf}" y2="${stateY+xHalf}" /></g>`;
    } else if(fret === 0) {
      svg += `<circle class="string-state state-open" cx="${x}" cy="${stateY}" r="${stateR}" aria-label="struna grana pusta" />`;
    } else {
      const y = top + (fret - startFret + .5) * fretGap;
      svg += `<circle class="finger-dot" cx="${x}" cy="${y}" r="${markerR}" />`;
    }
  });
  svg += '</svg>';
  return svg;
}
function renderChordCard(name){
  return `<button type="button" class="chord-card" data-chord="${escapeHtml(name)}">
    <span class="chord-figure chord-card-figure">
      <span class="chord-card-head chord-title-box">
        <span class="chord-name">${escapeHtml(chordDisplayName(name))}</span>
      </span>
      ${chordSvg(name, BASE_CHORDS[name])}
    </span>
  </button>`;
}
function chordFamily(name){
  if(name.includes('maj7')) return 'maj7';
  if(name.endsWith('7')) return '7';
  if(name[0] === name[0].toLowerCase()) return 'minor';
  return 'major';
}
function chordSortValue(name){
  const p = parseChord(name);
  return p ? p.idx : 99;
}

function homeHtml(){
  return `<section class="start-panel home-screen" aria-label="Ekran startowy">
    <div class="home-card-bg" aria-hidden="true"></div>
    ${toolCard('transpose','Transpozycja','Zmień tonację utworu','transpose')}
    ${toolCard('chords','Akordy','Diagramy chwytów gitarowych','chords')}
    ${toolCard('metronome','Metronom','BPM, metrum, rytm','metronome')}
  </section>`;
}
function toolCard(view,title,desc,type){
  const dots = type === 'transpose' ? '<span class="dot dot-a"></span><span class="dot dot-b"></span>' : type === 'chords' ? '<span class="dot dot-a"></span><span class="dot dot-b"></span><span class="dot dot-c"></span>' : '<span class="dot dot-a"></span>';
  return `<button class="tool-card tool-card-${type}" type="button" data-view="${view}" aria-label="${escapeHtml(title)} — ${escapeHtml(desc)}">
    <span class="tool-copy"><span class="tool-title">${escapeHtml(title)}</span><span class="tool-desc">${escapeHtml(desc)}</span></span>
    <span class="fret-art fret-art-${type}" aria-hidden="true">${dots}</span>
    <span class="tool-arrow" aria-hidden="true">›</span>
  </button>`;
}
function transposeHtml(){
  return `<section class="start-panel view-screen">
    <div class="view-head"><button class="back-btn" type="button" data-view="home" aria-label="Wróć">‹</button><h1 class="view-title">Transpozycja</h1><span></span></div>
    <div class="view-card">
      <div class="form-label-row"><label class="form-label" for="songInput">Tekst z akordami</label><button class="small-action" type="button" id="clearSong" aria-label="Wyczyść tekst">Wyczyść</button></div>
      <textarea id="songInput" class="song-input" spellcheck="false" wrap="off" placeholder="Np. C G a F&#10;Zaśpiewaj tutaj tekst..."></textarea>
      <span class="form-label transpose-section-label">Transpozycja (półtony)</span>
      <div class="transpose-controls"><button class="round-btn" type="button" id="stepDown">−</button><div class="transpose-value"><strong id="transposeValue">0</strong></div><button class="round-btn" type="button" id="stepUp">+</button></div>
      <div class="transpose-actions transpose-reset-row"><button class="ghost-btn" type="button" id="resetTranspose">Reset</button></div>
    </div>
    <div class="view-card"><div class="form-label-row result-label-row"><span class="form-label">Wynik</span><button class="info-dot" type="button" id="transposeResultInfo" aria-label="Informacja"></button></div><div id="songOutput" class="song-output"></div><div class="transpose-actions"><button class="primary-btn" type="button" id="copyResult">Skopiuj</button></div></div>
  </section>`;
}
function chordsHtml(){
  return `<section class="start-panel view-screen"><div class="view-head chords-view-head"><button class="back-btn" type="button" data-view="home" aria-label="Wróć">‹</button><h1 class="view-title">Akordy</h1><button class="small-action" type="button" id="resetChords">Reset</button></div>
    <div class="view-card chords-panel">
      <div class="letter-filter-row" id="letterFilterRow" aria-label="Filtruj akordy po literze">
        <button class="letter-chip" data-letter="C">C</button><button class="letter-chip" data-letter="D">D</button><button class="letter-chip" data-letter="E">E</button><button class="letter-chip" data-letter="F">F</button><button class="letter-chip" data-letter="G">G</button><button class="letter-chip" data-letter="A">A</button><button class="letter-chip" data-letter="B">B</button><button class="letter-chip" data-letter="H">H</button>
      </div>
      <div class="filter-row type-filter-row" id="filterRow" aria-label="Filtruj akordy po typie"><button class="filter-chip" data-filter="major">Dur</button><button class="filter-chip" data-filter="minor">Mol</button><button class="filter-chip" data-filter="sharp">Krzyżyk</button><button class="filter-chip" data-filter="7">7</button><button class="filter-chip" data-filter="maj7">maj7</button></div>
      <div id="chordGrid" class="chord-grid"></div>
    </div></section>`;
}
function metronomeHtml(){
  return `<section class="start-panel view-screen"><div class="view-head"><button class="back-btn" type="button" data-view="home" aria-label="Wróć">‹</button><h1 class="view-title">Metronom</h1><span></span></div>
    <div class="metro-layout">
      <div class="view-card metro-display"><button id="bpmDial" class="bpm-dial" type="button" role="slider" aria-label="BPM — dotknij, aby powiększyć metronom" aria-valuemin="40" aria-valuemax="240"><strong id="bpmValue">100</strong></button><input id="bpmSlider" class="bpm-slider" type="range" min="40" max="240" value="100"></div>
      <div class="view-card"><span class="group-label">Tap tempo</span><button id="tapTempo" class="tap-btn" type="button">TAP TEMPO</button></div>
      <div class="view-card"><span class="group-label">Presety tempa</span><div id="presetGrid" class="preset-grid"></div></div>
      <div class="view-card"><span class="group-label">Metrum</span><div id="meterButtons" class="meter-buttons"></div></div>
      <div class="view-card"><span class="group-label">Rytm / akcent</span><div id="accentButtons" class="accent-buttons"></div></div>
      <div class="view-card"><span class="group-label">Sygnał</span><div id="visualModeButtons" class="visual-mode-buttons"></div></div>
      <div class="view-card"><span class="group-label">Uderzenia</span><div id="beats" class="beats"></div></div>
      <div class="metro-controls"><button id="startMetro" class="primary-btn metro-start" type="button">Start</button><button id="resetMetro" class="ghost-btn metro-reset" type="button">Reset</button></div>
    </div></section>`;
}

function renderView(view){
  if(view !== 'chords') {
    chordFilters.letters.clear();
    chordFilters.types.clear();
  }
  currentView = view;
  stopMetronome();
  if(view === 'home') content.innerHTML = homeHtml();
  if(view === 'transpose') content.innerHTML = transposeHtml();
  if(view === 'chords') content.innerHTML = chordsHtml();
  if(view === 'metronome') content.innerHTML = metronomeHtml();
  content.focus({ preventScroll:true });
  if(view === 'transpose') initTranspose();
  if(view === 'chords') initChords();
  if(view === 'metronome') initMetronome();
}


function fitTransposeText(){
  const input = document.querySelector('#songInput');
  const output = document.querySelector('#songOutput');
  if(!input || !output) return;
  const text = input.value || '';
  const longest = Math.max(1, ...text.split('\n').map(line => line.length));
  const available = Math.max(120, input.clientWidth - 28);
  const nextSize = Math.max(10, Math.min(14, Math.floor(available / (longest * 0.58))));
  input.style.fontSize = nextSize + 'px';
  output.style.fontSize = nextSize + 'px';
}

function initTranspose(){
  const input = document.querySelector('#songInput');
  const output = document.querySelector('#songOutput');
  const val = document.querySelector('#transposeValue');
  const saved = localStorage.getItem('easytune-song') || 'C G a F\nTo jest przykład z akordami\nF C G C';
  input.value = saved;
  const update = () => { localStorage.setItem('easytune-song', input.value); val.textContent = transposeSteps > 0 ? `+${transposeSteps}` : String(transposeSteps); output.innerHTML = renderOutputText(input.value, transposeSteps); fitTransposeText(); };
  input.addEventListener('input', update);
  window.addEventListener('resize', fitTransposeText);
  document.querySelector('#stepDown').onclick = () => { transposeSteps--; update(); };
  document.querySelector('#stepUp').onclick = () => { transposeSteps++; update(); };
  document.querySelector('#resetTranspose').onclick = () => { transposeSteps = 0; update(); };
  document.querySelector('#clearSong').onclick = () => { input.value = ''; update(); input.focus(); };
  document.querySelector('#copyResult').onclick = async () => { await navigator.clipboard?.writeText(input.value.split('\n').map(l => splitWordsAndSpaces(l).map(p => isChordToken(p) ? transposeOneToken(p, transposeSteps) : p).join('')).join('\n')); };
  document.querySelector('#transposeResultInfo')?.addEventListener('click', () => openAppModal('transpose-result'));
  update();
}
function chordLetter(name){
  const main = mainChord(name);
  return main[0] ? main[0].toUpperCase() : '';
}
function chordFeatures(name){
  const clean = mainChord(name);
  const p = parseChord(clean);
  if(!p) return null;
  const suffix = String(p.suffix || '');
  const isMaj7 = suffix === 'maj7';
  const isSeven = suffix === '7';
  return {
    root: p.root,
    baseLetter: String(p.root || '').replace('#','')[0]?.toUpperCase() || '',
    sharp: String(p.root || '').includes('#'),
    quality: p.minor ? 'minor' : 'major',
    seventh: isMaj7 ? 'maj7' : (isSeven ? '7' : null)
  };
}
function chordTags(name){
  const features = chordFeatures(name);
  const tags = new Set();
  if(!features) return tags;
  if(features.sharp) tags.add('sharp');
  tags.add(features.quality);
  if(features.seventh) tags.add(features.seventh);
  return tags;
}
function matchesChordFilters(name){
  const letters = chordFilters.letters;
  const types = chordFilters.types;
  const f = chordFeatures(name);
  if(!f) return false;

  // Górny rząd liter działa jako OR. Jeśli nie ma dolnych filtrów,
  // wybrana litera pokazuje całą rodzinę, np. C: C, c, C7, Cmaj7, C#, c#...
  if(letters.size && !letters.has(f.baseLetter)) return false;
  if(!types.size) return true;

  // Dolny rząd działa po cechach, nie po fragmentach nazwy.
  // Wybrane cechy są obowiązkowe, a niewybrane cechy # / 7 / maj7 są wykluczane,
  // dzięki czemu C + mol pokazuje tylko c, a C + mol + 7 pokazuje dopiero c7.
  if(types.has('sharp') !== f.sharp) return false;
  if(types.has('minor') && f.quality !== 'minor') return false;
  if(types.has('major') && f.quality !== 'major') return false;
  if(types.has('minor') && types.has('major')) return false;
  if(types.has('7') && f.seventh !== '7') return false;
  if(types.has('maj7') && f.seventh !== 'maj7') return false;
  if(types.has('7') && types.has('maj7')) return false;
  if(!types.has('7') && f.seventh === '7') return false;
  if(!types.has('maj7') && f.seventh === 'maj7') return false;
  return true;
}
function initChords(){
  const grid = document.querySelector('#chordGrid');
  const render = () => {
    const names = Object.keys(BASE_CHORDS)
      .filter(matchesChordFilters)
      .sort((a,b) => chordSortValue(a)-chordSortValue(b) || a.localeCompare(b));
    grid.innerHTML = names.map(renderChordCard).join('') || '<p class="empty-state">Brak akordów dla tego zestawu filtrów.</p>';
  };
  document.querySelector('#letterFilterRow')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-letter]');
    if(!btn) return;
    const value = btn.dataset.letter;
    if(chordFilters.letters.has(value)) chordFilters.letters.delete(value);
    else chordFilters.letters.add(value);
    btn.classList.toggle('active', chordFilters.letters.has(value));
    render();
  });
  document.querySelector('#filterRow')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if(!btn) return;
    const value = btn.dataset.filter;
    if(chordFilters.types.has(value)) chordFilters.types.delete(value);
    else chordFilters.types.add(value);
    btn.classList.toggle('active', chordFilters.types.has(value));
    render();
  });
  document.querySelector('#resetChords')?.addEventListener('click', () => {
    chordFilters.letters.clear();
    chordFilters.types.clear();
    document.querySelectorAll('#letterFilterRow .active, #filterRow .active').forEach(btn => btn.classList.remove('active'));
    render();
  });
  render();
}
function initMetronome(){
  renderMetroControls();
  setBpm(bpm, {restart:false});
  document.querySelector('#bpmSlider').addEventListener('input', e => setBpm(Number(e.target.value)));
  document.querySelector('#startMetro').onclick = () => metroRunning ? stopMetronome() : startMetronome();
  document.querySelector('#resetMetro').onclick = () => resetMetronomeSettings();
  const dial = document.querySelector('#bpmDial');
  dial.addEventListener('pointerdown', e => { dialPointerActive = true; dialPointerMoved = false; dial.setPointerCapture(e.pointerId); updateBpmFromPointer(e); });
  dial.addEventListener('pointermove', e => { if(e.buttons){ dialPointerMoved = true; updateBpmFromPointer(e); } });
  dial.addEventListener('pointerup', () => { setTimeout(()=>{ dialPointerActive = false; }, 0); });
  dial.addEventListener('click', e => { if(!dialPointerMoved) openMetroVisualModal(); });
  const beats = document.querySelector('#beats');
  beats?.addEventListener('click', openMetroVisualModal);
}
function updateBpmFromPointer(e){
  const r = e.currentTarget.getBoundingClientRect();
  const y = 1 - ((e.clientY - r.top) / r.height);
  const value = Math.round(40 + Math.max(0,Math.min(1,y)) * 200);
  setBpm(value);
}
function renderMetroControls(){
  const presets = [60,80,100,120,140,160];
  const presetGrid = document.querySelector('#presetGrid');
  const meterButtons = document.querySelector('#meterButtons');
  const accentButtons = document.querySelector('#accentButtons');
  const visualModeButtons = document.querySelector('#visualModeButtons');
  if(presetGrid) presetGrid.innerHTML = presets.map(v => `<button class="preset-bpm${v===bpm?' active':''}" data-bpm="${v}">${v}</button>`).join('');
  if(meterButtons) meterButtons.innerHTML = [2,3,4,5,6].map(v => `<button class="meter-btn${v===meter?' active':''}" data-meter="${v}">${v}${v===6?'/8':'/4'}</button>`).join('');
  if(accentButtons) accentButtons.innerHTML = [['first','Pierwszy'],['all','Każdy'],['off','Bez akcentu']].map(([v,l]) => `<button class="accent-btn${v===accentMode?' active':''}" data-accent="${v}">${l}</button>`).join('');
  if(visualModeButtons) visualModeButtons.innerHTML = [['sound','Dźwięk'],['light','Światło'],['both','Oba']].map(([v,l]) => `<button class="visual-mode-btn${v===metroVisualMode?' active':''}" data-visual-mode="${v}">${l}</button>`).join('');
  if(presetGrid) presetGrid.onclick = e => { const b=e.target.closest('[data-bpm]'); if(b){setBpm(Number(b.dataset.bpm)); renderMetroControls();}};
  if(meterButtons) meterButtons.onclick = e => { const b=e.target.closest('[data-meter]'); if(b){meter=Number(b.dataset.meter); beatIndex=0; saveMetroSettings(); renderBeats(); updateMeter(); renderMetroControls();}};
  if(accentButtons) accentButtons.onclick = e => { const b=e.target.closest('[data-accent]'); if(b){accentMode=b.dataset.accent; saveMetroSettings(); renderBeats(); renderMetroControls();}};
  if(visualModeButtons) visualModeButtons.onclick = e => { const b=e.target.closest('[data-visual-mode]'); if(b){metroVisualMode=b.dataset.visualMode; saveMetroSettings(); renderMetroControls();}};
  renderBeats(); updateMeter();
}
function setBpm(v, opts={restart:true}){
  bpm = Math.max(40, Math.min(240, Math.round(v)));
  saveMetroSettings();
  const bpmEl = document.querySelector('#bpmValue');
  const slider = document.querySelector('#bpmSlider');
  const dial = document.querySelector('#bpmDial');
  if(bpmEl) bpmEl.textContent = bpm;
  if(slider) slider.value = bpm;
  if(dial) dial.setAttribute('aria-valuenow', String(bpm));
  updateMetroModalState();
  if(opts.restart && metroRunning){ stopMetronome(); startMetronome(); }
}
function saveMetroSettings(){
  localStorage.setItem('easytune-metro-bpm', String(bpm));
  localStorage.setItem('easytune-metro-meter', String(meter));
  localStorage.setItem('easytune-metro-accent', accentMode);
  localStorage.setItem('easytune-metro-visual-mode', metroVisualMode);
}
function resetMetronomeSettings(){
  stopMetronome();
  bpm = 100;
  meter = 4;
  accentMode = 'first';
  metroVisualMode = 'both';
  tapTimes = [];
  beatIndex = 0;
  saveMetroSettings();
  if(currentView === 'metronome') initMetronome();
  else { setBpm(bpm, {restart:false}); renderBeats(); updateMeter(); updateMetroModalState(); }
}
function handleTapTempo(){
  const now = Date.now();
  tapTimes = tapTimes.filter(t => now - t < 2200);
  tapTimes.push(now);
  if(tapTimes.length >= 2){
    const intervals = tapTimes.slice(1).map((t,i)=>t - tapTimes[i]);
    const avg = intervals.reduce((a,b)=>a+b,0) / intervals.length;
    setBpm(Math.round(60000 / avg));
  }
}
function flashMetro(accented){
  document.body.classList.remove('metro-flash','metro-flash-accent');
  void document.body.offsetWidth;
  document.body.classList.add(accented ? 'metro-flash-accent' : 'metro-flash');
  window.setTimeout(()=>document.body.classList.remove('metro-flash','metro-flash-accent'), 120);
}
function updatePendulumSpeed(){
  const pendulum = document.querySelector('.metro-pendulum');
  if(pendulum) pendulum.style.animationDuration = `${Math.max(180, 60000 / bpm)}ms`;
}
function updateMeter(){ const label = meter === 6 ? '6/8' : `${meter}/4`; const el=document.querySelector('#meterInDial'); if(el) el.textContent = label; const modalMeter=document.querySelector('[data-modal-meter]'); if(modalMeter) modalMeter.textContent = label; }
function renderBeats(){
  const markup = Array.from({length:meter}, (_,i) => `<span class="beat-wrap"><span class="beat-number ${i===beatIndex?'active':''}">${i+1}</span><span class="beat ${i===0?'accent':''} ${i===beatIndex?'active':''}">${'●'}</span></span>`).join('');
  const beats = document.querySelector('#beats');
  if(beats) beats.innerHTML = markup;
  const modalBeats = document.querySelector('#metroModalBeats');
  if(modalBeats) modalBeats.innerHTML = markup;
}
function updateMetroModalState(){
  const modalBpm = document.querySelector('#metroModalBpm');
  if(modalBpm) modalBpm.textContent = bpm;
  const modalStart = document.querySelector('#metroModalStart');
  if(modalStart) modalStart.textContent = metroRunning ? 'Stop' : 'Start';
  if(metroVisualModal) metroVisualModal.classList.toggle('running', metroRunning);
  updatePendulumSpeed();
}
function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if(audioCtx.state === 'suspended') audioCtx.resume(); }
function clickSound(accented){
  if(metroVisualMode === 'light') return;
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = accented ? 1400 : 850;
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(accented ? 0.22 : 0.14, audioCtx.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.065);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.075);
}
function tick(){
  const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
  clickSound(accented);
  if(metroVisualMode === 'light' || metroVisualMode === 'both') flashMetro(accented);
  renderBeats();
  beatIndex = (beatIndex + 1) % meter;
}
function startMetronome(){
  if(metroVisualMode !== 'light') ensureAudio(); metroRunning = true; beatIndex = 0;
  const btn = document.querySelector('#startMetro'); if(btn) btn.textContent = 'Stop';
  updateMetroModalState();
  tick(); metroTimer = setInterval(tick, 60000 / bpm);
}
function stopMetronome(){
  metroRunning = false; if(metroTimer) clearInterval(metroTimer); metroTimer = null;
  const btn = document.querySelector('#startMetro'); if(btn) btn.textContent = 'Start';
  updateMetroModalState();
}
function toggleMetroFullscreen(){
  const card = document.querySelector('.metro-visual-card');
  if(!document.fullscreenElement){
    (card?.requestFullscreen || document.documentElement.requestFullscreen)?.call(card || document.documentElement).catch?.(()=>{});
  } else {
    document.exitFullscreen?.();
  }
}
function openMetroVisualModal(){
  if(!metroVisualModal) return;
  renderBeats();
  updateMeter();
  updateMetroModalState();
  metroVisualModal.classList.add('visible');
  metroVisualModal.setAttribute('aria-hidden','false');
}
function closeMetroVisualModal(){
  if(!metroVisualModal) return;
  metroVisualModal.classList.remove('visible');
  metroVisualModal.setAttribute('aria-hidden','true');
}

function openChordModal(chord){
  const clean = mainChord(chord);
  if(!BASE_CHORDS[clean]) return;
  if(!chordModal || !chordModalContent) return;
  chordModalContent.innerHTML = `<div class="chord-figure modal-chord-figure"><div class="modal-chord-title-box chord-title-box"><h2 class="modal-chord-title">${escapeHtml(chordDisplayName(clean))}</h2><p class="modal-chord-notes">${escapeHtml(chordNotes(clean))}</p></div>${chordSvg(clean, BASE_CHORDS[clean], true)}</div>`;
  chordModal.classList.add('visible'); chordModal.setAttribute('aria-hidden','false');
}
function closeChordModal(){ if(!chordModal) return; chordModal.classList.remove('visible'); chordModal.setAttribute('aria-hidden','true'); }
function openAppModal(kind){
  if(!appModal || !appModalContent) return;
  const installMarkup = isPwaInstalled() ? '' : '<button class="primary-btn" type="button" data-pwa-install>Zainstaluj aplikację</button>';
  appModalContent.innerHTML = kind === 'options'
    ? `<h2>Opcje</h2><p>EasyTune działa offline po pierwszym uruchomieniu.${isPwaInstalled() ? ' Aplikacja jest już uruchomiona jako zainstalowane PWA.' : ' Aby działała jako pełne PWA, wybierz „Zainstaluj" z menu przeglądarki.'}</p>${installMarkup}`
    : kind === 'transpose-result'
      ? '<h2>Wynik transpozycji</h2><p>Kliknij dowolny akord w oknie wyniku, aby otworzyć powiększony diagram tego chwytu.</p>'
      : `<h2>EasyTune</h2><p>Transpozycja, akordy i metronom. Wersja PWA offline ${appVersion}.</p>`;
  appModal.classList.add('visible'); appModal.setAttribute('aria-hidden','false');
  syncInstallButtons();
}
function closeAppModal(){ if(!appModal) return; appModal.classList.remove('visible'); appModal.setAttribute('aria-hidden','true'); }

async function loadManifestVersion(){
  try {
    const response = await fetch('./manifest.webmanifest');
    if (!response.ok) throw new Error('Failed to fetch manifest');
    const manifest = await response.json();
    if (manifest.version) {
      appVersion = manifest.version;
    }
  } catch (error) {
    console.warn('Failed to load version from manifest:', error);
    // appVersion stays as default '1.2'
  } finally {
    if (versionEl) {
      versionEl.textContent = `v${appVersion}`;
    }
  }
}

function showApp(){ app.hidden = false; renderView('home'); setTimeout(()=>splash.classList.add('is-hidden'), 850); setTimeout(()=>splash.remove(), 1300); }

menuButton?.addEventListener('click', () => { const open = !optionsMenu.hidden; optionsMenu.hidden = open; menuButton.setAttribute('aria-expanded', String(!open)); });
homeLogoBtn?.addEventListener('click', () => renderView('home'));
document.addEventListener('click', e => {
  const viewBtn = e.target.closest('[data-view]');
  if(viewBtn){ renderView(viewBtn.dataset.view); return; }
  const chordBtn = e.target.closest('[data-chord]');
  if(chordBtn){ openChordModal(chordBtn.dataset.chord); return; }
  const installBtn = e.target.closest('[data-pwa-install]');
  if(installBtn){ optionsMenu.hidden = true; menuButton.setAttribute('aria-expanded','false'); promptPwaInstall(); return; }
  const appBtn = e.target.closest('[data-app-modal]');
  if(appBtn){ optionsMenu.hidden = true; menuButton.setAttribute('aria-expanded','false'); openAppModal(appBtn.dataset.appModal); return; }
  if(e.target.closest('[data-close-chord]') || e.target === chordModal) closeChordModal();
  if(e.target.closest('[data-close-app-modal]') || e.target === appModal) closeAppModal();
  if(e.target.closest('[data-close-metro-visual]') || e.target === metroVisualModal) closeMetroVisualModal();
  if(e.target.closest('#metroModalStart')){ metroRunning ? stopMetronome() : startMetronome(); return; }
  if(e.target.closest('#metroModalReset')){ resetMetronomeSettings(); return; }
  if(e.target.closest('#metroModalDown')){ setBpm(bpm - 1); return; }
  if(e.target.closest('#metroModalUp')){ setBpm(bpm + 1); return; }
  if(e.target.closest('#metroModalTap')){ handleTapTempo(); return; }
  if(e.target.closest('#metroModalFullscreen')){ toggleMetroFullscreen(); return; }
  if(optionsMenu && !optionsMenu.hidden && !optionsMenu.contains(e.target) && !menuButton.contains(e.target)){ optionsMenu.hidden = true; menuButton.setAttribute('aria-expanded','false'); }
});
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeChordModal(); closeAppModal(); closeMetroVisualModal(); closeTapHelpModal?.(); } });


let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.documentElement.classList.add('pwa-can-install');
  syncInstallButtons();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.documentElement.classList.remove('pwa-can-install');
  document.documentElement.classList.add('pwa-installed');
  syncInstallButtons();
});
window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', syncInstallButtons);
window.matchMedia?.('(display-mode: fullscreen)')?.addEventListener?.('change', syncInstallButtons);
async function promptPwaInstall(){
  if (isPwaInstalled()) { syncInstallButtons(); return; }
  if (!deferredInstallPrompt) {
    alert('Przeglądarka nie zgłosiła jeszcze gotowości instalacji PWA. Upewnij się, że strona działa przez HTTPS lub localhost, odśwież ją raz i wybierz w menu przeglądarki „Zainstaluj aplikację".');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  document.documentElement.classList.remove('pwa-can-install');
  syncInstallButtons();
}
syncInstallButtons();
loadManifestVersion().then(() => { showApp(); syncInstallButtons(); });
