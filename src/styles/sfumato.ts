import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { exposure } from "../finishes/index.ts"
import { drift } from "../layouts/drift.ts"
import type { DriftScene } from "../layouts/drift.ts"

// A long exposure through a moving window: two colours, smeared along one line
// of travel, with glowing highlights and film grain. Named for the smoky
// blending of Renaissance painting, where tones melt without a line between
// them. Unlike every other style it is built on a pair of colours.
const SCENES: readonly DriftScene[] = [
  // horizon: a wide field over a low warm band.
  {
    angle: 8,
    turn: 7,
    blobs: [
      { tone: "body", x: 50, y: 4, rx: 86, ry: 34 },
      { tone: "soft", x: 86, y: 34, rx: 52, ry: 16 },
      { tone: "partner", x: 88, y: 92, rx: 62, ry: 17 },
      { tone: "quiet", x: 62, y: 62, rx: 64, ry: 9 },
    ],
    streakTones: ["strong", "partner", "body"],
  },
  // canopy: bright masses thrown across a dark ground.
  {
    angle: -58,
    turn: 18,
    blobs: [
      { tone: "body", x: 86, y: 14, rx: 30, ry: 24 },
      { tone: "partner", x: 56, y: 26, rx: 15, ry: 22 },
      { tone: "soft", x: 72, y: 58, rx: 26, ry: 15 },
      { tone: "strong", x: 92, y: 40, rx: 9, ry: 13 },
    ],
    streakTones: ["partner", "body", "strong"],
  },
  // sky: pale cloud pulled over a warm low light.
  {
    angle: 24,
    turn: 16,
    blobs: [
      { tone: "soft", x: 36, y: 14, rx: 58, ry: 26 },
      { tone: "strong", x: 84, y: 22, rx: 22, ry: 13 },
      { tone: "partner", x: 96, y: 66, rx: 32, ry: 28 },
      { tone: "body", x: 70, y: 40, rx: 32, ry: 14 },
    ],
    streakTones: ["strong", "soft", "partner"],
  },
  // sweep: one long diagonal of colour, its edge lit.
  {
    angle: -32,
    turn: 12,
    blobs: [
      { tone: "body", x: 72, y: 26, rx: 56, ry: 24 },
      { tone: "partner", x: 100, y: 58, rx: 34, ry: 21 },
      { tone: "strong", x: 52, y: 10, rx: 20, ry: 7 },
      { tone: "quiet", x: 92, y: 4, rx: 34, ry: 15 },
    ],
    streakTones: ["strong", "partner", "body"],
  },
]

const PALETTE: PaletteSpec = {
  ...BASE_PALETTE,
  maxChroma: 0.12,
  // A grey brand still gets a colour beside it, or the pair goes flat.
  partnerFloor: 0.08,
  light: {
    ...BASE_PALETTE.light,
    ground: { l: [0.87, 0.905], c: [0.34, 0.44] },
    quiet: { l: [0.74, 0.79], c: [0.44, 0.54] },
    soft: { l: [0.8, 0.84], c: [0.55, 0.7] },
    body: { l: [0.62, 0.69], c: [0.86, 1] },
    strong: { l: [0.44, 0.5], c: [0.8, 0.95], turn: 12 },
    partner: { l: [0.68, 0.74], c: [0.86, 1] },
  },
  dark: {
    ...BASE_PALETTE.dark,
    ground: { l: [0.255, 0.3], c: [0.5, 0.62], turn: 10 },
    quiet: { l: [0.165, 0.195], c: [0.4, 0.5], turn: 10 },
    soft: { l: [0.42, 0.48], c: [0.62, 0.76], turn: 6 },
    body: { l: [0.54, 0.6], c: [0.86, 1] },
    strong: { l: [0.84, 0.89], c: [0.3, 0.42], turn: -14 },
    partner: { l: [0.58, 0.64], c: [0.9, 1] },
  },
}

export const sfumato = defineRecipe({
  style: "sfumato",
  version: 1,
  ranges: {
    jitter: [2, 7],
    scatter: [0.3, 0.8],
    streaks: [2.5, 7],
    streakLength: [180, 420],
    streak: [84, 136],
    warp: [240, 440],
    shade: [0.3, 0.5],
    veil: [0.68, 0.82],
    veilShift: [0.12, 0.52],
    veilTilt: [-22, 22],
    veilRatio: [0.8, 1.25],
    grain: [0.26, 0.38],
  },
  moods: {
    calm: {
      streak: [118, 136],
      streaks: [2.5, 4],
      scatter: [0.3, 0.45],
      grain: [0.26, 0.3],
    },
    bold: { streak: [84, 100], streaks: [5, 7], grain: [0.32, 0.38] },
  },
  grain: {
    smooth: { grain: [0.05, 0.09] },
    heavy: { grain: [0.48, 0.6] },
  },
  // Too soft or busy for a ruler and label: detail "micro" adds the marks alone.
  marksOnly: true,
  palette: PALETTE,

  layout: (context) => drift(context, SCENES, context.p),
  finish(art, { p, rng, theme }) {
    const seeds = rng.fork("exposure")
    const layers = exposure(art, {
      angle: (art as ReturnType<typeof drift>).angle,
      streak: p.streak,
      warp: p.warp,
      // On paper nearly everything is bright, so only the top of it may glow.
      bloom: theme === "dark" ? 0.54 : 0.84,
      seed: seeds.int(1, 999),
      amount: p.grain,
      scale: 0.72,
      grainSeed: seeds.int(1, 9999),
    })
    // The ground is part of the exposure, so when the plate fades in or moves
    // there would be nothing under it but the page. A bare ground goes first
    // on a moving cover: the exposure then builds up out of a blank frame, as
    // film does. A still cover has no need of it and is drawn as before.
    return art.moves?.plate
      ? [{ kind: "fill" as const, id: "backdrop", tone: "ground" as const }, ...layers]
      : layers
  },
})
