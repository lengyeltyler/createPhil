// public/app.js
// Orchestrator for compositing trait SVGs without touching trait code.
// - Z-order is enforced by the canonical LAYERS array (not checkbox order).
// - Each trait SVG is embedded as a data: URL <image> to avoid ID collisions.
// - Optional Service Worker keeps /traits_json fetches working under subpaths.
// - NEW: Per-trait generate/save via postMessage from parent page.

import { optimizeSVG } from './svgoClient.js';

const W = 420, H = 420;
const logEl   = document.getElementById('log');
const stage   = document.getElementById('stage');
const form    = document.getElementById('layerForm');
const genBtn  = document.getElementById('generateBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn= document.getElementById('clearBtn');

// --- create (or find) a PNG export button programmatically ---
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

// --------------------------
// State for exports/previews
// --------------------------
let lastSVG = '';            // composite wrapper used for preview
let lastInlineSVG = '';      // raw trait SVG when exactly one trait selected
let lastWasSingle = false;   // selection size at generation time

// Per-trait cache: last generated inline SVG for each trait id
const lastTraitSVG = Object.create(null);

// Helper: find layer meta by id
function getLayerMeta(id) {
  return LAYERS.find(l => l.id === id);
}

// Helper: dynamic import of a layer module (cache-busted in dev)
async function importTrait(id) {
  const meta = getLayerMeta(id);
  if (!meta) throw new Error(`Unknown trait id "${id}"`);
  return await (meta.importerCacheBusted ? meta.importerCacheBusted() : meta.importer());
}

// Safely post a single-trait SVG to the preview panel (works embedded or standalone)
function postToParentPreview(trait, svg) {
  const msg = { source: 'createPhil', kind: 'preview-layer', trait, svg };

  try { window.postMessage(msg, '*'); } catch (e) {}
  try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (e) {}
  try { if (window.top && window.top !== window && window.top !== window.parent) window.top.postMessage(msg, '*'); } catch (e) {}

  log(`› Sent ${trait} to parent preview.`);
}

// --------------------------
// Composite generation (UI)
// --------------------------
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
  const svgs  = [];

  for (const id of orderedIds) {
    try {
      const mod = await importTrait(id);
      if (typeof mod.generateTrait !== 'function') {
        log(`⚠️ ${id}: generateTrait() not found. Skipped.`);
        continue;
      }
      const svg = await mod.generateTrait();
      svgs.push(svg);
      hrefs.push(svgToImageHref(svg));
      lastTraitSVG[id] = svg; // cache per-trait result as well
      log(`✓ ${getLayerMeta(id)?.name || id} generated.`);
    } catch (err) {
      log(`✗ ${getLayerMeta(id)?.name || id} failed: ${err?.message || err}`);
    }
  }

  if (!hrefs.length) {
    if (stage) stage.innerHTML = '';
    if (genBtn) genBtn.disabled = false;
    return;
  }

  lastSVG = compose(hrefs);
  lastWasSingle  = (svgs.length === 1);
  lastInlineSVG  = lastWasSingle ? svgs[0] : '';

  if (stage) stage.innerHTML = lastSVG;
  if (saveBtn) saveBtn.disabled = false;
  if (savePngBtn) savePngBtn.disabled = false;
  if (genBtn) genBtn.disabled = false;
}

// --------------------------
// Per-trait generation (PM)
// --------------------------
async function generateOne(traitId) {
  try {
    if (stage) stage.innerHTML = '<div class="spinner">Generating…</div>';
    const mod = await importTrait(traitId);
    if (typeof mod.generateTrait !== 'function') {
      throw new Error('generateTrait() not found');
    }
    const svg = await mod.generateTrait();
    lastTraitSVG[traitId] = svg;
    lastInlineSVG = svg;
    lastWasSingle = true;
    lastSVG = svg; // for preview, show the single trait inline svg
    if (stage) stage.innerHTML = svg;
    log(`✓ ${getLayerMeta(traitId)?.name || traitId} generated.`);
  } catch (err) {
    if (stage) stage.innerHTML = '';
    log(`✗ ${getLayerMeta(traitId)?.name || traitId} failed: ${err?.message || err}`);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (savePngBtn) savePngBtn.disabled = false;
  }
}

async function saveOne(traitId) {
  try {
    // If user hasn't generated this trait yet in this session, generate now.
    if (!lastTraitSVG[traitId]) {
      await generateOne(traitId);
      if (!lastTraitSVG[traitId]) return; // still failed
    }

    let svg = lastTraitSVG[traitId];
    try {
      svg = await optimizeSVG(svg);
    } catch (e) {
      console.warn('SVGO optimize failed for trait, sending raw SVG:', e);
    }

    // Send the single-trait SVG back to parent to be dropped into the preview box
    postToParentPreview(traitId, svg);
  } catch (e) {
    log(`✗ Save ${traitId} failed: ${e?.message || e}`);
  }
}

// --------------------------
// Whole-canvas SVG/PNG save
// --------------------------
async function save() {
  if (!lastSVG) return;

  // Prefer the inline single-trait SVG when only one layer was selected
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
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    return true;
  } catch (_) {
    return false;
  }
}

// High-res PNG export (composite or last single)
async function savePNG(targetPx) {
  if (!lastSVG) return;
  const DEFAULT_SIZE = 3300; // ~11" at 300dpi
  const size = Number.isFinite(targetPx) && targetPx > 0 ? Math.floor(targetPx) : DEFAULT_SIZE;

  const svgStr = lastSVG;
  const img = new Image();
  img.decoding = 'async';
  img.loading = 'eager';
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));

  await img.decode().catch(() => new Promise(res => { img.onload = res; }));

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const link = document.createElement('a');
  link.download = 'phil.png';
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function clearStage(){
  lastSVG = '';
  lastInlineSVG = '';
  lastWasSingle = false;
  for (const k in lastTraitSVG) delete lastTraitSVG[k];
  if (stage) stage.innerHTML = '';
  if (saveBtn) saveBtn.disabled = true;
  if (savePngBtn) savePngBtn.disabled = true;
  clearLog();
}

// --------------------------
// Wire up local UI buttons
// --------------------------
genBtn?.addEventListener('click', generate);
saveBtn?.addEventListener('click', () => { save(); });
clearBtn?.addEventListener('click', clearStage);

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

// --------------------------
// Parent messaging bridge
// --------------------------
window.addEventListener('message', (e) => {
  // If you want to restrict, check e.origin === 'https://your-site'
  const msg = e.data || {};
  if (!msg || msg.source !== 'parent') return;

  const trait = String(msg.trait || '').toLowerCase();
  if (msg.kind === 'generate') {
    if (!getLayerMeta(trait)) {
      log(`(ignored) Unknown trait "${trait}"`);
      return;
    }
    generateOne(trait);
  }

  if (msg.kind === 'save') {
    if (!getLayerMeta(trait)) {
      log(`(ignored) Unknown trait "${trait}"`);
      return;
    }
    saveOne(trait);
  }
});