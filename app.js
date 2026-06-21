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
  const dots = type === 'transpose' ? '<span class="dot dot-a"></span><span class="dot dot-b"></span>' : type === 'chords' ? '<span class="dot dot-a"></span><span class="dot dot-b"></span><span class="dot dot-c"></span>' : '<span class="dot dot-green"></span>';
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
    <div class="view-card"><div class="form-label-row result-label-row"><span class="form-label">Wynik</span><button class="info-dot" type="button" id="transposeResultInfo" aria-label="Informacja o wyniku transpozycji" title="Informacja o wyniku transpozycji">i</button></div><div id="songOutput" class="output-box"></div><div class="output-actions"><button class="primary-btn" type="button" id="copyResult">Kopiuj wynik</button></div></div>
  </section>`;
}
function chordsHtml(){
  return `<section class="start-panel view-screen"><div class="view-head chords-view-head"><button class="back-btn" type="button" data-view="home" aria-label="Wróć">‹</button><h1 class="view-title">Akordy</h1><button class="small-action chord-reset-btn" type="button" id="resetChords">Reset</button></div>
    <div class="view-card chords-panel">
      <div class="letter-filter-row" id="letterFilterRow" aria-label="Filtruj akordy po literze">
        <button class="letter-chip" data-letter="C">C</button><button class="letter-chip" data-letter="D">D</button><button class="letter-chip" data-letter="E">E</button><button class="letter-chip" data-letter="F">F</button><button class="letter-chip" data-letter="G">G</button><button class="letter-chip" data-letter="A">A</button><button class="letter-chip" data-letter="H">H</button>
      </div>
      <div class="filter-row type-filter-row" id="filterRow" aria-label="Filtruj akordy po typie"><button class="filter-chip" data-filter="major">Dur</button><button class="filter-chip" data-filter="minor">Moll</button><button class="filter-chip" data-filter="sharp">#</button><button class="filter-chip" data-filter="7">7</button><button class="filter-chip" data-filter="maj7">Maj7</button></div>
      <div id="chordGrid" class="chord-grid"></div>
    </div></section>`;
}
function metronomeHtml(){
  return `<section class="start-panel view-screen"><div class="view-head"><button class="back-btn" type="button" data-view="home" aria-label="Wróć">‹</button><h1 class="view-title">Metronom</h1><span></span></div>
    <div class="metro-layout">
      <div class="view-card metro-display"><button id="bpmDial" class="bpm-dial" type="button" role="slider" aria-label="BPM — dotknij, aby powiększyć metronom" aria-valuemin="40" aria-valuemax="240" aria-valuenow="${bpm}"><div class="bpm"><span id="bpmValue">${bpm}</span><small>BPM</small></div><div id="meterInDial" class="meter-in-dial">${meter}/4</div><div class="dial-hint">dotknij, aby powiększyć</div></button><input id="bpmSlider" class="bpm-slider" type="range" min="40" max="240" value="${bpm}"></div>
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
  document.querySelector('#copyResult').onclick = async () => { await navigator.clipboard?.writeText(input.value.split('\n').map(l => splitWordsAndSpaces(l).map(p => isChordToken(p) ? transposeOneToken(p, transposeSteps) : p).join('')).join('\n')).catch(()=>{}); };
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
function updateMeter(){ const label = meter === 6 ? '6/8' : `${meter}/4`; const el=document.querySelector('#meterInDial'); if(el) el.textContent = label; const modalMeter=document.querySelector('#metroModalMeter'); if(modalMeter) modalMeter.textContent = label; }
function renderBeats(){
  const markup = Array.from({length:meter}, (_,i) => `<span class="beat-wrap"><span class="beat-number ${i===beatIndex?'active':''}">${i+1}</span><span class="beat ${i===0?'accent':''} ${i===beatIndex?'active':''}"></span></span>`).join('');
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
  chordModalContent.innerHTML = `<div class="chord-figure modal-chord-figure"><div class="modal-chord-title-box chord-title-box"><h2 class="modal-chord-title">${escapeHtml(chordDisplayName(clean))}</h2><span class="chord-title-divider" aria-hidden="true"></span><p class="modal-chord-sub"><span class="modal-notes-label">Dźwięki: </span>${escapeHtml(chordNotes(clean))}</p></div>${chordSvg(clean, BASE_CHORDS[clean], true)}<div class="chord-legend" aria-label="Legenda diagramu akordu"><span><b class="legend-x">×</b> nie graj</span><span><b class="legend-o">○</b> graj otwartą strunę</span><span><b class="legend-fret">1, 2, ...</b> nr progu</span></div></div>`;
  chordModal.classList.add('visible'); chordModal.setAttribute('aria-hidden','false');
}
function closeChordModal(){ if(!chordModal) return; chordModal.classList.remove('visible'); chordModal.setAttribute('aria-hidden','true'); }
function openAppModal(kind){
  if(!appModal || !appModalContent) return;
  const installMarkup = isPwaInstalled() ? '' : '<button class="primary-btn" type="button" data-pwa-install>Zainstaluj aplikację</button>';
  appModalContent.innerHTML = kind === 'options'
    ? `<h2>Opcje</h2><p>EasyTune działa offline po pierwszym uruchomieniu.${isPwaInstalled() ? ' Aplikacja jest już uruchomiona jako zainstalowane PWA.' : ' Aby działała jako pełne PWA, wybierz „Zainstaluj aplikację”, a nie „Dodaj skrót”.'}</p>${installMarkup}`
    : kind === 'transpose-result'
      ? '<h2>Wynik transpozycji</h2><p>Kliknij dowolny akord w oknie wyniku, aby otworzyć powiększony diagram tego chwytu.</p>'
      : `<h2>EasyTune</h2><p>Transpozycja, akordy i metronom. Wersja PWA offline ${appVersion}.</p>`;
  appModal.classList.add('visible'); appModal.setAttribute('aria-hidden','false');
  syncInstallButtons();
}
function closeAppModal(){ if(!appModal) return; appModal.classList.remove('visible'); appModal.setAttribute('aria-hidden','true'); }

