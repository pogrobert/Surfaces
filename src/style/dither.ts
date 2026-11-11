// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Dither alone: the same functions as "@pogrobert/surfaces",
// drawing only dither, so a page that uses it carries none of the other
// styles. A brand made here is in dither without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { ditherStyle as dither } from "../styles/dither.ts"

const recipes = { dither }

/** Draws one dither cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "dither" }): Scene => generateWith(recipes, input)

/** A site's brand, in dither: `createBrand({ name, color })`. Its covers draw with dither alone. */
export const createBrand = (choices: BrandChoices & { style?: "dither" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
