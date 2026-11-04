// One generator for the whole library: mulberry32, seeded from an FNV-1a hash
// of the seed's text. Both use only Math.imul and shifts, so one seed is one
// sequence on every engine.

export type Range = readonly [number, number]

export type Rng = {
  next(): number
  between(range: Range): number
  int(low: number, high: number): number
  pick<T>(items: readonly T[]): T
  // A stream of its own. A fork depends only on the seed and its label, so
  // drawing more from one part of a recipe never reshuffles another part.
  fork(label: string): Rng
}

export function hash(text: string, basis = 0x811c9dc5) {
  let state = basis
  for (let i = 0; i < text.length; i++) {
    state = Math.imul(state ^ text.charCodeAt(i), 0x01000193)
  }
  // FNV is weak in the high bits for short strings, which are most seeds.
  state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d)
  state = Math.imul(state ^ (state >>> 12), 0x297a2d39)
  return (state ^ (state >>> 15)) >>> 0
}

function stream(start: number) {
  let state = start | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: string | number): Rng {
  return fromState(hash(String(seed)))
}

function fromState(state: number): Rng {
  const next = stream(state)
  return {
    next,
    between: ([low, high]) => low + (high - low) * next(),
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    fork: (label) => fromState(hash(label, state)),
  }
}
