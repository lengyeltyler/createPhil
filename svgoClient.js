// svgoClient.js
// Helper to talk to svgo.worker.js and optimize an SVG string.

let _worker = null;
let _seq = 0;
const _pending = new Map();

export function optimizeSVG(svgString) {
  if (!_worker) {
    // Classic worker because we use importScripts() inside it
    _worker = new Worker('./svgo.worker.js', { type: 'module' });
    _worker.onmessage = (e) => {
      const { id, ok, svg, error } = e.data || {};
      const pending = _pending.get(id);
      if (!pending) return;
      _pending.delete(id);
      ok ? pending.resolve(svg) : pending.reject(new Error(error));
    };
  }

  return new Promise((resolve, reject) => {
    const id = ++_seq;
    _pending.set(id, { resolve, reject });
    _worker.postMessage({ id, svg: svgString });
  });
}