import { describe, expect, it } from 'vitest'
import { BOOK } from '../../src/book/data'
import { validateBook } from '../../src/book/validate'

describe('the real joseki book', () => {
  it('passes the validator', () => {
    const errors = validateBook(BOOK)
    expect(errors, errors.join('\n')).toEqual([])
  })
})
