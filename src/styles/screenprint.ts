import { BASE_PALETTE } from "../core/palette.ts"
import { compose } from "../grammar/compose.ts"

// A bold mark printed in two flat inks that don't quite line up, on folded
// paper: the brand's colour, and its partner over every other piece. Made
// from the grammar's parts alone, as Stencil is.
export const screenprint = compose({
  style: "screenprint",
  version: 1,
  ground: "paper",
  figure: "tiles",
  fill: "flat",
  relation: "inside",
  process: "press",
  palette: BASE_PALETTE,
})
