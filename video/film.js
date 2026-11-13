// The launch film, as a page that can show any moment of itself: film.seek(t)
// places everything for second t and nothing else moves it, so a frame is the
// same however it is reached. video/capture.mjs asks for each frame in turn.
// Open film.html?t=12.4 to look at one moment; the bar under the stage scrubs.
//
// The film: one cover, the lens pulls back to the wall of thirty styles, pushes in
// to another cover, a post's title is typed into it, and then post after post goes
// by, each with its own title: in style after style, then in colour after colour
// with the title in a different place each time, then one post in the shapes a
// site shows it in, before the wall comes back under the name and the one command.
;(() => {
  const ART = window.ART
  const stage = document.getElementById("stage")

  // --- Small tools -------------------------------------------------------------------------
  const clamp = (x, low = 0, high = 1) => Math.min(high, Math.max(low, x))
  // How far through a stretch starting at `from` and lasting `dur` seconds, 0 to 1.
  const through = (t, from, dur) => clamp((t - from) / dur)
  const mix = (a, b, p) => a + (b - a) * p
  const ease = {
    out: (p) => 1 - (1 - p) ** 3,
    outSoft: (p) => 1 - (1 - p) ** 5,
    in: (p) => p ** 3,
    inOut: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
    back: (p) => 1 + 2 * (p - 1) ** 3 + 1 * (p - 1) ** 2,
    smooth: (p) => p * p * (3 - 2 * p),
  }
  // A CSS cubic-bezier as a function of progress, so the film can use the curves motion on the web is tuned with.
  const bezier = (x1, y1, x2, y2) => (p) => {
    if (p <= 0 || p >= 1) return clamp(p)
    let low = 0
    let high = 1
    let u = p
    for (let i = 0; i < 26; i++) {
      u = (low + high) / 2
      if (3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3 < p) low = u
      else high = u
    }
    return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3
  }
  // By role: what arrives runs out long and soft; what moves across the frame gathers and settles hard.
  ease.arrive = bezier(0.16, 1, 0.3, 1)
  ease.move = bezier(0.77, 0, 0.175, 1)
  const el = (html) => {
    const holder = document.createElement("template")
    holder.innerHTML = html.trim()
    return holder.content.firstElementChild
  }
  const img = (src) => `<img src="${src}" alt="" decoding="sync">`
  const show = (node, on) => {
    node.style.display = on ? "" : "none"
    return on
  }
  // Something that rises in at `at` and lifts away at `out` (never, if not given). `keep` leaves its room in the layout while it is away.
  const enter = (node, t, at, out, { dur = 0.5, outDur = 0.25, rise = 1.2, keep = false } = {}) => {
    const on = t >= at && (out == null || t < out + outDur)
    if (keep) node.style.visibility = on ? "" : "hidden"
    else show(node, on)
    if (!on) return false
    const a = ease.arrive(through(t, at, dur))
    const b = out == null ? 0 : ease.in(through(t, out, outDur))
    node.style.opacity = a * (1 - b)
    node.style.transform = `translateY(${mix(rise, 0, a) - rise * 0.6 * b}cqw)`
    return true
  }

  // --- When things happen, in seconds ------------------------------------------------------
  const PULL = 0.5
  const PULL_DUR = 1.25
  const THIRTY = [PULL + PULL_DUR - 0.2, 2.85] // the chip lands as the pull back settles, not during it
  const PUSH = 3.0
  const PUSH_DUR = 1.15
  const ON = PUSH + PUSH_DUR // the one cover is the frame from here
  // The same unevenness every run: a number from 0 to 1 for the nth key.
  const uneven = (n) => {
    const x = Math.sin(n * 91.7 + 13.1) * 43758.5453
    return x - Math.floor(x)
  }
  // The title is typed quickly, on its own cover, into the place that cover keeps for it.
  const TEXT = ART.styles[0].title
  const KEYS = []
  {
    // One line, at a steady quick pace: a key every twentieth of a second, give or take a little, so it reads as a hand and not a machine.
    let at = ON + 0.4
    for (const [i] of [...TEXT].entries()) KEYS.push((at += 0.046 + 0.012 * uneven(i)))
  }
  const TYPED = KEYS.at(-1)
  const DRAWN = TYPED + 0.45 // the title has been read once
  const MENU = DRAWN + 0.25
  // The menu steps from style to style, quicker through the middle of the list.
  // Never faster than five a second: under that a title is a flicker, not a word.
  const HOLDS = [0.4, 0.32, 0.26, 0.22, 0.2, 0.2, 0.2, 0.2, 0.22, 0.26, 0.32, 0.42]
  const STEPS = [MENU + 0.5]
  for (const hold of HOLDS.slice(0, ART.styles.length - 2)) STEPS.push(STEPS.at(-1) + hold)
  const MENU_OUT = STEPS.at(-1) + 0.7
  // Then the colours, each drawn across the last and held long enough to see where its title sits.
  const WIPE = 0.38
  // No two wipes in a row come from the same side.
  const SIDES = ["right", "left", "down", "right", "up", "left"]
  // What a wipe has drawn so far of the new picture, and what it has left of the old, as clip-paths.
  const drawnBy = (side, p) => ({ right: `inset(0 ${(1 - p) * 100}% 0 0)`, left: `inset(0 0 0 ${(1 - p) * 100}%)`, down: `inset(0 0 ${(1 - p) * 100}% 0)`, up: `inset(${(1 - p) * 100}% 0 0 0)` })[side]
  const leftBy = (side, p) => ({ right: `inset(0 0 0 ${p * 100}%)`, left: `inset(0 ${p * 100}% 0 0)`, down: `inset(${p * 100}% 0 0 0)`, up: `inset(0 0 ${p * 100}% 0)` })[side]
  const TINTS = ART.colours.slice(1).map((_, i) => MENU_OUT + 0.3 + i * 0.78)
  // Then the cover becomes a card, and the card the other shapes.
  const SHAPES = TINTS.at(-1) + WIPE + 1.15
  // Two covers move as the library moves them (motion: "once"): the one the title is typed on draws itself as the lens comes in,
  // and the last colour's builds once its wipe has brought it. `at` is when each starts, `rate` how much faster than its own clock.
  const MOVING = new Map([
    [ART.styles[0].src, { at: PUSH + 0.3, rate: 1.4 }],
    [ART.colours.at(-1).src, { at: TINTS.at(-1) + 0.1, rate: 1.8 }],
  ])
  const SHRINK = 0.85
  const MORPH = 0.55
  const OG = SHAPES + SHRINK + 0.85
  const BANNER = OG + MORPH + 0.95
  const END = BANNER + MORPH + 1.05
  // The end: the lens pulls back from the X header as it is, until it is one picture on the wall among all the covers;
  // the name comes up on a card over them, the command typed into its field.
  const BACK = END
  const BACK_DUR = 1.25
  const LOGO = BACK + BACK_DUR - 0.2
  const COMMAND = "npx @pogrobert/surfaces init"
  const COMMAND_KEYS = [...COMMAND].map((_, i) => LOGO + 0.5 + i * 0.026 + 0.012 * uneven(i + 50))
  const DURATION = Math.ceil((COMMAND_KEYS.at(-1) + 3.4) * 10) / 10
  // What the sound is told of (video/sound.mjs): each thing that happens, and when.
  const CUES = [
    { at: PULL, kind: "pull", dur: PULL_DUR },
    { at: THIRTY[0], kind: "chip" },
    { at: PUSH, kind: "push", dur: PUSH_DUR },
    ...KEYS.map((at) => ({ at, kind: "key" })),
    { at: MENU, kind: "menu" },
    ...STEPS.map((at) => ({ at, kind: "step" })),
    ...TINTS.map((at, i) => ({ at, kind: "wipe", dur: WIPE, side: SIDES[i % SIDES.length] })),
    { at: SHAPES, kind: "shrink", dur: SHRINK },
    { at: OG, kind: "wipe", dur: MORPH, side: "left" },
    { at: BANNER, kind: "wipe", dur: MORPH, side: "right" },
    { at: BACK, kind: "pull", dur: BACK_DUR },
    { at: END, kind: "end", lands: LOGO - END },
    ...COMMAND_KEYS.map((at) => ({ at, kind: "key" })),
  ]

  // --- The stage's furniture ---------------------------------------------------------------
  const wall = el(`<div class="wall">${ART.wall.map((col) => `<div class="col">${col.map(img).join("")}</div>`).join("")}</div>`)
  const big = el(`<p class="big"><span>30 styles</span></p>`)
  // Every post the one frame shows: its cover, and its title set where that cover keeps room for it.
  // They are stacked; one is seen at a time, two while a colour is drawn across.
  const posts = [...new Map([...ART.styles, ...ART.colours].map((cover) => [cover.src, cover])).values()]
  const typedPost = ART.styles[0]
  const letters = (text) => [...text].map((ch) => `<span class="ch">${ch}</span>`).join("")
  const setting = ({ place, area }) => {
    const across = place.includes("left") ? ["flex-start", "left"] : place.includes("right") ? ["flex-end", "right"] : ["center", "center"]
    const down = place.includes("top") ? "flex-start" : place.includes("bottom") ? "flex-end" : "center"
    return `left:${area.x * 100}%;top:${area.y * 100}%;width:${area.w * 100}%;height:${area.h * 100}%;justify-content:${across[0]};text-align:${across[1]};align-items:${down}`
  }
  const card = el(`<div class="card">
    <div class="frame"><div class="art">${posts.map((cover) => img(cover.src)).join("")}</div>${posts
      .map((post) => `<div class="words"><div class="title" style="${setting(post)}"><span>${post === typedPost ? `${letters(post.title)}` : post.title}</span></div></div>`)
      .join("")}</div>
    <div class="shape og">${img(ART.shapes.og.src)}<div class="on"><span>${ART.shapes.og.title}</span></div></div>
    <div class="shape banner">${img(ART.shapes.banner.src)}</div>
  </div>`)
  const [frame, og, banner] = card.children
  const art = frame.querySelector(".art")
  const ogTitle = og.querySelector(".on")
  const pictureOf = Object.fromEntries(posts.map((cover, i) => [cover.src, art.children[i]]))
  // The moving covers, live: the library's own markup, its animations held and set to the moment by the film's clock.
  const liveOf = Object.fromEntries(
    posts.filter((post) => post.live).map((post) => {
      const node = el(`<div class="live">${post.live.html}</div>`)
      art.append(node)
      const { at, rate } = MOVING.get(post.src)
      return [post.src, { node, at, rate, skip: post.live.skip, end: post.live.end, done: at + (post.live.end - post.live.skip) / rate }]
    }),
  )
  const wordsOf = Object.fromEntries(posts.map((post, i) => [post.src, frame.querySelectorAll(".words")[i]]))
  const typedWords = wordsOf[typedPost.src]
  const typedLetters = [...typedWords.querySelectorAll(".ch")]
  const caret = el(`<i class="caret"></i>`)
  const labels = [["Post cover", "1600 × 900"], ["Link preview", "1200 × 630"], ["X header", "1500 × 500"]].map(([name, size]) => el(`<p class="label">${name}<i>${size}</i></p>`))
  const menu = el(`<div class="menu"><div class="head"><span>Style</span><span>30</span></div><div class="window"><i class="bar"></i><div class="list">${[...ART.styles.map((style) => style.name), ...ART.more]
    .map((name) => `<div class="row">${name}</div>`)
    .join("")}</div></div></div>`)
  const end = el(`<div class="end"><div class="panel"><img class="lockup" src="lockup-dark.svg" alt="" decoding="sync"><p class="line">Covers for every page.</p><p class="cmd"><span>$ </span>${[...COMMAND].map((ch) => `<b>${ch}</b>`).join("")}</p><p class="small">No AI. No API key. Free and open source.<br>surfaces.pogrobert.com</p></div></div>`)
  stage.append(wall, big, card, ...labels, menu, end)

  // The shapes the card takes, in px of the stage: the frame itself, then a post's cover, its link preview and an X header.
  const CARD = { x: 960, y: 492 }
  const GROWN = 1.02
  const SIZES = [
    { w: 1920, h: 1080, y: 540, r: 0 },
    { w: 1150, h: 1150 / (16 / 9), y: CARD.y, r: 24 },
    { w: 1150, h: 1150 / ART.shapes.og.ratio, y: CARD.y, r: 24 },
    { w: 1320, h: 1320 / ART.shapes.banner.ratio, y: CARD.y, r: 24 },
  ]

  // --- Measures taken once, from the stage laid out and nothing moved ------------------------
  let opens
  let typed
  let ends
  let wallBox
  const measure = () => {
    const origin = stage.getBoundingClientRect()
    const scale = origin.width / 1920
    const box = (node) => {
      const r = node.getBoundingClientRect()
      return { x: (r.left - origin.left) / scale, y: (r.top - origin.top) / scale, w: r.width / scale, h: r.height / scale }
    }
    for (const node of [wall, ...wall.children]) node.style.transform = ""
    opens = box(wall.children[ART.opensOn.col].children[ART.opensOn.row])
    typed = box(wall.children[ART.typedOn.col].children[ART.typedOn.row])
    // The wall's last place is measured as it will be at the end, holding the X header, which is wider for its height than a cover.
    const last = wall.children[ART.endsOn.col].children[ART.endsOn.row]
    last.style.aspectRatio = ART.shapes.banner.ratio
    ends = box(last)
    last.style.aspectRatio = ""
    wallBox = box(wall)
    // Each title is set as large as the room its cover keeps for it allows, up to the size the typed one has.
    Object.assign(card.style, { left: "0px", top: "0px", width: "1920px", height: "1080px" })
    frame.style.transform = ""
    for (const post of posts) {
      const words = wordsOf[post.src]
      words.style.display = ""
      const title = words.firstElementChild
      for (let px = 113; px >= 54; px -= 3) {
        title.style.fontSize = `${px}px`
        const set = title.firstElementChild.getBoundingClientRect()
        if (set.height / scale <= post.area.h * 1080 + 1 && set.width / scale <= post.area.w * 1920 + 1) break
      }
    }
    // The link preview's title likewise, in shares of the card's width.
    const { area, ink, ground } = ART.shapes.og
    const size = SIZES[2]
    Object.assign(card.style, { width: `${size.w}px`, height: `${size.h}px` })
    Object.assign(ogTitle.style, { left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%`, color: ink })
    ogTitle.style.setProperty("--ground", ground)
    let fits = 20
    for (let px = 20; px <= 120; px += 1) {
      ogTitle.style.fontSize = `${(px / size.w) * 100}cqw`
      const words = ogTitle.firstElementChild.getBoundingClientRect()
      if (words.height / scale > area.h * size.h || words.width / scale > area.w * size.w + 0.5) break
      fits = px
    }
    ogTitle.style.fontSize = `${(fits / size.w) * 100}cqw`
  }

  // --- Each part, at second t ----------------------------------------------------------------
  // How far the wall's columns have drifted, in cqw: up to speed after the pull back, slowing to a stop through the push in, and off again at the end.
  const speed = (t) => 2.3 * ease.smooth(through(t, PULL + 0.25, 0.9)) * (1 - ease.smooth(through(t, PUSH - 0.3, PUSH_DUR))) + 1.5 * ease.smooth(through(t, BACK + BACK_DUR, 1.2))
  const drifted = [0]
  for (let i = 1; i <= DURATION * 240; i++) drifted.push(drifted[i - 1] + speed(i / 240) / 240)
  const driftAt = (t) => drifted[Math.round(clamp(t, 0, DURATION) * 240)]

  const columns = [...wall.children]
  const tiles = [...wall.querySelectorAll("img")]
  const bigChip = big.firstElementChild
  const endTile = wall.children[ART.endsOn.col].children[ART.endsOn.row]
  const endTileWas = endTile.getAttribute("src")
  const typedTile = wall.children[ART.typedOn.col].children[ART.typedOn.row]
  const typedTileWas = typedTile.getAttribute("src")
  // A zoom of the wall about the point that stays put, by `amount`: 1 has the tile filling the frame, 0 leaves the wall as it lies.
  // `moved` is how far the tile's column has drifted, in cqw. Gives the tile's place on the stage and the wall's scale.
  const zoomed = (tile, moved, amount) => {
    const fill = 1920 / tile.w
    const y = tile.y + moved * 19.2
    const fixed = { x: (fill * tile.x) / (fill - 1), y: (fill * y) / (fill - 1) }
    const scale = Math.exp(Math.log(fill) * amount)
    return { fixed, scale, x: fixed.x + scale * (tile.x - fixed.x), y: fixed.y + scale * (y - fixed.y), w: scale * tile.w, h: scale * tile.h }
  }
  // Where the push in stands at t: the wall grows about the point that brings the tile, wherever its column has carried it, to fill the frame.
  const pushZoom = (t) => zoomed(typed, (ART.typedOn.col % 2 ? -1 : 1) * driftAt(t), ease.move(through(t, PUSH, PUSH_DUR)))
  // Where the last pull back stands at t. It begins with the wall so large, and so placed, that its X header lies exactly where the card is,
  // and ends with the wall as it lies: a scale about the one point that makes both true.
  const endZoom = (t) => {
    const from = (SIZES[3].w * GROWN) / ends.w
    const tile = { x: ends.x + ends.w / 2, y: ends.y + ends.h / 2 + (ART.endsOn.col % 2 ? -1 : 1) * driftAt(ON) * 19.2 }
    const fixed = { x: (CARD.x - from * tile.x) / (1 - from), y: (CARD.y - from * tile.y) / (1 - from) }
    const scale = Math.exp(Math.log(from) * (1 - ease.move(through(t, BACK, BACK_DUR))))
    const [w, h] = [scale * ends.w, scale * ends.h]
    return { fixed, scale, w, h, x: fixed.x + scale * (tile.x - fixed.x) - w / 2, y: fixed.y + scale * (tile.y - fixed.y) - h / 2 }
  }
  function drawWall(t) {
    if (show(wall, t < ON || t >= BACK)) {
      const drift = driftAt(t)
      columns.forEach((col, i) => (col.style.transform = `translateY(${i % 2 ? -drift : drift}cqw)`))
      const zoom = (tile, moved, amount) => {
        const { fixed, scale } = zoomed(tile, moved, amount)
        wall.style.transformOrigin = `${fixed.x - wallBox.x}px ${fixed.y - wallBox.y}px`
        wall.style.transform = `scale(${scale})`
      }
      // When the wall returns, the place the title was typed in holds another cover: an empty label there would say the typing never happened.
      const typedSrc = t >= END ? ART.wallLater : typedTileWas
      if (typedTile.getAttribute("src") !== typedSrc) typedTile.setAttribute("src", typedSrc)
      // At the end, the place the lens pulls back from holds the X header itself, in its own shape: nothing is swapped for the move's sake.
      const src = t >= END ? ART.shapes.banner.src : endTileWas
      if (endTile.getAttribute("src") !== src) {
        endTile.setAttribute("src", src)
        endTile.style.aspectRatio = t >= END ? ART.shapes.banner.ratio : ""
      }
      let tiled = 1
      if (t < PUSH) {
        // Already easing back from the first frame, a little, before the pull itself: nothing in the film stands dead still.
        zoom(opens, 0, 1 - ease.inOut(through(t, PULL, PULL_DUR)) + 0.014 * (1 - through(t, 0, PULL + 0.35)) ** 2)
        tiled = ease.out(through(t, PULL, 0.6))
      } else if (t < ON) {
        const { fixed, scale } = pushZoom(t)
        wall.style.transformOrigin = `${fixed.x - wallBox.x}px ${fixed.y - wallBox.y}px`
        wall.style.transform = `scale(${scale})`
        tiled = 1 - ease.in(through(t, PUSH + PUSH_DUR * 0.55, PUSH_DUR * 0.45))
      } else {
        // At the end the lens pulls back once more: the covers come up round the header, which lies exactly over its own place, then dim a little under the name.
        const { fixed, scale } = endZoom(t)
        wall.style.transformOrigin = `${fixed.x - wallBox.x}px ${fixed.y - wallBox.y}px`
        wall.style.transform = `scale(${scale})`
      }
      wall.style.opacity = t >= BACK ? ease.smooth(through(t, BACK, 0.5)) * mix(1, 0.55, ease.smooth(through(t, LOGO - 0.25, 0.8))) : 1
      // Corners and a hairline edge make each cover a tile; both are gone when one cover is the whole frame.
      wall.style.setProperty("--edge", 0.1 * tiled)
      for (const tile of tiles) tile.style.borderRadius = `${0.8 * tiled}cqw`
    }
    if (show(big, t >= THIRTY[0] && t < THIRTY[1] + 0.2)) {
      const out = through(t, THIRTY[1], 0.2)
      bigChip.style.opacity = through(t, THIRTY[0], 0.15) * (1 - out)
      bigChip.style.transform = `scale(${mix(0.92, 1, ease.back(through(t, THIRTY[0], 0.45))) * mix(1, 0.96, out)})`
    }
  }

  // What the one frame shows at t: the post, and the one a new colour is being drawn across.
  function stateAt(t) {
    const step = STEPS.findLastIndex((s) => s <= t)
    const tint = TINTS.findLastIndex((s) => s <= t)
    const cover = tint >= 0 ? ART.colours[tint + 1] : step >= 0 ? ART.styles[step + 1] : typedPost
    return { step, tint, cover, under: tint >= 0 ? ART.colours[tint] : null, drawn: tint >= 0 ? ease.move(through(t, TINTS[tint], WIPE)) : 1, side: SIDES[Math.max(0, tint) % SIDES.length] }
  }

  function drawCard(t, { cover, under, drawn, step, side }) {
    // Once the wall is fully there the card is gone: its own picture on the wall is under it, the same to the pixel, and dims with the rest.
    // It is there from the start of the push in, lying over its tile and growing with it: the full frame is then the cover itself,
    // sharp and in place, and not a small picture enlarged that the real one must replace.
    if (!show(card, t >= PUSH && t < BACK + 0.5)) {
      for (const label of labels) show(label, false)
      return
    }
    // The card's shape: the whole frame, then each shape in turn.
    const turns = [ease.move(through(t, SHAPES, SHRINK)), ease.move(through(t, OG, MORPH)), ease.move(through(t, BANNER, MORPH))]
    const size = turns.reduce((from, turn, i) => ({ w: mix(from.w, SIZES[i + 1].w, turn), h: mix(from.h, SIZES[i + 1].h, turn), y: mix(from.y, SIZES[i + 1].y, turn), r: mix(from.r, SIZES[i + 1].r, turn) }), SIZES[0])
    // At the end it rides the pull back, lying over its own place on the wall, its corners easing to a tile's.
    // While it is a card it grows by a fiftieth, slowly, so the holds between its shapes are never quite still.
    const grown = 1 + (GROWN - 1) * through(t, SHAPES + SHRINK, END - SHAPES - SHRINK)
    size.w *= grown
    size.h *= grown
    let x = CARD.x
    if (t < ON) {
      const place = pushZoom(t)
      x = place.x + place.w / 2
      Object.assign(size, { w: place.w, h: place.h, y: place.y + place.h / 2, r: 15.36 * place.scale * (1 - ease.in(through(t, PUSH + PUSH_DUR * 0.55, PUSH_DUR * 0.45))) })
    }
    if (t >= END) {
      const place = endZoom(t)
      x = place.x + place.w / 2
      Object.assign(size, { w: place.w, h: place.h, y: place.y + place.h / 2, r: mix(size.r, 15.36 * place.scale, ease.smooth(through(t, END, 0.3))) })
    }
    Object.assign(card.style, { left: `${x - size.w / 2}px`, top: `${size.y - size.h / 2}px`, width: `${size.w}px`, height: `${size.h}px`, borderRadius: `${size.r}px` })
    // On a dark ground a shadow only smudges: a hairline edge is what lifts the card off it.
    card.style.boxShadow = `0 0 0 1.5px rgb(255 255 255 / ${0.12 * turns[0] * (1 - through(t, BACK, 0.4))})`

    // The cover itself: the lens creeps in while it is the frame, a change of style gives it a small push, and it is scaled with the card.
    if (show(frame, turns[1] < 1)) {
      const creep = mix(1 + 0.004 * (Math.min(t, SHAPES) - ON), 1, turns[0])
      const push = step >= 0 && t < SHAPES ? mix(1.022, 1, ease.out(through(t, STEPS[step], 0.24))) : 1
      frame.style.transform = `scale(${Math.max(size.w / 1920, size.h / 1080) * creep * push})`
      for (const picture of art.children) picture.style.display = "none"
      for (const post of posts) wordsOf[post.src].style.display = "none"
      // A new colour is drawn across the old one, not faded through it: two inks half mixed are grey. Its title comes with it.
      const crossing = under && drawn < 1
      const place = (post, picture, words, clip) => {
        pictureOf[picture.src].style.display = ""
        pictureOf[picture.src].style.clipPath = clip.picture
        words.style.display = ""
        words.style.clipPath = clip.words
        words.style.color = picture.ink
        words.style.setProperty("--ground", picture.ground)
        // Gone just before the card becomes a link preview, whose own title comes up after: never two titles at once.
        words.style.opacity = 1 - through(t, OG - 0.2, 0.2)
      }
      if (crossing) place(under, under, wordsOf[under.src], { picture: "", words: leftBy(side, drawn) })
      place(cover, cover, wordsOf[cover.src], crossing ? { picture: drawnBy(side, drawn), words: drawnBy(side, drawn) } : { picture: "", words: "" })
      // A cover that is moving lies over its own still picture, cut by the same wipe, and fades into it once it has come to rest.
      // (Each is moved to the top only when it is not there already: putting a node back in the page starts its animations afresh.)
      const live = liveOf[cover.src]
      const top = live && t < live.done + 0.25 ? live.node : pictureOf[cover.src]
      if (pictureOf[cover.src].nextSibling !== (top === live?.node ? live.node : null)) art.append(pictureOf[cover.src])
      if (top === live?.node) {
        if (art.lastChild !== live.node) art.append(live.node)
        live.node.style.display = ""
        live.node.style.clipPath = crossing ? drawnBy(side, drawn) : ""
        live.node.style.opacity = 1 - ease.smooth(through(t, live.done, 0.25))
        const now = Math.min(live.end, live.skip + Math.max(0, t - live.at) * live.rate) * 1000
        for (const moving of live.node.getAnimations({ subtree: true })) {
          moving.pause()
          moving.currentTime = now
        }
      }

      // The typed title: a key at a time, each letter already in the place it will keep, then left alone.
      const count = KEYS.filter((key) => key <= t).length
      typedLetters.forEach((letter, i) => (letter.style.visibility = i < count ? "" : "hidden"))
      const idle = t - (count ? KEYS[count - 1] : ON)
      const blinking = t >= ON + 0.1 && t < MENU + 0.2 && (idle < 0.25 || Math.floor((idle - 0.25) / 0.4) % 2 === 1)
      if (blinking) typedLetters[0].parentNode.insertBefore(caret, typedLetters[count] ?? null)
      else caret.remove()
    }
    // Each new shape is drawn across the last, as the colours were: two titles half faded into each other read as neither.
    if (show(og, turns[1] > 0 && turns[2] < 1)) {
      og.style.clipPath = turns[1] < 1 ? drawnBy("left", turns[1]) : ""
      ogTitle.style.opacity = ease.smooth(through(t, OG + MORPH * 0.7, 0.3))
    }
    if (show(banner, turns[2] > 0)) banner.style.clipPath = turns[2] < 1 ? drawnBy("right", turns[2]) : ""

    // What each shape is, under it.
    const foot = size.y + size.h / 2
    // Each comes a moment after its shape has landed, never ahead of it.
    const starts = [SHAPES + SHRINK + 0.06, OG + MORPH * 0.85, BANNER + MORPH * 0.85]
    const stops = [OG - 0.05, BANNER - 0.05, END - 0.1]
    labels.forEach((label, i) => {
      if (enter(label, t, starts[i], stops[i], { dur: 0.45, outDur: 0.2, rise: 0.8 })) label.style.top = `${foot + 46}px`
    })
  }

  const list = menu.querySelector(".list")
  const rows = [...list.children]
  function drawMenu(t, { step }) {
    if (!show(menu, t >= MENU && t < MENU_OUT + 0.3)) return
    const into = ease.outSoft(through(t, MENU, 0.5))
    const out = ease.in(through(t, MENU_OUT, 0.3))
    menu.style.opacity = into * (1 - out)
    menu.style.transform = `translateX(${(1 - into) * 3 + out * 3}cqw)`
    // The list runs up under the bar, a row for each step.
    const row = step < 0 ? 0 : step + ease.outSoft(through(t, STEPS[step], 0.18))
    list.style.transform = `translateY(${-row * 3.3}cqw)`
    rows.forEach((node, i) => node.classList.toggle("on", i === Math.round(row)))
  }

  const panel = end.firstElementChild
  const endParts = [...panel.children]
  const commandLetters = [...end.querySelectorAll(".cmd b")]
  const prompt = el(`<i></i>`)
  function drawEnd(t) {
    if (!show(end, t >= LOGO - 0.15)) return
    // A card of its own, over the covers.
    const up = ease.arrive(through(t, LOGO - 0.15, 0.6))
    panel.style.opacity = through(t, LOGO - 0.15, 0.25)
    panel.style.transform = `scale(${mix(0.95, 1, up)})`
    // The mark first, the rest close behind: each starts before the one above it has settled.
    endParts.forEach((part, i) => enter(part, t, LOGO + i * 0.075, null, { dur: 0.7, keep: true }))
    const count = COMMAND_KEYS.filter((key) => key <= t).length
    commandLetters.forEach((letter, i) => (letter.style.visibility = i < count ? "" : "hidden"))
    commandLetters[0].parentNode.insertBefore(prompt, commandLetters[count] ?? null)
    const idle = t - (COMMAND_KEYS[count - 1] ?? LOGO)
    prompt.style.opacity = idle < 0.3 || Math.floor((idle - 0.3) / 0.5) % 2 === 1 ? 1 : 0
  }

  function seek(t) {
    t = clamp(t, 0, DURATION)
    const state = stateAt(t)
    drawWall(t)
    drawCard(t, state)
    drawMenu(t, state)
    drawEnd(t)
    film.time = t
  }

  // --- Ready when the type and every picture are in ------------------------------------------
  const loaded = (image) => (image.complete ? Promise.resolve() : new Promise((resolve, reject) => ((image.onload = resolve), (image.onerror = () => reject(new Error(`Missing picture: ${image.src}. Run node video/art.mjs.`))))))
  const ready = Promise.all([document.fonts.load(`700 40px "Atkinson Next"`), document.fonts.load(`500 40px "Atkinson Mono"`), ...[...stage.querySelectorAll("img")].map(loaded)]).then(() => {
    measure()
    seek(film.time)
  })
  const film = (window.film = { duration: DURATION, fps: 60, time: 0, seek, ready, cues: CUES, marks: { ON, TYPED, DRAWN, MENU, STEPS, MENU_OUT, TINTS, SHAPES, OG, BANNER, END } })

  // --- The desk: fit the stage to the window, scrub, play at half the film's frame rate ---------
  const params = new URLSearchParams(location.search)
  if (params.has("capture")) document.documentElement.classList.add("capture")
  else {
    const fit = document.getElementById("fit")
    const scrub = document.getElementById("scrub")
    const clock = document.getElementById("clock")
    const play = document.getElementById("play")
    scrub.max = DURATION
    const resize = () => (fit.style.transform = `scale(${Math.min(innerWidth / 1920, (innerHeight - 44) / 1080)})`)
    addEventListener("resize", resize)
    resize()
    const go = (t) => {
      seek(t)
      scrub.value = t
      clock.textContent = `${t.toFixed(2)}s`
    }
    scrub.addEventListener("input", () => go(Number(scrub.value)))
    let timer
    play.addEventListener("click", () => {
      if (timer) return (clearInterval(timer), (timer = null), (play.textContent = "Play"))
      play.textContent = "Pause"
      const from = performance.now() - (film.time >= DURATION ? 0 : film.time) * 1000
      // Thirty frames a second at most, and it stops at the end: looking at it should cost little.
      timer = setInterval(() => {
        const t = (performance.now() - from) / 1000
        go(Math.min(t, DURATION))
        if (t >= DURATION) play.click()
      }, 1000 / 30)
    })
    film.time = Number(params.get("t") ?? 0)
    ready.then(() => go(film.time))
  }
})()
