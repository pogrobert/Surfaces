import { BASE_PALETTE } from "../core/palette.ts"
import { compose } from "../grammar/compose.ts"

// Cloth: threads crossing over and under in plain weave, twill or basket, in
// stripes, checks or a tartan's count, cut to one form.
export const weave = compose({
  style: "weave",
  version: 1,
  ground: "plain",
  figure: "form",
  fill: "weave",
  relation: "inside",
  process: "film",
  palette: {
    ...BASE_PALETTE,
    partnerFloor: 0.08,
    light: { ...BASE_PALETTE.light, partner: { l: [0.64, 0.74], c: [0.75, 0.95] } },
    dark: { ...BASE_PALETTE.dark, partner: { l: [0.56, 0.66], c: [0.75, 0.95] } },
  },
})
