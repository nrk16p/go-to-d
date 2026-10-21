// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt
// Trimmed: upstream's worker message types are gone (go-to-d has its own worker protocol in
// src/engine/teacher.worker.ts). What is left is the analyze request the engine core takes,
// without the tree-reuse, progress-report and human-SL fields go-to-d does not use.

import type { MctsSearch } from './analyzeMcts';
import type { BoardState, GameRules, Move, Player, RegionOfInterest } from './shared/types';

export interface KataGoAnalyzeRequest {
  board: BoardState;
  previousBoard?: BoardState;
  previousPreviousBoard?: BoardState;
  currentPlayer: Player;
  moveHistory: Move[];
  /** Full exact situational keys for superko, separate from the five NN history moves. */
  repetitionHistory?: readonly string[];
  komi: number;
  rules?: GameRules;
  regionOfInterest?: RegionOfInterest | null;
  topK?: number;
  analysisPvLen?: number;
  wideRootNoise?: number;
  /** KataGo rootPolicyTemperature: above 1 flattens the root policy, widening the search. */
  rootPolicyTemperature?: number;
  nnRandomize?: boolean;
  conservativePass?: boolean;
  /** KataGo fillDameBeforePass: under territory scoring, don't pass while dame remain. */
  fillDameBeforePass?: boolean;
  visits?: number;
  maxTimeMs?: number;
  batchSize?: number;
  maxChildren?: number;
  ownershipMode?: 'none' | 'root' | 'tree';
  /**
   * KataGo avoidMoves: moves the search may not play until `untilDepth` plies from
   * the root. `untilDepth` defaults to 1, which bans the move at the root alone.
   * `player` defaults to whoever is to move.
   */
  avoidMoves?: Array<{ x: number; y: number; player?: Player; untilDepth?: number }>;
  /** KataGo allowMoves: the complement, at most one entry per player. */
  allowMoves?: Array<{ moves: Array<{ x: number; y: number }>; player?: Player; untilDepth?: number }>;
}

/** Root values and per-move scores are from Black's perspective. */
export type KataGoAnalysisPayload = ReturnType<MctsSearch['getAnalysis']>;