async function loadManifestVersion(){
  try{ const res = await fetch('manifest.webmanifest'); const m = await res.json(); appVersion = m.version || '1.2'; versionEl.textContent = `v${appVersion}`; } catch { versionEl.textContent = `v${appVersion}`; }
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
    alert('Przeglądarka nie zgłosiła jeszcze gotowości instalacji PWA. Upewnij się, że strona działa przez HTTPS lub localhost, odśwież ją raz i wybierz w menu przeglądarki „Zainstaluj aplikację” — nie „Dodaj skrót”.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  document.documentElement.classList.remove('pwa-can-install');
  syncInstallButtons();
}
syncInstallButtons();
loadManifestVersion().finally(() => { showApp(); syncInstallButtons(); });

/* =====================================================
   EasyTune v2.5 — CZYSTY METRONOM
   Ten blok nadpisuje wyłącznie widok i logikę metronomu.
   Pozostałe widoki i modale pozostają bez zmian.
   ===================================================== */
let cleanTapTimes = [];
let cleanMetroTimer = null;
let metroPendulumFrame = null;
let metroPendulumStartedAt = 0;
let metroWasRunningBeforeModal = false;
let metroPausedByModal = false;
let metroLayoutFrame = null;

function metronomeHtml(){
  const meterLabel = meter === 6 ? '6/8' : `${meter}/4`;
  const accentLabel = accentMode === 'off' ? 'Brak' : accentMode === 'all' ? 'Każdy' : 'Pierwszy';
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
          <strong id="bpmValue">${bpm}</strong>
          <span>BPM</span>
        </button>
      </div>

      <div class="metro-clean-beats" id="beats" role="button" tabindex="0" aria-label="Uderzenia taktu"></div>

      <div class="metro-clean-meta">
        <button id="openTempoModal" type="button"><span>Tempo</span><strong id="metroTempoMeta">${bpm} BPM</strong></button>
        <button id="openMeterModal" type="button"><span>Metrum</span><strong id="meterInDial">${meterLabel}</strong></button>
        <button id="openAccentModal" type="button"><span>Akcent</span><strong id="metroAccentMeta">${accentLabel}</strong></button>
      </div>
    </div>

    <div class="metro-clean-actions">
      <button id="startMetro" class="primary-btn metro-start" type="button">${metroRunning ? 'Stop' : 'Start'}</button>
    </div>

    <div id="metroTempoModal" class="metro-settings-modal" aria-hidden="true" role="dialog" aria-label="Ustaw tempo">
      <div class="metro-settings-card">
        <button class="metro-settings-close" type="button" data-close-metro-settings aria-label="Zamknij">×</button>
        <h2>Tempo</h2>
        <div class="metro-bpm-stepper">
          <button id="metroBpmDown" type="button">−</button>
          <strong id="metroModalBpm">${bpm}</strong>
          <button id="metroBpmUp" type="button">+</button>
        </div>
        <input id="bpmSlider" class="bpm-slider" type="range" min="40" max="240" value="${bpm}">
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
        <p>Wystukaj żądane tempo, klikając kilka razy przycisk „Tap Tempo” w rytmie utworu. EasyTune automatycznie rozpozna i ustawi odpowiednią wartość BPM.</p>
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

function initMetronome(){
  metroWasRunningBeforeModal = false;
  metroPausedByModal = false;
  renderMetroControls();
  syncCleanMetronomeUi();
  setBpm(bpm, {restart:false});
  scheduleCleanMetronomeLayoutSync();

  document.querySelector('#startMetro')?.addEventListener('click', () => metroRunning ? stopMetronome() : startMetronome());
  document.querySelector('#metroResetTop')?.addEventListener('click', resetMetronomeSettings);
  document.querySelector('#metroTapInModal')?.addEventListener('click', handleTapTempo);
  document.querySelector('#metroBpmDown')?.addEventListener('click', () => setBpm(bpm - 1));
  document.querySelector('#metroBpmUp')?.addEventListener('click', () => setBpm(bpm + 1));
  document.querySelector('#bpmSlider')?.addEventListener('input', e => setBpm(Number(e.target.value)));
  document.querySelector('#openTempoModal')?.addEventListener('click', () => openMetroSettings('metroTempoModal'));
  document.querySelector('#openMeterModal')?.addEventListener('click', () => openMetroSettings('metroMeterModal'));
  document.querySelector('#openAccentModal')?.addEventListener('click', () => openMetroSettings('metroAccentModal'));
  document.querySelector('#metroTapInfoClean')?.addEventListener('click', () => {
    const modal = document.querySelector('#tapHelpModal');
    pauseMetronomeForModal();
    modal?.classList.add('open');
    modal?.setAttribute('aria-hidden','false');
  });
  document.querySelector('#tapHelpClose')?.addEventListener('click', closeTapHelpModal);
  document.querySelector('#tapHelpModal')?.addEventListener('click', e => {
    if(e.target === e.currentTarget) closeTapHelpModal();
  });

  document.querySelectorAll('[data-close-metro-settings]').forEach(btn => btn.addEventListener('click', closeMetroSettings));
  document.querySelectorAll('.metro-settings-modal').forEach(modal => modal.addEventListener('click', e => {
    if(e.target === modal) closeMetroSettings();
  }));
}

function scheduleCleanMetronomeLayoutSync(){
  if(currentView !== 'metronome') return;
  if(metroLayoutFrame) cancelAnimationFrame(metroLayoutFrame);
  metroLayoutFrame = requestAnimationFrame(() => {
    metroLayoutFrame = null;
    syncCleanMetronomeLayout();
  });
}

function syncCleanMetronomeLayout(){
  const screen = document.querySelector('.metro-clean-screen');
  const main = document.querySelector('#metroCleanMain');
  const visual = document.querySelector('#metroCleanVisual');
  if(!screen || !main || !visual) return;

  const viewportWidth = Math.max(320, Math.round(
    window.visualViewport?.width ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    screen.clientWidth ||
    0
  ));
  const viewportHeight = Math.max(320, Math.round(
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    screen.clientHeight ||
    0
  ));
  const landscape = viewportWidth > viewportHeight;
  const head = screen.querySelector('.view-head');
  const actions = screen.querySelector('.metro-clean-actions');
  const screenStyle = getComputedStyle(screen);
  const mainStyle = getComputedStyle(main);
  const actionsStyle = actions ? getComputedStyle(actions) : null;
  const screenHeight = screen.clientHeight || Math.round(screen.getBoundingClientRect().height) || viewportHeight;
  const availableWidth = Math.max(
    260,
    Math.min(main.clientWidth || screen.clientWidth || viewportWidth, viewportWidth - 28)
  );
  const availableHeight = Math.max(
    230,
    screenHeight -
      (head?.offsetHeight || 0) -
      ((parseFloat(screenStyle.paddingTop) || 0) + (parseFloat(screenStyle.paddingBottom) || 0)) -
      (actions?.offsetHeight || 0) -
      (actionsStyle ? (parseFloat(actionsStyle.marginTop) || 0) : 0) -
      16
  );

  const baseVisualWidth = landscape ? 384 : 360;
  const baseVisualRatio = landscape ? 0.98 : 1.16;
  const baseVisualHeight = baseVisualWidth * baseVisualRatio;
  const baseMainHeight =
    baseVisualHeight +
    (landscape ? 56 : 62) +
    (landscape ? 58 : 62) +
    ((parseFloat(mainStyle.rowGap || mainStyle.gap) || 18) * 2);
  const scale = Math.max(
    0.56,
    Math.min(
      availableWidth / baseVisualWidth,
      availableHeight / baseMainHeight,
      1.18
    )
  );

  screen.classList.toggle('metro-clean-landscape', landscape);
  screen.classList.toggle('metro-clean-portrait', !landscape);
  screen.style.setProperty('--metro-scale', scale.toFixed(3));
  screen.style.setProperty('--metro-visual-width', `${Math.round(baseVisualWidth * scale)}px`);
  screen.style.setProperty('--metro-visual-ratio', baseVisualRatio.toFixed(3));
}

window.addEventListener('resize', scheduleCleanMetronomeLayoutSync);
window.visualViewport?.addEventListener?.('resize', scheduleCleanMetronomeLayoutSync);

function pauseMetronomeForModal(){
  if(metroPausedByModal) return;
  metroWasRunningBeforeModal = metroRunning;
  if(metroRunning) stopMetronome();
  metroPausedByModal = metroWasRunningBeforeModal;
}
function isAnyMetroModalOpen(){
  const settingsOpen = Array.from(document.querySelectorAll('.metro-settings-modal')).some(m => m.classList.contains('visible'));
  const tapHelpOpen = document.querySelector('#tapHelpModal')?.classList.contains('open');
  return settingsOpen || Boolean(tapHelpOpen);
}
function resumeMetronomeAfterModal(){
  if(isAnyMetroModalOpen()) return;
  const shouldResume = metroPausedByModal && metroWasRunningBeforeModal;
  metroPausedByModal = false;
  metroWasRunningBeforeModal = false;
  if(shouldResume && !metroRunning) startMetronome();
}

function openMetroSettings(id){
  pauseMetronomeForModal();
  document.querySelectorAll('.metro-settings-modal').forEach(m => {
    m.classList.remove('visible');
    m.setAttribute('aria-hidden','true');
  });
  const modal = document.querySelector('#' + id);
  if(!modal) return;
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden','false');
}
function closeMetroSettings(){
  document.querySelectorAll('.metro-settings-modal').forEach(m => {
    m.classList.remove('visible');
    m.setAttribute('aria-hidden','true');
  });
  resumeMetronomeAfterModal();
}

function closeTapHelpModal(){
  const modal = document.querySelector('#tapHelpModal');
  if(!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  resumeMetronomeAfterModal();
}

function renderMetroControls(){
  const presets = [60, 80, 100, 120, 140, 160];
  const presetGrid = document.querySelector('#presetGrid');
  if(presetGrid){
    presetGrid.innerHTML = presets.map(v => `<button class="preset-bpm${v===bpm?' active':''}" data-bpm="${v}" type="button">${v}</button>`).join('');
    presetGrid.onclick = e => {
      const btn = e.target.closest('[data-bpm]');
      if(!btn) return;
      setBpm(Number(btn.dataset.bpm));
      renderMetroControls();
    };
  }

  const meterButtons = document.querySelector('#meterButtons');
  if(meterButtons){
    meterButtons.innerHTML = [2,3,4,5,6].map(v => `<button class="meter-btn${v===meter?' active':''}" data-meter="${v}" type="button">${v}${v===6?'/8':'/4'}</button>`).join('');
    meterButtons.onclick = e => {
      const btn = e.target.closest('[data-meter]');
      if(!btn) return;
      meter = Number(btn.dataset.meter);
      beatIndex = 0;
      saveMetroSettings();
      renderMetroControls();
      renderBeats();
      syncCleanMetronomeUi();
    };
  }

  const accentButtons = document.querySelector('#accentButtons');
  if(accentButtons){
    accentButtons.innerHTML = [
      ['first','Pierwszy'],
      ['all','Każdy'],
      ['off','Brak']
    ].map(([v,l]) => `<button class="accent-btn${v===accentMode?' active':''}" data-accent="${v}" type="button">${l}</button>`).join('');
    accentButtons.onclick = e => {
      const btn = e.target.closest('[data-accent]');
      if(!btn) return;
      accentMode = btn.dataset.accent;
      beatIndex = 0;
      saveMetroSettings();
      renderMetroControls();
      renderBeats();
      syncCleanMetronomeUi();
    };
  }

  renderBeats();
  syncCleanMetronomeUi();
}


function stopPendulumMotion(reset=true){
  if(metroPendulumFrame){
    cancelAnimationFrame(metroPendulumFrame);
    metroPendulumFrame = null;
  }
  if(reset){
    const pendulum = document.querySelector('.metro-clean-pendulum');
    if(pendulum) pendulum.style.setProperty('transform', 'translateX(-50%) rotate(0deg)', 'important');
  }
}

function startPendulumMotion(){
  stopPendulumMotion(false);
  const pendulum = document.querySelector('.metro-clean-pendulum');
  if(!pendulum) return;
  const beatMs = Math.max(180, 60000 / bpm);
  const maxAngle = 38;
  metroPendulumStartedAt = performance.now();

  const draw = (now) => {
    if(!metroRunning){
      metroPendulumFrame = null;
      return;
    }

    // Jeden mechanizm ruchu: pozycja zależy wyłącznie od czasu i BPM.
    // Uderzenia wypadają na skrajach wahadła: lewo, prawo, lewo...
    const elapsed = now - metroPendulumStartedAt;
    const phase = (elapsed % (beatMs * 2)) / beatMs;
    const angle = phase <= 1
      ? -maxAngle + (phase * 2 * maxAngle)
      :  maxAngle - ((phase - 1) * 2 * maxAngle);

    pendulum.style.setProperty('transform', `translateX(-50%) rotate(${angle.toFixed(2)}deg)`, 'important');
    metroPendulumFrame = requestAnimationFrame(draw);
  };

  pendulum.style.setProperty('transform', `translateX(-50%) rotate(${-maxAngle}deg)`, 'important');
  metroPendulumFrame = requestAnimationFrame(draw);
}

function syncCleanMetronomeUi(){
  const meterLabel = meter === 6 ? '6/8' : `${meter}/4`;
  const accentLabel = accentMode === 'off' ? 'Brak' : accentMode === 'all' ? 'Każdy' : 'Pierwszy';

  const bpmText = document.querySelector('#bpmValue');
  const modalBpm = document.querySelector('#metroModalBpm');
  const slider = document.querySelector('#bpmSlider');
  const tempoMeta = document.querySelector('#metroTempoMeta');
  const meterMeta = document.querySelector('#meterInDial');
  const accentMeta = document.querySelector('#metroAccentMeta');
  const visual = document.querySelector('#metroCleanVisual');
  const start = document.querySelector('#startMetro');

  if(bpmText) bpmText.textContent = bpm;
  if(modalBpm) modalBpm.textContent = bpm;
  if(slider) slider.value = bpm;
  if(tempoMeta) tempoMeta.textContent = `${bpm} BPM`;
  if(meterMeta) meterMeta.textContent = meterLabel;
  if(accentMeta) accentMeta.textContent = accentLabel;
  if(start) start.textContent = metroRunning ? 'Stop' : 'Start';

  if(visual){
    // Jedyny ruch metronomu: wahadło synchronizowane z interwałem BPM.
    visual.style.setProperty('--metro-duration', `${60000 / bpm}ms`);
    visual.classList.toggle('running', metroRunning);
  }
  scheduleCleanMetronomeLayoutSync();
}

function setBpm(v, opts={restart:true}){
  bpm = Math.max(40, Math.min(240, Math.round(v)));
  saveMetroSettings();
  syncCleanMetronomeUi();
  document.querySelectorAll('.preset-bpm').forEach(b => b.classList.toggle('active', Number(b.dataset.bpm) === bpm));
  if(opts.restart && metroRunning){
    stopMetronome();
    startMetronome();
  }
}

function saveMetroSettings(){
  localStorage.setItem('easytune-metro-bpm', String(bpm));
  localStorage.setItem('easytune-metro-meter', String(meter));
  localStorage.setItem('easytune-metro-accent', accentMode);
}

function resetMetronomeSettings(){
  stopMetronome();
  bpm = 100;
  meter = 4;
  accentMode = 'first';
  cleanTapTimes = [];
  beatIndex = 0;
  saveMetroSettings();
  renderMetroControls();
  syncCleanMetronomeUi();
}

function handleTapTempo(){
  const now = Date.now();
  cleanTapTimes = cleanTapTimes.filter(t => now - t < 2200);
  cleanTapTimes.push(now);
  if(cleanTapTimes.length < 2) return;
  const intervals = cleanTapTimes.slice(1).map((t,i)=> t - cleanTapTimes[i]);
  const avg = intervals.reduce((a,b)=>a+b,0) / intervals.length;
  setBpm(Math.round(60000 / avg));
}

function renderBeats(){
  const beats = document.querySelector('#beats');
  if(!beats) return;
  beats.innerHTML = Array.from({length:meter}, (_,i)=>{
    const active = i === beatIndex;
    const accent = accentMode === 'all' || (accentMode === 'first' && i === 0);
    return `<span class="beat-wrap"><span class="beat-number${active?' active':''}">${i+1}</span><span class="beat${active?' active':''}${accent?' accent':''}"></span></span>`;
  }).join('');
}

function ensureAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
}
function clickSound(accented){
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = accented ? 1300 : 820;
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(accented ? 0.22 : 0.13, audioCtx.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.07);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}
function tick(){
  const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
  clickSound(accented);
  renderBeats();
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    if(accented){
      void visual.offsetWidth;
      visual.classList.add('accent-hit');
      window.setTimeout(()=>visual.classList.remove('accent-hit'), 220);
    }
  }
  beatIndex = (beatIndex + 1) % meter;
}
function startMetronome(){
  ensureAudio();
  metroRunning = true;
  beatIndex = 0;
  clearInterval(cleanMetroTimer);
  clearInterval(metroTimer);
  cleanMetroTimer = null;
  metroTimer = null;
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    visual.style.setProperty('--metro-duration', `${60000 / bpm}ms`);
  }
  syncCleanMetronomeUi();
  startPendulumMotion();
  tick();
  cleanMetroTimer = setInterval(tick, 60000 / bpm);
  metroTimer = cleanMetroTimer;
}
function stopMetronome(){
  metroRunning = false;
  clearInterval(cleanMetroTimer);
  clearInterval(metroTimer);
  cleanMetroTimer = null;
  metroTimer = null;
  stopPendulumMotion(true);
  syncCleanMetronomeUi();
  renderBeats();
}


