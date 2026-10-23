// Whether to show the "Add to Home Screen" hint: on iOS, Safari can drop a site's storage after seven
// days without a visit, but not a Home Screen app's. Every iOS browser runs on Safari's engine and can
// add to the Home Screen (iOS 16.4+), so the hint isn't limited to Safari itself.

export function isIos(): boolean {
  try {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) return true
    // iPadOS asks for desktop pages and says it is a Mac; a Mac has no touch screen.
    return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
  } catch {
    return false
  }
}

export function isStandalone(): boolean {
  try {
    if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
    return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

export function needsIosInstallHint(dismissed: boolean): boolean {
  return !dismissed && isIos() && !isStandalone()
}
