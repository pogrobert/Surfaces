import { BASE_PALETTE } from "../core/palette.ts"
import { compose } from "../grammar/compose.ts"

// Lines drawn along a current, evenly apart, like iron filings round a magnet
// or wind over a map, filling one form.
export const currents = compose({
  style: "currents",
  version: 1,
  ground: "plain",
  figure: "form",
  fill: "flow",
  relation: "inside",
  process: "film",
  palette: BASE_PALETTE,
})