// v2.5.6 help modal
document.addEventListener('click', function(e){
  if(e.target && e.target.id==='tapHelpModal'){
    e.target.classList.remove('open');
  }
});

/* EasyTune v40 — metronome unified clock: one trigger for sound, dots, accent light and pendulum */
let metroUnifiedBeatCount = 0;
let metroUnifiedStartAt = 0;

function stopPendulumMotion(reset=true){
  if(metroPendulumFrame){
    cancelAnimationFrame(metroPendulumFrame);
    metroPendulumFrame = null;
  }
  const pendulum = document.querySelector('.metro-clean-pendulum');
  if(reset && pendulum){
    pendulum.style.setProperty('transform', 'translateX(-50%) rotate(0deg)', 'important');
  }
}

function startPendulumMotion(startAt = performance.now()){
  stopPendulumMotion(false);
  const pendulum = document.querySelector('.metro-clean-pendulum');
  if(!pendulum) return;
  const beatMs = Math.max(180, 60000 / bpm);
  const maxAngle = 38;
  metroPendulumStartedAt = startAt;

  const draw = (now) => {
    if(!metroRunning){
      metroPendulumFrame = null;
      return;
    }
    const elapsed = Math.max(0, now - metroPendulumStartedAt);
    const phase = (elapsed % (beatMs * 2)) / beatMs;
    const angle = phase <= 1
      ? -maxAngle + (phase * 2 * maxAngle)
      :  maxAngle - ((phase - 1) * 2 * maxAngle);
    pendulum.style.setProperty('transform', `translateX(-50%) rotate(${angle.toFixed(2)}deg)`, 'important');
    metroPendulumFrame = requestAnimationFrame(draw);
  };

  pendulum.style.setProperty('transform', `translateX(-50%) rotate(${-maxAngle}deg)`, 'important');
  metroPendulumFrame = requestAnimationFrame(draw);
}

