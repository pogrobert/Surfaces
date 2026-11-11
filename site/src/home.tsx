import { StrictMode, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"
import { createRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { createBrand } from "@pogrobert/surfaces"
import type { StyleName } from "@pogrobert/surfaces"
import { Surface } from "@pogrobert/surfaces/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { INIT, LINKS, NAME, ORDER, PROMPT, sample } from "./data.ts"
import { Code, CopyButton, Mend } from "./parts.tsx"
import "./styles.css"

// The main page: one plate, a picture the size of the window, stepping through
// the thirty styles, and under it only a paragraph, how to install, and the way
// to the studio. Everything you can choose is in the studio.
const SAY = "Pictures for every page of your site, drawn from one colour."
const SUB = "Post covers, link previews, headers. Thirty styles, each yours to tune."
const round = (n: number) => Math.round(n / 4) * 4
// The shape a style shows on the plate where its seed's own pick is not the
// one to open the page with: Stencil opens it, on its grid of tiles.
const SHAPE: Partial<Record<StyleName, string>> = { stencil: "grid" }

// An element's own size, to the nearest 4px, so a change too small to see
// draws nothing again. The plate is measured, not the window: a phone's
// window grows and shrinks as its address bar hides on scroll, and the plate
// (sized in svh) does not.
function useSize(element: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const target = element.current
    if (!target) return
    const read = (w: number, h: number) => setSize((was) => (was && was.w === round(w) && was.h === round(h) ? was : { w: round(w), h: round(h) }))
    const box = target.getBoundingClientRect()
    read(box.width, box.height)
    const watch = new ResizeObserver(([entry]) => entry && read(entry.contentRect.width, entry.contentRect.height))
    watch.observe(target)
    return () => watch.disconnect()
  }, [])
  return size
}

// A stepper button, its key named in its tooltip.
function Step({ by, label, keyName, children }: { by: number; label: string; keyName: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} data-step={by} className="transition-[scale] hover:bg-(--on)/10 hover:text-(--on) pointer-coarse:size-11">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label} <Kbd>{keyName}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

