# Landing page - cleanup + layered motion system

_Design spec · 2026-07-15 · branch `feature/landing-motion`_

## Goal

Make the logged-out marketing landing (`frontend/src/pages/Landing.tsx`) look
notably more complex and polished with a cohesive motion system, while removing
testimonials and stray emoji. All motion stays in the app's clay language
(navy `#0B1957` / blush `#FA9EBC` / cream `#FFF6EA`, Ramaraja display font,
clay shadows, organic blobs), adds **no new dependencies** (anime.js v4 is
already installed; reactbits-style effects are ported as self-contained files
following the existing `BlobCursor` / `ClickSpark` pattern), and respects
`prefers-reduced-motion`.

## Scope

Landing page only (plus a 1-line SVG swap in `WeatherWidget`). The logged-in app
keeps its current motion.

## 1. Cleanup

- **Remove testimonials.** Delete the `TESTIMONIALS` array (`Landing.tsx` ~41–45)
  and the entire "Loved by sharp dressers" `<section>` (~350–368). Keep the hero
  avatar stack (that is separate social proof, not a testimonial). `Avatar` stays
  imported (still used in the hero).
- **Emoji + decorative glyph → SVG** (arrows `←`/`→` stay):
  - `💨` in `components/WeatherWidget.tsx:128` → a small inline wind-gust SVG
    beside the wind speed.
  - `✦` in the ribbon → becomes an SVG diamond/sparkle separator supplied by the
    new marquee, so no glyph character remains.

## 2. Marquee → seamless scroller (reactbits-style)

New self-contained `components/Marquee.tsx`:

- Renders `children` once in a measured "set", then duplicates the set enough
  times to overflow the viewport width (`ceil(containerW / setW) + 1`), so the
  track is always wider than the container.
- Animates the track `translateX(0 → -setW)` on a linear infinite loop; because
  the offset equals exactly one set width and the sets are identical, the wrap is
  seamless with no visible seam or gap. Duration derived from `setW` for constant
  pixels/sec regardless of content width.
- Re-measures on resize (`ResizeObserver`). Pauses on hover. Under
  `prefers-reduced-motion`, renders one static set, no animation.
- Used for the ribbon with word + blush SVG-diamond separators.

**Root-cause note:** the current CSS marquee translates `-50%` of a doubled track
whose per-item `gap` and trailing `pr` interact with viewport width; on wide
viewports one copy is narrower than the container, exposing the seam. Measuring
and duplicating to always-overflow removes the failure mode entirely. The exact
current glitch will be confirmed in-browser (measure track vs container) before
replacing.

## 3. The four animations

1. **Scroll-reveals** - extend `animations.ts` with `useReveal<T>(opts)`: an
   IntersectionObserver hook that runs a one-shot anime.js fade + rise (and
   optional stagger of children) when the element first enters the viewport
   (~15% visible). Replaces the current mount-only `useFadeRise` /
   `useStaggerReveal` usage on the landing so sections animate as you scroll to
   them. Reduced-motion → elements start visible, no animation.
2. **Count-up stats** - `components/CountUp.tsx`: parses a stat string into
   `prefix + number + suffix` (e.g. `$5/mo` → `$` / `5` / `/mo`; `7-day` → `` /
   `7` / `-day`), and on first reveal animates the number `0 → target` with
   anime.js. Non-numeric stats render as-is. Reduced-motion → final value
   immediately.
3. **Animated hero background** - `components/HeroField.tsx`: a `<canvas>` behind
   the hero content rendering a slow drift of soft particles with faint
   connecting lines in blush/navy at low opacity. `requestAnimationFrame` loop,
   DPR-aware, sized to its container; **paused when offscreen** via
   IntersectionObserver and on `visibilitychange`. Reduced-motion → paints one
   static frame, no loop. Sits under the existing radial `Glow`s.
4. **Animated headline** - `components/SplitText.tsx`: splits text into word
   spans and reveals them staggered with a blur + rise via anime.js on mount /
   reveal. Applied to the hero `<h1>` ("Your wardrobe, styled by AI."). Preserves
   the existing blush accent on "styled by AI." Reduced-motion → plain text.

## 4. Extra polish ("more complex, better designed")

- **Illustration entrances:** garment/feature/step illustrations pop-scale in as
  part of their card's reveal (filled SVGs, so scale - not line-draw). Hero art
  tiles get a subtle idle drift layered on the existing `floaty`.
- **Cursor parallax** on the hero's floating cards: pointer position nudges each
  card a few px (depth-tiered). Disabled on touch and reduced-motion.
- **Animated gradient** on the hero accent word (reuse `gradient-pan`), and a
  slightly richer card hover (lift + shadow-deepen + illustration nudge) via
  `clay-card-hover`.

## Component boundaries

| Unit | Purpose | Depends on |
|------|---------|-----------|
| `Marquee.tsx` | Seamless infinite horizontal scroller | React, ResizeObserver |
| `HeroField.tsx` | Ambient canvas particle/line field | React, canvas, IO |
| `SplitText.tsx` | Word-staggered text reveal | React, anime.js |
| `CountUp.tsx` | Animated number with prefix/suffix | React, anime.js |
| `animations.ts` `useReveal` | Scroll-triggered reveal hook | anime.js, IO |
| `Landing.tsx` | Composition + parallax/gradient/hover | all of the above |

Each new component is self-contained, prop-driven, and independently testable.

## Constraints & non-goals

- No new npm dependencies. No changes to backend or logged-in app (beyond the
  `WeatherWidget` SVG swap).
- Every effect gated on `prefers-reduced-motion`.
- Canvas throttled (rAF) and paused offscreen; no layout thrash in scroll
  handlers (use transforms, `will-change` sparingly).
- Keep the palette; motion is subtle and cohesive, not flashy.

## Testing / verification

- Unit: `CountUp` parse logic (prefix/number/suffix split) and the marquee
  copy-count math are pure functions - cover with a lightweight test or an
  in-browser assertion.
- Build: `npm run build` (tsc) stays clean.
- In-browser (dev server): marquee seam absence (sample track `transform` over
  time + measure `setW` vs container), count-up runs on scroll, reveals fire per
  section, canvas present and its pixels change frame-to-frame, reduced-motion
  path is static. Screenshots time out in this pane, so verification is
  structural + value-sampling, as established earlier this session.