function metronomeBeat(){
  if(!metroRunning) return;
  const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
  clickSound(accented);
  renderBeats();
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    if(accented){
      void visual.offsetWidth;
      visual.classList.add('accent-hit');
      window.setTimeout(()=>visual.classList.remove('accent-hit'), 180);
    }
  }
  beatIndex = (beatIndex + 1) % meter;
}

function tick(){
  metronomeBeat();
}

function scheduleNextMetronomeBeat(){
  if(!metroRunning) return;
  const beatMs = Math.max(180, 60000 / bpm);
  metroUnifiedBeatCount += 1;
  const dueAt = metroUnifiedStartAt + metroUnifiedBeatCount * beatMs;
  const delay = Math.max(0, dueAt - performance.now());
  cleanMetroTimer = window.setTimeout(() => {
    metronomeBeat();
    scheduleNextMetronomeBeat();
  }, delay);
  metroTimer = cleanMetroTimer;
}

function startMetronome(){
  ensureAudio();
  stopMetronome();
  metroRunning = true;
  beatIndex = 0;
  metroUnifiedBeatCount = 0;
  metroUnifiedStartAt = performance.now();
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    visual.style.setProperty('--metro-duration', `${60000 / bpm}ms`);
  }
  syncCleanMetronomeUi();
  startPendulumMotion(metroUnifiedStartAt);
  metronomeBeat();
  scheduleNextMetronomeBeat();
}

function stopMetronome(){
  metroRunning = false;
  if(cleanMetroTimer) window.clearTimeout(cleanMetroTimer);
  if(metroTimer) window.clearTimeout(metroTimer);
  window.clearInterval(cleanMetroTimer);
  window.clearInterval(metroTimer);
  cleanMetroTimer = null;
  metroTimer = null;
  stopPendulumMotion(true);
  syncCleanMetronomeUi();
  renderBeats();
}

/* EasyTune v41 — metronome: extrema-driven single trigger
   Sound, accent light and beat dots fire ONLY when the needle is at max left/right.
   The circle never pulses. The needle transition between extrema is visual only. */
let metroExtremeSide = -1;
let metroMoveTimer = null;
let metroMoveSerial = 0;

function metroBeatMs(){
  return Math.max(180, 60000 / bpm);
}

function setMetroNeedleSide(side, immediate=false){
  const pendulum = document.querySelector('.metro-clean-pendulum');
  if(!pendulum) return;
  const angle = side < 0 ? -38 : 38;
  if(immediate){
    pendulum.style.setProperty('transition', 'none', 'important');
    pendulum.style.setProperty('transform', `translateX(-50%) rotate(${angle}deg)`, 'important');
    pendulum.getBoundingClientRect();
  } else {
    pendulum.style.setProperty('transition', `transform ${metroBeatMs()}ms cubic-bezier(.37,0,.63,1)`, 'important');
    pendulum.style.setProperty('transform', `translateX(-50%) rotate(${angle}deg)`, 'important');
  }
}

function clearMetroClock(){
  metroMoveSerial += 1;
  if(metroMoveTimer) window.clearTimeout(metroMoveTimer);
  if(cleanMetroTimer) window.clearTimeout(cleanMetroTimer);
  if(metroTimer) window.clearTimeout(metroTimer);
  window.clearInterval(cleanMetroTimer);
  window.clearInterval(metroTimer);
  metroMoveTimer = null;
  cleanMetroTimer = null;
  metroTimer = null;
  if(metroPendulumFrame){
    cancelAnimationFrame(metroPendulumFrame);
    metroPendulumFrame = null;
  }
}

function fireMetroExtremeBeat(){
  if(!metroRunning) return;
  const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
  clickSound(accented);
  renderBeats();

  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    if(accented){
      void visual.offsetWidth;
      visual.classList.add('accent-hit');
      window.setTimeout(() => visual.classList.remove('accent-hit'), 180);
    }
  }
  beatIndex = (beatIndex + 1) % meter;
}

function scheduleMetroExtremeLoop(serial){
  if(!metroRunning || serial !== metroMoveSerial) return;
  const beatMs = metroBeatMs();
  const nextSide = -metroExtremeSide;

  // After the beat fires at the current extreme, move toward the next extreme.
  requestAnimationFrame(() => {
    if(!metroRunning || serial !== metroMoveSerial) return;
    setMetroNeedleSide(nextSide, false);
  });

  metroMoveTimer = window.setTimeout(() => {
    if(!metroRunning || serial !== metroMoveSerial) return;
    metroExtremeSide = nextSide;
    // Confirm exact endpoint before firing the next beat.
    setMetroNeedleSide(metroExtremeSide, true);
    fireMetroExtremeBeat();
    scheduleMetroExtremeLoop(serial);
  }, beatMs);
  cleanMetroTimer = metroMoveTimer;
  metroTimer = metroMoveTimer;
}

function tick(){
  fireMetroExtremeBeat();
}

function stopPendulumMotion(reset=true){
  clearMetroClock();
  if(reset){
    const pendulum = document.querySelector('.metro-clean-pendulum');
    if(pendulum){
      pendulum.style.setProperty('transition','none','important');
      pendulum.style.setProperty('transform','translateX(-50%) rotate(0deg)','important');
    }
  }
}

function startPendulumMotion(){
  // Kept for compatibility; real motion is driven by startMetronome().
  setMetroNeedleSide(metroExtremeSide, true);
}

function startMetronome(){
  ensureAudio();
  stopMetronome();
  metroRunning = true;
  beatIndex = 0;
  metroExtremeSide = -1;
  metroMoveSerial += 1;
  const serial = metroMoveSerial;

  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    visual.style.setProperty('--metro-duration', `${metroBeatMs()}ms`);
  }

  setMetroNeedleSide(metroExtremeSide, true);
  syncCleanMetronomeUi();
  fireMetroExtremeBeat();
  scheduleMetroExtremeLoop(serial);
}

function stopMetronome(){
  metroRunning = false;
  clearMetroClock();
  const pendulum = document.querySelector('.metro-clean-pendulum');
  if(pendulum){
    pendulum.style.setProperty('transition','none','important');
    pendulum.style.setProperty('transform','translateX(-50%) rotate(0deg)','important');
  }
  syncCleanMetronomeUi();
  renderBeats();
}

let metroEndpointTimer = null;

/* EasyTune v45 — metronome: single RAF clock, sound/light at needle extrema.
   No CSS swing, no circle pulse, no frame flash. The same animation frame sets
   the needle endpoint and fires the sound/accent light. */
let metroRafId = null;
let metroRafStart = 0;
let metroLastBeatOrdinal = -1;
let metroRunSerial = 0;

function metroBeatMs(){
  return Math.max(180, 60000 / bpm);
}

function metroMaxAngle(){ return 38; }

function setMetroNeedleAngle(angle){
  const pendulum = document.querySelector('.metro-clean-pendulum');
  if(!pendulum) return;
  pendulum.style.setProperty('animation', 'none', 'important');
  pendulum.style.setProperty('transition', 'none', 'important');
  pendulum.style.setProperty('transform-origin', '50% 100%', 'important');
  pendulum.style.setProperty('transform', `translateX(-50%) rotate(${angle}deg)`, 'important');
}

