import { BASE_PALETTE } from "../core/palette.ts"
import { compose } from "../grammar/compose.ts"

// Loose paint seen through a stencil: a mark of rounded tiles, each a window
// onto one sheet of wet colour, on folded paper. The first style made only from
// the grammar's parts.
export const stencil = compose({
  style: "stencil",
  version: 1,
  ground: "paper",
  figure: "tiles",
  fill: "paint",
  relation: "inside",
  process: "wash",
  palette: { ...BASE_PALETTE, maxChroma: 0.19 },
})
