// Marketing landing page shown to logged-out visitors. Built entirely in the
// app's claymorphic language (navy / blush / cream, Ramaraja display font,
// clay shadows) with organic blob shapes and flat vector illustrations (see
// components/illustrations) — nothing is fetched from the network.
import { useFadeRise, useReveal } from "../animations";
import LegalFooter from "../components/LegalFooter";
import Marquee from "../components/Marquee";
import CountUp from "../components/CountUp";
import HeroField from "../components/HeroField";
import {
  Tee, Coat, Jeans, Sneaker, Derby, SunCloud,
  Wardrobe, Bag, Chat, Mirror, Calendar,
  Camera, Pin, Sparkles, Bags, Avatar,
} from "../components/illustrations";

type Ill = (props: { className?: string }) => React.ReactElement;
const BLOBS = ["blob-a", "blob-b", "blob-c", "blob-d"];
const CARD_BLOBS = ["blob-card-a", "blob-card-b", "blob-card-c", "blob-card-d"];

/* --------------------------------------------------------------- content */
const FEATURES: { Ill: Ill; title: string; body: string }[] = [
  { Ill: Wardrobe, title: "Smart Wardrobe", body: "Snap a photo and AI tags category, colour, warmth, formality and season, automatically." },
  { Ill: SunCloud, title: "Today's Outfit", body: "A full look assembled from what you already own, matched to the forecast and your calendar." },
  { Ill: Bag, title: "Buy Next", body: "Gap analysis with real, shoppable links, so you only buy what your closet is actually missing." },
  { Ill: Chat, title: "DresserAI", body: "Chat with a stylist that genuinely knows your closet, the weather and your week ahead." },
  { Ill: Mirror, title: "Virtual TryOn", body: "See a garment rendered onto your own photo before you commit to buying it." },
  { Ill: Calendar, title: "Occasion-Aware", body: "Add interviews, weddings or gym days and every outfit matches the dress code for you." },
];

const STEPS: { n: string; Ill: Ill; title: string; body: string }[] = [
  { n: "01", Ill: Camera, title: "Build your closet", body: "Upload photos or add real products from the web. AI tags each piece as it lands." },
  { n: "02", Ill: Pin, title: "Tell us your day", body: "Set your city for weather and add the events on your calendar." },
  { n: "03", Ill: Sparkles, title: "Get dressed", body: "Open Today for a weather- and occasion-ready outfit, head to toe." },
  { n: "04", Ill: Bags, title: "Shop the gaps", body: "Buy Next shows exactly what's missing, with links to buy it." },
];

const STATS = [
  { v: "1 tap", l: "to add a garment" },
  { v: "7-day", l: "outfit planning" },
  { v: "$5/mo", l: "for unlimited" },
  { v: "$0", l: "card to start" },
];

