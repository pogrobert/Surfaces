import { BASE_PALETTE } from "../core/palette.ts"
import { compose } from "../grammar/compose.ts"

// Layers of cut paper, each lifted a little off the one behind it and casting
// a soft shadow: rainbows, ripples, petals or hills under a sun.
export const papercut = compose({
  style: "papercut",
  version: 1,
  ground: "paper",
  figure: "cut",
  fill: "flat",
  relation: "stacked",
  process: "lift",
  palette: BASE_PALETTE,
})
