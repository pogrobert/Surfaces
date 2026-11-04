## @pogrobert/surfaces

- Input: `{ style, seed, color?, width?, height?, areas?, theme?, mood?, grain?, detail?, motion?, shape? }`, listed values only (`inputSchema`, `catalog`).
- `seed`: the page's slug, never `42`/`"test"`. `color`: brand hex.
- `areas`: `{ place, size?, art? }`. `place`: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`. `size`: `sm`, `md`, `lg`. `art`: `"around"` (default; readable text, logo) or `"behind"` (opaque card).
- React (`@pogrobert/surfaces/react`): `children` = one large bottom-left title, or `areas` with `content`, never both.
- `motion`: default `"none"`; `"loop"` on one hero per page.
- Alt: no `label` under a heading; `label={title}` if the cover is the link.
- Avatars: `avatar({ style, seed: user.id, color })`/`<Avatar>`, style in `AVATAR_STYLES`.
- OG: `toPng(generate({ ...input, ...formats.og }))` (`@pogrobert/surfaces/png`), alt `describe(scene, { title })`.
- Errors name the fix; `validate(input)` checks first.
