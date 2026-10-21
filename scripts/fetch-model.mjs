// Makes sure the teacher's KataGo network is in public/models/ before dev and build.
// The network named by MODEL_FILE in src/engine/model.ts is committed when it is 25 MB or less,
// so this usually just says it is there. Otherwise it is downloaded (and checked against its
// SHA-256); networks only published in KataGo's text format are converted to .bin.gz with
// tools/engine-bench/txt-to-bin.ts.
//
//   node scripts/fetch-model.mjs                                   the app's model into public/models/
//   node scripts/fetch-model.mjs --all --dir tools/engine-bench/models   every benchmark candidate

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

const KATA1 = 'https://media.katagotraining.org/uploaded/networks/models/kata1'

/** Where each network comes from; sha256 is of the downloaded file. */
const SOURCES = {
  'g170-b6c96-s175395328-d26788732.bin.gz': {
    url: 'https://raw.githubusercontent.com/lightvector/KataGo/master/cpp/tests/models/g170-b6c96-s175395328-d26788732.bin.gz',
    sha256: 'f5d32604e3675c480c7c8f6aa579a1ea857135628a0afccc8fa56330fbacd38d',
  },
  // The g170e nets, as katagotraining.org lists them; text format only.
  'kata1-b10c128-s1141046784-d204142634.bin.gz': {
    url: `${KATA1}/kata1-b10c128-s1141046784-d204142634.txt.gz`,
    sha256: '3d8a24697ba25fe4da39af4c2b6bd405907b0ad8295322f5a550fa2d8fe4a2f4',
    convert: true,
  },
  'kata1-b15c192-s1672170752-d466197061.bin.gz': {
    url: `${KATA1}/kata1-b15c192-s1672170752-d466197061.txt.gz`,
    sha256: '09456899f1b9155217f4ca059cf8a68f79b7eba22cf6b7c00ffb7f17ce067967',
    convert: true,
  },
  // Model version 17: the vendored parser stops at 16, so this one fails to load (kept for the benchmark).
  'kata1-tf2-b10c384-s2941M-d5872M.bin.gz': {
    url: `${KATA1}/kata1-tf2-b10c384-s2941M-d5872M.bin.gz`,
    sha256: '8015d49bdf45854c94e5f9e22b2b70e8738d3e56a6edca730e5b82509998a5b5',
  },
}

async function exists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

async function appModelFile() {
  const src = await fs.readFile(path.join(projectRoot, 'src', 'engine', 'model.ts'), 'utf8')
  const m = /export const MODEL_FILE = '([^']+)'/.exec(src)
  if (!m) throw new Error('MODEL_FILE not found in src/engine/model.ts')
  return m[1]
}

async function fetchOne(file, dir) {
  const dest = path.join(dir, file)
  if (await exists(dest)) {
    console.log(`Model present: ${path.relative(projectRoot, dest)}`)
    return
  }
  const source = SOURCES[file]
  if (!source) throw new Error(`No download source for ${file}; add it to SOURCES in scripts/fetch-model.mjs`)
  console.log(`Downloading ${source.url}`)
  const res = await fetch(source.url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const sha = createHash('sha256').update(buf).digest('hex')
  if (sha !== source.sha256) throw new Error(`${file}: SHA-256 ${sha} does not match ${source.sha256}`)
  await fs.mkdir(dir, { recursive: true })
  if (!source.convert) {
    await fs.writeFile(dest, buf)
  } else {
    const tmp = `${dest}.download.txt.gz`
    await fs.writeFile(tmp, buf)
    const converter = path.join(projectRoot, 'tools', 'engine-bench', 'txt-to-bin.ts')
    const r = spawnSync('npx', ['tsx', converter, tmp, dest], { cwd: projectRoot, stdio: 'inherit' })
    await fs.rm(tmp, { force: true })
    if (r.status !== 0) throw new Error(`Converting ${file} failed`)
  }
  console.log(`Saved ${path.relative(projectRoot, dest)} (${((await fs.stat(dest)).size / 1e6).toFixed(1)} MB)`)
}

async function main() {
  const args = process.argv.slice(2)
  const dirArg = args.indexOf('--dir')
  const dir = dirArg >= 0 ? path.resolve(args[dirArg + 1]) : path.join(projectRoot, 'public', 'models')
  const files = args.includes('--all') ? Object.keys(SOURCES) : [await appModelFile()]
  for (const f of files) await fetchOne(f, dir)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
