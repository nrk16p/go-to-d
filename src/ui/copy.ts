// The UI text in the app's language, picked once when the app loads (R38). Switching language
// reloads the page, so nothing here has to change while the app runs and `import { COPY }` keeps
// working everywhere. The words themselves live in copy.en.ts and copy.th.ts.

import * as EN from './copy.en'
import * as TH from './copy.th'
import { currentLang, type Lang } from './lang'

export type { Copy } from './copy.en'

/** The language this page load speaks. */
export const LANG: Lang = currentLang()

const PACK = LANG === 'th' ? TH : EN

export const COPY: EN.Copy = PACK.COPY

/** What the session says when a tap doesn't count or it has to stop (src/session/messages.ts re-exports these). */
export const SESSION_MESSAGES: EN.SessionMessages = PACK.SESSION_MESSAGES

/** "1 point" / "1 แต้ม". */
export const points: (n: number) => string = PACK.points
