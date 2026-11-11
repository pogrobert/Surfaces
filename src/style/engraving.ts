// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Engraving alone: the same functions as "@pogrobert/surfaces",
// drawing only engraving, so a page that uses it carries none of the other
// styles. A brand made here is in engraving without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { engraving } from "../styles/engraving.ts"

const recipes = { engraving }

/** Draws one engraving cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "engraving" }): Scene => generateWith(recipes, input)

/** A site's brand, in engraving: `createBrand({ name, color })`. Its covers draw with engraving alone. */
export const createBrand = (choices: BrandChoices & { style?: "engraving" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
