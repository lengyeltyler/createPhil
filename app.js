// public/app.js
// Orchestrator for compositing trait SVGs without touching trait code.
// - Z-order is enforced by the canonical LAYERS array (not checkbox order).
// - Each trait SVG is embedded as a data: URL <image> to avoid ID collisions.
// - Optional Service Worker keeps /traits_json fetches working under subpaths.

import { optimizeSVG } from './svgoClient.js';

const W = 420, H = 420;
const logEl   = document.getElementById('log');
const stage   = document.getElementById('stage');
const form    = document.getElementById('layerForm');
const genBtn  = document.getElementById('generateBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn= document.getElementById('clearBtn');

// --- NEW: create (or find) a PNG export button programmatically ---
let savePngBtn = document.getElementById('savePngBtn');
(function ensurePngButton(){
  if (!savePngBtn) {
    savePngBtn = document.createElement('button');
    savePngBtn.id = 'savePngBtn';
    savePngBtn.type = 'button';
    savePngBtn.textContent = 'Export PNG';
    savePngBtn.style.marginLeft = '8px';
    const toolbar = (saveBtn && saveBtn.parentElement) || document.body;
    toolbar.appendChild(savePngBtn);
  }
})();

// Register service worker (optional but recommended for subpath-safe JSON fetch)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then(reg => reg.update?.())
    .catch(() => {});
}

// Canonical z-order (top to bottom in the final composite)
const LAYERS = [
  { id:'bg',     name:'Background',
    importer: () => import('./traits/bgTrait.js'),
    importerCacheBusted: () => import(`./traits/bgTrait.js?v=${Date.now()}`) },
  { id:'wings',  name:'Wings',
    importer: () => import('./traits/wingsTrait.js'),
    importerCacheBusted: () => import(`./traits/wingsTrait.js?v=${Date.now()}`) },
  { id:'phil',   name:'Phil',
    importer: () => import('./traits/philTrait.js'),
    importerCacheBusted: () => import(`./traits/philTrait.js?v=${Date.now()}`) },
  { id:'spikes', name:'Spikes',
    importer: () => import('./traits/spikesTrait.js'),
    importerCacheBusted: () => import(`./traits/spikesTrait.js?v=${Date.now()}`) },
  { id:'eyes',   name:'Eyes',
    importer: () => import('./traits/eyesTrait.js'),
    importerCacheBusted: () => import(`./traits/eyesTrait.js?v=${Date.now()}`) },
  { id:'nose',   name:'Nose',
    importer: () => import('./traits/noseTrait.js'),
    importerCacheBusted: () => import(`./traits/noseTrait.js?v=${Date.now()}`) },
  { id:'teeth',  name:'Teeth',
    importer: () => import('./traits/teethTrait.js'),
    importerCacheBusted: () => import(`./traits/teethTrait.js?v=${Date.now()}`) },
  { id:'top',    name:'Top',
    importer: () => import('./traits/topTrait.js'),
    importerCacheBusted: () => import(`./traits/topTrait.js?v=${Date.now()}`) },
];

function log(msg){ if (!logEl) return; logEl.textContent += (msg + "\n"); logEl.scrollTop = logEl.scrollHeight; }
function clearLog(){ if (!logEl) return; logEl.textContent = ''; }

function getSelectedIdsSet() {
  if (!form) return new Set();
  return new Set(
    Array.from(form.querySelectorAll('input[name="layer"]:checked'))
      .map(i => i.value)
  );
}

// Encode SVG to base64 UTF-8 data URL to prevent parser issues and ID collisions
function svgToImageHref(svgString){
  const encoded = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${encoded}`;
}

function compose(hrefs) {
  // The order of 'hrefs' is already canonical; just stack them in that order.
  const images = hrefs.map(href => `<image href="${href}" x="0" y="0" width="${W}" height="${H}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${images}</svg>`;
}

// --- NEW: keep both composite and inline (single-layer) versions for export ---
let lastSVG = '';            // composite wrapper used for preview
let lastInlineSVG = '';      // raw trait SVG when exactly one trait selected
let lastWasSingle = false;   // selection size at generation time

