// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Currents alone: the same functions as "@pogrobert/surfaces",
// drawing only currents, so a page that uses it carries none of the other
// styles. A brand made here is in currents without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { currents } from "../styles/currents.ts"

const recipes = { currents }

/** Draws one currents cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "currents" }): Scene => generateWith(recipes, input)

/** A site's brand, in currents: `createBrand({ name, color })`. Its covers draw with currents alone. */
export const createBrand = (choices: BrandChoices & { style?: "currents" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
