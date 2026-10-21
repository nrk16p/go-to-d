// What the session tells the owner when a tap doesn't count or the session has to stop.
// Plain sentences; the UI shows them as they are (Task 7 may move them to ui/copy.ts).

export const MESSAGES = {
  occupied: 'There’s already a stone there.',
  suicide: 'That stone would have no liberties. Try another point.',
  ko: 'Ko: you can’t take back right away. Play somewhere else first.',
  engineLoading: 'The engine is still loading, so the teacher can’t answer off the book yet. The session stops here.',
  engineFailed: 'The engine couldn’t answer this position, so the session stops here.',
  noMove: 'The teacher has no move to play, so the session stops here.',
}
