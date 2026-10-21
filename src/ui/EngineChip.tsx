// Says whether the teacher's engine is loading, ready or off. When it's off, one button tries again.

import { useSyncExternalStore } from 'react'
import { COPY } from './copy'
import type { EngineHub } from './engine'

export function EngineChip({ engine }: { engine: EngineHub }) {
  const status = useSyncExternalStore(engine.subscribe, engine.snapshot)
  const text = status === 'ready' ? COPY.engine.ready : status === 'loading' ? COPY.engine.loading : COPY.engine.off
  return (
    <div className={`engine engine-${status}`}>
      <span className="engine-chip" role="status" title={status === 'failed' ? COPY.engine.offHelp : undefined}>
        <span className="engine-dot" aria-hidden="true" />
        {text}
      </span>
      {status === 'failed' && (
        <button type="button" className="btn btn-quiet" onClick={() => engine.retry()}>
          {COPY.engine.retry}
        </button>
      )}
    </div>
  )
}
