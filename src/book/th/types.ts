// Thai text for one joseki family. English stays the source of truth in src/book/data/<family>.ts;
// these maps only replace the words. Moves, kinds and weights never live here.

export interface FamilyTh {
  /** Every pattern's English text has a Thai version here (a test holds complete families to it). */
  complete: boolean
  /** Pattern id → Thai name. No board coordinates in names (R36). */
  names: Record<string, string>
  /**
   * Node key (as BookNode.key, e.g. "W:R14/B:O17") → Thai note. Only nodes whose English note isn't
   * empty. Keep every board point the English note names (Q4, R14…): the app turns them with the board.
   */
  notes: Record<string, string>
}
