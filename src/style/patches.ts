// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Patches alone: the same functions as "@pogrobert/surfaces",
// drawing only patches, so a page that uses it carries none of the other
// styles. A brand made here is in patches without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { patches } from "../styles/patches.ts"

const recipes = { patches }

/** Draws one patches cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "patches" }): Scene => generateWith(recipes, input)

/** A site's brand, in patches: `createBrand({ name, color })`. Its covers draw with patches alone. */
export const createBrand = (choices: BrandChoices & { style?: "patches" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
