// Node-only helper: maps the bare 'three' import to the vendored copy so CameraRig.js runs outside the browser.
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: new URL('../vendor/three.module.js', import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
// the project has no package.json, so treat its .js files as ES modules
export async function load(url, ctx, next) {
  if (url.endsWith('.js') && url.startsWith('file:')) return next(url, { ...ctx, format: 'module' });
  return next(url, ctx);
}
