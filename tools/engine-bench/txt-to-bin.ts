// Converts a KataGo text network (.txt or .txt.gz) to the binary format (.bin.gz) the browser
// engine reads. The weights are the same numbers; only the container changes. The older g170 nets
// (b10c128, b15c192) are published as text only.
//
//   npx tsx tools/engine-bench/txt-to-bin.ts in.txt.gz out.bin.gz
//
// It walks the file with the vendored parser itself (parseKataGoModelV8), so every token is read in
// the order the engine reads it: header tokens are copied as text, each weight array is written as
// "@BIN@" followed by little-endian float32s, which is KataGo's own .bin layout.

import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { KataGoBinModelParser } from '../../src/engine/katago/binModelParser'
import { parseKataGoModelV8 } from '../../src/engine/katago/loadModelV8'

const WHITESPACE = new Set([0x20, 0x0a, 0x0d, 0x09])

class TextToBin extends KataGoBinModelParser {
  private readonly text: Uint8Array
  private pos = 0
  private readonly chunks: Uint8Array[] = []
  private readonly enc = new TextEncoder()
  private readonly dec = new TextDecoder()

  constructor(text: Uint8Array) {
    super(text)
    this.text = text
  }

  private nextToken(): string {
    while (this.pos < this.text.length && WHITESPACE.has(this.text[this.pos])) this.pos++
    const start = this.pos
    while (this.pos < this.text.length && !WHITESPACE.has(this.text[this.pos])) this.pos++
    if (this.pos === start) throw new Error('Unexpected end of the text model')
    return this.dec.decode(this.text.subarray(start, this.pos))
  }

  override readToken(): string {
    const tok = this.nextToken()
    if (tok === '@BIN@' || tok.startsWith('@BIN@')) throw new Error('This model is already binary')
    this.chunks.push(this.enc.encode(`${tok}\n`))
    return tok
  }

  override readBinaryFloats(count: number): Float32Array {
    const out = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const v = Number.parseFloat(this.nextToken())
      if (!Number.isFinite(v)) throw new Error(`Bad float in weight array (${i} of ${count})`)
      out[i] = v
    }
    this.chunks.push(this.enc.encode('@BIN@'))
    this.chunks.push(new Uint8Array(out.buffer.slice(0)))
    this.chunks.push(this.enc.encode('\n'))
    return out
  }

  /** What is left after the parser has finished: must be only whitespace. */
  rest(): string {
    return this.dec.decode(this.text.subarray(this.pos)).trim()
  }

  output(): Uint8Array {
    const size = this.chunks.reduce((n, c) => n + c.length, 0)
    const out = new Uint8Array(size)
    let off = 0
    for (const c of this.chunks) {
      out.set(c, off)
      off += c.length
    }
    return out
  }
}

export function textModelToBin(input: Uint8Array): { bin: Uint8Array; modelName: string } {
  const text = input[0] === 0x1f && input[1] === 0x8b ? new Uint8Array(gunzipSync(input)) : input
  const t = new TextToBin(text)
  const parsed = parseKataGoModelV8(text, t)
  const rest = t.rest()
  if (rest !== '') throw new Error(`The parser stopped early; ${rest.length} characters left`)
  return { bin: t.output(), modelName: parsed.modelName }
}

const [, , inPath, outPath] = process.argv
if (inPath && outPath) {
  const { bin, modelName } = textModelToBin(new Uint8Array(readFileSync(inPath)))
  const gz = gzipSync(bin, { level: 9 })
  writeFileSync(outPath, gz)
  console.log(`${modelName}: ${(gz.length / 1e6).toFixed(1)} MB -> ${outPath}`)
}
