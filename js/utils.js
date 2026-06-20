/**
 * EasyTune Utility Functions
 * Shared helper functions across the application
 */

import { CONFIG, BASE_CHORDS } from './config.js';

/**
 * Escape HTML special characters
 */
export function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  };
  return String(str).replace(/[&<>'"]/g, ch => map[ch]);
}

/**
 * Check if PWA is installed
 */
export function isPwaInstalled() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * Normalize chord root note
 */
export function normalizeRoot(root) {
  if (!root) return '';
  let value = root.replace('is', '#').replace('es', 'b');
  const first = value[0] ? value[0].toUpperCase() : '';
  value = first + value.slice(1);
  return CONFIG.FLATS[value] || value;
}

/**
 * Clean chord token by removing prefix/suffix characters
 */
export function cleanChordToken(token) {
  return String(token || '')
    .trim()
    .replace(/^[\[(]+/, '')
    .replace(/[\]),;:.!?]+$/, '');
}

/**
 * Extract main chord (without bass note)
 */
export function mainChord(token) {
  return cleanChordToken(token).split('/')[0];
}

/**
 * Check if token is a valid chord
 */
export function isChordToken(token) {
  const clean = cleanChordToken(token);
  return CONFIG.PATTERNS.CHORD.test(clean) && !!BASE_CHORDS[mainChord(clean)];
}

/**
 * Parse chord into components
 */
export function parseChord(chord) {
  const clean = mainChord(chord);
  const match = clean.match(/^([A-Ha-h](?:#|b|is|es)?)(.*)$/);
  if (!match) return null;
  
  const root = normalizeRoot(match[1]);
  const suffix = match[2] || '';
  const idx = CONFIG.NOTES.indexOf(root);
  
  if (idx < 0) return null;
  
  return {
    root,
    suffix,
    idx,
    minor: clean[0] === clean[0].toLowerCase()
  };
}

/**
 * Transpose root note by semitones
 */
export function transposeRoot(idx, minor) {
  const root = CONFIG.NOTES[(idx + 1200) % 12];
  return minor ? root.toLowerCase() : root;
}

/**
 * Transpose a chord by semitones
 */
export function transposeChord(chord, steps) {
  const clean = cleanChordToken(chord);
  const slash = clean.includes('/') ? clean.split('/') : null;
  const main = slash ? slash[0] : clean;
  const bass = slash ? slash[1] : null;
  const parsed = parseChord(main);
  
  if (!parsed) return chord;
  
  let out = transposeRoot(parsed.idx + steps, parsed.minor) + parsed.suffix;
  
  if (bass) {
    const b = parseChord(bass);
    if (b) out += '/' + transposeRoot(b.idx + steps, b.minor);
  }
  
  return out;
}

/**
 * Split text into words and spaces
 */
export function splitWordsAndSpaces(line) {
  return String(line).split(/(\s+)/);
}

/**
 * Transpose a single token with prefix/suffix preservation
 */
export function transposeOneToken(token, steps) {
  const prefix = String(token).match(CONFIG.PATTERNS.CHORD_PREFIX)?.[0] || '';
  const suffix = String(token).match(CONFIG.PATTERNS.CHORD_SUFFIX)?.[0] || '';
  const core = cleanChordToken(token);
  return prefix + transposeChord(core, steps) + suffix;
}

/**
 * Get chord notes (intervals)
 */
export function chordNotes(name) {
  const main = mainChord(name);
  const p = parseChord(main);
  if (!p) return '';
  
  const intervals =
    p.suffix === 'maj7'
      ? p.minor ? [0, 3, 7, 11] : [0, 4, 7, 11]
      : p.suffix === '7'
      ? p.minor ? [0, 3, 7, 10] : [0, 4, 7, 10]
      : p.minor ? [0, 3, 7] : [0, 4, 7];
  
  return intervals.map(step => CONFIG.NOTES[(p.idx + step) % CONFIG.NOTES.length]).join(' • ');
}

/**
 * Get full chord name with quality
 */
export function chordFullName(name) {
  const clean = mainChord(name);
  const p = parseChord(clean);
  if (!p) return clean;
  
  const root = String(p.root || '').replace('#', 'is');
  const quality = p.minor ? 'mol' : 'dur';
  
  if (p.suffix === 'maj7') return `${root} ${quality} maj7`;
  if (p.suffix === '7') return `${root} ${quality} 7`;
  return `${root} ${quality}`;
}

/**
 * Get display name for chord
 */
export function chordDisplayName(name) {
  return `${name} (${chordFullName(name)})`;
}

/**
 * Convert number to Roman numerals
 */
export function romanFretNumber(n) {
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return roman[n] || String(n);
}

/**
 * Get chord family type
 */
export function chordFamily(name) {
  if (name.includes('maj7')) return CONFIG.CHORD_FAMILIES.MAJ7;
  if (name.endsWith('7')) return CONFIG.CHORD_FAMILIES.SEVEN;
  if (name[0] === name[0].toLowerCase()) return CONFIG.CHORD_FAMILIES.MINOR;
  return CONFIG.CHORD_FAMILIES.MAJOR;
}

/**
 * Get chord sort value
 */
export function chordSortValue(name) {
  const p = parseChord(name);
  return p ? p.idx : 99;
}

/**
 * Get chord base letter
 */
export function chordLetter(name) {
  const main = mainChord(name);
  return main[0] ? main[0].toUpperCase() : '';
}

/**
 * Get chord features for filtering
 */
export function chordFeatures(name) {
  const clean = mainChord(name);
  const p = parseChord(clean);
  if (!p) return null;
  
  const suffix = String(p.suffix || '');
  const isMaj7 = suffix === 'maj7';
  const isSeven = suffix === '7';
  
  return {
    root: p.root,
    baseLetter: String(p.root || '')
      .replace('#', '')
      [0]?.toUpperCase() || '',
    sharp: String(p.root || '').includes('#'),
    quality: p.minor ? 'minor' : 'major',
    seventh: isMaj7 ? 'maj7' : isSeven ? '7' : null
  };
}

/**
 * Get chord tags for filtering
 */
export function chordTags(name) {
  const features = chordFeatures(name);
  const tags = new Set();
  
  if (!features) return tags;
  
  if (features.sharp) tags.add('sharp');
  tags.add(features.quality);
  if (features.seventh) tags.add(features.seventh);
  
  return tags;
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Get DOM element by selector
 */
export function getElement(selector) {
  return document.querySelector(selector);
}

/**
 * Get all DOM elements by selector
 */
export function getElements(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Add event listener with error handling
 */
export function addEventListener(target, event, handler) {
  if (!target) return;
  target.addEventListener(event, handler);
}

/**
 * Remove event listener
 */
export function removeEventListener(target, event, handler) {
  if (!target) return;
  target.removeEventListener(event, handler);
}

/**
 * Set CSS custom property
 */
export function setCSSVariable(name, value) {
  document.documentElement.style.setProperty(name, value);
}

/**
 * Get CSS custom property
 */
export function getCSSVariable(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Format time to MM:SS
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get local storage item with fallback
 */
export function getLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set local storage item with error handling
 */
export function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
