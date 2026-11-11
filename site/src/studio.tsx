import { memo, StrictMode, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { createBrand } from "@pogrobert/surfaces"
import type { Grain, Mood, StyleName, Theme, Use } from "@pogrobert/surfaces"
import { Cover, Surface } from "@pogrobert/surfaces/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ABOUT, KINDS, LINKS, NAME, SAMPLES, SIZES } from "./data.ts"
import { Code, Mend, Picture } from "./parts.tsx"
import "./styles.css"

// The studio: every choice the library has, seen and made. Laid out as a desk:
// the styles in a list, one large picture, every choice beside it, and the
// code that makes it under it. On a phone the styles run in a row.
type Look = { name: string; color: string; style: StyleName; shape: string | null; mood: Mood | null; grain: Grain; theme: Theme; use: Use; title: string }

const brandOf = (look: Look) =>
  createBrand({ name: look.name, color: look.color, style: look.style, theme: look.theme, grain: look.grain, ...(look.shape ? { shape: look.shape } : null), ...(look.mood ? { mood: look.mood } : null) })

// The code that draws what is shown, with only the choices that aren't the default.
function snippet(look: Look) {
  const options: [string, string][] = [["name", look.name], ["color", look.color], ["style", look.style]]
  if (look.theme !== "light") options.push(["theme", look.theme])
  if (look.grain !== "natural") options.push(["grain", look.grain])
  if (look.shape) options.push(["shape", look.shape])
  if (look.mood) options.push(["mood", look.mood])
  const call = SIZES.find((size) => size.use === look.use)!.call
  return `const brand = createBrand({ ${options.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")} })\n${call}`
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
const Styles = memo(function Styles({ look, pick }: { look: Pick<Look, "name" | "color" | "theme" | "style">; pick: (style: StyleName) => void }) {
  const narrow = useNarrow()
  return (
    <ScrollArea className="sticky top-4 h-[calc(100svh-32px)] [&>[data-slot=scroll-area-viewport]]:overscroll-x-contain max-[1100px]:static max-[1100px]:-mx-4 max-[1100px]:h-auto">
      <ToggleGroup
        type="single"
        aria-label="Styles"
        orientation={narrow ? "horizontal" : "vertical"}
        spacing={0}
        value={look.style}
        onValueChange={(style) => style && pick(style as StyleName)}
        className="grid w-full gap-[18px] max-[1100px]:flex max-[1100px]:w-max max-[1100px]:items-start max-[1100px]:gap-5 max-[1100px]:px-4 max-[1100px]:pb-3"
      >
        {KINDS.map(([kind, styles]) => (
          <div key={kind} role="presentation" className="grid gap-0.5 max-[1100px]:flex max-[1100px]:items-start max-[1100px]:gap-1">
            <h3 className="mb-1 text-[12.5px] font-medium text-quiet max-[1100px]:mr-1 max-[1100px]:mb-0 max-[1100px]:rotate-180 max-[1100px]:self-stretch max-[1100px]:text-right max-[1100px]:[writing-mode:vertical-rl]">{kind}</h3>
            {styles.map((style) => (
              <ToggleGroupItem
                key={style}
                value={style}
                className="grid h-auto w-full grid-cols-[36px_minmax(0,1fr)_auto] justify-normal gap-2.5 rounded-[7px]! py-[3px] pr-2 pl-[3px] text-left font-normal text-body data-[state=on]:bg-muted data-[state=on]:font-semibold data-[state=on]:text-ink max-[1100px]:w-[86px] max-[1100px]:grid-cols-1 max-[1100px]:gap-[5px] max-[1100px]:p-1 max-[1100px]:text-[13px]"
              >
                {/* Each in the colour and theme chosen, so the list shows what a change of colour does to every style. */}
                <Picture input={{ ...createBrand({ name: look.name, color: look.color, style, theme: look.theme }).input("card", { title: "Surfaces", id: "list" }), width: 160, height: 120 }} className="aspect-[4/3] w-full rounded-[2px]" />
                {NAME(style)}
                <small className="font-mono text-xs text-quiet max-[1100px]:hidden">{ABOUT[style].shapes.length || ""}</small>
              </ToggleGroupItem>
            ))}
          </div>
        ))}
      </ToggleGroup>
    </ScrollArea>
  )
},
(was, now) => was.pick === now.pick && was.look.name === now.look.name && was.look.color === now.look.color && was.look.theme === now.look.theme && was.look.style === now.look.style)

function Shown({ look }: { look: Look }) {
  const brand = useMemo(() => brandOf(look), [look.name, look.color, look.style, look.theme, look.grain, look.shape, look.mood])
  const size = SIZES.find((entry) => entry.use === look.use)!
  // A banner is art alone; the rest are covers with their title on them.
  if (size.banner) return <Surface {...brand.input(look.use)} className="rounded-[3px]" />
  return <Cover brand={brand} use={look.use} title={look.title} id="studio" motion="none" className="rounded-[3px]" />
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
  const [look, setLook] = useState<Look>({ name: SAMPLES[0].name, color: SAMPLES[0].color, style: "riso", shape: null, mood: null, grain: "natural", theme: "light", use: "post", title: "What we shipped in March" })
  const set = useCallback((change: Partial<Look>) => setLook((was) => ({ ...was, ...change })), [])
  const pick = useCallback((style: StyleName) => set({ style, shape: null }), [set])
  const banner = SIZES.find((size) => size.use === look.use)!.banner
  const about = ABOUT[look.style]
  // The large picture follows a little behind typing and dragging.
  const shown = useDeferredValue(look)

  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex items-center gap-[18px] border-b border-rule px-6 py-4 max-[640px]:px-4">
        <a href="/" className="font-bold">Surfaces</a>
        <span className="text-quiet">Studio</span>
        <nav className="-my-2 ml-auto flex gap-2 text-sm text-body">
          <a href={LINKS.github} className="px-1.5 py-2">GitHub</a>
        </nav>
      </header>
      <div className="grid grid-cols-[200px_minmax(0,1fr)_300px] items-start gap-8 p-6 max-[1100px]:grid-cols-1 max-[1100px]:gap-6 max-[1100px]:p-4">
        <Styles look={look} pick={pick} />
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
        <aside className="sticky top-4 grid gap-[18px] max-[1100px]:static">
          <Colour look={look} set={set} />
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
          <Choice<Theme> label="Theme" value={look.theme} options={[["light", "Light"], ["dark", "Dark"]]} set={(theme) => theme && set({ theme })} />
          <Choice<Use> label="Size" value={look.use} options={SIZES.map((size) => [size.use, size.name] as const)} set={(use) => use && set({ use })} />
          {/* A banner is art alone, so it has no title to type. */}
          <div className="grid gap-[7px]" hidden={banner}>
            <Label htmlFor="title" className="text-[13px] font-normal text-quiet">Title</Label>
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
