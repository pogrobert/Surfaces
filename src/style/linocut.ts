// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// Surfaces with Linocut alone: the same functions as "@pogrobert/surfaces",
// drawing only linocut, so a page that uses it carries none of the other
// styles. A brand made here is in linocut without saying so.
import { createBrandWith } from "../brand.ts"
import type { Brand, BrandChoices } from "../brand.ts"
import { generateWith } from "../core/generate.ts"
import type { SurfaceInput } from "../core/generate.ts"
import type { Scene } from "../core/scene.ts"
import { linocut } from "../styles/linocut.ts"

const recipes = { linocut }

/** Draws one linocut cover as a `Scene`, as `generate` from "@pogrobert/surfaces" does. Another style throws, naming the import that has it. */
export const generate = (input: SurfaceInput & { style: "linocut" }): Scene => generateWith(recipes, input)

/** A site's brand, in linocut: `createBrand({ name, color })`. Its covers draw with linocut alone. */
export const createBrand = (choices: BrandChoices & { style?: "linocut" }): Brand => createBrandWith(recipes, choices)

export * from "../shared.ts"
