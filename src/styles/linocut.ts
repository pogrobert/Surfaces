import { BASE_PALETTE } from "../core/palette.ts"
import { compose } from "../grammar/compose.ts"

// A relief print: one bold form cut from a block, the gouge's strokes printing
// as paper, rolled in one ink and pressed.
export const linocut = compose({
  style: "linocut",
  version: 1,
  ground: "paper",
  figure: "form",
  fill: "gouge",
  relation: "inside",
  process: "block",
  palette: BASE_PALETTE,
})