const MARQUEE = ["MINIMAL", "STREETWEAR", "SMART CASUAL", "WEATHER-AWARE", "CALENDAR-SYNCED", "AI TRY-ON", "SHOP THE GAPS", "OWN YOUR STYLE"];

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
export default function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  const heroText = useFadeRise<HTMLDivElement>();
  const heroArt = useFadeRise<HTMLDivElement>(150);
  const statsGrid = useReveal<HTMLDivElement>({ stagger: true });
  const featuresHead = useReveal<HTMLDivElement>();
  const featureGrid = useReveal<HTMLDivElement>({ stagger: true });
  const howHead = useReveal<HTMLDivElement>();
  const stepGrid = useReveal<HTMLDivElement>({ stagger: true });
  const showcase = useReveal<HTMLDivElement>();
  const pricingHead = useReveal<HTMLDivElement>();
  const priceGrid = useReveal<HTMLDivElement>({ stagger: true });
  const cta = useReveal<HTMLDivElement>();

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
            <button onClick={onGetStarted} className="hidden sm:inline text-sm px-4 py-2 text-navy/70 hover:text-navy transition-colors">
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
            <span className="clay-chip blob-pill inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Your AI-powered personal stylist</span>
            <h1 className="font-brand text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mt-5">
              Your wardrobe,
              <br />
              <span className="text-blush-deep">styled by AI.</span>
            </h1>
            <p className="text-lg text-navy/60 mt-5 max-w-md">
              BetterDresser catalogues every piece you own, then dresses you for the weather, your
              calendar and your taste, and tells you exactly what's worth buying next.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <button onClick={onGetStarted} className="clay-btn blob-pill px-7 py-3 text-base">Get started free</button>
              <a href="#how" className="clay-btn-blush blob-pill px-7 py-3 text-base">See how it works</a>
            </div>
            <div className="flex items-center gap-4 mt-6 text-sm text-navy/50">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3].map((n) => (
                  <span key={n} className="w-8 h-8 rounded-full overflow-hidden shadow-clay-sm ring-2 ring-cream-soft">
                    <Avatar i={n} />
                  </span>
                ))}
              </div>
              <span>Free outfits forever, no card required</span>
            </div>
          </div>

          {/* Hero art: a floating "Today" card + satellites */}
          <div ref={heroArt} className="relative h-[440px] sm:h-[470px]">
            <div className="absolute inset-x-2 top-4 clay-card blob-card-a p-6 animate-floaty">
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

            <div className="absolute -left-2 sm:-left-6 bottom-6 clay-card blob-card-d px-4 py-3 animate-floaty-slow max-w-[220px]">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 blob-pill bg-navy text-cream grid place-items-center text-[10px] font-semibold">AI</span>
                <p className="text-xs text-navy/50">DresserAI</p>
              </div>
              <p className="text-sm mt-1.5">"Swap the white tee for the striped one. It lifts the whole fit."</p>
            </div>

            <div className="absolute right-0 sm:-right-4 bottom-24 clay-card blob-card-b px-4 py-3 animate-floaty">
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

      {/* ========================================================== STATS */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        <div ref={statsGrid} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <div key={s.l} className={`clay-card ${BLOBS[i % 4]} px-5 py-6 text-center`}>
              <p className="font-brand text-3xl text-navy"><CountUp value={s.v} /></p>
              <p className="text-xs text-navy/50 mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================= FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-4 pt-24 pb-8">
        <div ref={featuresHead} className="text-center max-w-2xl mx-auto">
          <span className="clay-chip blob-pill">Everything, in one closet</span>
          <h2 className="font-brand text-4xl sm:text-5xl mt-4">Six ways to dress smarter</h2>
          <p className="text-navy/60 mt-3">From the moment a garment enters your wardrobe to the day you wear it, and the next thing you buy.</p>
        </div>

        <div ref={featureGrid} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`clay-card clay-card-hover ${CARD_BLOBS[i % 4]} p-7`}>
              <div className={`w-16 h-16 ${BLOBS[(i + 1) % 4]} bg-cream grid place-items-center p-3 shadow-clay-sm`}>
                <f.Ill className="w-full h-full" />
              </div>
              <h3 className="font-brand text-2xl mt-5">{f.title}</h3>
              <p className="text-sm text-navy/60 mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================== HOW IT WORKS */}
      <section id="how" className="relative overflow-hidden py-24">
        <Glow style={{ width: 380, height: 380, top: 40, left: -140, background: "radial-gradient(circle, rgba(250,158,188,0.35), rgba(250,158,188,0) 70%)" }} />
        <div className="max-w-6xl mx-auto px-4 relative">
          <div ref={howHead} className="text-center max-w-2xl mx-auto">
            <span className="clay-chip blob-pill">Four steps</span>
            <h2 className="font-brand text-4xl sm:text-5xl mt-4">From closet to confident</h2>
          </div>
          <div ref={stepGrid} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`clay-card clay-card-hover ${CARD_BLOBS[i % 4]} p-6`}>
                <div className={`w-14 h-14 ${BLOBS[(i + 2) % 4]} bg-cream grid place-items-center p-2.5 shadow-clay-sm`}>
                  <s.Ill className="w-full h-full" />
                </div>
                <p className="font-brand text-blush-deep text-lg mt-4">{s.n}</p>
                <h3 className="font-semibold text-lg mt-1">{s.title}</h3>
                <p className="text-sm text-navy/60 mt-2">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================= SHOWCASE */}
      <section id="showcase" className="max-w-6xl mx-auto px-4 py-16">
        <div ref={showcase} className="clay-card blob-card-a p-3 sm:p-5 overflow-hidden">
          <div className="rounded-[2rem] bg-cream overflow-hidden shadow-[inset_2px_2px_10px_rgba(11,25,87,0.05)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-cream-deep">
              <span className="w-3 h-3 rounded-full bg-blush" />
              <span className="w-3 h-3 rounded-full bg-cream-deep" />
              <span className="w-3 h-3 rounded-full bg-navy/20" />
              <span className="font-brand text-lg ml-3">Better<span className="text-blush-deep">Dresser</span></span>
              <div className="ml-auto hidden sm:flex gap-2 text-xs text-navy/50">
                {["Wardrobe", "Today", "Buy Next", "DresserAI", "TryOn"].map((t, i) => (
                  <span key={t} className={`px-3 py-1 blob-pill ${i === 1 ? "bg-navy text-cream" : "bg-cream-soft shadow-clay-sm"}`}>{t}</span>
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
      <section id="pricing" className="max-w-5xl mx-auto px-4 py-24">
        <div ref={pricingHead} className="text-center max-w-2xl mx-auto">
          <span className="clay-chip blob-pill">Simple pricing</span>
          <h2 className="font-brand text-4xl sm:text-5xl mt-4">Start free. Upgrade if you love it.</h2>
          <p className="text-navy/60 mt-3">Outfit recommendations are always free and unlimited. Plus lifts the weekly caps on the extras.</p>
        </div>

        <div ref={priceGrid} className="grid md:grid-cols-2 gap-6 mt-12 items-start">
          {/* Free */}
          <div className="clay-card blob-card-a p-8">
            <p className="font-brand text-2xl">Free</p>
            <p className="mt-2"><span className="font-brand text-5xl">$0</span><span className="text-navy/50"> / forever</span></p>
            <button onClick={onGetStarted} className="clay-btn-blush rounded-full w-full py-3 mt-6">Get started</button>
            <ul className="mt-6 space-y-3 text-sm">
              {["Unlimited outfit recommendations", "Full wardrobe + AI auto-tagging", "Weather & calendar aware", "A weekly allowance of Buy Next, DresserAI & TryOn"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="text-blush-deep mt-0.5"><Check /></span>
                  <span className="text-navy/70">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plus */}
          <div className="clay-card blob-card-d p-8 relative bg-navy text-cream shadow-clay-navy overflow-hidden">
            <Glow style={{ width: 260, height: 260, top: -100, right: -80, background: "radial-gradient(circle, rgba(250,158,188,0.5), rgba(250,158,188,0) 70%)" }} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="font-brand text-2xl">Plus</p>
                <span className="blob-pill bg-blush text-navy text-xs font-semibold px-3 py-1">Most popular</span>
              </div>
              <p className="mt-2"><span className="font-brand text-5xl">$5</span><span className="text-cream/60"> / month</span></p>
              <button onClick={onGetStarted} className="clay-btn-blush rounded-full w-full py-3 mt-6">Go Plus</button>
              <ul className="mt-6 space-y-3 text-sm">
                {["Everything in Free", "Unlimited Buy Next suggestions", "Unlimited DresserAI chat", "Unlimited Virtual TryOn renders", "Cancel anytime, keep access to term-end"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span className="text-blush mt-0.5"><Check /></span>
                    <span className="text-cream/85">{t}</span>
                  </li>
                ))}
              </ul>
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
            <button onClick={onGetStarted} className="mt-8 blob-pill bg-cream text-navy font-semibold px-8 py-3.5 shadow-clay hover:-translate-y-0.5 active:translate-y-0.5 transition-all">
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
              <li><button onClick={onGetStarted} className="hover:text-navy">Sign in</button></li>
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