function setMetroNeedleExtreme(side){
  setMetroNeedleAngle(side < 0 ? -metroMaxAngle() : metroMaxAngle());
}

function clearMetroEndpointClock(){
  metroRunSerial += 1;
  if(metroRafId){
    cancelAnimationFrame(metroRafId);
    metroRafId = null;
  }
  if(cleanMetroTimer) window.clearTimeout(cleanMetroTimer);
  if(metroTimer) window.clearTimeout(metroTimer);
  window.clearInterval(cleanMetroTimer);
  window.clearInterval(metroTimer);
  cleanMetroTimer = null;
  metroTimer = null;
  if(typeof metroEndpointTimer !== 'undefined' && metroEndpointTimer) window.clearTimeout(metroEndpointTimer);
  metroEndpointTimer = null;
  if(metroPendulumFrame){
    cancelAnimationFrame(metroPendulumFrame);
    metroPendulumFrame = null;
  }
}

function fireMetroBeatFromNeedle(beatOrdinal){
  if(!metroRunning) return;
  const side = beatOrdinal % 2 === 0 ? -1 : 1;
  setMetroNeedleExtreme(side);
  const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
  clickSound(accented);
  renderBeats();
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    if(accented){
      void visual.offsetWidth;
      visual.classList.add('accent-hit');
      window.setTimeout(() => visual.classList.remove('accent-hit'), 150);
    }
  }
  beatIndex = (beatIndex + 1) % meter;
}

function metroAnimationFrame(serial, now){
  if(!metroRunning || serial !== metroRunSerial) return;
  const beatMs = metroBeatMs();
  const elapsed = Math.max(0, now - metroRafStart);
  const beatOrdinal = Math.floor(elapsed / beatMs);

  if(beatOrdinal !== metroLastBeatOrdinal){
    metroLastBeatOrdinal = beatOrdinal;
    fireMetroBeatFromNeedle(beatOrdinal);
  } else {
    // Left extreme at beat 0, right extreme at beat 1, etc.
    const angle = -metroMaxAngle() * Math.cos(Math.PI * elapsed / beatMs);
    setMetroNeedleAngle(angle);
  }

  metroRafId = requestAnimationFrame(t => metroAnimationFrame(serial, t));
}

function startMetronome(){
  ensureAudio();
  clearMetroEndpointClock();
  metroRunning = true;
  beatIndex = 0;
  metroLastBeatOrdinal = -1;
  const serial = metroRunSerial;
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    visual.classList.add('running');
    visual.style.setProperty('--metro-duration', `${metroBeatMs()}ms`);
  }

  // Start visibly at the left endpoint, then the RAF clock becomes the single source of truth.
  setMetroNeedleExtreme(-1);
  syncCleanMetronomeUi();
  requestAnimationFrame(() => {
    requestAnimationFrame(t => {
      if(!metroRunning || serial !== metroRunSerial) return;
      metroRafStart = t;
      metroRafId = requestAnimationFrame(tt => metroAnimationFrame(serial, tt));
    });
  });
}

function stopMetronome(){
  metroRunning = false;
  clearMetroEndpointClock();
  setMetroNeedleAngle(0);
  const visual = document.querySelector('#metroCleanVisual');
  if(visual) visual.classList.remove('running','beat-hit','accent-hit');
  syncCleanMetronomeUi();
  renderBeats();
}

function tick(){
  fireMetroBeatFromNeedle(Math.max(0, metroLastBeatOrdinal + 1));
}

function startPendulumMotion(){
  if(!metroRunning) setMetroNeedleExtreme(-1);
}

function stopPendulumMotion(reset=true){
  clearMetroEndpointClock();
  if(reset) setMetroNeedleAngle(0);
}

/* EasyTune v47 — FINAL metronome phase fix.
   Start needle at LEFT extreme. Do NOT click at start.
   First click/dot/light fires only when the needle reaches RIGHT extreme,
   then on every next extreme. Circle/frame pulse stays disabled by CSS. */
function metroAnimationFrame(serial, now){
  if(!metroRunning || serial !== metroRunSerial) return;
  const beatMs = metroBeatMs();
  const elapsed = Math.max(0, now - metroRafStart);

  // Position is the source of truth: t=0 left, t=beatMs right, t=2*beatMs left.
  const angle = -metroMaxAngle() * Math.cos(Math.PI * elapsed / beatMs);
  setMetroNeedleAngle(angle);

  const beatOrdinal = Math.floor(elapsed / beatMs);
  if(beatOrdinal >= 1 && beatOrdinal !== metroLastBeatOrdinal){
    metroLastBeatOrdinal = beatOrdinal;
    fireMetroBeatFromNeedle(beatOrdinal);
  }

  metroRafId = requestAnimationFrame(t => metroAnimationFrame(serial, t));
}

function startMetronome(){
  ensureAudio();
  clearMetroEndpointClock();
  metroRunning = true;
  beatIndex = 0;
  metroLastBeatOrdinal = 0; // start is visual only; first audible beat is at RIGHT extreme
  const serial = metroRunSerial;
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    visual.classList.add('running');
    visual.style.setProperty('--metro-duration', `${metroBeatMs()}ms`);
  }

  setMetroNeedleExtreme(-1);
  renderBeats();
  syncCleanMetronomeUi();

  requestAnimationFrame(t => {
    if(!metroRunning || serial !== metroRunSerial) return;
    metroRafStart = t;
    metroRafId = requestAnimationFrame(tt => metroAnimationFrame(serial, tt));
  });
}

function stopMetronome(){
  metroRunning = false;
  clearMetroEndpointClock();
  setMetroNeedleAngle(0);
  const visual = document.querySelector('#metroCleanVisual');
  if(visual) visual.classList.remove('running','beat-hit','accent-hit');
  syncCleanMetronomeUi();
  renderBeats();
}

/* EasyTune v48 — metronome endpoint clock final override.
   Idle/start needle is LEFT. First sound/dot fires only after the needle reaches RIGHT.
   A single timeout-driven endpoint loop controls needle, sound, dots and accent light. */
let metroEndpointLoopTimer = null;
let metroEndpointSerialFinal = 0;
let metroEndpointSideFinal = -1;

function metroBeatMs(){
  return Math.max(180, 60000 / bpm);
}
function metroMaxAngle(){ return 38; }
function metroAngleForSide(side){ return side < 0 ? -metroMaxAngle() : metroMaxAngle(); }

function setMetroNeedleEndpoint(side, animate=false){
  const pendulum = document.querySelector('.metro-clean-pendulum');
  if(!pendulum) return;
  pendulum.style.setProperty('animation', 'none', 'important');
  pendulum.style.setProperty('transform-origin', '50% 100%', 'important');
  pendulum.style.setProperty('transition', animate ? `transform ${metroBeatMs()}ms cubic-bezier(.37,0,.63,1)` : 'none', 'important');
  pendulum.style.setProperty('transform', `translateX(-50%) rotate(${metroAngleForSide(side)}deg)`, 'important');
}

function clearMetroEndpointLoopFinal(){
  metroEndpointSerialFinal += 1;
  if(metroEndpointLoopTimer) window.clearTimeout(metroEndpointLoopTimer);
  metroEndpointLoopTimer = null;
  if(cleanMetroTimer) window.clearTimeout(cleanMetroTimer);
  if(metroTimer) window.clearTimeout(metroTimer);
  if(cleanMetroTimer) window.clearInterval(cleanMetroTimer);
  if(metroTimer) window.clearInterval(metroTimer);
  cleanMetroTimer = null;
  metroTimer = null;
  if(metroRafId){ cancelAnimationFrame(metroRafId); metroRafId = null; }
  if(metroPendulumFrame){ cancelAnimationFrame(metroPendulumFrame); metroPendulumFrame = null; }
}

function fireMetroEndpointBeatFinal(){
  if(!metroRunning) return;
  const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
  clickSound(accented);
  renderBeats();
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    if(accented){
      void visual.offsetWidth;
      visual.classList.add('accent-hit');
      window.setTimeout(() => visual.classList.remove('accent-hit'), 150);
    }
  }
  beatIndex = (beatIndex + 1) % meter;
}

