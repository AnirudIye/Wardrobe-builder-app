# Landing Motion System Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, task-by-task. Steps use checkbox (`- [ ]`) syntax. No frontend test runner exists - verification is `tsc` build + in-browser behavioral checks (value sampling / DOM measurement via the browser JS tool), plus inline assertions for pure functions.

**Goal:** Make the logged-out landing page look markedly more polished with a cohesive, on-brand motion system, and remove testimonials + stray emoji.

**Architecture:** Self-contained React components in `frontend/src/components/` (following the existing `BlobCursor`/`ClickSpark` port pattern) + one shared hook added to `animations.ts`, composed in `Landing.tsx`. anime.js v4 drives value animations; a raw `<canvas>` drives the ambient field. IntersectionObserver gates scroll-triggered effects.

**Tech Stack:** React 18, TypeScript, Tailwind 3, anime.js v4 (already installed). No new dependencies.

## Global Constraints

- No new npm dependencies (runtime or dev).
- Every effect gated on `prefers-reduced-motion: reduce` → static/final state, no loops.
- Palette only: navy `#0B1957`, blush `#FA9EBC` (`#F2769F` deep), cream `#FFF6EA`/`#FFFBF4`, gold `#F6C453`.
- Canvas work: rAF loop, DPR-aware, **paused when offscreen** (IntersectionObserver) and on `document.hidden`.
- Changes limited to the landing + `WeatherWidget` SVG swap. No backend, no logged-in-app behavior change.
- Keep arrows `←`/`→`. Remove only `💨` and `✦`.
- Commit after each task. Branch: `feature/landing-motion`.

---

### Task 1: Cleanup - remove testimonials + wind emoji

**Files:**
- Modify: `frontend/src/pages/Landing.tsx` (delete `TESTIMONIALS` array ~41–45; delete testimonials `<section>` ~350–368)
- Modify: `frontend/src/components/WeatherWidget.tsx:128` (`💨` → inline SVG)

**Interfaces:**
- Produces: nothing consumed downstream. `Avatar` import in `Landing.tsx` stays (used by hero).

- [ ] **Step 1:** Delete the `TESTIMONIALS` constant and the entire `{/* TESTIMONIALS */}` section element. Leave the CTA section directly after pricing.
- [ ] **Step 2:** In `WeatherWidget.tsx`, replace `💨 ` inside the wind chip with a small inline SVG gust (two/three curved blush-navy strokes), keeping the `{Math.round(weather.wind_kph)} km/h` text.
- [ ] **Step 3 (verify):** `cd frontend && npm run build` → clean. `grep -rn "TESTIMONIALS\|💨" src` → no matches.
- [ ] **Step 4 (commit):** `git commit -am "refactor(landing): remove testimonials and wind emoji"`

---

### Task 2: `useReveal` scroll-reveal hook + apply to sections

