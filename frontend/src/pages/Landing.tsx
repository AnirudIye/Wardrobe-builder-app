// Marketing landing page shown to logged-out visitors. Built entirely in the
// app's claymorphic language (navy / blush / cream, Ramaraja display font,
// clay shadows) so it feels native to BetterDresser. Illustrations are inline
// SVG + emoji thumbnails so nothing is fetched from the network.
import { useFadeRise, useStaggerReveal } from "../animations";
import LegalFooter from "../components/LegalFooter";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* ------------------------------------------------------------------ icons */
const icons = {
  wardrobe: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" {...stroke}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.6" />
      <line x1="12" y1="3.5" x2="12" y2="20.5" />
      <line x1="9.6" y1="10" x2="9.6" y2="13" />
      <line x1="14.4" y1="10" x2="14.4" y2="13" />
    </svg>
  ),
  today: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" {...stroke}>
      <circle cx="12" cy="12" r="3.6" />
      <line x1="12" y1="3" x2="12" y2="5.5" />
      <line x1="12" y1="18.5" x2="12" y2="21" />
      <line x1="3" y1="12" x2="5.5" y2="12" />
      <line x1="18.5" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="7.4" y2="7.4" />
      <line x1="16.6" y1="16.6" x2="18.4" y2="18.4" />
      <line x1="16.6" y1="7.4" x2="18.4" y2="5.6" />
      <line x1="5.6" y1="18.4" x2="7.4" y2="16.6" />
    </svg>
  ),
  bag: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" {...stroke}>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" {...stroke}>
      <rect x="4" y="5" width="16" height="12" rx="2.6" />
      <path d="M9 17v3l4-3" />
      <path d="M15 8l.6 1.5L17 10l-1.4.5L15 12l-.6-1.5L13 10l1.4-.5L15 8Z" />
    </svg>
  ),
  tryon: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" {...stroke}>
      <path d="M11 4l1.3 3.4L15.7 8.7 12.3 10 11 13.4 9.7 10 6.3 8.7 9.7 7.4 11 4Z" />
      <path d="M17.5 13l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9Z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" {...stroke}>
      <rect x="4" y="5.2" width="16" height="14.8" rx="2" />
      <line x1="4" y1="9.2" x2="20" y2="9.2" />
      <line x1="9" y1="3" x2="9" y2="6" />
      <line x1="15" y1="3" x2="15" y2="6" />
      <circle cx="9" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" {...stroke} strokeWidth={2.4}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  ),
};

/* --------------------------------------------------------------- content */
const FEATURES = [
  { key: "wardrobe", tone: "navy", title: "Smart Wardrobe", body: "Snap a photo and AI tags category, colour, warmth, formality and season — automatically." },
  { key: "today", tone: "blush", title: "Today's Outfit", body: "A full look assembled from what you already own, matched to the forecast and your calendar." },
  { key: "bag", tone: "navy", title: "Buy Next", body: "Gap analysis with real, shoppable links — so you only buy what your closet is actually missing." },
  { key: "chat", tone: "blush", title: "DresserAI", body: "Chat with a stylist that genuinely knows your closet, the weather and your week ahead." },
  { key: "tryon", tone: "navy", title: "Virtual TryOn", body: "See a garment rendered onto your own photo before you commit to buying it." },
  { key: "calendar", tone: "blush", title: "Occasion-Aware", body: "Add interviews, weddings or gym days and every outfit matches the dress code for you." },
] as const;

const STEPS = [
  { n: "01", emoji: "📸", title: "Build your closet", body: "Upload photos or add real products from the web. AI tags each piece as it lands." },
  { n: "02", emoji: "📍", title: "Tell us your day", body: "Set your city for weather and add the events on your calendar." },
  { n: "03", emoji: "✨", title: "Get dressed", body: "Open Today for a weather- and occasion-ready outfit, head to toe." },
  { n: "04", emoji: "🛍️", title: "Shop the gaps", body: "Buy Next shows exactly what's missing, with links to buy it." },
];

