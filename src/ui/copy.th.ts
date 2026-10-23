// Every string the owner reads, in Thai: the same keys as copy.en.ts (the Copy type makes a missing
// one a type error). Written fresh in Thai, not word for word: a 3-dan friend sitting next to you,
// short sentences, the words Thai Go players use (the glossary at the top of src/book/th/invade33.ts),
// and "คุณ" only where Thai would say it. Thai has no plural, and numbers stay as plain digits.

import type { Color } from '../go/coords'
import type { Side } from '../session/sides'
import type { Copy, SessionMessages } from './copy.en'

/** "1 แต้ม", "0.5 แต้ม", "3.2 แต้ม". */
export function points(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${s} แต้ม`
}

export const colorName = (c: Color): string => (c === 'black' ? 'ดำ' : 'ขาว')

const sideWord = (side: Side) => (side === 'defend' ? 'ฝ่ายรับ' : 'ฝ่ายบุก')

export const SESSION_MESSAGES: SessionMessages = {
  occupied: 'ตรงนั้นมีหมากอยู่แล้ว',
  suicide: 'วางตรงนั้นหมากจะไม่มีลมเลย ลองจุดอื่น',
  ko: 'ติดโคะ ยังกินคืนทันทีไม่ได้ ไปเล่นที่อื่นก่อนหนึ่งตา',
  engineLoading: 'เอไอยังโหลดไม่เสร็จ ตานอกตำราครูเลยยังตอบไม่ได้ รอบนี้พอแค่นี้ก่อน',
  engineFailed: 'เอไอตอบรูปนี้ไม่ได้ รอบนี้เลยพอแค่นี้',
  noMove: 'ครูไม่มีตาจะเดินต่อแล้ว รอบนี้เลยพอแค่นี้',
}

export const COPY: Copy = {
  appName: 'Go-to-D',
  nav: { label: 'เมนูหลัก', today: 'วันนี้', library: 'คลังท่า', settings: 'ตั้งค่า' },

  board: {
    label: 'กระดานหมากล้อม',
    keys: 'ใช้ลูกศรเลื่อนจุด กด Enter เพื่อวาง',
    point: (gtp) => `จุด ${gtp}`,
  },

  engine: {
    loading: 'กำลังโหลดเอไอของครู…',
    ready: 'เอไอพร้อมแล้ว',
    off: 'เอไอไม่ทำงาน (ใช้แค่ตำรา)',
    offHelp: 'ตาในตำรายังตรวจได้ตามปกติ ส่วนตานอกตำราต้องรอเอไอกลับมาก่อน',
    retry: 'ลองอีกที',
  },

  spar: {
    freeTitle: (family) => `ซ้อมอิสระ ${family}`,
    youAre: (c, side) => `เล่น${colorName(c)} ${side === 'defend' ? 'ฝ่ายรับมุม' : 'ฝ่ายบุกมุม'}`,
    youAreColor: (c) => `เล่น${colorName(c)}`,
    teacherThinking: 'ครูกำลังคิด…',
    yourMove: 'ถึงตาคุณ',
    tapAgain: (gtp) => `${gtp} ใช่ไหม แตะซ้ำอีกทีเพื่อวาง`,
    playPoint: (gtp) => `วาง ${gtp}`,
    playElsewhere: 'ไปเล่นที่อื่น',
    fullBoard: 'ดูทั้งกระดาน',
    cornerView: 'ซูมเข้ามุม',
    you: 'คุณ',
    teacher: 'ครู',
    elsewhere: (gtp) => `เทนุกิไป ${gtp}`,
    movesSoFar: (n) => `ตาที่เล่นไปแล้ว (${n})`,
    done: 'จบลำดับนี้แล้ว',
    seeReport: 'ดูสรุป',
    saveFailed: 'เบราว์เซอร์นี้บันทึกความคืบหน้าไม่ได้',
    lowConfidence: 'อันนี้ไม่ชัวร์ร้อยเปอร์เซ็นต์ ลองถามคนที่เก่งกว่าดูอีกที',
    unknownPattern: (id) => `ไม่มีท่าชื่อ "${id}"`,
    unknownFamily: 'มุมนี้ไม่มีในตำรา',
    noSide: 'ท่านี้ยังไม่มีฝั่งให้ซ้อม',
    backToToday: 'กลับหน้าวันนี้',
    failed: 'มีอะไรผิดพลาด รอบนี้เลยหยุดไป',
    startAgain: 'เริ่มใหม่',
  },

  verdict: {
    good: 'ใช่เลย',
    alternative: 'แบบนี้ก็ได้',
    fineOffbook: 'ไม่ใช่ตาที่เล่นกันปกติ แต่ใช้ได้',
    fineNoBook: 'ตานี้ใช้ได้',
    fineCost: (lost) => (lost > 0 ? `ห่างจากตาที่ดีที่สุดราว ${points(lost)}` : ''),
    bookPlays: (gtp) => `ในตำราเล่น ${gtp}`,
    bookPlaysElsewhere: 'ในตำราตรงนี้เทนุกิ',
    unjudged: 'เอไอของครูยังไม่พร้อม ตานี้เลยยังไม่ได้ตรวจ',
    mistake: 'ตานี้พลาด',
    bigMistake: 'ตานี้พลาดหนัก',
    better: (gtp, lost) => (lost === null ? `${gtp} ดีกว่า` : `${gtp} ดีกว่าราว ${points(lost)}`),
    betterElsewhere: (lost) => (lost === null ? 'เทนุกิดีกว่า' : `เทนุกิดีกว่าราว ${points(lost)}`),
    betterElsewhereAt: (gtp, lost) => (lost === null ? `เทนุกิไป ${gtp} ดีกว่า` : `เทนุกิไป ${gtp} ดีกว่าราว ${points(lost)}`),
    costOnly: (lost) => `เสียไปราว ${points(lost)}`,
    retry: 'ลองใหม่',
    playOn: 'เล่นต่อ',
    otherJoseki: 'ได้ อันนี้ก็โจเซกิเหมือนกัน',
    otherOpening: 'ได้ ตานี้ก็มีในตำราเหมือนกัน',
    otherJosekiOne: (name) => `ตานี้พาไปท่า "${name}" แต่รอบนี้ซ้อมอีกทาง`,
    otherJosekiMany: 'ตานี้พาไปท่าอื่น แต่รอบนี้ซ้อมอีกทาง',
    otherJosekiNone: 'แต่รอบนี้ซ้อมอีกทาง',
    retryDrill: 'ซ้อมท่านี้ใหม่',
    switchOne: 'เปลี่ยนไปซ้อมท่านั้น',
    switchTo: (name) => `เปลี่ยนไปท่า "${name}"`,
  },

  report: {
    clean: 'ไม่พลาดเลยสักตา',
    mistakes: (n) => (n === 1 ? 'รอบนี้พลาดตาเดียว' : `รอบนี้พลาด ${n} ตา`),
    unfinished: 'ไม่พลาด แต่ยังเล่นไม่จบลำดับ',
    right: 'ถูก',
    wrong: 'พลาด',
    lost: 'แต้มที่เสีย',
    unchecked: 'ไม่ได้ตรวจ',
    nextToday: 'ท่านี้วนกลับมาอีกทีวันนี้',
    nextTomorrow: 'พรุ่งนี้ท่านี้จะกลับมาอีกที',
    nextIn: (days) => `อีก ${days} วันท่านี้จะกลับมาอีกที`,
    countedFor: (name) => `รอบนี้นับให้ท่า "${name}"`,
    nothingScheduled: 'รอบนี้ยังไปไม่ถึงท่าไหน เลยไม่ได้นัดทบทวน',
    dueTitle: 'ถึงรอบวันนี้',
    dueNone: 'วันนี้ไม่มีท่าอื่นถึงรอบแล้ว',
    again: 'อีกรอบ',
    today: 'หน้าวันนี้',
    none: 'ยังไม่มีรอบให้สรุป',
    pickDrill: 'เลือกท่าซ้อม',
    side: sideWord,
    subtitle: (title, side) => `${title} · ${sideWord(side)}`,
    dueSide: (side) => ` · ${sideWord(side)}`,
    subtitleColor: (title, c) => `${title} · เล่น${colorName(c)}`,
    dueColor: (c) => ` · เล่น${colorName(c)}`,
  },

  today: {
    title: 'วันนี้',
    lead: (due, fresh, openings = 0) => {
      if (due === 0 && fresh === 0 && openings === 0) return 'วันนี้ไม่มีอะไรค้างแล้ว จะซ้อมข้างล่างหรือเปิดดูคลังท่าก็ได้'
      const parts = [
        due > 0 ? `ทบทวน ${due} ท่า` : '',
        fresh > 0 ? `ท่าใหม่ ${fresh} ท่า` : '',
        openings > 0 ? `เปิดเกมใหม่ ${openings} แบบ` : '',
      ]
      return `${parts.filter(Boolean).join(' แล้วต่อด้วย')} เริ่มจากอันบนสุดเลย`
    },
    streak: 'วันติดกัน',
    mastered: 'คล่องแล้ว',
    openingsStat: 'เปิดเกม',
    masteredValue: (n, total) => `${n} จาก ${total}`,
    dueTitle: 'ถึงรอบทบทวน',
    newTitle: 'ท่าใหม่วันนี้',
    allStarted: 'เล่นมาครบทุกท่าในตำราแล้ว จากนี้ไปก็ทบทวนอย่างเดียว',
    doneNew: 'ท่าใหม่ของวันนี้ครบแล้ว',
    learnOneMore: 'ขอเพิ่มอีกท่า',
    openingsTitle: 'เปิดเกมวันนี้',
    doneOpenings: 'เปิดเกมของวันนี้ครบแล้ว',
    allOpeningsStarted: 'เล่นเปิดเกมมาครบทุกแบบในตำราแล้ว จากนี้ไปก็ทบทวนอย่างเดียว',
    freeOpenings: 'เปิดเกม',
    freeOpeningsBody: 'ตรงนี้เลือกสีเอง ปุ่มสลับข้างบนใช้กับท่ามุมเท่านั้น',
    freeOpening: (family, c) => `${family} · เล่น${colorName(c)}`,
    play: 'เล่น',
    freeTitle: 'ครูเลือกให้',
    freeBody: 'ครูเลือกลำดับให้เอง ไปได้ทุกทางในตำรา ไว้วอร์มก่อนซ้อม หรือเล่นต่อหลังทำรายการวันนี้หมดแล้ว',
    sideGroup: 'ฝั่งที่เล่น',
    sideDefend: 'รับมุม',
    sideAttack: 'บุกมุม',
    iosHintTitle: 'เพิ่มลงหน้าจอโฮม ความคืบหน้าจะได้ไม่หาย',
    iosHintBody:
      'ถ้าไม่ได้เปิดเว็บนี้เกินหนึ่งสัปดาห์ Safari อาจล้างข้อมูลที่เก็บไว้ทิ้ง กดปุ่มแชร์ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม" จากนั้นเปิด Go-to-D จากไอคอนแทน',
    iosHintInApp: 'เปิดหน้านี้ใน Safari ก่อน เบราว์เซอร์ในแอปอย่าง LINE เพิ่มลงหน้าจอโฮมไม่ได้',
    iosHintMove:
      'แอปบนหน้าจอโฮมมองไม่เห็นข้อมูลใน Safari เลยจะเริ่มจากศูนย์ ส่งออกความคืบหน้าในหน้าตั้งค่าก่อน แล้วค่อยไปนำเข้าในแอป',
    iosHintExport: 'ไปส่งออกที่หน้าตั้งค่า',
    iosHintDismiss: 'เข้าใจแล้ว',
  },

  level: (box, mastered) => (box === 0 ? 'ยังไม่ได้เล่น' : mastered ? `คล่องแล้ว ขั้น ${box} จาก 5` : `ขั้น ${box} จาก 5`),
  sideName: (side) => (side === 'defend' ? 'รับมุม' : 'บุกมุม'),
  colorName,

  library: {
    title: 'คลังท่า',
    lead: (n) => `ทั้งหมด ${n} ท่า แตะท่าไหนก็ได้ จะได้ไล่ดูลำดับหลักทีละตา`,
    legend:
      'เล่นท่าไหนครั้งแรกได้หนึ่งจุด พอท่ากลับมาให้ทบทวนแล้วเล่นไม่พลาดก็ได้เพิ่มอีกจุด ถ้าพลาดจะกลับไปเหลือจุดเดียว ครบสี่จุดถือว่าคล่องแล้ว',
    sideShort: (side) => (side === 'defend' ? 'รับ' : 'บุก'),
    openingsTitle: 'เปิดเกม',
    openingsBody: 'ดูทั้งกระดานตั้งแต่ตาแรก ว่าลงตรงไหนและเพราะอะไร',
  },

  pattern: {
    back: 'คลังท่า',
    start: 'รูปเริ่มต้น',
    step: (i, n) => `ตาที่ ${i} จาก ${n}`,
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    move: (c, gtp) => `${colorName(c)} ${gtp}`,
    elsewhere: (c) => `${colorName(c)}เทนุกิ`,
    kind: { mistake: 'ตาพลาด', trick: 'กล', alternative: 'แบบนี้ก็ได้' } as Record<string, string>,
    meta: (family, difficulty) => `${family} · ${difficulty === 1 ? 'ง่าย' : difficulty === 2 ? 'ปานกลาง' : 'ยาก'}`,
    drillTitle: 'ซ้อมท่านี้',
    drill: (side, c) => (side === 'defend' ? `รับมุม เล่น${colorName(c)}` : `บุกมุม เล่น${colorName(c)}`),
    drillColor: (c) => `เล่น${colorName(c)}`,
    oneSide: 'ท่านี้ซ้อมได้ฝั่งเดียว อีกฝั่งเป็นกล ไม่ใช่ท่าที่ควรจำไปเล่น',
    blackOnly: 'เกมต่อเราถือดำ แบบนี้เลยซ้อมฝั่งดำอย่างเดียว',
    emptyBoard: 'กระดานว่าง ดำเดินก่อน',
  },

  watch: {
    lead: (c, side) => `ดูก่อนรอบนึง แล้วค่อยลองเล่นเองเป็น${colorName(c)} ${side === 'defend' ? 'ฝ่ายรับมุม' : 'ฝ่ายบุกมุม'}`,
    leadColor: (c) => `ดูก่อนรอบนึง แล้วค่อยลองเล่นเองเป็น${colorName(c)}`,
    autoPlay: 'เล่นอัตโนมัติ',
    pause: 'หยุด',
    tryIt: 'ลองเล่นเอง',
    watchFirst: 'ดูก่อน',
    watch: 'ดู',
    test: 'ทดสอบ',
  },

  settings: {
    title: 'ตั้งค่า',
    teacherTitle: 'ครู',
    fine: 'ผ่าน ถ้าเสียไม่เกิน',
    fineHelp: 'ตานอกตำราที่เสียไม่เกินเท่านี้ ครูให้ผ่าน',
    big: 'พลาดหนัก ถ้าเสียเกิน',
    pointsLost: 'แต้ม',
    visits: 'เอไอคิดกี่ visits ต่อครั้ง',
    visitsHelp: 'ยิ่งเยอะยิ่งเก่งขึ้นนิดหน่อย แต่ช้าลง ถ้ามือถือช้า เอไอจะหยุดคิดที่ราว 2 วินาทีอยู่ดี',
    newPerDay: 'ท่าใหม่ต่อวัน',
    newOpeningsPerDay: 'เปิดเกมใหม่ต่อวัน',
    save: 'บันทึก',
    saved: 'บันทึกแล้ว',
    saveFailed: 'เบราว์เซอร์นี้ไม่ยอมบันทึก',
    notNumber: 'ทุกช่องต้องเป็นตัวเลข',
    fineBelowBig: 'ค่า "ผ่าน" ต้องน้อยกว่าค่า "พลาดหนัก"',
    fineNegative: 'ค่า "ผ่าน" ติดลบไม่ได้',
    visitsRange: 'จำนวน visits ใส่ได้ตั้งแต่ 16 ถึง 400',
    newRange: 'ท่าใหม่ต่อวันใส่ได้ตั้งแต่ 0 ถึง 10',
    newOpeningsRange: 'เปิดเกมใหม่ต่อวันใส่ได้ตั้งแต่ 0 ถึง 3',

    engineTitle: 'เอไอ',
    backend: 'รันบน',
    model: 'โมเดล',
    backendName: (b) =>
      b === 'webgpu' ? 'การ์ดจอ (WebGPU)' : b === 'wasm' ? 'ซีพียู (WebAssembly)' : b === 'cpu' ? 'ซีพียู โหมดช้า' : b,

    backupTitle: 'สำรองข้อมูล',
    backupBody:
      'ความคืบหน้าเก็บอยู่ในเบราว์เซอร์นี้ที่เดียว และบน iPhone แอปบนหน้าจอโฮมนับเป็นอีกเบราว์เซอร์หนึ่ง ส่งออกเก็บไว้เป็นระยะ แล้วไปนำเข้าในที่ที่จะเล่นต่อ',
    export: 'ส่งออกความคืบหน้า',
    import: 'นำเข้าความคืบหน้า',
    importConfirm: (inFile, now) =>
      `${inFile === 0 ? 'ไฟล์นี้ไม่มีประวัติทบทวนเลย' : `ไฟล์นี้มีประวัติทบทวน ${inFile} รายการ`} ${
        now === 0 ? 'ตอนนี้ยังไม่มีสักรายการ' : `ตอนนี้มีอยู่ ${now} รายการ`
      } เอาของในไฟล์มาแทนทั้งประวัติและการตั้งค่าเลยไหม`,
    importReplace: 'ใช้ของในไฟล์แทน',
    cancel: 'ยกเลิก',
    imported: (n) => (n === 0 ? 'นำเข้าแล้ว ตอนนี้ยังไม่มีประวัติทบทวน' : `นำเข้าแล้ว ตอนนี้มีประวัติทบทวน ${n} รายการ`),
    // importProgress only ever says the file isn't a progress file, and that reason is in English, so
    // Thai says it in its own words instead of quoting it.
    importBad: () => 'ไฟล์นี้ไม่ใช่ไฟล์ความคืบหน้าของ Go-to-D ของเดิมยังอยู่เหมือนเดิม',
    importUnreadable: 'เปิดไฟล์นี้ไม่ได้ ของเดิมยังอยู่เหมือนเดิม',
    importSaveFailed: 'เบราว์เซอร์นี้ไม่ยอมบันทึก ของเดิมยังอยู่เหมือนเดิม',

    resetTitle: 'เริ่มใหม่หมด',
    resetBody: 'ล้างประวัติทบทวนทั้งหมดกับวันติดกัน ส่วนการตั้งค่าข้างบนยังอยู่',
    reset: 'ล้างความคืบหน้า',
    resetConfirm: (n) =>
      n === 0
        ? 'ยังไม่มีประวัติทบทวน ล้างวันติดกันเลยไหม'
        : `ล้างประวัติทบทวน ${n} รายการกับวันติดกันเลยไหม ถ้าอาจอยากได้คืน ส่งออกเก็บไว้ก่อน`,
    resetYes: 'ล้างทั้งหมด',
    resetDone: 'ล้างแล้ว',
    resetFailed: 'เบราว์เซอร์นี้ไม่ยอมบันทึก ยังไม่ได้ล้างอะไร',

    langTitle: 'ภาษา',
    langHelp: 'เลือกแล้วหน้าจะโหลดใหม่เป็นภาษานั้น',
  },

  notFound: {
    title: 'ไม่มีหน้านี้',
    body: 'ลิงก์นี้ไม่ได้พาไปหน้าไหนในแอป',
  },

  broken: {
    title: 'หน้านี้มีปัญหา',
    body: 'ความคืบหน้ายังอยู่เหมือนเดิม กลับไปหน้าวันนี้แล้วเล่นต่อได้เลย',
  },
}
