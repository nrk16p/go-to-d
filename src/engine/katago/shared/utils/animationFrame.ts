// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt
// Trimmed to getAnimationNow, the only part the engine uses.

export function getAnimationNow(): number {
  try {
    const now = globalThis.performance?.now;
    if (typeof now === 'function') return now.call(globalThis.performance);
  } catch {
    // Fall back below.
  }
  return Date.now();
}
