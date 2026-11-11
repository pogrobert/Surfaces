import { StrictMode, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { createBrand } from "@pogrobert/surfaces"
import { Surface } from "@pogrobert/surfaces/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { INIT, NAME, ORDER, PROMPT, sample } from "./data.ts"
import { Code, CopyButton } from "./parts.tsx"
import "./styles.css"

// The main page: one plate, a picture the size of the window, stepping through
// the thirty styles, and under it only a paragraph, how to install, and the way
// to the studio. Everything you can choose is in the studio.
const SAY = "Pictures for every page of your site, drawn from one colour."
const SUB = "Post covers, link previews, headers. Thirty styles, each yours to tune."

// The window's shape, so the plate is drawn to it and not cropped from another.
function useWindow() {
  const read = () => ({ w: innerWidth, h: innerHeight })
  const [size, setSize] = useState(read)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const resize = () => (clearTimeout(timer), (timer = setTimeout(() => setSize(read()), 200)))
    addEventListener("resize", resize)
    return () => (clearTimeout(timer), removeEventListener("resize", resize))
  }, [])
  return size
}

// A stepper button, its key named in its tooltip.
function Step({ by, label, keyName, children }: { by: number; label: string; keyName: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} data-step={by}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label} <Kbd>{keyName}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

function Plate() {
  const [at, setAt] = useState(ORDER.indexOf("riso"))
  const step = (by: number) => setAt((i) => (i + by + ORDER.length) % ORDER.length)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element).closest?.("input, textarea")) return
      if (event.key === "ArrowRight") step(1)
      if (event.key === "ArrowLeft") step(-1)
    }
    addEventListener("keydown", key)
    return () => removeEventListener("keydown", key)
  }, [])
  const view = useWindow()
  // On a narrow window the controls can't stand over the art beside the
  // words, so the art stops short of them and they sit on the page below it.
  const narrow = view.w <= 860
  const below = narrow ? 120 : 0
  const height = Math.max(600, Math.min(2400, Math.round((2400 * Math.max(view.h * (narrow ? 0.86 : 1), 520) - 2400 * below) / Math.max(view.w, 1))))
  const style = ORDER[at]!
  const { areas, ...input } = useMemo(() => createBrand({ name: sample(at).name, color: sample(at).color, style }).input("post", { title: SAY, id: "home", text: "bottom-left" }), [at])
  const links = ["Studio", "Docs", "GitHub"]

  return (
    <section className="relative h-svh min-h-[520px] max-[860px]:h-[86svh]">
      <Surface
        {...input}
        width={2400}
        height={height}
        css={{ position: "absolute", inset: 0, bottom: below, aspectRatio: "auto" }}
        // The name and the links go in areas of their own, which the art keeps
        // clear and gives an ink that reads there, as it does the words.
        areas={[
          {
            ...areas![0]!,
            content: (
              <h1 className="text-[clamp(34px,5cqw,84px)] leading-[0.98] font-[680] tracking-[-0.035em] text-balance">
                {SAY}
                <small className="mt-[0.7em] block text-[max(15px,0.24em)] leading-[1.35] font-medium tracking-[-0.005em] opacity-80">{SUB}</small>
              </h1>
            ),
          },
          { place: "top-left", size: "sm", content: <b className="text-[15px] tracking-[-0.01em]">Surfaces</b> },
          {
            place: "top-right",
            size: "sm",
            content: (
              <nav className="-mt-1.5 -mr-2.5 flex gap-1 max-[860px]:hidden">
                {links.map((link) => (
                  <Button key={link} variant="ghost" asChild className="text-current opacity-85 hover:bg-current/10 hover:text-current hover:opacity-100">
                    <a href={link === "Studio" ? "/studio/" : "#"}>{link}</a>
                  </Button>
                ))}
              </nav>
            ),
          },
        ]}
      />
      <div
        className="absolute right-6 bottom-[22px] flex items-center gap-3 max-[860px]:right-4 max-[860px]:bottom-4 max-[860px]:left-4 max-[860px]:flex-wrap"
        onClick={(event) => {
          const by = (event.target as Element).closest<HTMLElement>("[data-step]")?.dataset.step
          if (by) step(Number(by))
        }}
      >
        <div className="flex items-center gap-0.5 rounded-xl bg-background p-1 ring-1 ring-border">
          <Step by={-1} label="The style before" keyName="←">
            <ChevronLeft />
          </Step>
          <span className="min-w-[132px] text-center font-mono text-[13px] whitespace-pre">{`${NAME(style)}  ${String(at + 1).padStart(2, "0")}/${ORDER.length}`}</span>
          <Step by={1} label="The next style" keyName="→">
            <ChevronRight />
          </Step>
        </div>
        <Button variant="outline" size="lg" asChild>
          <a href="/studio/">See all thirty in the studio</a>
        </Button>
        <CopyButton text={PROMPT} size="lg">Copy prompt</CopyButton>
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
          <a href="#">Docs</a>
          <a href="#">GitHub</a>
          <a href="#">npm</a>
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
