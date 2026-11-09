# The grammar

Started 2026-11-06. Internal for now: nothing here is in the public input, and
`docs/api.md` is unchanged.

## Why

Hand-built styles grow one at a time, and each new look seen elsewhere means a
new recipe. Most of those looks are new combinations of a few decisions, not
new drawings. The grammar names the decisions, so a new look is usually a new
combination, and a new answer to one decision works with every other.

## Layers

| Layer | Question | Parts so far |
|---|---|---|
| ground | What is it printed on? | `plain`, `paper` (warm stock, one fold) |
| figure | What is the subject? | `tiles` (grid, corner, halves, pair, arch, bars, steps), `form` (one shape drawn true: orb, pill, slab, arch, dome, quarter), `cut` (layers of paper: rainbow, ripples, frames, hills) |
| fill | What is the ink? | `paint` (torn blots in three coats), `flat`, `gouge` (a block with lines cut from it), `type` (typewriter characters), `flow` (lines along a current), `weave` (threads over and under), `stone` (terrazzo chips) |
| relation | How do figure and fill meet? | `inside` (fill seen through the figure), `cutout` (figure cut from a slab of fill), `stacked` (layers laid one on the next, deepening) |
| process | How was it reproduced? | `film`, `wash` (soft inside, sharp edge), `plate` (one-ink aquatint), `press` (two inks out of line, Riso's own print), `lift` (cut paper casting soft shadows), `block` (a relief print, its cuts left as paper) |

Shapes are the primitives a designer's shape kit is made of: circles, pills,
squares, arches, domes, quarter circles. None is a sign: no crescents, crosses,
stars, or marks that turn about their middle in hooks, since each reads as one
people's or one faith's somewhere in the world.

Each part brings its own ranges, mood and grain narrowing, and the parts it
avoids (`src/grammar/parts.ts`). `compose()` (`src/grammar/compose.ts`) turns
one answer per layer into an ordinary `Recipe`. Validation, alt text, the
catalog and every renderer then treat it like any other recipe. It refuses
clashing parts, naming the fix.

A style is a preset: one combination, looked at and named. Stencil is the
first (`paper`, `tiles`, `paint`, `inside`, `wash`); Screenprint the second
(`paper`, `tiles`, `flat`, `inside`, `press`), built from Riso's print finish
ported as a process. Papercut, linocut, currents and terrazzo followed, each
adding a part or two.

Typewriter and weave began as presets too, and are now written whole
(`src/layouts/typewriter.ts`, `src/layouts/weave.ts`): sharing one figure made
them look alike, and a style's character is its own subjects. They still use
the shared toolkit (`src/grammar/kit.ts`, `seated.ts`), the paper ground and
the film and lift processes. The `type` and `weave` fills stay in the grammar
as parts.

## The judge

`src/core/judge.ts` decides whether a cover is fit to show, from the scene
alone: content reads at 4.5:1, the art is neither blank nor a wall, and the
subject stays out of every area. The hand-built styles' tests use its
measures. `test/grammar.test.ts` holds every combination `compose()` allows
to it, at every common size, both themes and every figure, so opening a
combination never costs the promise that every seed is good.

## Next

1. Port hand-built styles onto parts where they really come apart: their
   finishes are already processes in all but name (`print`, `plate`,
   `focus`, `exposure`, `smear` in `src/finishes`). Keep output identical:
   replay `test/golden.json` before and after.
2. More parts: figures from the existing subjects, fills from halftone dots,
   lines and marbling, a riso press that misregisters whole pieces.
3. The judge at draw time: a few seeded candidates per cover, the best one
   kept, so a combination needs less hand-narrowing.
4. Only then, and only if the owner reopens `docs/api.md`: brand regions
   (lock some layers, let the seed vary the rest) and per-layer overrides in
   the public input.