function runMetroEndpointLoopFinal(serial){
  if(!metroRunning || serial !== metroEndpointSerialFinal) return;
  const beatMs = metroBeatMs();
  const nextSide = -metroEndpointSideFinal;

  // Move first. The beat happens only after the visual needle has arrived.
  requestAnimationFrame(() => {
    if(!metroRunning || serial !== metroEndpointSerialFinal) return;
    setMetroNeedleEndpoint(nextSide, true);
  });

  metroEndpointLoopTimer = window.setTimeout(() => {
    if(!metroRunning || serial !== metroEndpointSerialFinal) return;
    metroEndpointSideFinal = nextSide;
    setMetroNeedleEndpoint(metroEndpointSideFinal, false); // snap to exact edge before click
    fireMetroEndpointBeatFinal();
    runMetroEndpointLoopFinal(serial);
  }, beatMs);
  cleanMetroTimer = metroEndpointLoopTimer;
  metroTimer = metroEndpointLoopTimer;
}

function startMetronome(){
  ensureAudio();
  clearMetroEndpointLoopFinal();
  metroRunning = true;
  beatIndex = 0;
  metroEndpointSideFinal = -1;
  const serial = metroEndpointSerialFinal;
  const visual = document.querySelector('#metroCleanVisual');
  if(visual){
    visual.classList.remove('beat-hit','accent-hit');
    visual.classList.add('running');
    visual.style.setProperty('--metro-duration', `${metroBeatMs()}ms`);
  }
  setMetroNeedleEndpoint(-1, false); // visible LEFT start; no sound here
  renderBeats();
  syncCleanMetronomeUi();
  runMetroEndpointLoopFinal(serial);
}

function stopMetronome(){
  metroRunning = false;
  clearMetroEndpointLoopFinal();
  metroEndpointSideFinal = -1;
  setMetroNeedleEndpoint(-1, false);
  const visual = document.querySelector('#metroCleanVisual');
  if(visual) visual.classList.remove('running','beat-hit','accent-hit');
  syncCleanMetronomeUi();
  beatIndex = 0;
  renderBeats();
}

function tick(){
  fireMetroEndpointBeatFinal();
}
function startPendulumMotion(){
  if(!metroRunning) setMetroNeedleEndpoint(-1, false);
}
function stopPendulumMotion(reset=true){
  clearMetroEndpointLoopFinal();
  if(reset) setMetroNeedleEndpoint(-1, false);
}

/* EasyTune v50 — metronom napisany od nowa: start = maksymalny lewy wychył.
   Jeden zegar endpointów. Brak dźwięku na starcie. Pierwsze piknięcie dopiero
   po dojściu wskazówki do prawego skraju. */
(function(){
  const LEFT = -1;
  const RIGHT = 1;
  const MAX_ANGLE = 38;
  let endpointTimer = null;
  let endpointSerial = 0;
  let endpointSide = LEFT;

  function msPerBeat(){ return Math.max(180, 60000 / bpm); }
  function angleFor(side){ return side === LEFT ? -MAX_ANGLE : MAX_ANGLE; }

  function needle(){ return document.querySelector('.metro-clean-pendulum'); }
  function visual(){ return document.querySelector('#metroCleanVisual'); }

  function forceNeedle(side){
    const p = needle();
    if(!p) return;
    p.style.setProperty('animation', 'none', 'important');
    p.style.setProperty('transition', 'none', 'important');
    p.style.setProperty('transform-origin', '50% 100%', 'important');
    p.style.setProperty('transform', `translateX(-50%) rotate(${angleFor(side)}deg)`, 'important');
  }

  function moveNeedle(side){
    const p = needle();
    if(!p) return;
    p.style.setProperty('animation', 'none', 'important');
    p.style.setProperty('transition', `transform ${msPerBeat()}ms cubic-bezier(.37,0,.63,1)`, 'important');
    p.style.setProperty('transform-origin', '50% 100%', 'important');
    p.style.setProperty('transform', `translateX(-50%) rotate(${angleFor(side)}deg)`, 'important');
  }

  function clearMetronomeClock(){
    endpointSerial += 1;
    if(endpointTimer) window.clearTimeout(endpointTimer);
    endpointTimer = null;
    if(cleanMetroTimer) { window.clearTimeout(cleanMetroTimer); window.clearInterval(cleanMetroTimer); }
    if(metroTimer) { window.clearTimeout(metroTimer); window.clearInterval(metroTimer); }
    cleanMetroTimer = null;
    metroTimer = null;
    if(metroPendulumFrame){ cancelAnimationFrame(metroPendulumFrame); metroPendulumFrame = null; }
    if(typeof metroRafId !== 'undefined' && metroRafId){ cancelAnimationFrame(metroRafId); metroRafId = null; }
  }

  function fireBeatAtCurrentEdge(){
    if(!metroRunning) return;
    const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
    clickSound(accented);
    renderBeats();
    const v = visual();
    if(v){
      v.classList.remove('beat-hit','accent-hit');
      if(accented){
        void v.offsetWidth;
        v.classList.add('accent-hit');
        window.setTimeout(() => v.classList.remove('accent-hit'), 150);
      }
    }
    beatIndex = (beatIndex + 1) % meter;
  }

  function scheduleMove(serial){
    if(!metroRunning || serial !== endpointSerial) return;
    const target = endpointSide === LEFT ? RIGHT : LEFT;
    moveNeedle(target);

    endpointTimer = window.setTimeout(() => {
      if(!metroRunning || serial !== endpointSerial) return;
      endpointSide = target;
      forceNeedle(endpointSide);      // dokładny skraj PRZED dźwiękiem
      fireBeatAtCurrentEdge();        // dźwięk/kropka/światło wyłącznie na skraju
      scheduleMove(serial);
    }, msPerBeat());

    cleanMetroTimer = endpointTimer;
    metroTimer = endpointTimer;
  }

  window.setMetronomeNeedleLeft = function(){
    endpointSide = LEFT;
    forceNeedle(LEFT);
  };

  // Nadpisanie poprzednich implementacji.
  startMetronome = function(){
    ensureAudio();
    clearMetronomeClock();
    metroRunning = true;
    beatIndex = 0;
    endpointSide = LEFT;
    const serial = endpointSerial;
    const v = visual();
    if(v){
      v.classList.remove('beat-hit','accent-hit');
      v.classList.add('running');
      v.style.setProperty('--metro-duration', `${msPerBeat()}ms`);
    }
    forceNeedle(LEFT);                // START: maksymalny lewy wychył
    renderBeats();
    syncCleanMetronomeUi();
    requestAnimationFrame(() => scheduleMove(serial)); // pierwsze piknięcie po dojściu do prawego skraju
  };

  stopMetronome = function(){
    metroRunning = false;
    clearMetronomeClock();
    endpointSide = LEFT;
    forceNeedle(LEFT);                // STOP/idle: nadal maksymalny lewy wychył
    const v = visual();
    if(v) v.classList.remove('running','beat-hit','accent-hit');
    beatIndex = 0;
    syncCleanMetronomeUi();
    renderBeats();
  };

  startPendulumMotion = function(){ forceNeedle(LEFT); };
  stopPendulumMotion = function(){ clearMetronomeClock(); forceNeedle(LEFT); };
  tick = function(){ fireBeatAtCurrentEdge(); };

  const previousInitMetronome = initMetronome;
  initMetronome = function(){
    previousInitMetronome();
    if(!metroRunning) requestAnimationFrame(() => forceNeedle(LEFT));
  };
})();

/* EasyTune v51 — METRONOME FINAL: RAF is the only clock.
   Start/idle needle is max LEFT. No sound at start. First beat fires at max RIGHT.
   Sound, dots and accent light are triggered in the same animation frame that draws the endpoint. */