const STATS = [
  { v: "1 tap", l: "to add a garment" },
  { v: "7-day", l: "outfit planning" },
  { v: "$5/mo", l: "for unlimited" },
  { v: "$0", l: "card to start" },
];

const TESTIMONIALS = [
  { q: "I stopped standing in front of my closet at 8am. It just tells me what to wear.", n: "Maya R.", r: "Product designer", i: "MR", tone: "blush" },
  { q: "Buy Next talked me out of my third navy jacket and into the shoes I actually needed.", n: "Devin K.", r: "Consultant", i: "DK", tone: "navy" },
  { q: "The weather-aware picks are scarily good — I haven't been caught underdressed since.", n: "Priya S.", r: "Grad student", i: "PS", tone: "blush" },
];

const MARQUEE = ["MINIMAL", "STREETWEAR", "SMART CASUAL", "WEATHER-AWARE", "CALENDAR-SYNCED", "AI TRY-ON", "SHOP THE GAPS", "OWN YOUR STYLE"];

/* ----------------------------------------------------------- decorations */
function Blob({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`absolute rounded-full blur-3xl ${className ?? ""}`} style={style} aria-hidden="true" />;
}

/* A little garment thumbnail tile (emoji on clay). */
function Thumb({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 rounded-2xl bg-cream grid place-items-center text-3xl shadow-clay-sm">{emoji}</div>
      <span className="text-[10px] uppercase tracking-wide text-navy/40">{label}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- LANDING */
export default function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  const heroText = useFadeRise<HTMLDivElement>();
  const heroArt = useFadeRise<HTMLDivElement>(150);
  const featureGrid = useStaggerReveal<HTMLDivElement>(1);
  const stepGrid = useStaggerReveal<HTMLDivElement>(1);
  const priceGrid = useStaggerReveal<HTMLDivElement>(1);

  return (
    <div className="relative overflow-x-hidden">
      {/* ============================================================ NAV */}
      <header className="sticky top-0 z-40 px-3 sm:px-4 pt-3">
        <nav className="max-w-6xl mx-auto bg-cream-soft/80 backdrop-blur-md rounded-2xl shadow-clay-sm px-4 sm:px-6 py-3 flex items-center justify-between">
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
            <button onClick={onGetStarted} className="hidden sm:inline text-sm px-4 py-2 rounded-2xl text-navy/70 hover:text-navy transition-colors">
              Sign in
            </button>
            <button onClick={onGetStarted} className="clay-btn text-sm px-5 py-2">Get started</button>
          </div>
        </nav>
      </header>

      {/* =========================================================== HERO */}
      <section className="relative grain overflow-hidden">
        <Blob className="animate-blobmorph animate-floaty-slow" style={{ width: 460, height: 460, top: -120, right: -120, background: "radial-gradient(circle at 30% 30%, rgba(250,158,188,0.55), rgba(250,158,188,0) 70%)" }} />
        <Blob className="animate-floaty" style={{ width: 420, height: 420, top: 180, left: -160, background: "radial-gradient(circle at 50% 50%, rgba(27,44,119,0.28), rgba(27,44,119,0) 70%)" }} />
        <Blob style={{ width: 300, height: 300, bottom: -80, right: 120, background: "radial-gradient(circle at 50% 50%, rgba(247,233,212,0.9), rgba(247,233,212,0) 70%)" }} />

        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          <div ref={heroText}>
            <span className="clay-chip inline-flex items-center gap-1.5">✨ Your AI-powered personal stylist</span>
            <h1 className="font-brand text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mt-5">
              Your wardrobe,
              <br />
              <span className="text-blush-deep">styled by AI.</span>
            </h1>
            <p className="text-lg text-navy/60 mt-5 max-w-md">
              BetterDresser catalogues every piece you own, then dresses you for the weather, your
              calendar and your taste — and tells you exactly what's worth buying next.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <button onClick={onGetStarted} className="clay-btn px-7 py-3 text-base">Get started — it's free</button>
              <a href="#how" className="clay-btn-blush px-7 py-3 text-base">See how it works</a>
            </div>
            <div className="flex items-center gap-4 mt-6 text-sm text-navy/50">
              <div className="flex -space-x-2">
                {["🧑🏽", "👩🏼", "🧑🏾", "👩🏻"].map((e, i) => (
                  <span key={i} className="w-8 h-8 rounded-full bg-cream grid place-items-center text-sm shadow-clay-sm ring-2 ring-cream-soft">{e}</span>
                ))}
              </div>
              <span>Free outfits forever · no card required</span>
            </div>
          </div>

          {/* Hero art: a floating "Today" card + satellites */}
          <div ref={heroArt} className="relative h-[420px] sm:h-[460px]">
            <div className="absolute inset-x-2 top-4 clay-card p-6 animate-floaty">
              <div className="flex items-center justify-between">
                <p className="font-brand text-2xl">Today</p>
                <span className="clay-chip inline-flex items-center gap-1">⛅ 14° · breezy</span>
              </div>
              <div className="flex justify-between mt-5">
                <Thumb emoji="🧥" label="outer" />
                <Thumb emoji="👕" label="top" />
                <Thumb emoji="👖" label="bottom" />
                <Thumb emoji="👟" label="shoes" />
              </div>
              <div className="mt-5 rounded-2xl bg-cream px-4 py-3 text-sm text-navy/70 shadow-[inset_3px_3px_8px_rgba(11,25,87,0.06),inset_-3px_-3px_8px_rgba(255,255,255,0.9)]">
                A light layer for the wind, smart enough for your 2pm coffee meeting.
              </div>
            </div>

            <div className="absolute -left-2 sm:-left-6 bottom-6 clay-card px-4 py-3 animate-floaty-slow max-w-[220px]">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-navy text-cream grid place-items-center text-xs">AI</span>
                <p className="text-xs text-navy/50">DresserAI</p>
              </div>
              <p className="text-sm mt-1.5">"Swap the white tee for the striped one — it lifts the whole fit."</p>
            </div>

            <div className="absolute right-0 sm:-right-4 bottom-20 clay-card px-4 py-3 animate-floaty">
              <p className="text-xs text-navy/50">Buy next</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl">👞</span>
                <div>
                  <p className="text-sm font-medium leading-none">Brown derbies</p>
                  <p className="text-xs text-blush-deep font-semibold mt-0.5">from $79</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* marquee ribbon */}
        <div className="relative border-y border-cream-deep bg-cream-soft/60 py-4 overflow-hidden">
          <div className="flex w-max animate-marquee gap-10 pr-10">
            {[...MARQUEE, ...MARQUEE].map((w, i) => (
              <span key={i} className="font-brand text-xl text-navy/30 whitespace-nowrap flex items-center gap-10">
                {w}<span className="text-blush">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================== STATS */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.l} className="clay-card px-5 py-6 text-center">
              <p className="font-brand text-3xl text-navy">{s.v}</p>
              <p className="text-xs text-navy/50 mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================= FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-4 pt-24 pb-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="clay-chip">Everything, in one closet</span>
          <h2 className="font-brand text-4xl sm:text-5xl mt-4">Six ways to dress smarter</h2>
          <p className="text-navy/60 mt-3">From the moment a garment enters your wardrobe to the day you wear it — and the next thing you buy.</p>
        </div>

        <div ref={featureGrid} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {FEATURES.map((f) => (
            <div key={f.key} className="clay-card clay-card-hover p-7 group">
              <div className={`w-14 h-14 rounded-2xl grid place-items-center shadow-clay-sm ${f.tone === "navy" ? "bg-navy text-cream" : "bg-blush text-navy"}`}>
                {icons[f.key]}
              </div>
              <h3 className="font-brand text-2xl mt-5">{f.title}</h3>
              <p className="text-sm text-navy/60 mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================== HOW IT WORKS */}
      <section id="how" className="relative overflow-hidden py-24">
        <Blob style={{ width: 380, height: 380, top: 40, left: -140, background: "radial-gradient(circle, rgba(250,158,188,0.35), rgba(250,158,188,0) 70%)" }} />
        <div className="max-w-6xl mx-auto px-4 relative">
          <div className="text-center max-w-2xl mx-auto">
            <span className="clay-chip">Four steps</span>
            <h2 className="font-brand text-4xl sm:text-5xl mt-4">From closet to confident</h2>
          </div>
          <div ref={stepGrid} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {STEPS.map((s) => (
              <div key={s.n} className="clay-card clay-card-hover p-6 relative">
                <div className="w-12 h-12 rounded-2xl bg-navy text-cream grid place-items-center text-lg shadow-clay-navy">{s.emoji}</div>
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
        <div className="clay-card p-3 sm:p-4 overflow-hidden">
          {/* fake app window chrome */}
          <div className="rounded-2xl bg-cream overflow-hidden shadow-[inset_2px_2px_10px_rgba(11,25,87,0.05)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-cream-deep">
              <span className="w-3 h-3 rounded-full bg-blush" />
              <span className="w-3 h-3 rounded-full bg-cream-deep" />
              <span className="w-3 h-3 rounded-full bg-navy/20" />
              <span className="font-brand text-lg ml-3">Better<span className="text-blush-deep">Dresser</span></span>
              <div className="ml-auto hidden sm:flex gap-2 text-xs text-navy/50">
                {["Wardrobe", "Today", "Buy Next", "DresserAI", "TryOn"].map((t, i) => (
                  <span key={t} className={`px-3 py-1 rounded-xl ${i === 1 ? "bg-navy text-cream" : "bg-cream-soft shadow-clay-sm"}`}>{t}</span>
                ))}
              </div>
            </div>
            <div className="p-5 sm:p-8 grid md:grid-cols-3 gap-5">
              <div className="md:col-span-2 clay-card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-brand text-2xl">Your outfit for today</h3>
                  <span className="clay-chip">source: AI</span>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-5">
                  {[
                    { e: "🧥", l: "Trench" },
                    { e: "👕", l: "Striped tee" },
                    { e: "👖", l: "Dark denim" },
                    { e: "👟", l: "White sneakers" },
                  ].map((g) => (
                    <div key={g.l} className="rounded-2xl bg-cream-soft shadow-clay-sm p-3 text-center">
                      <div className="text-3xl">{g.e}</div>
                      <p className="text-[11px] text-navy/50 mt-1">{g.l}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-navy/60 mt-4">Cool and breezy today, with a dressier lean for your afternoon meeting — layered but easy to shed indoors.</p>
              </div>
              <div className="space-y-5">
                <div className="clay-card p-5">
                  <p className="text-xs text-navy/50">Waterloo, ON</p>
                  <p className="font-brand text-4xl mt-1">14°</p>
                  <p className="text-sm text-navy/60">Partly cloudy · wind 12 km/h</p>
                </div>
                <div className="clay-card p-5">
                  <p className="text-xs text-navy/50 mb-2">DresserAI</p>
                  <p className="text-sm">"Add the tan belt — it ties the sneakers and trench together."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== PRICING */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="clay-chip">Simple pricing</span>
          <h2 className="font-brand text-4xl sm:text-5xl mt-4">Start free. Upgrade if you love it.</h2>
          <p className="text-navy/60 mt-3">Outfit recommendations are always free and unlimited. Plus lifts the weekly caps on the extras.</p>
        </div>

        <div ref={priceGrid} className="grid md:grid-cols-2 gap-6 mt-12 items-start">
          {/* Free */}
          <div className="clay-card p-8">
            <p className="font-brand text-2xl">Free</p>
            <p className="mt-2"><span className="font-brand text-5xl">$0</span><span className="text-navy/50"> / forever</span></p>
            <button onClick={onGetStarted} className="clay-btn-blush w-full py-3 mt-6">Get started</button>
            <ul className="mt-6 space-y-3 text-sm">
              {["Unlimited outfit recommendations", "Full wardrobe + AI auto-tagging", "Weather & calendar aware", "A weekly allowance of Buy Next, DresserAI & TryOn"].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="text-blush-deep mt-0.5">{icons.check}</span>
                  <span className="text-navy/70">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plus */}
          <div className="clay-card p-8 relative bg-navy text-cream shadow-clay-navy overflow-hidden">
            <Blob style={{ width: 260, height: 260, top: -100, right: -80, background: "radial-gradient(circle, rgba(250,158,188,0.5), rgba(250,158,188,0) 70%)" }} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="font-brand text-2xl">Plus</p>
                <span className="rounded-full bg-blush text-navy text-xs font-semibold px-3 py-1">Most popular</span>
              </div>
              <p className="mt-2"><span className="font-brand text-5xl">$5</span><span className="text-cream/60"> / month</span></p>
              <button onClick={onGetStarted} className="clay-btn-blush w-full py-3 mt-6">Go Plus</button>
              <ul className="mt-6 space-y-3 text-sm">
                {["Everything in Free", "Unlimited Buy Next suggestions", "Unlimited DresserAI chat", "Unlimited Virtual TryOn renders", "Cancel anytime, keep access to term-end"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span className="text-blush mt-0.5">{icons.check}</span>
                    <span className="text-cream/85">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== TESTIMONIALS */}
      <section className="max-w-6xl mx-auto px-4 pb-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="clay-chip">Loved by sharp dressers</span>
          <h2 className="font-brand text-4xl sm:text-5xl mt-4">Mornings, minus the guesswork</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {TESTIMONIALS.map((t) => (
            <figure key={t.n} className="clay-card clay-card-hover p-7 flex flex-col">
              <div className="text-blush-deep text-4xl font-brand leading-none">“</div>
              <blockquote className="text-navy/75 mt-1 flex-1">{t.q}</blockquote>
              <figcaption className="flex items-center gap-3 mt-5">
                <span className={`w-10 h-10 rounded-full grid place-items-center text-sm font-semibold shadow-clay-sm ${t.tone === "navy" ? "bg-navy text-cream" : "bg-blush text-navy"}`}>{t.i}</span>
                <span className="text-sm"><span className="font-medium block">{t.n}</span><span className="text-navy/50">{t.r}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ============================================================= CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="relative overflow-hidden rounded-[2rem] p-10 sm:p-16 text-center text-cream shadow-clay-navy gradient-pan" style={{ backgroundImage: "linear-gradient(120deg, #071140, #1B2C77 45%, #F2769F)" }}>
          <div className="grain absolute inset-0" />
          <div className="relative">
            <h2 className="font-brand text-4xl sm:text-6xl">Dress better, effortlessly.</h2>
            <p className="text-cream/70 mt-4 max-w-lg mx-auto">Your closet already has great outfits in it. Let BetterDresser find them — free, no card required.</p>
            <button onClick={onGetStarted} className="mt-8 rounded-2xl bg-cream text-navy font-semibold px-8 py-3.5 shadow-clay hover:-translate-y-0.5 active:translate-y-0.5 transition-all">
              Start dressing smarter →
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================== FOOTER */}
      <footer className="max-w-6xl mx-auto px-4 pt-8">
        <div className="clay-card p-8 sm:p-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
            <div className="flex gap-2 mt-3">
              {["𝕏", "in", "◎"].map((s) => (
                <span key={s} className="w-9 h-9 rounded-xl bg-cream shadow-clay-sm grid place-items-center text-navy/60">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <LegalFooter />
    </div>
  );
}