async function generate() {
  clearLog();
  if (genBtn) genBtn.disabled = true;
  if (saveBtn) saveBtn.disabled = true;
  if (savePngBtn) savePngBtn.disabled = true;
  if (stage) stage.innerHTML = '<div class="spinner">Generating…</div>';

  // 1) selection as a set
  const selected = getSelectedIdsSet();
  if (selected.size === 0) {
    log('No layers selected.');
    if (stage) stage.innerHTML = '';
    if (genBtn) genBtn.disabled = false;
    return;
  }

  // 2) enforce canonical z-order (bg → wings → phil → spikes → eyes → nose → teeth → top)
  const orderedIds = LAYERS.map(l => l.id).filter(id => selected.has(id));

  const hrefs = [];
  const svgs  = []; // NEW: keep raw trait SVG strings

  for (const id of orderedIds) {
    const layer = LAYERS.find(l => l.id === id);
    if (!layer) continue;
    try {
      // Use cache-busted import to ensure latest code during active dev
      const mod = await (layer.importerCacheBusted ? layer.importerCacheBusted() : layer.importer());
      if (typeof mod.generateTrait !== 'function') {
        log(`⚠️ ${layer.name}: generateTrait() not found. Skipped.`);
        continue;
      }
      const svg = await mod.generateTrait(); // defaults keep each trait's internal style
      svgs.push(svg);                        // NEW: store inline SVG
      hrefs.push(svgToImageHref(svg));
      log(`✓ ${layer.name} generated.`);
    } catch (err) {
      log(`✗ ${layer.name} failed: ${err?.message || err}`);
    }
  }

  if (!hrefs.length) {
    if (stage) stage.innerHTML = '';
    if (genBtn) genBtn.disabled = false;
    return;
  }

  // For preview we still show the composed wrapper as before
  lastSVG = compose(hrefs);

  // For saving: if exactly one trait, keep the inline version
  lastWasSingle  = (svgs.length === 1);
  lastInlineSVG  = lastWasSingle ? svgs[0] : '';

  if (stage) stage.innerHTML = lastSVG;
  if (saveBtn) saveBtn.disabled = false;
  if (savePngBtn) savePngBtn.disabled = false;
  if (genBtn) genBtn.disabled = false;
}

async function save() {
  if (!lastSVG) return;

  // Prefer the inline single-trait SVG (smaller, fully minified) when only one layer was selected
  const candidate = (lastWasSingle && lastInlineSVG) ? lastInlineSVG : lastSVG;

  let finalSVG = candidate;
  try {
    finalSVG = await optimizeSVG(candidate);   // SVGO in worker
  } catch (e) {
    console.warn('SVGO optimize failed; falling back to raw SVG:', e);
  }

  // Try direct download first (works when you open createPhil directly)
  const ok = directDownload('phil.svg', finalSVG);
  if (ok) return;

  // Fallback: send to parent page to download top-level
  try {
    if (window.top && window.top !== window) {
      window.top.postMessage({
        source: 'createPhil',
        kind: 'download-svg',
        filename: 'phil.svg',
        mime: 'image/svg+xml;charset=utf-8',
        data: finalSVG
      }, '*');
    }
  } catch (e) {
    console.warn('postMessage to parent failed:', e);
  }
}

function directDownload(filename, dataStr, mime='image/svg+xml;charset=utf-8') {
  try {
    const blob = new Blob([dataStr], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    // Some browsers need the link in DOM
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    return true;
  } catch (_) {
    return false;
  }
}

// --- NEW: High-res PNG export ---
// Default target is 3300x3300 px (crisp on US Letter/A4 when set to "Fit to page" in print dialogs).
async function savePNG(targetPx) {
  if (!lastSVG) return;
  const DEFAULT_SIZE = 3300; // ~11" at 300dpi; square to maximize printable area
  const size = Number.isFinite(targetPx) && targetPx > 0 ? Math.floor(targetPx) : DEFAULT_SIZE;

  // Ensure <svg> string has explicit viewBox (we already set that in compose)
  const svgStr = lastSVG;

  // Make an <img> from the SVG string
  const img = new Image();
  img.decoding = 'async';
  img.loading = 'eager';
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));

  await img.decode().catch(() => new Promise(res => { img.onload = res; }));

  // Draw to a high-res square canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  // scale the square 420x420 to the target square
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Download as PNG
  const link = document.createElement('a');
  link.download = 'phil.png';
  link.href = canvas.toDataURL('image/png'); // lossless
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function clearStage(){
  lastSVG = '';
  lastInlineSVG = '';
  lastWasSingle = false;
  if (stage) stage.innerHTML = '';
  if (saveBtn) saveBtn.disabled = true;
  if (savePngBtn) savePngBtn.disabled = true;
  clearLog();
}

genBtn?.addEventListener('click', generate);
saveBtn?.addEventListener('click', () => { save(); });
clearBtn?.addEventListener('click', clearStage);

// --- NEW: hook up PNG export ---
// Click = quick export at 3300px; Shift+Click prompts custom size.
savePngBtn?.addEventListener('click', (e) => {
  if (e.shiftKey) {
    const val = prompt('Export PNG size in pixels (square):', '3300');
    const px = val ? parseInt(val, 10) : NaN;
    savePNG(px);
  } else {
    savePNG(3300);
  }
});