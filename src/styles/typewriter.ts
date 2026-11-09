import { BASE_PALETTE } from "../core/palette.ts"
import { compose } from "../grammar/compose.ts"

// Typewriter art: a form drawn in rows of struck characters, heavier where it
// is darker, as typists drew with the keys they had.
export const typewriter = compose({
  style: "typewriter",
  version: 1,
  ground: "paper",
  figure: "form",
  fill: "type",
  relation: "inside",
  process: "film",
  palette: BASE_PALETTE,
})
