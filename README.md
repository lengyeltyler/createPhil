# createPhil

A self-contained front-end to generate Phil traits, layer them (without changing trait code), and save a composite 420×420 SVG. Visitors can toggle layers, randomize, and download their own Phil.

## Project goals
- **Do not modify trait generation scripts or JSON** (styles must remain identical).
- Support GitHub Pages **project page** under `/createPhil` **or** as a standalone site.
- Avoid ID/filter collisions by compositing each trait SVG as a data URL `<image>`.

## Directory layout
```
createPhil/
  index.html
  styles.css
  app.js
  sw.js
  utils/
    colorUtils.js
    sizeValidation.js
    svgUtils.js
  traits/             <-- put your trait JS files here (bgTrait.js, philTrait.js, etc.)
  traits_json/        <-- put all your *.json outlines here
  vendor/             <-- optional: local libs if you don't want CDNs
```

> Note: Several trait scripts expect `ClipperLib` to be available globally. `index.html` loads it via a CDN. If you prefer local hosting, drop a UMD build into `vendor/` and update the script tag.

## Local development
Serve via any static server (service workers need http/https, not `file://`). For example:
```bash
# from inside the createPhil folder
python3 -m http.server 8000
# or
npx serve
```
Then open `http://localhost:8000/`.

## GitHub Pages (project site)
1. Create a new repo named **createPhil** and push this folder as the root.
2. In **Settings → Pages**, set **Source** to **Deploy from a branch** and pick `main` / `/ (root)`.
3. Your site will be at `https://<user>.github.io/createPhil/` (with your custom domain, at `https://tylerlengyel.com/createPhil/`).
4. Add a link from your main site navigation to `/createPhil/`.

### Important: `/traits_json` paths under a subpath
If any trait script fetches JSON using an **absolute** path like `/traits_json/...`, GitHub Pages will otherwise look at the domain root (`/`). The included **service worker** remaps those requests to the correct relative path under `/createPhil/` automatically. No trait code changes required.

## Using it
1. Copy your existing **trait JS** into `traits/` (unchanged).
2. Copy all **outline JSON** into `traits_json/` (unchanged).
3. Visit the page, check the layers you want, click **Generate**, then **Save SVG**.

## Notes
- The app composes layers by embedding each trait SVG as a base64 data URL inside the final SVG. This preserves each trait’s `<defs>` and IDs without collisions, keeping visuals **identical**.
- If a trait fails (e.g., missing JSON), the UI logs the error and continues with the other layers.


python3 -m http.server 8000
http://localhost:8000/

CLEAR CACHE IN SAFARI CONSOLE
(async () => {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  }
  if (self.caches) {
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
  }
  localStorage.clear();
  sessionStorage.clear();
  console.log('All caches, SWs, and storage cleared.');
})();