// Every string the owner reads, in English, in one place: short, like a stronger friend talking.
// Book notes live in the book; everything else is here. Apostrophes are straight on purpose:
// two lines below are fixed word for word by the plan. copy.th.ts has the same shape (the Copy type
// below), and copy.ts picks one of the two when the app loads.

import type { Side } from '../session/sides'
import type { Color } from '../go/coords'

/** "no reviews", "1 review", "3 reviews". */
export function count(n: number, noun: string): string {
  return n === 0 ? `no ${noun}s` : n === 1 ? `1 ${noun}` : `${n} ${noun}s`
}

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
    noSide: "This pattern can't be drilled from either side yet.",
    backToToday: 'Back to Today',
    failed: 'Something went wrong and this session stopped.',
    startAgain: 'Start again',
  },

  verdict: {
    good: 'Good.',
    alternative: 'Also fine.',
    fineOffbook: 'Not the usual move, but it works.',
    /** The same verdict once play is off the book: there is no usual move any more. */
    fineNoBook: 'That works.',
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
    /** The better move is a point away from the corner. */
    betterElsewhereAt: (gtp: string, lost: number | null) =>
      lost === null ? `Playing elsewhere at ${gtp} was better.` : `Playing elsewhere at ${gtp} was better, by about ${points(lost)}.`,
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
    subtitle: (title: string, side: Side) => `${title}, ${side === 'defend' ? 'defending' : 'attacking'}.`,
    dueSide: (side: Side) => `, ${side === 'defend' ? 'defending' : 'attacking'}`,
  },

  today: {
    title: 'Today',
    lead: (due: number, fresh: number) => {
      if (due === 0 && fresh === 0) return 'Nothing left on the list today. Spar below, or look through the Library.'
      const parts = [due > 0 ? `${count(due, 'review')} due` : '', fresh > 0 ? count(fresh, 'new pattern') : '']
      return `${parts.filter(Boolean).join(', then ')}. Start at the top.`
    },
    streak: 'Day streak',
    mastered: 'Mastered',
    masteredValue: (n: number, total: number) => `${n} of ${total}`,
    dueTitle: 'Reviews due',
    newTitle: 'New today',
    allStarted: "You've started every pattern in the book. From here it's reviews.",
    doneNew: "That's today's new ones.",
    learnOneMore: 'Learn one more',
    play: 'Play',
    freeTitle: "Teacher's choice",
    freeBody: 'The teacher picks the line, any branch in the book. Good as a warm-up, or once the list is done.',
    sideGroup: 'Your side',
    sideDefend: 'Defending',
    sideAttack: 'Attacking',
    iosHintTitle: "Add to Home Screen so your progress isn't wiped",
    iosHintBody:
      "Safari can clear a site's saved data after a week without a visit. Tap Share, then Add to Home Screen, and open Go-to-D from the icon.",
    iosHintInApp: "Open this page in Safari first. The browser inside apps like LINE can't add it to the Home Screen.",
    iosHintMove:
      "The Home Screen app can't see Safari's data, so it starts empty. Export your progress in Settings first, then Import it in the app.",
    iosHintExport: 'Export in Settings',
    iosHintDismiss: 'Got it',
  },

  /** The 0-5 review box, as dots. */
  level: (box: number, mastered: boolean) =>
    box === 0 ? 'Not played yet' : mastered ? `Mastered, level ${box} of 5` : `Level ${box} of 5`,
  sideName: (side: Side) => (side === 'defend' ? 'Defending' : 'Attacking'),

  library: {
    title: 'Library',
    lead: (n: number) => `${n} patterns. Tap one to step through its main line.`,
    legend:
      'A pattern gets its first dot the first time you play it, and one more each time it comes back and you play it clean. A mistake takes it back to one. Four dots counts as mastered.',
    sideShort: (side: Side) => (side === 'defend' ? 'Defend' : 'Attack'),
  },

  pattern: {
    back: 'Library',
    start: 'Start position',
    step: (i: number, n: number) => `Move ${i} of ${n}`,
    prev: 'Previous',
    next: 'Next',
    move: (c: Color, gtp: string) => `${colorName(c)} ${gtp}`,
    elsewhere: (c: Color) => `${colorName(c)} plays elsewhere`,
    kind: { mistake: 'Mistake', trick: 'Trick', alternative: 'Also fine' } as Record<string, string>,
    meta: (family: string, difficulty: number) =>
      `${family}, ${difficulty === 1 ? 'easy' : difficulty === 2 ? 'medium' : 'hard'}`,
    drillTitle: 'Drill it',
    drill: (side: Side, c: Color) => (side === 'defend' ? `Defend as ${colorName(c)}` : `Attack as ${colorName(c)}`),
    oneSide: "Only one side to drill here. The other side's line is a trick, not something to copy.",
  },

  /** Watch first, then test (R45): the teacher plays the line through once, then the owner plays it. */
  watch: {
    lead: (c: Color, side: Side) =>
      `Watch it once, then you play ${colorName(c)}, ${side === 'defend' ? 'defending' : 'attacking'} the corner.`,
    autoPlay: 'Auto-play',
    pause: 'Pause',
    tryIt: 'Try it yourself',
    watchFirst: 'Watch first',
    watch: 'Watch',
    test: 'Test',
  },

  settings: {
    title: 'Settings',
    teacherTitle: 'Teacher',
    fine: 'Fine up to',
    fineHelp: 'An off-book move that loses this much or less passes.',
    big: 'Big mistake over',
    pointsLost: 'points lost',
    visits: 'Engine visits per search',
    visitsHelp: 'More is a bit stronger and slower. A slow phone stops at about 2 seconds anyway.',
    newPerDay: 'New patterns a day',
    save: 'Save',
    saved: 'Saved.',
    saveFailed: "This browser wouldn't save it.",
    notNumber: 'Every box needs a number.',
    fineBelowBig: 'Fine has to be smaller than big mistake.',
    fineNegative: "Fine can't be below 0.",
    visitsRange: 'Visits go from 16 to 400.',
    newRange: 'New patterns a day go from 0 to 10.',

    engineTitle: 'Engine',
    backend: 'Runs on',
    model: 'Network',
    backendName: (b: string) =>
      b === 'webgpu' ? 'Graphics chip (WebGPU)' : b === 'wasm' ? 'Processor (WebAssembly)' : b === 'cpu' ? 'Processor, slow mode' : b,

    backupTitle: 'Backup',
    backupBody:
      'Your progress lives in this browser only, and on iPhone the Home Screen app counts as a separate browser. Export a copy now and then, and Import it wherever you play next.',
    export: 'Export progress',
    import: 'Import progress',
    importConfirm: (inFile: number, now: number) =>
      `This file has ${count(inFile, 'review')}. You have ${count(now, 'review')} now. Replace your reviews and settings with the file's?`,
    importReplace: 'Replace my progress',
    cancel: 'Cancel',
    imported: (n: number) => `Imported. You now have ${count(n, 'review')}.`,
    importBad: (why: string) => `${why}. Your progress is unchanged.`,
    importUnreadable: "That file couldn't be opened. Your progress is unchanged.",
    importSaveFailed: "This browser wouldn't save it. Your progress is unchanged.",

    resetTitle: 'Start over',
    resetBody: 'Clears every review and the streak. These settings stay.',
    reset: 'Reset progress',
    resetConfirm: (n: number) => `Clear ${count(n, 'review')} and the streak? Export first if you might want them back.`,
    resetYes: 'Clear it all',
    resetDone: 'Progress cleared.',
    resetFailed: "This browser wouldn't save it. Nothing was cleared.",

    langTitle: 'Language',
    langHelp: 'The page reloads in the language you pick.',
  },

  notFound: {
    title: "There's nothing here.",
    body: 'That link points nowhere in this app.',
  },

  /** A screen that failed to draw (ScreenBoundary). */
  broken: {
    title: 'Something went wrong on this page.',
    body: 'Your progress is safe. Go back to Today and carry on.',
  },
}

/** A value's shape with every literal string widened to `string`, so another language's words fit it. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T

/** The shape every language's COPY has. A key missing from another language is a type error. */
export type Copy = Widen<typeof COPY>

export type SessionMessages = Widen<typeof SESSION_MESSAGES>
