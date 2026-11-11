import { memo, StrictMode, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { createBrand } from "@pogrobert/surfaces"
import type { Grain, Mood, MotionLevel, StyleName, Theme, Use } from "@pogrobert/surfaces"
import { Cover, Surface } from "@pogrobert/surfaces/react"
import { Dices, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ABOUT, KINDS, LINKS, NAME, ORDER, SAMPLES, SIZES, TITLES } from "./data.ts"
import { Code, GitHubMark, NpmMark, Mend, Picture, ThemeSwitch } from "./parts.tsx"
import { useTheme } from "@/lib/theme"
import "./styles.css"

// The studio: every choice the library has, seen and made. Laid out as a desk:
// the styles in a list, one large picture, every choice beside it, and the
// code that makes it under it. On a phone the styles run in a row.
type Look = { name: string; color: string; partner: string | null; style: StyleName; shape: string | null; mood: Mood | null; grain: Grain; theme: Theme | "auto"; use: Use; motion: MotionLevel | null; title: string; seed: string | null }

// How a size moves when left to itself: a page's header loops, the rest hold still.
const ownMotion = (use: Use): MotionLevel => (use === "hero" ? "loop" : "none")
// What is drawn: the motion asked for, or the size's own, and none at all for a style that holds still.
const motionOf = (look: Look): MotionLevel => (ABOUT[look.style].moves ? look.motion ?? ownMotion(look.use) : "none")

// The desk as an address, so the main page can open it on what it showed and
// a look can be shared: only what differs from the defaults is written.
// It opens following its reader, as a site with a dark mode would have it.
const DEFAULT: Look = { name: SAMPLES[0].name, color: SAMPLES[0].color, partner: null, style: ORDER[0]!, shape: null, mood: null, grain: "natural", theme: "auto", use: "post", motion: null, title: TITLES[0]!, seed: null }
const one = <T extends string>(value: string | null, from: readonly T[]) => (from as readonly string[]).includes(value ?? "") ? (value as T) : null
// The name a colour brings with it: a sample's own, or the default's. The name
// seeds the art, so one that differs is written too, or a shared custom colour
// would open on a different picture.
const nameOf = (color: string) => SAMPLES.find((sample) => sample.color === color)?.name ?? DEFAULT.name
function fromAddress(): Look {
  const asked = new URLSearchParams(location.search)
  const style = one(asked.get("style"), ORDER) ?? DEFAULT.style
  const color = /^#[0-9a-f]{6}$/i.test(asked.get("color") ?? "") ? asked.get("color")!.toLowerCase() : DEFAULT.color
  const name = asked.get("name")
  const partner = asked.get("partner")
  const seed = asked.get("id")
  const title = asked.get("title")
  return {
    name: name !== null && /^[a-z0-9.-]{1,40}$/i.test(name) ? name : nameOf(color),
    color,
    partner: partner !== null && /^#[0-9a-f]{6}$/i.test(partner) ? partner.toLowerCase() : null,
    style,
    shape: one(asked.get("shape"), ABOUT[style].shapes),
    mood: one(asked.get("mood"), ["calm", "bold"] as const),
    grain: one(asked.get("grain"), ["smooth", "natural", "heavy"] as const) ?? DEFAULT.grain,
    theme: one(asked.get("theme"), ["auto", "light", "dark"] as const) ?? DEFAULT.theme,
    use: one(asked.get("size"), SIZES.map((size) => size.use)) ?? DEFAULT.use,
    motion: one(asked.get("motion"), ["none", "once", "loop"] as const),
    title: title !== null && title.length <= 90 ? title : DEFAULT.title,
    seed: seed !== null && /^[a-z0-9-]{1,24}$/i.test(seed) ? seed : null,
  }
}
function toAddress(look: Look) {
  const write = new URLSearchParams({ style: look.style })
  if (look.color !== DEFAULT.color) write.set("color", look.color)
  if (look.name !== nameOf(look.color)) write.set("name", look.name)
  if (look.partner) write.set("partner", look.partner)
  if (look.shape) write.set("shape", look.shape)
  if (look.mood) write.set("mood", look.mood)
  if (look.grain !== DEFAULT.grain) write.set("grain", look.grain)
  if (look.theme !== DEFAULT.theme) write.set("theme", look.theme)
  if (look.use !== DEFAULT.use) write.set("size", look.use)
  if (look.motion) write.set("motion", look.motion)
  if (look.title !== DEFAULT.title) write.set("title", look.title)
  if (look.seed) write.set("id", look.seed)
  return `?${write}`
}

// A look that follows its reader is drawn here in the theme the page is in,
// light or dark, so it changes with the page's own switch.
const drawn = (theme: Look["theme"], dark: boolean): Theme => (theme === "auto" ? (dark ? "dark" : "light") : theme)
const brandOf = (look: Look, dark: boolean) =>
  createBrand({ name: look.name, color: look.color, ...(look.partner ? { partner: look.partner } : null), style: look.style, theme: drawn(look.theme, dark), grain: look.grain, ...(look.shape ? { shape: look.shape } : null), ...(look.mood ? { mood: look.mood } : null) })

// The code that draws what is shown, with only the choices that aren't the default.
// The id goes where a cover's content is: beside its title, into a banner's
// options, or as the content of an input that had none.
function keepId(call: string, seed: string) {
  const id = `id: ${JSON.stringify(seed)}`
  if (call.includes("{ title }")) return call.replace("{ title }", `{ title, ${id} }`)
  if (call.startsWith("brand.banner(")) return call.replace(/ \}\)$/, `, ${id} })`)
  return call.replace(/brand\.input\(("[\w-]+")\)/, `brand.input($1, { ${id} })`)
}

