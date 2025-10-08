// public/app.js
// Orchestrator for compositing trait SVGs without touching trait code.

import { optimizeSVG } from './svgoClient.js';

const W = 420, H = 420;
const logEl   = document.getElementById('log');
const stage   = document.getElementById('stage');
const form    = document.getElementById('layerForm');
const genBtn  = document.getElementById('generateBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn= document.getElementById('clearBtn');

// --- PNG export button (insert if missing) ---
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

// Service worker (optional)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then(reg => reg.update?.())
    .catch(() => {});
}

// Canonical z-order (bg → wings → phil → spikes → eyes → nose → teeth → top)
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

// ---- selection helpers ----
function getSelectedIdsSet() {
  if (!form) return new Set(); // if there’s no form, prefer explicit per-trait generation
  const checked = Array.from(form.querySelectorAll('input[name="layer"]:checked')).map(i => i.value);
  return new Set(checked);
}
function orderByCanonical(ids) {
  const want = new Set(ids);
  return LAYERS.map(l => l.id).filter(id => want.has(id));
}

// ---- dataURL encoder ----
function svgToImageHref(svgString){
  const encoded = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${encoded}`;
}
function compose(hrefs) {
  const images = hrefs.map(href => `<image href="${href}" x="0" y="0" width="${W}" height="${H}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${images}</svg>`;
}

// --- last render state (for export) ---
let lastSVG = '';            // composed preview
let lastInlineSVG = '';      // inline SVG if single layer generated
let lastWasSingle = false;
let lastLayerHrefsById = {}; // { layerId: dataHref }

// --- preview persistence (localStorage) ---
const PREVIEW_KEY = 'phil.saved.preview.v1';
function loadSaved() { try { return JSON.parse(localStorage.getItem(PREVIEW_KEY) || '[]'); } catch { return []; } }
function saveSaved(arr) { try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(arr)); } catch {} }
function addThumb({ layerId, href }) {
  const grid = document.getElementById('previewGrid');
  if (!grid) return;
  const wrap = document.createElement('div');
  wrap.className = 'thumb';
  wrap.innerHTML = `
    <img alt="${layerId} preview" loading="lazy">
    <div class="meta">
      <span>${layerId}</span>
      <button type="button" style="background:#111;color:#bfecc8;border:1px solid #1b3b24;border-radius:6px;padding:2px 6px">Remove</button>
    </div>`;
  wrap.querySelector('img').src = href;
  wrap.querySelector('button').addEventListener('click', () => {
    const all = loadSaved().filter(x => !(x.layerId === layerId && x.href === href));
    saveSaved(all);
    wrap.remove();
  });
  grid.prepend(wrap);
}
function hydratePreviewFromStorage() {
  const grid = document.getElementById('previewGrid');
  if (!grid) return;
  grid.innerHTML = '';
  loadSaved().forEach(addThumb);
}
function saveCurrentLayer(layerId) {
  const href = lastLayerHrefsById[layerId];
  if (!href) { log(`Nothing to save for "${layerId}" yet—generate that trait first.`); return; }
  const entry = { layerId, href };
  const all = loadSaved(); all.push(entry);
  saveSaved(all);
  addThumb(entry);
  log(`★ Saved ${layerId} to preview.`);
}

// ---- core generation (refactored to accept explicit list) ----
async function generateLayers(layerIds) {
  clearLog();
  genBtn && (genBtn.disabled = true);
  saveBtn && (saveBtn.disabled = true);
  savePngBtn && (savePngBtn.disabled = true);
  if (stage) stage.innerHTML = '<div class="spinner">Generating…</div>';

  const ids = orderByCanonical(layerIds);
  if (!ids.length) {
    log('No layers selected.');
    stage && (stage.innerHTML = '');
    genBtn && (genBtn.disabled = false);
    return;
  }

  const hrefs = [];
  const svgs  = [];
  lastLayerHrefsById = {};

  for (const id of ids) {
    const layer = LAYERS.find(l => l.id === id);
    if (!layer) continue;

    // Soft-guard: Phil depends on ClipperLib in your trait. If missing, skip with a helpful log.
    if (id === 'phil' && typeof window !== 'undefined' && !('ClipperLib' in window)) {
      log('⚠️ Phil skipped: ClipperLib not found. Include it (e.g., vendor/clipper.min.js) or guard inside philTrait.');
      continue;
    }

    try {
      const mod = await (layer.importerCacheBusted ? layer.importerCacheBusted() : layer.importer());
      if (typeof mod.generateTrait !== 'function') {
        log(`⚠️ ${layer.name}: generateTrait() not found. Skipped.`);
        continue;
      }
      const svg = await mod.generateTrait();
      const href = svgToImageHref(svg);

      svgs.push(svg);
      hrefs.push(href);
      lastLayerHrefsById[id] = href;

      log(`✓ ${layer.name} generated.`);
    } catch (err) {
      log(`✗ ${layer.name} failed: ${err?.message || err}`);
    }
  }

  if (!hrefs.length) {
    stage && (stage.innerHTML = '');
    genBtn && (genBtn.disabled = false);
    return;
  }

  // Preview = composed stack of whatever we just generated
  lastSVG = compose(hrefs);
  lastWasSingle = (svgs.length === 1);
  lastInlineSVG = lastWasSingle ? svgs[0] : '';

  stage && (stage.innerHTML = lastSVG);
  saveBtn && (saveBtn.disabled = false);
  savePngBtn && (savePngBtn.disabled = false);
  genBtn && (genBtn.disabled = false);
}

