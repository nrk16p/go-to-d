// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt
// Trimmed to getOpponent, the only part the engine uses.

import type { Player } from '../types';

export const getOpponent = (player: Player): Player => player === 'black' ? 'white' : 'black';
