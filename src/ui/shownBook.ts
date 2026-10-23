// The book as the screens show it: names and notes in the app's language (R38). Same moves, keys and
// pattern ids as src/book/data's BOOK, so progress and the sparring controller work on either.

import { BOOK as SOURCE } from '../book/data'
import { localizeBook } from '../book/localize'
import { LANG } from './copy'

export const BOOK = localizeBook(SOURCE, LANG)
