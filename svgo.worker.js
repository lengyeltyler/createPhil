// svgo.worker.js
// Full SVGO in a Worker so the UI stays responsive.
// Uses the browser build of SVGO via importScripts (classic worker).

// Pick one CDN; unpkg shown here:
importScripts('./vendor/svgo.browser.js');

const svgoConfig = {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    'preset-default',
    { name: 'removeViewBox', active: false }, // keep viewBox
    { name: 'cleanupNumericValues', params: { floatPrecision: 1 } },
    { name: 'convertPathData', params: { floatPrecision: 1 } },
    { name: 'convertTransform', params: { floatPrecision: 1 } },
    { name: 'removeDimensions', active: false }, // keep width/height if you set them
  ],
};

self.onmessage = (e) => {
  const { id, svg } = e.data;
  try {
    // SVGO is exposed globally as SVGO in the browser build
    const result = self.SVGO.optimize(svg, svgoConfig);
    self.postMessage({ id, ok: true, svg: result.data });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};