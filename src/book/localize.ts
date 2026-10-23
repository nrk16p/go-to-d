// The book in the owner's language (R38). English stays the source of truth; this only swaps words.
// Every move, key, kind, weight, setup and pattern list is the same as in the English book, so review
// keys, missed positions, the book check (familyHash, checkedLoss) and the sparring controller all work
// on the localized book unchanged. The book passed in is never changed.
//
// Only what a screen shows is swapped: pattern names, node notes, family names and corner-stone notes.
// The authored moves inside each PatternDef (`line`, `branches`) keep their English notes; nothing
// shows those, the screens read notes from the tree.

import type { Lang } from '../ui/lang'
import { TH, type FamilyTh } from './th'
import { TH_FAMILIES, type FamilyHeadTh } from './th/families'
import type { Book, BookNode, FamilyBook, FamilyId, PatternDef } from './types'

export interface BookTexts {
  /** Per family: pattern id → name, node key → note. */
  text: Partial<Record<FamilyId, FamilyTh>>
  /** Per family: the family's name and its corner-stone notes. */
  family: Partial<Record<FamilyId, FamilyHeadTh>>
}

/** A usable translation from `map`, or undefined: missing, blank or inherited keys fall back to English. */
function pick(map: Record<string, string> | undefined, key: string): string | undefined {
  if (!map || !Object.hasOwn(map, key)) return undefined
  const v = map[key]
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function cloneTree(node: BookNode, parent: BookNode | null, notes: Record<string, string> | undefined, made: Map<BookNode, BookNode>): BookNode {
  const copy: BookNode = {
    ...node,
    note: node.move === null ? node.note : (pick(notes, node.key) ?? node.note),
    patternIds: [...node.patternIds],
    children: [],
    parent,
  }
  made.set(node, copy)
  copy.children = node.children.map((child) => cloneTree(child, copy, notes, made))
  return copy
}

/** `book` with names and notes taken from `texts` where they have them. */
export function localizeBookWith(book: Book, texts: BookTexts): Book {
  const made = new Map<BookNode, BookNode>()
  const defs = new Map<PatternDef, PatternDef>()
  const families = {} as Book['families']

  for (const [id, fam] of Object.entries(book.families) as Array<[FamilyId, FamilyBook]>) {
    const text = Object.hasOwn(texts.text, id) ? texts.text[id] : undefined
    const head = Object.hasOwn(texts.family, id) ? texts.family[id] : undefined
    const patterns = fam.def.patterns.map((p) => {
      const def = { ...p, name: pick(text?.names, p.id) ?? p.name }
      defs.set(p, def)
      return def
    })
    const name = head?.name.trim() ? head.name : fam.def.name
    const start = fam.def.start.map((s, i) => {
      const note = head?.start[i]
      return { ...s, note: typeof note === 'string' && note.trim() !== '' ? note : s.note }
    })
    families[id] = { def: { ...fam.def, name, start, patterns }, root: cloneTree(fam.root, null, text?.notes, made) }
  }

  const patterns: Book['patterns'] = {}
  for (const [id, entry] of Object.entries(book.patterns)) {
    const text = Object.hasOwn(texts.text, entry.family) ? texts.text[entry.family] : undefined
    patterns[id] = {
      family: entry.family,
      // The same object as in its family's pattern list, so both say the same name.
      def: defs.get(entry.def) ?? { ...entry.def, name: pick(text?.names, id) ?? entry.def.name },
      path: entry.path.map((n) => {
        const copy = made.get(n)
        if (!copy) throw new Error(`localizeBook: node "${n.key}" of "${id}" is not in its family's tree`)
        return copy
      }),
    }
  }

  return { families, patterns, issues: [...book.issues] }
}

const TEXTS: Record<Exclude<Lang, 'en'>, BookTexts> = {
  th: { text: TH, family: TH_FAMILIES },
}

const made = new WeakMap<Book, Map<Lang, Book>>()

/**
 * The book with its names and notes in `lang`. English gives the book back as it is; another
 * language gives a copy (made once per book and language), English wherever a translation is missing.
 */
export function localizeBook(book: Book, lang: Lang): Book {
  if (lang === 'en') return book
  let byLang = made.get(book)
  if (!byLang) made.set(book, (byLang = new Map()))
  let out = byLang.get(lang)
  if (!out) byLang.set(lang, (out = localizeBookWith(book, TEXTS[lang])))
  return out
}
