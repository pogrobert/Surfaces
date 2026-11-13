// Draws every picture the launch film shows, with Surfaces, in dark mode, and bakes
// each to a PNG once, so a frame of the film is bitmaps moved about and costs little.
// The film: a wall of styles, then one cover filling the frame with a post's title
// on it, and after it post after post: each style, each colour with its title in
// another place, and the shapes one post takes.
// Run after `pnpm build`:  node video/art.mjs
import { createHash } from "node:crypto"
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { catalog, createBrand, generate, toHtml, toSvg } from "../dist/index.js"
import { openChrome, pause } from "./chrome.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, "out")
for (const dir of ["svg", "png", "fonts"]) mkdirSync(join(OUT, dir), { recursive: true })

const SITE = "harbour.dev"
const THEME = "dark"
// The title typed at the start, on one line, and the style it is typed on: Endpaper, whose pattern stands clear
// of the middle and leaves a plain ground to type on. (Marbling, with its paper label, was there first and not liked full frame.)
const TYPED_SHAPE = "bubble"
const TITLE = "The quiet launch"
const COLOUR = "#ff6c2f"
// Then the menu steps through these, each style with a post of its own. The last is the style the colours are shown in.
const STYLES = [
  ["endpaper", TITLE],
  ["riso", "Introducing dark mode"],
  ["screenprint", "How we cut our build time in half"],
  ["strata", "What we shipped in November"],
  ["currents", "Why we rewrote search from scratch"],
  ["halftone", "Hiring our first designer"],
  ["patches", "Ten years of open source"],
  ["mezzotint", "A field guide to slow mornings"],
  ["underpaint", "On keeping things small"],
  ["fluted", "Notes from our team offsite"],
  ["chrome", "Meet the new editor"],
  ["linocut", "Shipping on Fridays"],
  ["prism", "Year in review"],
  ["papercut", "The case for boring technology"],
]
// Every other style under the last, so the list is the thirty its head says it is.
const MORE = catalog.map((entry) => entry.style).filter((style) => !STYLES.some(([shown]) => shown === style))
// Then the colours, each with a post of its own and its title in a different place; the shapes that follow are the last one's.
const COLOURS = [
  [COLOUR, STYLES.at(-1)[1], "center"],
  ["#f5a50b", "A better way to onboard", "bottom-left"],
  ["#00a95c", "What we learned from 10,000 users", "top-left"],
  ["#00838a", "Why our docs are open source", "right"],
  ["#7c3aed", "Designing for the first five minutes", "bottom"],
  ["#f15060", "Changelog: faster exports", "top-right"],
  ["#0078bf", "Our pricing, explained", "bottom-left"],
]
const NAME = (word) => word[0].toUpperCase() + word.slice(1)

const pictures = new Map()
const picture = (prefix, scene, width) => {
  const svg = toSvg(scene)
  const name = `${prefix}-${createHash("sha1").update(svg).update(`${width}`).digest("hex").slice(0, 10)}`
  pictures.set(name, { svg, width, height: Math.round((width * scene.size.h) / scene.size.w) })
  const area = scene.areas[0]
  return {
    src: `out/png/${name}.png`,
    ratio: scene.size.w / scene.size.h,
    ink: scene.ink,
    ground: scene.palette.ground,
    ...(area ? { area: { x: area.x / scene.size.w, y: area.y / scene.size.h, w: area.width / scene.size.w, h: area.height / scene.size.h } } : {}),
  }
}
// A moving cover's first frame, before anything in it has moved, as a picture: the page is baked with its animations held at their start.
const first = (html, width, height) => {
  const name = `first-${createHash("sha1").update(html).update(`${width}`).digest("hex").slice(0, 10)}`
  pictures.set(name, { html, width, height })
  return `out/png/${name}.png`
}
const brandOf = (style, colour, shape) => createBrand({ name: SITE, color: colour, style, theme: THEME, ...(shape ? { shape } : {}) })