**Files:**
- Modify: `frontend/src/animations.ts` (add `prefersReducedMotion()` helper + `useReveal` hook)
- Modify: `frontend/src/pages/Landing.tsx` (swap mount-only reveals for scroll reveals on each section's heading + grid)

**Interfaces:**
- Produces:
  - `prefersReducedMotion(): boolean`
  - `useReveal<T extends HTMLElement>(opts?: { stagger?: boolean; threshold?: number; y?: number; delay?: number }): React.RefObject<T>` - attaches an IntersectionObserver; on first intersection ≥ threshold (default 0.15), runs anime.js fade+rise on the element (or `staggerChildren` on its children when `stagger`), then disconnects. Reduced-motion → sets elements visible immediately, no animation.

- [ ] **Step 1:** Add `prefersReducedMotion()` reading `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- [ ] **Step 2:** Implement `useReveal`. Initial styles: set `opacity:0` (and children opacity:0 when stagger) synchronously in a layout effect so nothing flashes; on reveal call existing `fadeRise`/`staggerChildren`. Under reduced-motion, set opacity:1 and return.
- [ ] **Step 3:** In `Landing.tsx`, replace `useFadeRise`/`useStaggerReveal` mount usage: give each major section wrapper (features, how, showcase, pricing, CTA, stats) a `useReveal` ref (stagger for grids). Hero can keep an immediate reveal (above the fold).
- [ ] **Step 4 (verify build):** `npm run build` clean.
- [ ] **Step 5 (verify behavior):** dev server; scroll to a lower section and sample: before scroll its grid children have `opacity:0`; after entering view, `opacity:1` and a non-identity transform briefly. Confirm reduced-motion (emulate) leaves everything visible.
- [ ] **Step 6 (commit):** `git commit -am "feat(landing): scroll-triggered section reveals (anime.js + IO)"`

---

### Task 3: Seamless `Marquee` component + replace ribbon (removes ✦)

**Files:**
- Create: `frontend/src/components/Marquee.tsx`
- Modify: `frontend/src/pages/Landing.tsx` (replace the `animate-marquee` ribbon markup; drop `✦` glyph, use SVG diamond separator)
- Modify: `frontend/src/index.css` (remove now-unused `@keyframes marquee` / `.animate-marquee` if nothing else uses them)

**Interfaces:**
- Produces: `export default function Marquee({ children, speed=40, gap=40, pauseOnHover=true, className }: { children: React.ReactNode; speed?: number; gap?: number; pauseOnHover?: boolean; className?: string })` - `speed` = px/sec.

**Algorithm (seamless):** render one measured "set" (ref), compute `setW` (offsetWidth incl. trailing gap). Copies = `Math.ceil(containerW / setW) + 1`. Track width = `copies * setW`. Animate `translateX` from `0` to `-setW` linearly over `setW / speed` seconds, `infinite`. Because offset == exactly one set and sets are identical, the wrap is seamless. Re-measure on `ResizeObserver`. Reduced-motion → one static set, no animation. Implement the loop with a CSS custom property + keyframe (`--marquee-shift: -<setW>px`) or anime.js; CSS transform keyframe preferred (GPU, no JS per frame).

- [ ] **Step 1 (pure-math assertion):** in-browser/node check: for `containerW=1280, setW=500` → copies `ceil(1280/500)+1 = 4`, trackW `2000 ≥ 1280+setW`. Assert `copies*setW - setW ≥ containerW` (a full set always fills the viewport after the max shift).
- [ ] **Step 2:** Implement `Marquee.tsx` per algorithm. Separator: a small blush SVG diamond component rendered between items by the caller (not inside Marquee).
- [ ] **Step 3:** In `Landing.tsx`, replace ribbon: `<Marquee>` wrapping the `MARQUEE` words, each followed by an SVG diamond (`<Diamond/>`, blush). Remove the `✦` text node.
- [ ] **Step 4:** Remove dead `@keyframes marquee`/`.animate-marquee` from `index.css` (confirm no other refs via grep first).
- [ ] **Step 5 (verify seam):** dev server; sample the track `transform` at t and t+0.5s (moving left), measure `setW` and container width, assert `trackW ≥ containerW + setW`; confirm the first item of copy N sits exactly one `setW` after copy N-1 (no gap ≠ inter-item gap at the wrap).
- [ ] **Step 6 (verify build):** `npm run build` clean; `grep -rn "✦" src` → none.
- [ ] **Step 7 (commit):** `git commit -am "feat(landing): seamless marquee scroller, drop ✦ glyph"`

---

### Task 4: `CountUp` component + wire stats

**Files:**
- Create: `frontend/src/components/CountUp.tsx`
- Modify: `frontend/src/pages/Landing.tsx` (STATS render uses `<CountUp>`)

**Interfaces:**
- Produces:
  - `export function parseStat(v: string): { prefix: string; num: number | null; suffix: string }` - splits e.g. `"$5/mo"`→`{prefix:"$",num:5,suffix:"/mo"}`, `"7-day"`→`{prefix:"",num:7,suffix:"-day"}`, `"1 tap"`→`{prefix:"",num:1,suffix:" tap"}`, `"$0"`→`{prefix:"$",num:0,suffix:""}`. No digit → `num:null`.
  - `export default function CountUp({ value, className }: { value: string; className?: string })` - renders prefix + animated number + suffix; animates `0→num` with anime.js on first reveal (IO). `num===null` → render `value` verbatim. Reduced-motion → final immediately.

- [ ] **Step 1 (failing assertion):** inline check `parseStat("$5/mo")` deep-equals `{prefix:"$",num:5,suffix:"/mo"}`; `parseStat("7-day").num===7`; `parseStat("1 tap").suffix===" tap"`; `parseStat("$0").num===0`. Regex: `/^(\D*)(\d[\d,]*)(.*)$/` (strip commas before `Number`).
- [ ] **Step 2:** Implement `parseStat` + `CountUp` (IO threshold 0.4, once; anime.js `{ innerHTML:[0,num] }` with `round:1`, or animate a proxy and write `textContent`). Preserve integer formatting.
- [ ] **Step 3:** `Landing.tsx` STATS map renders `<CountUp value={s.v} className="font-brand text-3xl text-navy" />`.
- [ ] **Step 4 (verify):** build clean; dev server → scroll stats into view, confirm the number text transitions 0→target and ends exactly at target with prefix/suffix intact.
- [ ] **Step 5 (commit):** `git commit -am "feat(landing): count-up stat numbers on reveal"`

---

### Task 5: `HeroField` ambient canvas background

**Files:**
- Create: `frontend/src/components/HeroField.tsx`
- Modify: `frontend/src/pages/Landing.tsx` (mount `<HeroField/>` absolutely behind hero content, under the `Glow`s)

**Interfaces:**
- Produces: `export default function HeroField({ className }: { className?: string })` - fills its positioned parent with a `<canvas>` (absolute inset-0, `pointer-events-none`, `aria-hidden`).

**Behavior:** N≈`min(70, area/16000)` particles drifting slowly; draw faint lines between particles closer than ~120px; colors blush/navy at 0.10–0.25 alpha; DPR scale; resize via ResizeObserver; rAF loop; pause when offscreen (IO) and when `document.hidden`. Reduced-motion → paint one frame, no loop.

- [ ] **Step 1:** Implement `HeroField.tsx`.
- [ ] **Step 2:** Mount in hero: hero section is `relative`; add `<HeroField className="absolute inset-0" />` as first child, content stays `relative z-10`.
- [ ] **Step 3 (verify build):** clean.
- [ ] **Step 4 (verify behavior):** dev server → canvas present, sized > 0; sample `canvas.toDataURL()` (or a few `getImageData` pixels) at two times ~300ms apart → differs (animating). Scroll canvas offscreen → rAF stops (expose a debug counter or check via a data-attr frame count not advancing). Reduced-motion → two samples identical.
- [ ] **Step 5 (commit):** `git commit -am "feat(landing): ambient canvas particle field behind hero"`

---

### Task 6: `SplitText` headline reveal

**Files:**
- Create: `frontend/src/components/SplitText.tsx`
- Modify: `frontend/src/pages/Landing.tsx` (hero `<h1>` uses `<SplitText>`)

**Interfaces:**
- Produces: `export default function SplitText({ text, className, accentFrom, delay=0 }: { text: string; className?: string; accentFrom?: number; delay?: number })` - splits on words into inline-block spans; words at index ≥ `accentFrom` get the blush accent class; reveals words staggered with blur(6px→0) + translateY(16→0) + opacity on mount via anime.js. Reduced-motion → plain visible text.

- [ ] **Step 1:** Implement `SplitText.tsx` (preserve spaces; `will-change:filter,transform` during anim; clear after).
- [ ] **Step 2:** Replace hero `<h1>` inner text with `<SplitText text="Your wardrobe, styled by AI." accentFrom={2} .../>` producing the same two-line/accent look (accent on "styled by AI.").
- [ ] **Step 3 (verify):** build clean; dev → on load words start blurred/offset then settle; final DOM text equals "Your wardrobe, styled by AI." with accent spans on the right words.
- [ ] **Step 4 (commit):** `git commit -am "feat(landing): split-text headline reveal"`

---

### Task 7: Extra polish - parallax, gradient accent, richer hover, illustration pop

**Files:**
- Modify: `frontend/src/pages/Landing.tsx` (pointer parallax on hero art cards; gradient accent class on accent word; illustration entrance)
- Modify: `frontend/src/index.css` (`.text-gradient-pan` accent, enhanced `.clay-card-hover` if needed, illustration pop keyframe if used)

**Interfaces:**
- Consumes: hero art container ref for pointer math.

- [ ] **Step 1:** Add a pointer-move handler on the hero art wrapper (guarded by `!prefersReducedMotion()` and a coarse-pointer check `matchMedia('(pointer:fine)')`): translate the 3 floating cards by depth-tiered `(dx,dy)` a few px via CSS vars; reset on leave.
- [ ] **Step 2:** Add `.text-gradient-pan` in CSS (navy→blush clip-text using existing `gradient-pan`); apply to the accent word (works with SplitText accent spans).
- [ ] **Step 3:** Ensure feature/step illustration tiles scale-pop within their card reveal (extend `useReveal` children or a small CSS `@keyframes pop`); richer `clay-card-hover` (lift + shadow) verified present.
- [ ] **Step 4 (verify):** build clean; dev → moving cursor over hero shifts cards subtly; reduced-motion/touch → no parallax; accent word shows moving gradient.
- [ ] **Step 5 (commit):** `git commit -am "feat(landing): hero parallax, gradient accent, hover + illustration polish"`

---

### Task 8: Full-page verification + reduced-motion sweep

**Files:** none (verification only)

- [ ] **Step 1:** `npm run build` clean (tsc + vite).
- [ ] **Step 2:** In-browser full sweep: no `✦`/`💨` glyphs (`grep` + DOM check); testimonials gone; marquee seamless; reveals fire per section; count-up ends on target; canvas animates and pauses offscreen; no console errors; no horizontal overflow (`scrollWidth ≤ innerWidth`); prior blob-clip audit still 0 offenders.
- [ ] **Step 3:** Emulate `prefers-reduced-motion: reduce` → confirm marquee/canvas/reveals/count-up/split-text/parallax all static.
- [ ] **Step 4 (commit):** if any fixes, `git commit -am "fix(landing): reduced-motion + verification polish"`.

## Self-Review

- **Spec coverage:** cleanup (T1), emoji `💨` (T1) + `✦` (T3), seamless marquee (T3), scroll-reveals (T2), count-up (T4), hero canvas (T5), split-text headline (T6), parallax/gradient/hover/illustration polish (T7), reduced-motion + verification (T8). All spec sections mapped.
- **Placeholder scan:** none - each task has concrete files, interfaces, algorithm, and verification.
- **Type consistency:** `useReveal` (T2) reused by CountUp/HeroField patterns; `parseStat` signature stable T4; `Marquee`/`SplitText`/`HeroField`/`CountUp` default-export prop shapes fixed at definition.
- **Adaptation noted:** no test runner → tsc + in-browser assertions substitute for runner-based TDD (Global Constraints / header).
