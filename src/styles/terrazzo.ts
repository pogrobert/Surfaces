import { BASE_PALETTE } from "../core/palette.ts"
import { compose } from "../grammar/compose.ts"

// Terrazzo: chips of stone in the brand's colours and its partner set in a
// pale ground and ground flat, cut to one form.
export const terrazzo = compose({
  style: "terrazzo",
  version: 1,
  ground: "plain",
  figure: "form",
  fill: "stone",
  relation: "inside",
  process: "film",
  palette: {
    ...BASE_PALETTE,
    partnerFloor: 0.08,
    light: { ...BASE_PALETTE.light, partner: { l: [0.64, 0.74], c: [0.75, 0.95] } },
    dark: { ...BASE_PALETTE.dark, partner: { l: [0.56, 0.66], c: [0.75, 0.95] } },
  },
})
