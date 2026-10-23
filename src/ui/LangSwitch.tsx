// The ไทย / EN switch in the header, on every page. It shows the other language, named in that
// language, and one tap saves it and reloads the page in it (R38). The label is in the language it
// switches to as well, so someone who reads only that language can still find it.

import { LANG } from './copy'
import { LANG_SHORT, setLang, SWITCH_TO, type Lang } from './lang'

export function LangSwitch() {
  const other: Lang = LANG === 'th' ? 'en' : 'th'
  return (
    <button type="button" className="lang-switch" lang={other} aria-label={SWITCH_TO[other]} onClick={() => setLang(other)}>
      <span aria-hidden="true">{LANG_SHORT[other]}</span>
    </button>
  )
}