function Words({ ink, studio, refer }: { ink: { on: string; off: string }; studio: string; refer?: (element: HTMLDivElement | null) => void }) {
  return (
    <div ref={refer} className="grid justify-items-start" style={{ "--on": ink.on, "--off": ink.off } as CSSProperties}>
      <h1 className="text-[clamp(34px,5cqw,84px)] leading-[0.98] font-[680] tracking-[-0.035em] text-balance">{SAY}</h1>
      <p className="mt-[0.9em] text-[clamp(15px,1.2cqw,24px)] leading-[1.35] font-medium tracking-[-0.005em] opacity-80">{SUB}</p>
      {/* What to do next, with the words that say why, as a hero has it. They
          change colour with the art, at once, never after it. */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        <CopyButton text={PROMPT} size="lg" className="bg-(--on) px-4 text-(--off) transition-[scale] hover:bg-(--on)/85">Copy prompt</CopyButton>
        <Button variant="outline" size="lg" asChild className="border-(--on)/20 bg-(--off)/90 px-4 text-(--on) transition-[scale] hover:bg-(--off) hover:text-(--on) dark:border-(--on)/20 dark:bg-(--off)/90 dark:hover:bg-(--off)">
          <a href={studio}>See all thirty in the studio</a>
        </Button>
      </div>
    </div>
  )
}

function Plate() {
  const [at, setAt] = useState(0)
  // The counter moves at once; the picture follows as soon as it is drawn.
  const shown = useDeferredValue(at)
  const plate = useRef<HTMLElement>(null)
  const step = (by: number) => setAt((i) => (i + by + ORDER.length) % ORDER.length)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
      // A held key draws nothing more, and with a modifier an arrow is the
      // browser's (Alt or Cmd and ← is Back). Nor does a key step a plate
      // that has been scrolled away, or one typed into a field.
      if (event.repeat || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
      if ((event.target as Element).closest?.("input, textarea, select, [contenteditable]")) return
      if ((plate.current?.getBoundingClientRect().bottom ?? 0) <= 0) return
      step(event.key === "ArrowRight" ? 1 : -1)
    }
    addEventListener("keydown", key)
    return () => removeEventListener("keydown", key)
  }, [])

  const size = useSize(plate)
  const w = size?.w ?? 1
  // On a narrow window the stepper can't stand over the art beside the
  // words, so the art stops short of it and it sits on the page below.
  const narrow = w < 860
  const below = narrow ? 64 : 0
  const tall = Math.max((size?.h ?? 1) - below, 1)
  // Drawn to the plate's own shape, however tall a phone makes it.
  const height = Math.max(600, Math.min(8192, Math.round((2400 * tall) / w)))
  const style = ORDER[shown]!
  const input = useMemo(() => {
    const { areas: _, ...rest } = createBrand({ name: sample(shown).name, color: sample(shown).color, style, ...(SHAPE[style] ? { shape: SHAPE[style] } : null) }).input("post", { title: SAY, id: "home", text: "bottom-left" })
    return rest
  }, [shown])

  // Every box is measured in pixels of the plate and kept a twentieth of the
  // canvas at least and a fiftieth in from its edges, as the library asks.
  const share = (value: number, of: number, least = 0.02) => Math.max(least, value / of)
  const box = (x: number, y: number, bw: number, bh: number) => {
    const across = Math.min(share(bw, w, 0.05), 0.96)
    return { x: Math.min(share(x, w), 0.98 - across), y: share(y, tall), w: across, h: share(bh, tall, 0.05) }
  }
  const edge = narrow ? 16 : 24
  // The words' room is as tall as the words are, so on a phone, a short
  // window or at a large zoom the art keeps clear of all of them, not of a
  // fixed share they spill out of. It hangs from the foot, below the header.
  // The words appear only once the plate is measured, so they are watched
  // from the moment their element arrives.
  const [words, setWords] = useState<HTMLDivElement | null>(null)
  const [wordsH, setWordsH] = useState(0)
  useLayoutEffect(() => {
    if (!words) return
    setWordsH(round(words.getBoundingClientRect().height))
    const watch = new ResizeObserver(([entry]) => entry && setWordsH(round(entry.contentRect.height)))
    watch.observe(words)
    return () => watch.disconnect()
  }, [words])
  const left = share(narrow ? 24 : 0.06 * w, w)
  const across = narrow ? 1 - 2 * left : 0.6
  const foot = narrow ? 1 - share(20, tall) : 0.9
  const room = Math.max(0.05, foot - share(70, tall))
  // On a wide window the words keep the whole left side, from under the
  // header to the foot, so the art takes the right side whole, large, and is
  // not pressed into the band above them. On a phone the art stands above the
  // words, so they keep only as much as they are tall.
  const high = narrow ? Math.min(room, Math.max(0.05, wordsH ? (wordsH + 8) / tall : 0.34)) : room
  const wordsBox = { x: left, y: foot - high, w: across, h: high }

  // The buttons and the stepper take their colours from the ink the art
  // chose for the words, solid in it or on a face of its opposite, so they
  // read on a dark plate as on a pale one, whatever the page's own theme.
  const [ink, setInk] = useState({ on: "#121212", off: "#ffffff" })
  useLayoutEffect(() => {
    if (!words) return
    const seen = getComputedStyle(words).color
    // rgb() in 0 to 255, or color(srgb) in 0 to 1.
    const scale = seen.startsWith("color(") ? 255 : 1
    const [r = 0, g = 0, b = 0] = (seen.match(/[\d.]+/g) ?? []).map((n) => Number(n) * scale)
    const on = `rgb(${r} ${g} ${b})`
    const off = 0.2126 * r + 0.7152 * g + 0.0722 * b > 128 ? "#121212" : "#ffffff"
    setInk((was) => (was.on === on && was.off === off ? was : { on, off }))
  }, [words, shown, height, w, wordsH])

  // The studio opens on the style, shape and colour the plate shows.
  const studio = `/studio/?${new URLSearchParams({ style, ...(SHAPE[style] ? { shape: SHAPE[style] } : null), color: sample(shown).color })}`
  const links = [["Studio", studio], ["GitHub", LINKS.github]] as const
  return (
    <section ref={plate} className="relative h-svh min-h-[max(520px,25vw)] max-[860px]:h-[86svh]">
      {size && (
        <Mend
          retry={shown}
          fallback={
            // A style that fails to draw leaves the words on plain ground.
            <div className="absolute inset-0 tint" style={{ bottom: below }}>
              <div className="absolute" style={{ left: `${wordsBox.x * 100}%`, bottom: `${(1 - foot) * 100}%`, width: `${wordsBox.w * 100}%` }}>
                <Words ink={{ on: "var(--ink)", off: "var(--paper)" }} studio={studio} />
              </div>
            </div>
          }
        >
          <Surface
            {...input}
            width={2400}
            height={height}
            css={{ position: "absolute", inset: 0, bottom: below, aspectRatio: "auto" }}
            areas={[
              {
                box: wordsBox,
                // The words sit at the foot of their room, however tall it is.
                content: (
                  <div className="flex h-full flex-col justify-end">
                    <Words ink={ink} studio={studio} refer={setWords} />
                  </div>
                ),
              },
              // The name and the links stand where a page's header does.
              { box: box(edge, 14, 120, 40), content: <b className="flex h-full items-center text-[15px] tracking-[-0.01em]">Surfaces</b> },
              ...(narrow
                ? []
                : [
                    {
                      box: box(w - edge - 250, 14, 250, 40),
                      content: (
                        <nav className="-mr-2.5 flex h-full w-full items-center justify-end gap-1">
                          {links.map(([name, href]) => (
                            <Button key={name} variant="ghost" asChild className="cursor-pointer text-current opacity-85 hover:bg-current/10 hover:text-current hover:opacity-100">
                              <a href={href}>{name}</a>
                            </Button>
                          ))}
                        </nav>
                      ),
                    },
                  ]),
            ]}
          />
        </Mend>
      )}
      <div
        className="absolute right-6 bottom-[22px] max-[860px]:right-4 max-[860px]:bottom-3 max-[860px]:left-4"
        onClick={(event) => {
          const by = (event.target as Element).closest<HTMLElement>("[data-step]")?.dataset.step
          if (by) step(Number(by))
        }}
      >
        {/* Over the art it wears the words' colours; below it, on a phone, the page's. */}
        <div
          className={`flex w-fit items-center gap-0.5 rounded-xl p-1 ring-1 ${narrow ? "bg-background ring-border [--on:var(--ink)]" : "bg-(--off)/90 text-(--on) ring-(--on)/15"}`}
          style={narrow ? undefined : ({ "--on": ink.on, "--off": ink.off } as CSSProperties)}
        >
          <Step by={-1} label="The style before" keyName="←">
            <ChevronLeft />
          </Step>
          {/* As wide as the longest name, so the arrows never move under the pointer. */}
          <span className="w-[19ch] text-center font-mono text-[13px] whitespace-pre">{`${NAME(ORDER[at]!)}  ${String(at + 1).padStart(2, "0")}/${ORDER.length}`}</span>
          <Step by={1} label="The next style" keyName="→">
            <ChevronRight />
          </Step>
        </div>
      </div>
    </section>
  )
}

