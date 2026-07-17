// Marketing landing page shown to logged-out visitors. Built entirely in the
// app's claymorphic language (navy / blush / cream, Ramaraja display font,
// clay shadows) with organic blob shapes and flat vector illustrations (see
// components/illustrations) — nothing is fetched from the network.
import { useFadeRise, useReveal, prefersReducedMotion } from "../animations";
import LegalFooter from "../components/LegalFooter";
import Marquee from "../components/Marquee";
import CountUp from "../components/CountUp";
import HeroField from "../components/HeroField";
import SplitText from "../components/SplitText";
import {
  Tee, Coat, Jeans, Sneaker, Derby, SunCloud,
  Wardrobe, Chat, Mirror, Calendar,
  Camera, Pin, Sparkles, Bags,
} from "../components/illustrations";

type Ill = (props: { className?: string }) => React.ReactElement;
const BLOBS = ["blob-a", "blob-b", "blob-c", "blob-d"];
const CARD_BLOBS = ["blob-card-a", "blob-card-b", "blob-card-c", "blob-card-d"];

/* --------------------------------------------------------------- content */
// The three core capabilities get editorial rows; the rest a varied trio.
const CORE_FEATURES: {
  kicker: string;
  title: string;
  body: string;
  points: string[];
}[] = [
  {
    kicker: "Today's Recommendations",
    title: "Open the app already dressed for the day",
    body: "Each morning BetterDresser reads the forecast for your city and the events on your calendar, then assembles a full outfit from your own wardrobe: outerwear to shoes, casual Friday to interview.",
    points: [
      "Weather-aware picks for your exact city",
      "Dress codes matched to calendar events",
      "Free and unlimited, on every plan",
    ],
  },
  {
    kicker: "Smart Wardrobe",
    title: "Photograph it once. It's catalogued forever.",
    body: "Upload a photo and the AI fills in category, colour, warmth, formality and season on its own. Add real products from web search and they file themselves alongside your closet.",
    points: [
      "Automatic tagging, no forms to fill",
      "Warmth estimated for real winters",
      "Add pieces straight from web search",
    ],
  },
  {
    kicker: "What To Buy Next",
    title: "Buy the piece your closet is actually missing",
    body: "Gap analysis looks at what you own and how it combines, then suggests specific pieces with real, shoppable links. Five runs a day on the free plan.",
    points: [
      "Real products with live links",
      "A written reason for every suggestion",
      "Five runs a day, free",
    ],
  },
];

const MORE_FEATURES: { Ill: Ill; title: string; body: string; wide?: boolean }[] = [
  { Ill: Chat, title: "DresserAI", body: "A stylist chat that genuinely knows your closet, the weather and your week ahead. Ask for packing lists, date-night looks, or what goes with the green coat.", wide: true },
  { Ill: Mirror, title: "Virtual TryOn", body: "See a garment rendered onto your own photo before you buy it." },
  { Ill: Calendar, title: "Occasion-aware", body: "Interviews, weddings and gym days each get the right dress code." },
];

const STEPS: { Ill: Ill; title: string; body: string }[] = [
  { Ill: Camera, title: "Build your closet", body: "Upload photos or add real products from the web. AI tags each piece as it lands." },
  { Ill: Pin, title: "Tell us your day", body: "Set your city for weather and add the events on your calendar." },
  { Ill: Sparkles, title: "Get dressed", body: "Open Today's Recommendations for a weather-ready outfit, head to toe." },
  { Ill: Bags, title: "Shop the gaps", body: "What To Buy Next shows exactly what's missing, with links to buy it." },
];

const MARQUEE = ["DRESSED FOR THE FORECAST", "KNOWS YOUR CALENDAR", "AI AUTO-TAGGING", "VIRTUAL TRY-ON", "SHOP ONLY THE GAPS", "YOUR CLOSET, DIGITISED"];

