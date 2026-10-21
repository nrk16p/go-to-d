// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt
// Trimmed to the types the engine uses (upstream: src/types.ts).

export type BoardSize = 9 | 13 | 19;
export const DEFAULT_BOARD_SIZE: BoardSize = 19;

export type Player = 'black' | 'white';
export type Intersection = Player | null;
export type BoardState = Intersection[][];
export type GameRules =
  | 'japanese'
  | 'chinese'
  | 'korean'
  | 'aga'
  | 'new-zealand'
  | 'tromp-taylor'
  | 'stone-scoring';
export type KataGoBackendPreference = 'wasm' | 'webgpu' | 'cpu';
export type FloatArray = Float32Array | number[];

export interface Move {
    x: number;
    y: number;
    player: Player;
}

export type RegionOfInterest = { xMin: number; xMax: number; yMin: number; yMax: number };
