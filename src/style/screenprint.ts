// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Screenprint alone: the same functions as "@pogrobert/surfaces",
// drawing only screenprint, so a page that uses it carries none of the other
// styles. A brand made here is in screenprint without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { screenprint } from "../styles/screenprint.ts"

const recipes = { screenprint }

/** Draws one screenprint cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "screenprint" }): Scene => generateWith(recipes, input)

/** A site's brand, in screenprint: `createBrand({ name, color })`. Its covers draw with screenprint alone. */
export const createBrand = (choices: BrandChoices & { style?: "screenprint" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