function Home() {
  return (
    <TooltipProvider delayDuration={300}>
      <Plate />
      <div className="mx-auto max-w-[1240px] px-6 pt-24 pb-[72px] max-[640px]:px-4">
        <p className="max-w-[54ch] text-[21px] leading-[1.42] tracking-[-0.008em] text-pretty text-body">
          <b className="font-semibold text-ink">Surfaces draws the pictures a site repeats</b>: the cover of each post, the preview of each link, the header of each profile. One colour in, one look out, and the same title always gets the same picture. The words stay yours, in your own type. No image model, no API key, nothing to pay.
        </p>
        <div className="mt-11 grid grid-cols-2 gap-x-10 gap-y-3.5 max-[860px]:grid-cols-1">
          <div>
            <p className="mb-2 text-body">Ask your coding agent.</p>
            <Code code={PROMPT} />
          </div>
          <div>
            <p className="mb-2 text-body">Or run it yourself.</p>
            <Code code={INIT} lang="bash" />
          </div>
        </div>
        <Button variant="link" asChild className="mt-7 h-auto px-0 text-[17px] font-semibold text-ink underline decoration-1 underline-offset-[5px]">
          <a href="/studio/">Every style and every choice, in the studio →</a>
        </Button>
        <footer className="mt-24 flex flex-wrap gap-x-[22px] gap-y-2 border-t border-rule pt-[18px] text-sm text-quiet">
          <span>Surfaces · MIT No Attribution</span>
          <a href="/studio/">Studio</a>
          <a href={LINKS.github}>GitHub</a>
          <a href={LINKS.npm}>npm</a>
        </footer>
      </div>
    </TooltipProvider>
  )
}

// Mounted once: a hot reload while editing renders into the same root.
const holder = document.getElementById("root") as HTMLElement & { root?: Root }
;(holder.root ??= createRoot(holder)).render(
  <StrictMode>
    <Home />
  </StrictMode>
)