(function(){
  const LEFT = -1;
  const RIGHT = 1;
  const MAX_ANGLE = 38;
  let rafId = null;
  let runSerial = 0;
  let runStart = 0;
  let lastEndpoint = 0; // 0 means visual start only; first audible endpoint is 1 (RIGHT)

  function beatMs(){ return Math.max(180, 60000 / bpm); }
  function needle(){ return document.querySelector('.metro-clean-pendulum'); }
  function visual(){ return document.querySelector('#metroCleanVisual'); }
  function angleForEndpoint(endpoint){ return endpoint % 2 === 0 ? -MAX_ANGLE : MAX_ANGLE; }

  function drawNeedle(angle){
    const p = needle();
    if(!p) return;
    p.style.setProperty('animation', 'none', 'important');
    p.style.setProperty('transition', 'none', 'important');
    p.style.setProperty('transform-origin', '50% 100%', 'important');
    p.style.setProperty('transform', `translateX(-50%) rotate(${angle}deg)`, 'important');
  }

  function drawLeftStart(){ drawNeedle(-MAX_ANGLE); }

  function clearRafClock(){
    runSerial += 1;
    if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    if(cleanMetroTimer){ clearTimeout(cleanMetroTimer); clearInterval(cleanMetroTimer); cleanMetroTimer = null; }
    if(metroTimer){ clearTimeout(metroTimer); clearInterval(metroTimer); metroTimer = null; }
    if(typeof metroEndpointTimer !== 'undefined' && metroEndpointTimer){ clearTimeout(metroEndpointTimer); metroEndpointTimer = null; }
    if(typeof metroEndpointLoopTimer !== 'undefined' && metroEndpointLoopTimer){ clearTimeout(metroEndpointLoopTimer); metroEndpointLoopTimer = null; }
    if(typeof metroPendulumFrame !== 'undefined' && metroPendulumFrame){ cancelAnimationFrame(metroPendulumFrame); metroPendulumFrame = null; }
    if(typeof metroRafId !== 'undefined' && metroRafId){ cancelAnimationFrame(metroRafId); metroRafId = null; }
  }

  function fireBeat(){
    if(!metroRunning) return;
    const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
    clickSound(accented);
    renderBeats();
    const v = visual();
    if(v){
      v.classList.remove('beat-hit', 'accent-hit');
      if(accented){
        void v.offsetWidth;
        v.classList.add('accent-hit');
        setTimeout(() => v.classList.remove('accent-hit'), 140);
      }
    }
    beatIndex = (beatIndex + 1) % meter;
  }

  function frame(serial, now){
    if(!metroRunning || serial !== runSerial) return;
    const ms = beatMs();
    const elapsed = Math.max(0, now - runStart);

    // One half-swing per beat: 0=LEFT, 1=RIGHT, 2=LEFT...
    const endpoint = Math.floor(elapsed / ms);
    const inHalf = (elapsed - endpoint * ms) / ms;

    // Draw position first. At endpoint boundaries this is exactly LEFT or RIGHT.
    const angle = -MAX_ANGLE * Math.cos(Math.PI * (endpoint + inHalf));
    drawNeedle(Number(angle.toFixed(3)));

    // First sound is endpoint 1 (RIGHT), never endpoint 0 (LEFT start).
    if(endpoint >= 1 && endpoint !== lastEndpoint){
      lastEndpoint = endpoint;
      drawNeedle(angleForEndpoint(endpoint)); // exact endpoint before audio/UI trigger
      fireBeat();
    }

    rafId = requestAnimationFrame(t => frame(serial, t));
  }

  startMetronome = function(){
    ensureAudio();
    clearRafClock();
    metroRunning = true;
    beatIndex = 0;
    lastEndpoint = 0;
    const serial = runSerial;
    const v = visual();
    if(v){
      v.classList.add('running');
      v.classList.remove('beat-hit', 'accent-hit');
      v.style.setProperty('--metro-duration', `${beatMs()}ms`);
    }
    drawLeftStart();
    renderBeats();
    syncCleanMetronomeUi();
    requestAnimationFrame(t => {
      if(!metroRunning || serial !== runSerial) return;
      runStart = t;
      drawLeftStart();
      rafId = requestAnimationFrame(tt => frame(serial, tt));
    });
  };

  stopMetronome = function(){
    metroRunning = false;
    clearRafClock();
    beatIndex = 0;
    const v = visual();
    if(v) v.classList.remove('running', 'beat-hit', 'accent-hit');
    drawLeftStart();
    syncCleanMetronomeUi();
    renderBeats();
  };

  startPendulumMotion = drawLeftStart;
  stopPendulumMotion = function(){ clearRafClock(); drawLeftStart(); };
  tick = fireBeat;

  const previousInit = initMetronome;
  initMetronome = function(){
    previousInit();
    if(!metroRunning) requestAnimationFrame(drawLeftStart);
  };
})();


/* EasyTune v52 — metronome sync rewrite.
   One RAF draws the needle. Audio, dot and accent light are scheduled ahead for
   the exact endpoint time, so they happen when the needle reaches LEFT/RIGHT.
   Start/idle is always max LEFT. No frame/circle/border blinking. */
