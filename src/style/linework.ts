// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Linework alone: the same functions as "@pogrobert/surfaces",
// drawing only linework, so a page that uses it carries none of the other
// styles. A brand made here is in linework without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { lineworkStyle as linework } from "../styles/linework.ts"

const recipes = { linework }

/** Draws one linework cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "linework" }): Scene => generateWith(recipes, input)

/** A site's brand, in linework: `createBrand({ name, color })`. Its covers draw with linework alone. */
export const createBrand = (choices: BrandChoices & { style?: "linework" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
