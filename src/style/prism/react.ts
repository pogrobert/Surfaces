// Written by scripts/style-entries.ts, which `pnpm build` runs; edit that instead.
// <Surface> and <Cover> drawing prism alone, as "@pogrobert/surfaces/react"
// does every style: give <Cover> a brand from "@pogrobert/surfaces/prism".
import type { ReactElement } from "react"
import { drawCover, drawSurface } from "../../react.ts"
import type { CoverProps, SurfaceProps } from "../../react.ts"
import { generate } from "../prism.ts"
import type { SurfaceInput } from "../../core/generate.ts"

export type { CoverProps, SurfaceArea, SurfaceProps } from "../../react.ts"

// Drawn as given: another style throws, naming the import that has it.
const draw = (input: SurfaceInput) => generate(input as SurfaceInput & { style: "prism" })

/** The art of one prism cover, filling the element, with content in its areas. */
export function Surface(props: SurfaceProps): ReactElement {
  return drawSurface(draw, props)
}

/** A brand's cover with its title on it: `<Cover brand={brand} title={post.title} />`. */
export function Cover(props: CoverProps): ReactElement {
  return drawCover(Surface, props)
}
