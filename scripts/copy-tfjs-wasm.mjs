// Copies TF.js's WASM binaries to public/tfjs/, where the engine's WASM backend loads them
// (src/engine/katago/engine.ts sets the path to `<base>/tfjs/`). Runs before dev, build and test.
// Adapted from Sir-Teo/web-katrain scripts/copy-tfjs-wasm.mjs (MIT), see LICENSES/web-katrain.txt.

import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const wasmSrcDir = path.join(projectRoot, 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist')
const wasmOutDir = path.join(projectRoot, 'public', 'tfjs')

async function main() {
  await fs.mkdir(wasmOutDir, { recursive: true })
  const entries = await fs.readdir(wasmSrcDir, { withFileTypes: true })
  const wasmFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.wasm')).map((e) => e.name)
  if (wasmFiles.length === 0) throw new Error(`No .wasm files found in ${wasmSrcDir}`)
  await Promise.all(wasmFiles.map((name) => fs.copyFile(path.join(wasmSrcDir, name), path.join(wasmOutDir, name))))
  console.log(`Copied ${wasmFiles.length} wasm files to ${path.relative(projectRoot, wasmOutDir)}/`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
