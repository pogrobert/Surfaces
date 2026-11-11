// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Riso alone: the same functions as "@pogrobert/surfaces",
// drawing only riso, so a page that uses it carries none of the other
// styles. A brand made here is in riso without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { riso } from "../styles/riso.ts"

const recipes = { riso }

/** Draws one riso cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "riso" }): Scene => generateWith(recipes, input)

/** A site's brand, in riso: `createBrand({ name, color })`. Its covers draw with riso alone. */
export const createBrand = (choices: BrandChoices & { style?: "riso" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