/* ----------------------------------------------------------- decorations */
function Glow({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`absolute rounded-full blur-3xl ${className ?? ""}`} style={style} aria-hidden="true" />;
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

/* Four-point sparkle used as the marquee separator (replaces the old star glyph). */
function Diamond({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
    </svg>
  );
}

/* Garment thumbnail: a blobby cream tile holding a flat illustration. */
function Thumb({ Ill, label, blob = "blob-b" }: { Ill: Ill; label: string; blob?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-16 h-16 ${blob} bg-cream grid place-items-center p-2.5 shadow-clay-sm`}>
        <Ill className="w-full h-full" />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-navy/40">{label}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- LANDING */
export default function Landing({
  onGetStarted,
  onSignIn,
}: {
  onGetStarted: () => void; // opens the auth screen on the register form
  onSignIn: () => void; // opens it on the sign-in form
}) {
  const heroText = useFadeRise<HTMLDivElement>();
  const heroArt = useFadeRise<HTMLDivElement>(150);
  const featuresHead = useReveal<HTMLDivElement>();
  const coreRowA = useReveal<HTMLDivElement>();
  const coreRowB = useReveal<HTMLDivElement>();
  const coreRowC = useReveal<HTMLDivElement>();
  const trioGrid = useReveal<HTMLDivElement>({ stagger: true });
  const howHead = useReveal<HTMLDivElement>();
  const stepGrid = useReveal<HTMLDivElement>({ stagger: true });
  const showcase = useReveal<HTMLDivElement>();
  const pricingHead = useReveal<HTMLDivElement>();
  const priceGrid = useReveal<HTMLDivElement>({ stagger: true });
  const cta = useReveal<HTMLDivElement>();

  // Cursor parallax for the hero art (fine pointers only, respects reduced motion).
  const parallaxOn =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches &&
    !prefersReducedMotion();
  const onHeroMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!parallaxOn) return;
    const host = heroArt.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    host.querySelectorAll<HTMLElement>("[data-depth]").forEach((el) => {
      const d = Number(el.dataset.depth);
      el.style.translate = `${-nx * d}px ${-ny * d}px`;
    });
  };
  const onHeroLeave = () => {
    heroArt.current
      ?.querySelectorAll<HTMLElement>("[data-depth]")
      .forEach((el) => (el.style.translate = "0px 0px"));
  };

  return (
    <div className="relative overflow-x-hidden">
      {/* ============================================================ NAV */}
      <header className="sticky top-0 z-40 px-3 sm:px-4 pt-3">
        <nav className="max-w-6xl mx-auto bg-cream-soft/80 backdrop-blur-md blob-card-a shadow-clay-sm px-5 sm:px-7 py-3 flex items-center justify-between">
          <span className="font-brand text-2xl tracking-wide">
            Better<span className="text-blush-deep">Dresser</span>
          </span>
          <div className="hidden md:flex items-center gap-7 text-sm text-navy/60">
            <a href="#features" className="hover:text-navy transition-colors">Features</a>
            <a href="#how" className="hover:text-navy transition-colors">How it works</a>
            <a href="#showcase" className="hover:text-navy transition-colors">A peek inside</a>
            <a href="#pricing" className="hover:text-navy transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onSignIn} className="hidden sm:inline text-sm px-4 py-2 text-navy/70 hover:text-navy transition-colors">
              Sign in
            </button>
            <button onClick={onGetStarted} className="clay-btn blob-pill text-sm px-5 py-2">Get started</button>
          </div>
        </nav>
      </header>

      {/* =========================================================== HERO */}
      <section className="relative grain overflow-hidden">
        <HeroField className="absolute inset-0" />
        <Glow className="animate-blobmorph animate-floaty-slow" style={{ width: 460, height: 460, top: -120, right: -120, background: "radial-gradient(circle at 30% 30%, rgba(250,158,188,0.55), rgba(250,158,188,0) 70%)" }} />
        <Glow className="animate-floaty" style={{ width: 420, height: 420, top: 180, left: -160, background: "radial-gradient(circle at 50% 50%, rgba(27,44,119,0.28), rgba(27,44,119,0) 70%)" }} />
        <Glow style={{ width: 300, height: 300, bottom: -80, right: 120, background: "radial-gradient(circle at 50% 50%, rgba(247,233,212,0.9), rgba(247,233,212,0) 70%)" }} />

        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          <div ref={heroText}>
            <h1 className="font-brand text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight">
              <SplitText text={"Your wardrobe,\nstyled by AI."} accentFrom={2} accentClass="text-gradient-pan" />
            </h1>
            <p className="text-lg text-navy/60 mt-6 max-w-md">
              Photograph your clothes once. BetterDresser tags every piece, checks the forecast
              and your calendar each morning, and hands you a full outfit from what you already own.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <button onClick={onGetStarted} className="clay-btn blob-pill px-7 py-3 text-base">Get started free</button>
              <a href="#how" className="clay-btn-blush blob-pill px-7 py-3 text-base">See how it works</a>
            </div>
            <p className="flex items-center gap-2 mt-6 text-sm text-navy/50">
              <span className="text-blush-deep"><Check /></span>
              Outfit recommendations are free and unlimited. No card required.
            </p>
          </div>

          {/* Hero art: a floating "Today" card + satellites */}
          <div ref={heroArt} onMouseMove={onHeroMove} onMouseLeave={onHeroLeave} className="relative h-[440px] sm:h-[470px]">
            <div data-depth="18" className="absolute inset-x-2 top-4 clay-card blob-card-a p-6 animate-floaty">
              <div className="flex items-center justify-between">
                <p className="font-brand text-2xl">Today</p>
                <span className="clay-chip blob-pill inline-flex items-center gap-1.5"><SunCloud className="w-4 h-4" /> 14° · breezy</span>
              </div>
              <div className="flex justify-between mt-5">
                <Thumb Ill={Coat} label="outer" blob="blob-b" />
                <Thumb Ill={Tee} label="top" blob="blob-c" />
                <Thumb Ill={Jeans} label="bottom" blob="blob-d" />
                <Thumb Ill={Sneaker} label="shoes" blob="blob-a" />
              </div>
              <div className="mt-5 blob-card-c bg-cream px-5 py-3 text-sm text-navy/70 shadow-[inset_3px_3px_8px_rgba(11,25,87,0.06),inset_-3px_-3px_8px_rgba(255,255,255,0.9)]">
                A light layer for the wind, smart enough for your 2pm coffee meeting.
              </div>
            </div>

            <div data-depth="34" className="absolute -left-2 sm:-left-6 bottom-6 clay-card blob-card-d px-4 py-3 animate-floaty-slow max-w-[220px]">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 blob-pill bg-navy text-cream grid place-items-center text-[10px] font-semibold">AI</span>
                <p className="text-xs text-navy/50">DresserAI</p>
              </div>
              <p className="text-sm mt-1.5">"Swap the white tee for the striped one. It lifts the whole fit."</p>
            </div>

            <div data-depth="26" className="absolute right-0 sm:-right-4 bottom-24 clay-card blob-card-b px-4 py-3 animate-floaty">
              <p className="text-xs text-navy/50">Buy next</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-10 h-10 blob-c bg-cream grid place-items-center p-1.5 shadow-clay-sm"><Derby className="w-full h-full" /></span>
                <div>
                  <p className="text-sm font-medium leading-none">Brown derbies</p>
                  <p className="text-xs text-blush-deep font-semibold mt-0.5">from $79</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* marquee ribbon */}
        <div className="relative border-y border-cream-deep bg-cream-soft/60 py-4">
          <Marquee speed={45} gap={40}>
            {MARQUEE.map((w) => (
              <span key={w} className="font-brand text-xl text-navy/30 whitespace-nowrap flex items-center gap-10">
                {w}<Diamond className="w-3.5 h-3.5 text-blush" />
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ======================================================= FEATURES */}
      {/* Three core capabilities as editorial rows (alternating direction,
          each with its own visual composition), then a varied-scale trio.
          Deliberately NOT a grid of identical icon cards. */}
      <section id="features" className="max-w-6xl mx-auto px-4 pt-28 pb-8">
        <div ref={featuresHead} className="max-w-2xl">
          <h2 className="font-brand text-4xl sm:text-5xl tracking-tight">Everything your closet knows, working for you</h2>
          <p className="text-navy/60 mt-4 text-lg">From the moment a garment is photographed to the day you wear it, and the next piece worth buying.</p>
        </div>

        {/* Row A: Today's Recommendations, visual = mini outfit strip */}
        <div ref={coreRowA} className="grid md:grid-cols-2 gap-10 md:gap-16 items-center mt-20">
          <div>
            <p className="text-blush-deep font-semibold text-sm">{CORE_FEATURES[0].kicker}</p>
            <h3 className="font-brand text-3xl sm:text-4xl mt-2 tracking-tight">{CORE_FEATURES[0].title}</h3>
            <p className="text-navy/60 mt-4">{CORE_FEATURES[0].body}</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {CORE_FEATURES[0].points.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <span className="text-blush-deep mt-0.5"><Check /></span>
                  <span className="text-navy/70">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="clay-card blob-card-b p-6">
              <div className="flex items-center justify-between">
                <p className="font-brand text-xl">Tuesday's look</p>
                <span className="clay-chip blob-pill inline-flex items-center gap-1.5"><SunCloud className="w-4 h-4" /> 11° · light rain</span>
              </div>
              <div className="flex justify-between mt-5">
                <Thumb Ill={Coat} label="outer" blob="blob-a" />
                <Thumb Ill={Tee} label="top" blob="blob-d" />
                <Thumb Ill={Jeans} label="bottom" blob="blob-b" />
                <Thumb Ill={Derby} label="shoes" blob="blob-c" />
              </div>
              <p className="mt-5 text-sm text-navy/60">Rain first thing, then your 3pm review. The trench earns its keep today.</p>
            </div>
          </div>
        </div>

        {/* Row B: Smart Wardrobe, reversed, visual = large tile + floating tags */}
        <div ref={coreRowB} className="grid md:grid-cols-2 gap-10 md:gap-16 items-center mt-24">
          <div className="relative md:order-1 order-2">
            <div className="clay-card blob-card-c p-10 grid place-items-center">
              <Wardrobe className="w-48 h-48" />
            </div>
            <div className="absolute -right-2 top-6 clay-card blob-card-d px-4 py-2.5 animate-floaty">
              <p className="text-xs text-navy/50">auto-tagged</p>
              <p className="text-sm font-medium">wool coat · warm · formal</p>
            </div>
            <div className="absolute -left-2 bottom-6 clay-card blob-card-a px-4 py-2.5 animate-floaty-slow">
              <p className="text-xs text-navy/50">auto-tagged</p>
              <p className="text-sm font-medium">white tee · light · casual</p>
            </div>
          </div>
          <div className="md:order-2 order-1">
            <p className="text-blush-deep font-semibold text-sm">{CORE_FEATURES[1].kicker}</p>
            <h3 className="font-brand text-3xl sm:text-4xl mt-2 tracking-tight">{CORE_FEATURES[1].title}</h3>
            <p className="text-navy/60 mt-4">{CORE_FEATURES[1].body}</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {CORE_FEATURES[1].points.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <span className="text-blush-deep mt-0.5"><Check /></span>
                  <span className="text-navy/70">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Row C: What To Buy Next, visual = suggestion + price satellite */}
        <div ref={coreRowC} className="grid md:grid-cols-2 gap-10 md:gap-16 items-center mt-24">
          <div>
            <p className="text-blush-deep font-semibold text-sm">{CORE_FEATURES[2].kicker}</p>
            <h3 className="font-brand text-3xl sm:text-4xl mt-2 tracking-tight">{CORE_FEATURES[2].title}</h3>
            <p className="text-navy/60 mt-4">{CORE_FEATURES[2].body}</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {CORE_FEATURES[2].points.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <span className="text-blush-deep mt-0.5"><Check /></span>
                  <span className="text-navy/70">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="clay-card blob-card-a p-6">
              <p className="text-xs text-navy/50">the gap in your closet</p>
              <p className="font-medium mt-1">Brown leather derbies</p>
              <p className="text-sm text-navy/60 mt-2">Your smart-casual outfits keep landing on the same white sneakers. One dressier shoe unlocks four coats you already own.</p>
              <div className="flex items-center gap-3 mt-4">
                <span className="w-14 h-14 blob-c bg-cream grid place-items-center p-2 shadow-clay-sm"><Derby className="w-full h-full" /></span>
                <span className="clay-chip blob-pill">from $79 · 6 stores</span>
              </div>
            </div>
          </div>
        </div>

        {/* Varied-scale trio for the remaining capabilities */}
        <div ref={trioGrid} className="grid md:grid-cols-2 gap-6 mt-24">
          {MORE_FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`group clay-card clay-card-hover ${CARD_BLOBS[(i + 1) % 4]} p-7 ${f.wide ? "md:col-span-2 md:flex md:items-center md:gap-8" : ""}`}
            >
              <div className={`w-16 h-16 shrink-0 ${BLOBS[(i + 2) % 4]} bg-cream grid place-items-center p-3 shadow-clay-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                <f.Ill className="w-full h-full" />
              </div>
              <div>
                <h3 className="font-brand text-2xl mt-5 md:mt-0">{f.title}</h3>
                <p className="text-sm text-navy/60 mt-2 leading-relaxed max-w-xl">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================== HOW IT WORKS */}
      <section id="how" className="relative overflow-hidden py-24">
        <Glow style={{ width: 380, height: 380, top: 40, left: -140, background: "radial-gradient(circle, rgba(250,158,188,0.35), rgba(250,158,188,0) 70%)" }} />
        <div className="max-w-6xl mx-auto px-4 relative">
          <div ref={howHead} className="max-w-2xl">
            <h2 className="font-brand text-4xl sm:text-5xl tracking-tight">From closet to confident</h2>
            <p className="text-navy/60 mt-4 text-lg">One photo session, then it mostly runs itself.</p>
          </div>
          {/* A single connected flow, not four numbered cards: a hand-drawn
              dashed path links the step illustrations on wide screens. */}
          <div className="relative mt-16">
            <svg
              viewBox="0 0 1200 80"
              preserveAspectRatio="none"
              className="hidden lg:block absolute inset-x-0 top-10 w-full h-20 text-blush"
              aria-hidden="true"
            >
              <path
                d="M60 40 C 220 -10, 380 90, 540 40 S 860 -10, 1140 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="2 10"
                strokeLinecap="round"
              />
            </svg>
            <div ref={stepGrid} className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
              {STEPS.map((s, i) => (
                <div key={s.title} className="group">
                  <div className={`w-20 h-20 ${BLOBS[(i + 2) % 4]} bg-cream-soft grid place-items-center p-3.5 shadow-clay transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                    <s.Ill className="w-full h-full" />
                  </div>
                  <h3 className="font-semibold text-lg mt-5">{s.title}</h3>
                  <p className="text-sm text-navy/60 mt-2 max-w-[26ch]">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================= SHOWCASE */}
      <section id="showcase" className="max-w-6xl mx-auto px-4 py-20">
        <div className="max-w-2xl mb-10">
          <h2 className="font-brand text-4xl sm:text-5xl tracking-tight">This is the actual app</h2>
          <p className="text-navy/60 mt-4 text-lg">Not a concept render. What you see here is what you sign into.</p>
        </div>
        {/* TODO(D10): swap the inner mock for real screenshots at /screens/*.png
            once the app relayout lands; the frame below stays as-is. */}
        <div ref={showcase} className="clay-card blob-card-a p-3 sm:p-5 overflow-hidden">
          <div className="rounded-[2rem] bg-cream overflow-hidden shadow-[inset_2px_2px_10px_rgba(11,25,87,0.05)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-cream-deep">
              <span className="w-3 h-3 rounded-full bg-blush" />
              <span className="w-3 h-3 rounded-full bg-cream-deep" />
              <span className="w-3 h-3 rounded-full bg-navy/20" />
              <span className="font-brand text-lg ml-3">Better<span className="text-blush-deep">Dresser</span></span>
              <div className="ml-auto hidden sm:flex gap-2 text-xs text-navy/50">
                {["My Wardrobe", "Today's Recommendations", "DresserAI"].map((t, i) => (
                  <span key={t} className={`px-3 py-1 blob-pill whitespace-nowrap ${i === 1 ? "bg-navy text-cream" : "bg-cream-soft shadow-clay-sm"}`}>{t}</span>
                ))}
              </div>
            </div>
            <div className="p-5 sm:p-8 grid md:grid-cols-3 gap-5">
              <div className="md:col-span-2 clay-card blob-card-c p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-brand text-2xl">Your outfit for today</h3>
                  <span className="clay-chip blob-pill">source: AI</span>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-5">
                  {[
                    { Ill: Coat, l: "Trench" },
                    { Ill: Tee, l: "Striped tee" },
                    { Ill: Jeans, l: "Dark denim" },
                    { Ill: Sneaker, l: "White sneakers" },
                  ].map((g, gi) => (
                    <div key={g.l} className={`${BLOBS[gi % 4]} bg-cream-soft shadow-clay-sm p-3 text-center`}>
                      <div className="w-full aspect-square p-1"><g.Ill className="w-full h-full" /></div>
                      <p className="text-[11px] text-navy/50 mt-1">{g.l}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-navy/60 mt-4">Cool and breezy today, with a dressier lean for your afternoon meeting. Layered but easy to shed indoors.</p>
              </div>
              <div className="space-y-5">
                <div className="clay-card blob-card-b p-5">
                  <div className="flex items-center gap-3">
                    <span className="w-12 h-12 shrink-0"><SunCloud className="w-full h-full" /></span>
                    <div>
                      <p className="text-xs text-navy/50">Waterloo, ON</p>
                      <p className="font-brand text-3xl leading-none">14°</p>
                    </div>
                  </div>
                  <p className="text-sm text-navy/60 mt-3">Partly cloudy · wind 12 km/h</p>
                </div>
                <div className="clay-card blob-card-d p-5">
                  <p className="text-xs text-navy/50 mb-2">DresserAI</p>
                  <p className="text-sm">"Add the tan belt. It ties the sneakers and trench together."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== PRICING */}
      {/* Deliberately asymmetric: Free is a quiet panel, Plus is the hero
          card. Same information, honest visual weight. */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 py-24">
        <div ref={pricingHead} className="max-w-2xl">
          <h2 className="font-brand text-4xl sm:text-5xl tracking-tight">Start free. Upgrade if you love it.</h2>
          <p className="text-navy/60 mt-4 text-lg">Outfit recommendations never cost anything. Plus lifts the caps on the extras.</p>
        </div>

        <div ref={priceGrid} className="grid md:grid-cols-5 gap-6 mt-12 items-center">
          {/* Free: compact, quiet */}
          <div className="md:col-span-2 rounded-3xl border-2 border-cream-deep bg-cream-soft p-7">
            <p className="font-brand text-2xl">Free</p>
            <p className="mt-1"><CountUp value="$0" className="font-brand text-4xl" /><span className="text-navy/50 text-sm"> forever, no card</span></p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {["Unlimited outfit recommendations", "Full wardrobe with AI auto-tagging", "Daily Buy Next, weekly DresserAI & TryOn"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="text-blush-deep mt-0.5"><Check /></span>
                  <span className="text-navy/70">{t}</span>
                </li>
              ))}
            </ul>
            <button onClick={onGetStarted} className="w-full mt-6 py-2.5 rounded-full border-2 border-navy/15 text-navy font-medium hover:border-navy/40 transition-colors">
              Get started
            </button>
          </div>

          {/* Plus: the hero card */}
          <div className="md:col-span-3 clay-card blob-card-d p-8 sm:p-10 relative bg-navy text-cream shadow-clay-navy overflow-hidden">
            <Glow style={{ width: 260, height: 260, top: -100, right: -80, background: "radial-gradient(circle, rgba(250,158,188,0.5), rgba(250,158,188,0) 70%)" }} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="font-brand text-3xl">Plus</p>
                <span className="blob-pill bg-blush text-navy text-xs font-semibold px-3 py-1">Most popular</span>
              </div>
              <p className="mt-2"><CountUp value="$5" className="font-brand text-6xl" /><span className="text-cream/60"> / month</span></p>
              <ul className="mt-6 space-y-3 text-sm sm:columns-2 sm:gap-8">
                {["Everything in Free", "Unlimited Buy Next suggestions", "Unlimited DresserAI chat", "Unlimited Virtual TryOn renders", "Cancel anytime, keep access to term-end"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 break-inside-avoid mb-3">
                    <span className="text-blush mt-0.5"><Check /></span>
                    <span className="text-cream/85">{t}</span>
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="clay-btn-blush rounded-full w-full sm:w-auto sm:px-10 py-3 mt-4">Go Plus</button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================= CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div ref={cta} className="relative overflow-hidden blob-card-a p-10 sm:p-16 text-center text-cream shadow-clay-navy gradient-pan" style={{ backgroundImage: "linear-gradient(120deg, #071140, #1B2C77 45%, #F2769F)" }}>
          <div className="grain absolute inset-0" />
          <div className="relative">
            <h2 className="font-brand text-4xl sm:text-6xl">Dress better, effortlessly.</h2>
            <p className="text-cream/70 mt-4 max-w-lg mx-auto">Your closet already has great outfits in it. Let BetterDresser find them, free, no card required.</p>
            <button onClick={onGetStarted} className="mt-8 blob-pill bg-cream text-navy font-semibold px-8 py-3.5 shadow-clay hover:-translate-y-0.5 active:translate-y-0.5 transition duration-200 ease-out-strong">
              Start dressing smarter →
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================== FOOTER */}
      <footer className="max-w-6xl mx-auto px-4 pt-8">
        <div className="clay-card blob-card-a p-8 sm:p-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <p className="font-brand text-2xl">Better<span className="text-blush-deep">Dresser</span></p>
            <p className="text-sm text-navy/50 mt-2 max-w-[220px]">A digital wardrobe with an AI stylist that dresses you for real life.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-navy/40 mb-3">Product</p>
            <ul className="space-y-2 text-sm text-navy/60">
              <li><a href="#features" className="hover:text-navy">Features</a></li>
              <li><a href="#how" className="hover:text-navy">How it works</a></li>
              <li><a href="#showcase" className="hover:text-navy">A peek inside</a></li>
              <li><a href="#pricing" className="hover:text-navy">Pricing</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-navy/40 mb-3">Get started</p>
            <ul className="space-y-2 text-sm text-navy/60">
              <li><button onClick={onGetStarted} className="hover:text-navy">Create an account</button></li>
              <li><button onClick={onSignIn} className="hover:text-navy">Sign in</button></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-navy/40 mb-3">Say hi</p>
            <p className="text-sm text-navy/60">iyengar.anirud@gmail.com</p>
          </div>
        </div>
      </footer>

      <LegalFooter />
    </div>
  );
}
