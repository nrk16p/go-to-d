// The owner's rules for Thai text (R38): no stiff office phrasing anywhere the owner reads Thai, in the
// UI copy or in the book text. A plain scan of the files, so a new family file is covered the day it lands.

import { describe, expect, it } from 'vitest'

const FILES = import.meta.glob<string>(['../../src/ui/copy.th.ts', '../../src/book/th/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

const BANNED = [
  'ระบบจะทำการ',
  'ท่านสามารถ',
  'ดังนั้น',
  'ทั้งนี้',
  'อย่างไรก็ตาม',
  'นอกจากนี้',
  'อีกทั้ง',
  'อย่างง่ายดาย',
  'ครบถ้วนสมบูรณ์',
  'เพื่อให้มั่นใจว่า',
]

describe('Thai text', () => {
  it('keeps the owner’s banned phrases out of every Thai file', () => {
    expect(Object.keys(FILES).length).toBeGreaterThan(5)
    const hits: string[] = []
    for (const [file, text] of Object.entries(FILES)) {
      for (const phrase of BANNED) if (text.includes(phrase)) hits.push(`${file}: ${phrase}`)
    }
    expect(hits).toEqual([])
  })
})