function snippet(look: Look) {
  const options: [string, string][] = [["name", look.name], ["color", look.color], ...(look.partner && ABOUT[look.style].partner ? [["partner", look.partner] as [string, string]] : []), ["style", look.style]]
  if (look.theme !== "light") options.push(["theme", look.theme])
  if (look.grain !== "natural") options.push(["grain", look.grain])
  if (look.shape) options.push(["shape", look.shape])
  if (look.mood) options.push(["mood", look.mood])
  const size = SIZES.find((entry) => entry.use === look.use)!
  // A motion other than the size's own is the input, changed.
  const motion = motionOf(look)
  const call =
    motion === ownMotion(look.use) || !ABOUT[look.style].moves
      ? size.call
      : `generate({ ...brand.input("${look.use}"${size.banner ? "" : ", { title }"}), motion: "${motion}" })`
  // A shuffled drawing is kept by its id, as a post's is by its slug.
  const kept = look.seed ? keepId(call, look.seed) : call
  return `const brand = createBrand({ ${options.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")} })\n${kept}`
}

function useNarrow() {
  // As the CSS has it: max-[1100px] is a width under 1100px.
  const query = "(width < 1100px)"
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const list = matchMedia(query)
    const change = () => setNarrow(list.matches)
    list.addEventListener("change", change)
    return () => list.removeEventListener("change", change)
  }, [])
  return narrow
}