// A post's cover, with room kept for its title in one place: what the film needs to show it and set the words on it.
// A title in the middle gets the cover's large calm place; one at an edge gets a medium one, which leaves the art about half the frame.
// `moves` asks for the cover as the library moves it too (motion: "once", through toHtml): its markup, when its first part starts
// (`skip`) and its last part ends (`end`), in seconds of its own clock, and its first frame as a picture.
const cover = (title, style, colour, place = "center", shape, moves = false) => {
  const input = brandOf(style, colour, shape).input("post", { title, text: place })
  const sized = place === "center" ? input : { ...input, areas: input.areas.map((area) => ({ ...area, size: "md" })) }
  const made = { title, place, ...picture("cover", generate(sized), 1920) }
  if (!moves) return made
  const html = toHtml(generate({ ...sized, motion: "once" }))
  const parts = [...html.matchAll(/animation:\S+ ([\d.]+)s cubic-bezier\([^)]*\) ([\d.]+)s/g)].map(([, dur, delay]) => [Number(delay), Number(delay) + Number(dur)])
  if (!parts.length) throw new Error(`${style} does not move: choose a style with moves: true in catalog for a cover that should.`)
  return { ...made, live: { html, skip: Math.min(...parts.map(([from]) => from)), end: Math.max(...parts.map(([, to]) => to)), first: first(html, 1920, 1080) } }
}

// --- The one cover: in each style, then in each colour -------------------------------------------
// Two of them move, once, as the library moves a cover: the one the title is typed on, and the last colour's, which becomes the card.
const styles = STYLES.map(([style, title], i) => ({ style, name: NAME(style), ...cover(title, style, COLOUR, "center", i === 0 ? TYPED_SHAPE : undefined, i === 0) }))
const colours = COLOURS.map(([hex, title, place], i) => ({ hex, ...cover(title, STYLES.at(-1)[0], hex, place, undefined, i === COLOURS.length - 1) }))

// --- The last post in the other shapes a site shows it in ---------------------------------------
const last = brandOf(STYLES.at(-1)[0], COLOURS.at(-1)[0])
const shapes = {
  og: { title: COLOURS.at(-1)[1], ...picture("shape", last.og({ title: COLOURS.at(-1)[1] }), 1400) },
  banner: picture("shape", last.banner({ for: "x" }), 1500),
}

// --- The wall the film opens and closes on: six columns of eight ---------------------------------
const COLS = 6
const ROWS = 8
const WALL_COLOURS = ["#0078bf", "#f15060", "#00a95c", "#7c3aed", "#ff6c2f", "#00838a", "#f5a50b"]
const WALL_TITLES = [TITLE, "Introducing dark mode", "What we shipped in November", "Why we rewrote search from scratch", "Hiring our first designer", "Ten years of open source", "A field guide to slow mornings", "On keeping things small", "The quiet launch", "Notes from our team offsite"]
// The places seen whole once the lens has pulled back: thirty of them, one for each style.
const inView = (col, row) => (col % 2 === 0 ? row >= 1 && row <= 5 : row >= 2 && row <= 6)
// The wall pulls back from the first of these and pushes in to the second.
const OPENS_ON = { col: 2, row: 3 }
const TYPED_ON = { col: 3, row: 4 }
// And at the end it pulls back until the X header is the picture in this place.
const ENDS_ON = { col: 4, row: 3 }
// The film's first frame: a pane of ribbed glass, lit coral and blue.
const OPENING = { style: "fluted", shape: "panel", color: "#f15060" }
const opening = picture("wall-opening", generate({ ...OPENING, seed: "Introducing Surfaces", theme: THEME, mood: "bold", width: 1600, height: 900 }), 1920)
// The wall, column by column, top to bottom, chosen by eye from every style in every shape: each style in the shape that is
// most its own, no two that could be taken for each other side by side, the quiet ones (hairlines, still lifes, light trails)
// kept apart, and the places at the edges, seen only in part, given second shapes of the boldest styles. "light" is a light tile.
const WALL = [
  ["papercut hills light", "riso trio light", "linework globe light", "papercut rainbow", "mezzotint jug", "patches cluster", "riso sunset", "prism ring"],
  ["riso arches", "screenprint grid", "engraving orb", "screenprint bars light", "trails sweep", "terrazzo tile", "halftone bubble", "strata disc"],
  ["halftone tile", "chrome orb", "swatchbook scatter light", "OPENS", "currents vortex", "stencil corner", "marbling combed", "papercut frames"],
  ["stencil steps light", "dither waves", "prism folds", "dither ring", "TYPED", "aquatint ring", "weave strap light", "endpaper leaf"],
  ["engraving ripple", "underpaint aura", "linocut sprig light", "marbling swirl", "typewriter initial", "strata pair", "chrome capsule", "patches row"],
  ["weave swatch", "currents obstacle", "glass capsule", "sfumato", "photocopy page", "moire light", "dashes hills", "linocut mark light"],
]
const wall = WALL.map((column, col) =>
  column.map((entry, row) => {
    if (entry === "OPENS") return opening.src
    // The cover the title will be typed on stands on the wall as it is before it has drawn itself.
    if (entry === "TYPED") return styles[0].live.first
    const [style, ...rest] = entry.split(" ")
    const light = rest.at(-1) === "light"
    const shape = rest.filter((word) => word !== "light")[0]
    // Colours step by two across and three down: the nearest tile in a tile's own colour is two columns away.
    return picture("wall", generate({ style, ...(shape ? { shape } : {}), seed: WALL_TITLES[(col * 3 + row) % WALL_TITLES.length], color: WALL_COLOURS[(col * 2 + row * 3) % WALL_COLOURS.length], theme: light ? "light" : THEME, mood: "bold", width: 1600, height: 900 }), 960).src
  }),
)
// What stands in the typed title's place when the wall comes back at the end: the same pattern, whole, with no room kept for words.
const wallLater = picture("wall", generate({ style: STYLES[0][0], shape: TYPED_SHAPE, seed: `${SITE}/${TITLE}`, color: COLOUR, theme: THEME, width: 1600, height: 900 }), 960).src
// "30 styles" has to be true of what is on screen: every style of the catalog, once each, in the places seen whole.
{
  const seen = WALL.flatMap((column, col) => column.filter((_, row) => inView(col, row)).map((entry) => (entry === "OPENS" ? OPENING.style : entry === "TYPED" ? STYLES[0][0] : entry.split(" ")[0])))
  const missing = catalog.map((entry) => entry.style).filter((style) => !seen.includes(style))
  const twice = seen.filter((style, i) => seen.indexOf(style) !== i)
  if (WALL.length !== COLS || WALL.some((column) => column.length !== ROWS) || missing.length || twice.length) throw new Error(`The wall's thirty places in view must hold each style once. Missing: ${missing.join(", ") || "none"}. Twice: ${twice.join(", ") || "none"}.`)
}