// --- public handlers ---
async function generate() {
  const selected = getSelectedIdsSet();
  // If no form or nothing checked, do nothing (use per-trait buttons instead).
  if (!selected.size) {
    log('Tip: use the per-trait Generate buttons, or check layers then click Generate.');
    return;
  }
  await generateLayers([...selected]);
}
async function generateOne(layerId) {
  await generateLayers([layerId]);
}

// ---- exports ----
async function save() {
  if (!lastSVG) return;
  const candidate = (lastWasSingle && lastInlineSVG) ? lastInlineSVG : lastSVG;

  let finalSVG = candidate;
  try {
    finalSVG = await optimizeSVG(candidate);
  } catch (e) {
    console.warn('SVGO optimize failed; falling back to raw SVG:', e);
  }

  const ok = directDownload('phil.svg', finalSVG);
  if (ok) return;

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
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    return true;
  } catch { return false; }
}

// PNG export
async function savePNG(targetPx) {
  if (!lastSVG) return;
  const DEFAULT_SIZE = 3300;
  const size = Number.isFinite(targetPx) && targetPx > 0 ? Math.floor(targetPx) : DEFAULT_SIZE;

  const img = new Image();
  img.decoding = 'async';
  img.loading = 'eager';
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(lastSVG)));
  await img.decode().catch(() => new Promise(res => { img.onload = res; }));

  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const link = document.createElement('a');
  link.download = 'phil.png';
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link); link.click(); link.remove();
}

function clearStage(){
  lastSVG = '';
  lastInlineSVG = '';
  lastWasSingle = false;
  lastLayerHrefsById = {};
  stage && (stage.innerHTML = '');
  saveBtn && (saveBtn.disabled = true);
  savePngBtn && (savePngBtn.disabled = true);
  clearLog();
}

// --- base controls ---
genBtn?.addEventListener('click', generate);
saveBtn?.addEventListener('click', () => { save(); });
clearBtn?.addEventListener('click', clearStage);

// PNG export: Click = 3300px; Shift+Click = prompt size
savePngBtn?.addEventListener('click', (e) => {
  if (e.shiftKey) {
    const val = prompt('Export PNG size in pixels (square):', '3300');
    const px = val ? parseInt(val, 10) : NaN;
    savePNG(px);
  } else {
    savePNG(3300);
  }
});

// --- per-trait Generate + Save buttons (wire up if present) ---
const genBtnIds = [
  ['generateBgBtn','bg'],
  ['generateWingsBtn','wings'],
  ['generatePhilBtn','phil'],
  ['generateSpikesBtn','spikes'],
  ['generateEyesBtn','eyes'],
  ['generateNoseBtn','nose'],
  ['generateTeethBtn','teeth'],
  ['generateTopBtn','top'],
];
genBtnIds.forEach(([btnId, layerId]) => {
  const el = document.getElementById(btnId);
  el?.addEventListener('click', () => generateOne(layerId));
});

document.getElementById('saveBgBtn')    ?.addEventListener('click', () => saveCurrentLayer('bg'));
document.getElementById('saveWingsBtn') ?.addEventListener('click', () => saveCurrentLayer('wings'));
document.getElementById('savePhilBtn')  ?.addEventListener('click', () => saveCurrentLayer('phil'));
document.getElementById('saveSpikesBtn')?.addEventListener('click', () => saveCurrentLayer('spikes'));
document.getElementById('saveEyesBtn')  ?.addEventListener('click', () => saveCurrentLayer('eyes'));
document.getElementById('saveNoseBtn')  ?.addEventListener('click', () => saveCurrentLayer('nose'));
document.getElementById('saveTeethBtn') ?.addEventListener('click', () => saveCurrentLayer('teeth'));
document.getElementById('saveTopBtn')   ?.addEventListener('click', () => saveCurrentLayer('top'));

// Hydrate preview grid on load (no-op if grid missing)
window.addEventListener('DOMContentLoaded', hydratePreviewFromStorage);