// A choice: one of a row, as a toggle group, so the arrow keys move along it.
// "Any" and "Either" leave the choice to the title's seed.
const ANY = "any"
const on = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
function Choice<T extends string>({ label, value, options, set }: { label: string; value: T | null; options: readonly (readonly [T | null, string])[]; set: (value: T | null) => void }) {
  return (
    <div className="grid gap-[7px]">
      <span className="text-[13px] text-quiet">{label}</span>
      <ToggleGroup type="single" aria-label={label} spacing={1} className="flex-wrap" value={value ?? ANY} onValueChange={(next) => next && set(next === ANY ? null : (next as T))}>
        {options.map(([option, text]) => (
          <ToggleGroupItem key={option ?? ANY} value={option ?? ANY} size="sm" className={`bg-secondary pointer-coarse:h-10 ${on}`}>
            {text}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

// Redrawn only when what it shows changes, not on every letter of a title.
const Styles = memo(function Styles({ look, pick }: { look: Pick<Look, "name" | "color" | "partner" | "theme" | "style">; pick: (style: StyleName) => void }) {
  const narrow = useNarrow()
  // From under the header to the foot of the window, whether or not the page
  // has scrolled: the header is 4rem and sticks too, and the list starts at
  // it, not inside the page's padding. It sticks from a wrapper: the scroll
  // area sets position: relative on itself, which would undo sticky.
  return (
    <div className="sticky top-16 -my-6 h-[calc(100svh-4rem)] max-[1100px]:static max-[1100px]:-mx-4 max-[1100px]:my-0 max-[1100px]:h-auto">
    {/* The browser's own scrolling: a thin bar that shows and fades as the reader's system has it, not one drawn by script. */}
    <div className="h-full overflow-y-auto overscroll-contain [scrollbar-color:var(--rule)_transparent] [scrollbar-width:thin] max-[1100px]:h-auto max-[1100px]:overflow-x-auto max-[1100px]:overflow-y-hidden">
      <ToggleGroup
        type="single"
        aria-label="Styles"
        orientation={narrow ? "horizontal" : "vertical"}
        spacing={0}
        value={look.style}
        onValueChange={(style) => style && pick(style as StyleName)}
        className="grid w-full gap-[18px] py-6 pr-3.5 max-[1100px]:flex max-[1100px]:w-max max-[1100px]:items-start max-[1100px]:gap-5 max-[1100px]:px-4 max-[1100px]:pt-0 max-[1100px]:pb-3"
      >
        {KINDS.map(([kind, styles]) => (
          <div key={kind} role="presentation" className="grid gap-0.5 max-[1100px]:flex max-[1100px]:items-start max-[1100px]:gap-1">
            <h3 className="mb-1 text-[12.5px] font-medium text-quiet max-[1100px]:mr-1 max-[1100px]:mb-0 max-[1100px]:rotate-180 max-[1100px]:self-stretch max-[1100px]:text-right max-[1100px]:[writing-mode:vertical-rl]">{kind}</h3>
            {styles.map((style) => (
              <ToggleGroupItem
                key={style}
                value={style}
                className="grid h-auto w-full grid-cols-[36px_minmax(0,1fr)] justify-normal gap-2.5 rounded-[7px]! py-[3px] pr-2 pl-[3px] text-left font-normal text-body data-[state=on]:bg-muted data-[state=on]:font-semibold data-[state=on]:text-ink max-[1100px]:w-[86px] max-[1100px]:grid-cols-1 max-[1100px]:gap-[5px] max-[1100px]:p-1 max-[1100px]:text-[13px]"
              >
                {/* Each in the colour and theme chosen, so the list shows what a change of colour does to every style. */}
                <Picture input={{ ...createBrand({ name: look.name, color: look.color, ...(look.partner ? { partner: look.partner } : null), style, theme: look.theme }).input("card", { title: "Surfaces", id: "list" }), width: 160, height: 120 }} className="aspect-[4/3] w-full rounded-[2px]" />
                {NAME(style)}
              </ToggleGroupItem>
            ))}
          </div>
        ))}
      </ToggleGroup>
    </div>
    </div>
  )
},
(was, now) => was.pick === now.pick && was.look.name === now.look.name && was.look.color === now.look.color && was.look.partner === now.look.partner && was.look.theme === now.look.theme && was.look.style === now.look.style)

function Shown({ look }: { look: Look }) {
  const { dark } = useTheme()
  const brand = useMemo(() => brandOf(look, dark), [look.name, look.color, look.partner, look.style, look.theme, look.grain, look.shape, look.mood, dark])
  const size = SIZES.find((entry) => entry.use === look.use)!
  // A banner is art alone; the rest are covers with their title on them.
  const motion = motionOf(look)
  if (size.banner) return <Surface {...brand.input(look.use, look.seed ? { id: look.seed } : {})} motion={motion} className="rounded-[3px]" />
  return <Cover brand={brand} use={look.use} title={look.title} id={look.seed ?? "studio"} motion={motion} className="rounded-[3px]" />
}

// The brand's second colour: the one the brand picks by its name, shown in
// Auto, or one of the reader's own. A style in one hue has none to give.
function Partner({ look, set }: { look: Look; set: (change: Partial<Look>) => void }) {
  const picked = useMemo(() => createBrand({ name: look.name, color: look.color, style: look.style }).look.partner, [look.name, look.color, look.style])
  if (!ABOUT[look.style].partner || (look.style === "underpaint" && look.shape === "glow")) {
    return (
      <div className="grid gap-[7px]">
        <span className="text-[13px] text-quiet">Second colour</span>
        <p className="text-body">One hue: this {look.style === "underpaint" && look.shape === "glow" ? "shape" : "style"} draws no second colour.</p>
      </div>
    )
  }
  return (
    <div className="grid gap-[7px]">
      <span className="text-[13px] text-quiet">Second colour</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant={look.partner ? "ghost" : "secondary"}
          size="sm"
          aria-pressed={!look.partner}
          onClick={() => set({ partner: null })}
          className="gap-2 pointer-coarse:h-10"
        >
          <span aria-hidden className="size-3.5 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: picked }} />
          Auto
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <input type="color" aria-label="Any second colour" value={look.partner ?? picked ?? "#000000"} onChange={(event) => set({ partner: event.target.value })} className="size-[30px] border-0 bg-transparent p-0 pointer-coarse:size-11" />
          </TooltipTrigger>
          <TooltipContent>{look.partner ? `Your own: ${look.partner}` : `Auto: ${picked}, picked by the brand's name`}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function Colour({ look, set }: { look: Look; set: (change: Partial<Look>) => void }) {
  const known = SAMPLES.find((entry) => entry.color === look.color)
  return (
    <div className="grid gap-[7px]">
      <span className="text-[13px] text-quiet">Colour</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <ToggleGroup
          type="single"
          aria-label="Colour"
          spacing={1.5}
          value={known?.name ?? ""}
          onValueChange={(name) => {
            const entry = SAMPLES.find((sample) => sample.name === name)
            if (entry) set({ name: entry.name, color: entry.color })
          }}
        >
          {SAMPLES.map((entry) => (
            <Tooltip key={entry.name}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={entry.name}
                  aria-label={`Colour ${entry.color}`}
                  style={{ background: entry.color }}
                  // The tooltip sets its own data-state on the swatch, so its ring
                  // follows aria-checked instead.
                  className="size-[26px] min-w-0 rounded-full! p-0 pointer-coarse:size-10 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] hover:opacity-90 aria-checked:outline-2 aria-checked:outline-solid aria-checked:outline-offset-2 aria-checked:outline-ink"
                />
              </TooltipTrigger>
              <TooltipContent>{entry.color}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <input type="color" aria-label="Any colour" value={look.color} onChange={(event) => set({ color: event.target.value })} className="size-[30px] border-0 bg-transparent p-0 pointer-coarse:size-11" />
          </TooltipTrigger>
          <TooltipContent>Any colour{known ? "" : `: ${look.color}`}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function Studio() {
  // The theme the page is in, for the pictures of a look that follows its reader.
  const { dark } = useTheme()
  const [look, setLook] = useState<Look>(fromAddress)
  useEffect(() => history.replaceState(null, "", toAddress(look)), [look])
  // The next title to try, from the list, after the one shown.
  const anotherTitle = () => set({ title: TITLES[(TITLES.indexOf(look.title) + 1) % TITLES.length]! })
  const set = useCallback((change: Partial<Look>) => setLook((was) => ({ ...was, ...change })), [])
  const pick = useCallback((style: StyleName) => set({ style, shape: null }), [set])
  const banner = SIZES.find((size) => size.use === look.use)!.banner
  const about = ABOUT[look.style]
  // The large picture follows a little behind typing and dragging.
  const shown = useDeferredValue(look)

  return (
    <TooltipProvider delayDuration={300}>
      {/* On a phone the mark alone stands for GitHub and the gaps close up,
          so the header fits a 320px screen with room to spare. */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-[18px] border-b border-rule bg-background px-6 max-[640px]:px-4 max-[480px]:gap-3">
        <a href="/" className="font-bold">Surfaces</a>
        <span className="text-quiet">Studio</span>
        <nav className="-my-2 ml-auto flex items-center gap-2 text-sm text-body">
          <a href={LINKS.github} aria-label="GitHub" className="flex items-center gap-1.5 px-1.5 py-2 max-[480px]:px-2">
            <GitHubMark />
            <span className="max-[480px]:hidden">GitHub</span>
          </a>
          <a href={LINKS.npm} aria-label="npm" className="flex items-center gap-1.5 px-1.5 py-2 max-[480px]:px-2">
            <NpmMark className="size-3.5" />
            <span className="max-[480px]:hidden">npm</span>
          </a>
          <span aria-hidden className="h-5 w-px bg-rule max-[360px]:hidden" />
          <ThemeSwitch />
        </nav>
      </header>
      <div className="grid grid-cols-[200px_minmax(0,1fr)_300px] items-start gap-8 p-6 max-[1100px]:grid-cols-1 max-[1100px]:gap-6 max-[1100px]:p-4">
        <Styles look={{ name: look.name, color: look.color, partner: look.partner, style: look.style, theme: drawn(look.theme, dark) }} pick={pick} />
        <main className="grid gap-[18px]">
          {/* A choice that fails to draw says so where the picture was, and the
              rest of the desk stays; the next choice tries again. */}
          <Mend
            retry={JSON.stringify(shown)}
            fallback={<p className="grid aspect-[16/9] place-items-center rounded-[3px] p-6 text-center text-body tint">This one didn't draw. Try another choice.</p>}
          >
            <Shown look={shown} />
          </Mend>
          <p className="max-w-[62ch] text-pretty text-body">
            <b className="font-semibold text-ink">{NAME(look.style)}.</b> {about.looks} Suits {about.suits[0]!.toLowerCase()}{about.suits.slice(1)}
          </p>
          <Code code={snippet(look)} lang="typescript" />
        </main>
        <aside className="sticky top-22 grid gap-[18px] max-[1100px]:static">
          <Colour look={look} set={set} />
          <Partner look={look} set={set} />
          {about.shapes.length ? (
            <Choice label="Shape" value={look.shape} options={[[null, "Any"], ...about.shapes.map((shape) => [shape, NAME(shape)] as const)]} set={(shape) => set({ shape })} />
          ) : (
            <div className="grid gap-[7px]">
              <span className="text-[13px] text-quiet">Shape</span>
              <p className="text-body">One form; the title's seed varies it.</p>
            </div>
          )}
          <Choice<Mood> label="Mood" value={look.mood} options={[[null, "Either"], ["calm", "Calm"], ["bold", "Bold"]]} set={(mood) => set({ mood })} />
          <Choice<Grain> label="Grain" value={look.grain} options={[["smooth", "Smooth"], ["natural", "Natural"], ["heavy", "Heavy"]]} set={(grain) => grain && set({ grain })} />
          <Choice<Look["theme"]> label="Theme" value={look.theme} options={[["auto", "System"], ["light", "Light"], ["dark", "Dark"]]} set={(theme) => theme && set({ theme })} />
          <Choice<Use> label="Size" value={look.use} options={SIZES.map((size) => [size.use, size.name] as const)} set={(use) => use && set({ use, motion: null })} />
          {/* Motion, for a style that moves; a page's header loops by itself, the rest hold still. */}
          {about.moves ? (
            <Choice<MotionLevel> label="Motion" value={motionOf(look)} options={[["none", "Still"], ["once", "Once"], ["loop", "Loop"]]} set={(motion) => motion && set({ motion })} />
          ) : (
            <div className="grid gap-[7px]">
              <span className="text-[13px] text-quiet">Motion</span>
              <p className="text-body">This style holds still.</p>
            </div>
          )}
          {/* A banner is art alone, so it has no title to type. */}
          <div className="grid gap-[7px]" hidden={banner}>
            <Label htmlFor="title" className="text-[13px] font-normal text-quiet">Title</Label>
            <div className="flex gap-2">
              <Input
                id="title"
                dir="auto"
                value={look.title}
                maxLength={90}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="done"
                onChange={(event) => set({ title: event.target.value })}
                // 16px under a finger, so a phone or a tablet never zooms in to it.
                className="bg-sheet pointer-coarse:text-base"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="secondary" size="icon" aria-label="Another title" onClick={anotherTitle} className="pointer-coarse:size-11">
                    <Dices />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Another title</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {/* Another drawing in the same look: a new id, as another post would
              have, kept in the address and the code so a good one can be kept. */}
          <div className="grid gap-[7px]">
            <span className="text-[13px] text-quiet">Drawing</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => set({ seed: Math.random().toString(36).slice(2, 8) })} className="gap-2 pointer-coarse:h-10">
                <Shuffle />
                Shuffle
              </Button>
              {look.seed ? (
                <>
                  <code className="text-[13px] text-body">id: {look.seed}</code>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set({ seed: null })} className="pointer-coarse:h-10">
                    Back to the first
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  )
}

// Mounted once: a hot reload while editing renders into the same root.
const holder = document.getElementById("root") as HTMLElement & { root?: Root }
;(holder.root ??= createRoot(holder)).render(
  <StrictMode>
    <Studio />
  </StrictMode>
)
