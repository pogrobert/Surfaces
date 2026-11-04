// Every cell is the same rounded box with different corners tightened, so one
// drawing can change what it is made of without changing how it is laid out.
export const CELLS = ["tile", "disc", "bubble", "arch", "leaf"] as const
export type Cell = (typeof CELLS)[number]

// Radii run clockwise from the top left, and `tail` picks the corner a shape
// turns on. `open` and `tight` are the two radii the shape has to work with.
export function cellRadii(
  cell: Cell,
  tail: number,
  height: number,
  open: number,
  tight: number
): [number, number, number, number] {
  if (cell === "disc") {
    const round = height / 2
    return [round, round, round, round]
  }
  const radii: [number, number, number, number] = [open, open, open, open]
  if (cell === "bubble") radii[tail] = tight
  if (cell === "arch") {
    radii[tail] = tight
    radii[(tail + 1) % 4] = tight
  }
  if (cell === "leaf") {
    radii[tail] = tight
    radii[(tail + 2) % 4] = tight
  }
  return radii
}
