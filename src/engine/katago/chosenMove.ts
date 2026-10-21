// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt
// Trimmed to interpolateEarly, the only part the search uses (the rest picks bot moves).

/**
 * KataGo's chosen-move machinery: how a bot turns a searched root into the move it
 * actually plays. Ported from cpp/search/searchhelpers.cpp
 * (`Search::chooseIndexWithTemperature`, `Search::interpolateEarly`) and the
 * "Average in human policy" block of `Search::getPlaySelectionValues`
 * (cpp/search/searchresults.cpp).
 */

/**
 * KataGo Search::interpolateEarly: `earlyValue` on move 0 decaying to `value`, with
 * the halflife measured in 19x19 moves and rescaled for smaller boards.
 */
export function interpolateEarly(args: {
  halflife: number;
  earlyValue: number;
  value: number;
  turnNumber: number;
  boardWidth: number;
  boardHeight: number;
}): number {
  const { halflife, earlyValue, value, turnNumber } = args;
  if (!(halflife > 0)) return value;
  const rawHalflives = turnNumber / halflife;
  const halflives = (rawHalflives * 19.0) / Math.sqrt(args.boardWidth * args.boardHeight);
  return value + (earlyValue - value) * Math.pow(0.5, halflives);
}