(function(){
  const LEFT = -1;
  const RIGHT = 1;
  const MAX_ANGLE = 38;
  const LOOKAHEAD_MS = 90;
  let rafId = null;
  let serial = 0;
  let startTs = 0;
  let nextEndpoint = 1; // endpoint 0 is the silent LEFT start; endpoint 1 is first audible RIGHT
  let scheduledUiTimers = [];

  function beatMs(){ return Math.max(180, 60000 / bpm); }
  function angleAt(elapsed){ return -MAX_ANGLE * Math.cos(Math.PI * elapsed / beatMs()); }
  function needle(){ return document.querySelector('.metro-clean-pendulum'); }
  function visual(){ return document.querySelector('#metroCleanVisual'); }

  function setNeedle(angle){
    const p = needle();
    if(!p) return;
    p.style.setProperty('animation', 'none', 'important');
    p.style.setProperty('transition', 'none', 'important');
    p.style.setProperty('transform-origin', '50% 100%', 'important');
    p.style.setProperty('transform', `translateX(-50%) rotate(${angle.toFixed(3)}deg)`, 'important');
  }

  function setLeftStart(){ setNeedle(-MAX_ANGLE); }

  function clearAllMetronomeClocks(){
    serial += 1;
    if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    scheduledUiTimers.forEach(id => clearTimeout(id));
    scheduledUiTimers = [];
    if(cleanMetroTimer){ clearTimeout(cleanMetroTimer); clearInterval(cleanMetroTimer); cleanMetroTimer = null; }
    if(metroTimer){ clearTimeout(metroTimer); clearInterval(metroTimer); metroTimer = null; }
    if(typeof metroEndpointTimer !== 'undefined' && metroEndpointTimer){ clearTimeout(metroEndpointTimer); metroEndpointTimer = null; }
    if(typeof metroEndpointLoopTimer !== 'undefined' && metroEndpointLoopTimer){ clearTimeout(metroEndpointLoopTimer); metroEndpointLoopTimer = null; }
    if(typeof metroPendulumFrame !== 'undefined' && metroPendulumFrame){ cancelAnimationFrame(metroPendulumFrame); metroPendulumFrame = null; }
    if(typeof metroRafId !== 'undefined' && metroRafId){ cancelAnimationFrame(metroRafId); metroRafId = null; }
  }

  function scheduleClickSound(accented, when){
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(accented ? 1300 : 820, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(accented ? 0.22 : 0.13, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.075);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(when);
    osc.stop(when + 0.085);
  }

  function fireUiBeat(accented){
    if(!metroRunning) return;
    renderBeats();
    const v = visual();
    if(v){
      v.classList.remove('beat-hit', 'accent-hit');
      if(accented){
        void v.offsetWidth;
        v.classList.add('accent-hit');
        const off = setTimeout(() => v.classList.remove('accent-hit'), 140);
        scheduledUiTimers.push(off);
      }
    }
    beatIndex = (beatIndex + 1) % meter;
  }

  function scheduleEndpointBeat(endpoint, delayMs){
    const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
    const audioWhen = audioCtx.currentTime + Math.max(0, delayMs) / 1000;
    scheduleClickSound(accented, audioWhen);
    const id = setTimeout(() => fireUiBeat(accented), Math.max(0, delayMs));
    scheduledUiTimers.push(id);
  }

  function frame(mySerial, now){
    if(!metroRunning || mySerial !== serial) return;
    const elapsed = Math.max(0, now - startTs);
    setNeedle(angleAt(elapsed));

    const ms = beatMs();
    while(nextEndpoint * ms - elapsed <= LOOKAHEAD_MS){
      const delay = nextEndpoint * ms - elapsed;
      if(nextEndpoint >= 1) scheduleEndpointBeat(nextEndpoint, delay);
      nextEndpoint += 1;
    }

    rafId = requestAnimationFrame(t => frame(mySerial, t));
  }

  startMetronome = function(){
    ensureAudio();
    clearAllMetronomeClocks();
    metroRunning = true;
    beatIndex = 0;
    nextEndpoint = 1;
    const mySerial = serial;
    const v = visual();
    if(v){
      v.classList.add('running');
      v.classList.remove('beat-hit', 'accent-hit');
      v.style.setProperty('--metro-duration', `${beatMs()}ms`);
    }
    setLeftStart();
    renderBeats();
    syncCleanMetronomeUi();
    requestAnimationFrame(t => {
      if(!metroRunning || mySerial !== serial) return;
      startTs = t;
      setLeftStart();
      rafId = requestAnimationFrame(tt => frame(mySerial, tt));
    });
  };

  stopMetronome = function(){
    metroRunning = false;
    clearAllMetronomeClocks();
    beatIndex = 0;
    const v = visual();
    if(v) v.classList.remove('running', 'beat-hit', 'accent-hit');
    setLeftStart();
    syncCleanMetronomeUi();
    renderBeats();
  };

  startPendulumMotion = setLeftStart;
  stopPendulumMotion = function(){ clearAllMetronomeClocks(); setLeftStart(); };
  tick = function(){
    const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
    clickSound(accented);
    fireUiBeat(accented);
  };

  const prevInit = initMetronome;
  initMetronome = function(){
    prevInit();
    if(!metroRunning) requestAnimationFrame(setLeftStart);
  };
})();

/* EasyTune v53 — metronome perceptual-centre sync.
   Needle remains the visual clock. For every endpoint, sound, dot transition and
   accent light are started early by half of their own duration, so the CENTER
   of the beep / dot transition / flash lands on the exact left/right extreme.
   This compensates for fixed animation and click lengths at every BPM. */
(function(){
  const MAX_ANGLE = 38;
  const CLICK_DUR_MS = 85;
  const DOT_TRANSITION_MS = 80;
  const ACCENT_FLASH_MS = 140;
  const SCHED_LOOKAHEAD_MS = 180;
  let rafId = null;
  let serial = 0;
  let startTs = 0;
  let nextEndpoint = 1;
  let timers = [];

  function beatMs(){ return Math.max(180, 60000 / bpm); }
  function needle(){ return document.querySelector('.metro-clean-pendulum'); }
  function visual(){ return document.querySelector('#metroCleanVisual'); }
  function endpointTimeMs(endpoint){ return endpoint * beatMs(); }
  function angleAtElapsed(elapsed){ return -MAX_ANGLE * Math.cos(Math.PI * elapsed / beatMs()); }
  function angleForEndpoint(endpoint){ return endpoint % 2 === 0 ? -MAX_ANGLE : MAX_ANGLE; }

  function addTimer(id){ timers.push(id); return id; }

  function setNeedleAngle(angle){
    const p = needle();
    if(!p) return;
    p.style.setProperty('animation', 'none', 'important');
    p.style.setProperty('transition', 'none', 'important');
    p.style.setProperty('transform-origin', '50% 100%', 'important');
    p.style.setProperty('transform', `translateX(-50%) rotate(${angle.toFixed(3)}deg)`, 'important');
  }

  function setNeedleLeft(){ setNeedleAngle(-MAX_ANGLE); }

  function clearMetroSync(){
    serial += 1;
    if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    timers.forEach(id => clearTimeout(id));
    timers = [];
    if(cleanMetroTimer){ clearTimeout(cleanMetroTimer); clearInterval(cleanMetroTimer); cleanMetroTimer = null; }
    if(metroTimer){ clearTimeout(metroTimer); clearInterval(metroTimer); metroTimer = null; }
    if(typeof metroEndpointTimer !== 'undefined' && metroEndpointTimer){ clearTimeout(metroEndpointTimer); metroEndpointTimer = null; }
    if(typeof metroEndpointLoopTimer !== 'undefined' && metroEndpointLoopTimer){ clearTimeout(metroEndpointLoopTimer); metroEndpointLoopTimer = null; }
    if(typeof metroPendulumFrame !== 'undefined' && metroPendulumFrame){ cancelAnimationFrame(metroPendulumFrame); metroPendulumFrame = null; }
    if(typeof metroRafId !== 'undefined' && metroRafId){ cancelAnimationFrame(metroRafId); metroRafId = null; }
  }

  function scheduleAudio(accented, endpointDelayMs){
    ensureAudio();
    const startWhen = audioCtx.currentTime + Math.max(0, endpointDelayMs - CLICK_DUR_MS / 2) / 1000;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(accented ? 1300 : 820, startWhen);
    gain.gain.setValueAtTime(0.0001, startWhen);
    gain.gain.exponentialRampToValueAtTime(accented ? 0.22 : 0.13, startWhen + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startWhen + CLICK_DUR_MS / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startWhen);
    osc.stop(startWhen + (CLICK_DUR_MS + 8) / 1000);
  }

  function applyBeatUi(accented){
    if(!metroRunning) return;
    renderBeats();
    const v = visual();
    if(v){
      v.classList.remove('beat-hit', 'accent-hit');
      if(accented){
        void v.offsetWidth;
        v.classList.add('accent-hit');
        addTimer(setTimeout(() => v.classList.remove('accent-hit'), ACCENT_FLASH_MS));
      }
    }
    beatIndex = (beatIndex + 1) % meter;
  }

  function scheduleEndpoint(endpoint, endpointDelayMs){
    const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
    scheduleAudio(accented, endpointDelayMs);

    const dotStart = Math.max(0, endpointDelayMs - DOT_TRANSITION_MS / 2);
    addTimer(setTimeout(() => applyBeatUi(accented), dotStart));
  }

  function frame(mySerial, now){
    if(!metroRunning || mySerial !== serial) return;
    const elapsed = Math.max(0, now - startTs);
    setNeedleAngle(angleAtElapsed(elapsed));

    const endpointDelay = endpointTimeMs(nextEndpoint) - elapsed;
    while(endpointDelay <= SCHED_LOOKAHEAD_MS){
      if(nextEndpoint >= 1){
        scheduleEndpoint(nextEndpoint, endpointTimeMs(nextEndpoint) - elapsed);
      }
      nextEndpoint += 1;
      if(endpointTimeMs(nextEndpoint) - elapsed > SCHED_LOOKAHEAD_MS) break;
    }

    rafId = requestAnimationFrame(t => frame(mySerial, t));
  }

  startMetronome = function(){
    ensureAudio();
    clearMetroSync();
    metroRunning = true;
    beatIndex = 0;
    nextEndpoint = 1;
    const mySerial = serial;
    const v = visual();
    if(v){
      v.classList.add('running');
      v.classList.remove('beat-hit', 'accent-hit');
      v.style.setProperty('--metro-duration', `${beatMs()}ms`);
    }
    setNeedleLeft();
    renderBeats();
    syncCleanMetronomeUi();
    requestAnimationFrame(t => {
      if(!metroRunning || mySerial !== serial) return;
      startTs = t;
      setNeedleLeft();
      rafId = requestAnimationFrame(tt => frame(mySerial, tt));
    });
  };

  stopMetronome = function(){
    metroRunning = false;
    clearMetroSync();
    beatIndex = 0;
    const v = visual();
    if(v) v.classList.remove('running', 'beat-hit', 'accent-hit');
    setNeedleLeft();
    syncCleanMetronomeUi();
    renderBeats();
  };

  startPendulumMotion = setNeedleLeft;
  stopPendulumMotion = function(){ clearMetroSync(); setNeedleLeft(); };
  tick = function(){
    const accented = accentMode === 'all' || (accentMode === 'first' && beatIndex === 0);
    scheduleAudio(accented, CLICK_DUR_MS / 2);
    applyBeatUi(accented);
  };

  const prevInit = initMetronome;
  initMetronome = function(){
    prevInit();
    if(!metroRunning) requestAnimationFrame(setNeedleLeft);
  };
})();

/* EasyTune v55 — BPM display button opens Tempo modal */
(function(){
  var prevInit = initMetronome;
  initMetronome = function(){
    prevInit();
    document.querySelector('#metroCleanBpmButton')?.addEventListener('click', function(){
      openMetroSettings('metroTempoModal');
    });
  };
})();
