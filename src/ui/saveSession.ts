// Records a finished (or abandoned) session. Progress is loaded fresh at save time, so a session
// finished in a second tab isn't overwritten by this one (R24).

import { loadProgress, recordSession, saveProgress, todayLocal } from '../progress/store'
import type { SessionResult } from '../session/controller'

/** True when the progress was stored; false when this browser wouldn't keep it. */
export function saveSession(r: SessionResult, today: string = todayLocal()): boolean {
  return saveProgress(recordSession(loadProgress(), r, today))
}