writeFileSync(join(OUT, "manifest.js"), `window.ART = ${JSON.stringify({ site: SITE, styles, more: MORE.map(NAME), colours, shapes, wall, wallLater, opensOn: OPENS_ON, typedOn: TYPED_ON, endsOn: ENDS_ON }, null, 1)}\n`)
const FONTS = "../site/node_modules/@fontsource-variable"
for (const face of ["next", "mono"]) {
  const file = `atkinson-hyperlegible-${face}-latin-wght-normal.woff2`
  copyFileSync(join(HERE, FONTS, `atkinson-hyperlegible-${face}/files/${file}`), join(OUT, "fonts", file))
}

// Bake what is not baked yet, one picture, one page, one at a time; and clear out what the film no longer shows.
for (const dir of ["png", "svg"]) for (const file of readdirSync(join(OUT, dir))) if (!pictures.has(file.replace(/\.(png|svg)$/, ""))) rmSync(join(OUT, dir, file))
const todo = [...pictures].filter(([name]) => !existsSync(join(OUT, "png", `${name}.png`)))
console.log(`${pictures.size} pictures, ${todo.length} to bake`)
if (todo.length) {
  const chrome = await openChrome()
  const page = join(OUT, "bake.html")
  try {
    for (const [i, [name, { svg, html, width, height }]] of todo.entries()) {
      if (html) {
        writeFileSync(page, `<!doctype html><body style="margin:0;background:#000"><div style="width:${width}px;height:${height}px">${html}</div>`)
        await chrome.goto(pathToFileURL(page).href)
        await chrome.run(`for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0 } new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))`)
      } else {
        writeFileSync(join(OUT, "svg", `${name}.svg`), svg)
        writeFileSync(page, `<!doctype html><body style="margin:0;background:#000"><img src="svg/${name}.svg" style="display:block;width:${width}px;height:${height}px">`)
        await chrome.goto(pathToFileURL(page).href)
      }
      writeFileSync(join(OUT, "png", `${name}.png`), await chrome.picture({ x: 0, y: 0, width, height }))
      if ((i + 1) % 20 === 0 || i + 1 === todo.length) console.log(`  ${i + 1}/${todo.length}  Chrome holds ${chrome.memory()} MB`)
      await pause(40)
    }
  } finally {
    await chrome.close()
  }
}
process.exit(0)
