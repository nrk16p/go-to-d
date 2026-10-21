// Which KataGo network the teacher runs, and how hard it searches.
// The numbers come from the benchmark in docs/engine-choice.md; rerun it before changing them.

/** File name under public/models/ (committed when ≤ 25 MB, else downloaded by scripts/fetch-model.mjs). */
export const MODEL_FILE = 'g170-b6c96-s175395328-d26788732.bin.gz'

/** The network's own name, as the engine reports it after loading. */
export const MODEL_NAME = 'g170-b6c96-s175395328-d26788732'

// import.meta.env is Vite's; plain Node (tsx tools) has none.
const BASE_URL: string = import.meta.env?.BASE_URL ?? '/'

/** Where the app fetches the network from, under the GitHub Pages base path. */
export const MODEL_URL = `${BASE_URL}models/${MODEL_FILE}`

/**
 * Visits for each search (analyzeCorner runs two, scoreFor one). Fast devices finish them well
 * inside the time budget (WebGPU: about 0.4 s for both); slow ones stop at the budget.
 */
export const DEFAULT_VISITS = 100

/**
 * Time for one teacher answer: analyzeCorner's two searches, or a scoreFor followed by an
 * analyzeCorner on the same position (they share the whole-board search). Each search gets half.
 * A search runs a little past its cap (the root evaluation, the last batch): on a 4× slower CPU
 * analyzeCorner took 2.1 s and scoreFor + analyzeCorner 3.0 s.
 */
export const DEFAULT_MAX_TIME_MS = 2000
