// svgo.worker.js

// Import the ESM build you vendored locally
import { optimize } from './vendor/svgo.browser.js';

const svgoConfig = {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    'preset-default',
    { name: 'removeViewBox', active: false },
    { name: 'cleanupNumericValues', params: { floatPrecision: 1 } },
    { name: 'convertPathData', params: { floatPrecision: 1 } },
    { name: 'convertTransform', params: { floatPrecision: 1 } },
    { name: 'removeDimensions', active: false },
  ],
};

self.onmessage = (e) => {
  const { id, svg } = e.data || {};
  try {
    const result = optimize(svg, svgoConfig);  // ESM API
    self.postMessage({ id, ok: true, svg: result.data });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};