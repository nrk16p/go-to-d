// Every string the owner reads, in one place. English, short, like a stronger friend talking.
// Book notes live in the book; everything else is here. Apostrophes are straight on purpose:
// two lines below are fixed word for word by the plan.

import type { Side } from '../session/sides'
import type { Color } from '../go/coords'

/** "1 point", "0.5 points", "3.2 points". */
export function points(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return n === 1 ? '1 point' : `${s} points`
}

export const colorName = (c: Color): string => (c === 'black' ? 'Black' : 'White')

/** What the session says when a tap doesn't count or it has to stop (src/session/messages.ts re-exports these). */
export const SESSION_MESSAGES = {
  occupied: "There's already a stone there.",
  suicide: 'That stone would have no liberties. Try another point.',
  ko: "Ko: you can't take back right away. Play somewhere else first.",
  engineLoading: "The engine is still loading, so the teacher can't answer off the book yet. The session stops here.",
  engineFailed: "The engine couldn't answer this position, so the session stops here.",
  noMove: 'The teacher has no move to play, so the session stops here.',
}

export const COPY = {
  appName: 'Go-to-D',
  nav: { label: 'Main', today: 'Today', library: 'Library', settings: 'Settings' },

  board: {
    label: 'Go board',
    keys: 'Arrow keys move, Enter plays.',
    point: (gtp: string) => `Point ${gtp}`,
  },

  engine: {
    loading: "Loading the teacher's engine…",
    ready: 'Engine ready',
    off: 'Engine off (book only)',
    offHelp: "Book moves still get checked. Moves off the book don't, until the engine is back.",
    retry: 'Try again',
  },

  spar: {
    freeTitle: (family: string) => `Free sparring, ${family}`,
    youAre: (c: Color, side: Side) =>
      `You're ${colorName(c)}, ${side === 'defend' ? 'defending the corner' : 'attacking the corner'}.`,
    teacherThinking: 'The teacher is thinking…',
    yourMove: 'Your move.',
    tapAgain: (gtp: string) => `${gtp}? Tap it again to play.`,
    playPoint: (gtp: string) => `Play ${gtp}`,
    playElsewhere: 'Play elsewhere',
    fullBoard: 'Full board',
    cornerView: 'Zoom to corner',
    you: 'You',
    teacher: 'Teacher',
    elsewhere: (gtp: string) => `elsewhere, ${gtp}`,
    movesSoFar: (n: number) => `Moves so far (${n})`,
    done: 'That\'s the end of this line.',
    seeReport: 'See the report',
    saveFailed: "Progress couldn't be saved in this browser.",
    lowConfidence: 'Not 100% sure about this one. Check with a stronger player.',
    unknownPattern: (id: string) => `There's no pattern called "${id}".`,
    unknownFamily: "That corner isn't in the book.",
    backToToday: 'Back to Today',
  },

  verdict: {
    good: 'Good.',
    alternative: 'Also fine.',
    fineOffbook: 'Not the usual move, but it works.',
    fineCost: (lost: number) => (lost > 0 ? `About ${points(lost)} behind the best move.` : ''),
    bookPlays: (gtp: string) => `The book plays ${gtp}.`,
    bookPlaysElsewhere: 'The book plays elsewhere here.',
    unjudged: "The teacher's engine isn't ready, so this move wasn't checked.",
    mistake: "That's a mistake.",
    bigMistake: "That's a big mistake.",
    better: (gtp: string, lost: number | null) =>
      lost === null ? `${gtp} was better.` : `${gtp} was better, by about ${points(lost)}.`,
    betterElsewhere: (lost: number | null) =>
      lost === null ? 'Playing elsewhere was better.' : `Playing elsewhere was better, by about ${points(lost)}.`,
    costOnly: (lost: number) => `It costs about ${points(lost)}.`,
    retry: 'Retry',
    playOn: 'Play on',
    otherJoseki: "Fine, that's joseki too.",
    otherJosekiOne: (name: string) => `It's the start of "${name}". This drill goes another way.`,
    otherJosekiMany: 'It starts other patterns. This drill goes another way.',
    otherJosekiNone: 'This drill goes another way.',
    retryDrill: 'Retry this drill',
    switchOne: 'Switch to that pattern',
    switchTo: (name: string) => `Switch to "${name}"`,
  },

  report: {
    clean: 'Clean run.',
    mistakes: (n: number) => (n === 1 ? 'One mistake this time.' : `${n} mistakes this time.`),
    unfinished: "No mistakes, but the line wasn't finished.",
    right: 'Right',
    wrong: 'Wrong',
    lost: 'Points lost',
    unchecked: 'Not checked',
    nextToday: 'This one is due again today.',
    nextTomorrow: 'It comes back tomorrow.',
    nextIn: (days: number) => `It comes back in ${days} days.`,
    countedFor: (name: string) => `This session counted for "${name}".`,
    nothingScheduled: "This session didn't reach a named pattern, so nothing was scheduled.",
    dueTitle: 'Due today',
    dueNone: 'Nothing else is due today.',
    again: 'Again',
    today: 'Today',
    none: 'No session to report yet.',
    pickDrill: 'Pick a drill',
    side: (side: Side) => (side === 'defend' ? 'defending' : 'attacking'),
  },

  placeholder: {
    todayTitle: 'Today',
    todayBody: 'The full home screen comes next. For now, start with one of these.',
    free: (family: string) => `Free sparring, ${family}`,
    libraryTitle: 'Library',
    patternTitle: 'Pattern',
    drill: (side: Side) => (side === 'defend' ? 'Drill it, defending' : 'Drill it, attacking'),
    settingsTitle: 'Settings',
    settingsBody: 'Thresholds, backup and engine details come next.',
    notFoundTitle: "There's nothing here.",
    notFoundBody: 'That link points nowhere in this app.',
  },
}
