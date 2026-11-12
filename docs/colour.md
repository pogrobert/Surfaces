# How a cover's second colour is chosen

Most styles draw in a brand's one colour and its shades. Sixteen also set a
second hue beside it, the partner (`partner: true` in `catalog`). This is how
it is chosen, and why.

## What is known about colour pairs

- **Harmony rises as two hues come closer.** In Schloss and Palmer's study of
  colour pairs, both liking a pair and finding it harmonious rose with hue
  similarity, and they found no evidence that contrasting hues are
  harmonious. Contrast helps something stand out against a ground, which is
  a different job.
- **A moderate gap in lightness reads best.** Ou and Luo's model of two-colour
  harmony scores a pair highest when the two are neither nearly the same
  lightness nor far apart.
- **Rated palettes are simple.** Across thousands of rated palettes (Kuler,
  COLOURlovers), well-liked ones keep to one hue at several lightnesses,
  neighbouring hues, or one contrast; there is little sign that colour-wheel
  templates such as triads are what people use.
- **Opposite hues mix to mud.** Inks subtract light. A complementary pair
  covers the whole spectrum between them, so where they overlap they print
  brown or grey.
- **Print shops pair real inks.** Riso inks are semi-transparent, and two of
  them overprint as a third colour: Blue with Fluorescent Pink is the
  classic pair, the overlap giving the darks.
- **Warm against cool is read alike everywhere**, and pairs are liked better
  warm then cool than the other way round.
- **On a dark ground a strong colour vibrates**, so dark themes draw accents
  a little lighter and softer.
- About one man in twelve can't tell **red from green**.

## The rule

- A **calm** brand takes a neighbouring hue, 25° to 65° round the wheel. A
  **bold** brand takes a contrast, 85° to 155° away, warm against cool where
  it can, never the opposite hue. With no mood, the brand's name picks among
  both, so two brands of one colour are not alike.
- **Riso and Screenprint** print one ink over the other. For them the partner
  is a real riso ink, scored by how colourful its overlap with the brand's
  colour stays (their transmittances multiplied in linear light, as two thin
  ink layers'), and weak inks and yellow, which reads as olive in a stipple,
  are left out.
- Red and green are never paired.
- `partners(color, { style, mood })` lists the choices, best first; a brand
  keeps the one its name picks in `brand.look`.

## A partner the brand gives

It keeps its hue, its strength and, as near as the style allows, its
lightness: within a reach of the lightness the style keeps for its partner,
and clear of the ground, where it would vanish. On a dark ground it is drawn
a little lighter and softer.

## A warm brand on a dark page

An amber, orange or yellow brand prints on a near-black, since a dark warm
ground reads as brown. It keeps most of its tint, so that on a site's own
near-black page a cover still has an edge.

## Sources

- Schloss & Palmer (2011), Aesthetic response to color combinations: preference, harmony, and similarity. https://pmc.ncbi.nlm.nih.gov/articles/PMC3037488
- Ou & Luo, colour harmony for two-colour combinations. https://gwern.net/doc/psychology/vision/2004-ou.pdf
- O'Donovan, Agarwala & Hertzmann (2011), Color Compatibility From Large Datasets. https://www.dgp.toronto.edu/~donovan/color/colorcomp.pdf
- Munsell, Mud: understanding mixing complementary colors. https://munsell.com/color-blog/mud-understanding-mixing-complementary-colors/852/
- Riso overprinting: https://www.arts.ac.uk/partnerships/outreach/insights/how-to/techniques/how-totechniques-create-a-two-colour-risograph-print and https://monikerpress.ca/moniker-press-risograph-colour-charts
- Ou et al., colour emotion and preference for two-colour combinations. https://pureportal.coventry.ac.uk/en/publications/a-study-of-colour-emotion-and-colour-preference-part-ii-colour-em/
- Material Design, dark theme. https://m2.material.io/design/color/dark-theme
