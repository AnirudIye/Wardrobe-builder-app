// Site footer with Terms of Service and Privacy & Legal policies, shown in a
// claymorphic modal. Rendered at the very bottom of every screen.
import { useEffect, useState } from "react";
import { fadeRise } from "../animations";

type Doc = "terms" | "privacy" | null;

const LAST_UPDATED = "July 13, 2026";

function Terms() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="text-navy/60">Last updated: {LAST_UPDATED}</p>
      <h4 className="font-semibold">1. The service</h4>
      <p>
        BetterDresser lets you catalogue your clothing, receive outfit recommendations based
        on your wardrobe, weather, calendar, and current trends, and discover items you may
        wish to purchase. Recommendations are suggestions only — we don't guarantee they fit
        every occasion (or that you'll like them!).
      </p>
      <h4 className="font-semibold">2. Your account</h4>
      <p>
        You're responsible for your account credentials and for the content you upload. Only
        upload photos you have the right to use. You must be at least 13 years old.
      </p>
      <h4 className="font-semibold">3. Subscriptions & billing</h4>
      <p>
        The free plan includes a limited number of buy-next suggestions per week; outfit
        recommendations are free. BetterDresser Plus ($5/month) unlocks unlimited buy-next
        suggestions. Payments are processed by Stripe; we never see or store your card
        details. You can cancel any time via the customer portal — access continues until the
        end of the paid period.
      </p>
      <h4 className="font-semibold">4. Shopping links</h4>
      <p>
        Product suggestions link to third-party retailers. We're not a party to those
        purchases and aren't responsible for third-party products, prices, or availability.
      </p>
      <h4 className="font-semibold">5. Acceptable use</h4>
      <p>
        Don't misuse the service: no unlawful content, no attempts to break, overload, or
        reverse-engineer the platform, and no scraping other users' data.
      </p>
      <h4 className="font-semibold">6. Disclaimer & liability</h4>
      <p>
        The service is provided "as is" without warranties of any kind. To the maximum extent
        permitted by law, our liability is limited to the amount you paid us in the past 12
        months.
      </p>
      <h4 className="font-semibold">7. Changes</h4>
      <p>
        We may update these terms; material changes will be announced in the app. Continued
        use after changes means you accept them.
      </p>
      <h4 className="font-semibold">8. Contact</h4>
      <p>Questions? Email iyengar.anirud@gmail.com.</p>
    </div>
  );
}

function Privacy() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="text-navy/60">Last updated: {LAST_UPDATED}</p>
      <h4 className="font-semibold">1. What we collect</h4>
      <p>
        Your email and password (stored as a secure hash), wardrobe photos and their AI tags,
        your city/location (if provided) for weather, calendar events you add, style
        preferences, and recommendation usage counts.
      </p>
      <h4 className="font-semibold">2. How it's used</h4>
      <p>
        Solely to run the service: tagging your photos, generating recommendations, showing
        weather-appropriate outfits, and enforcing plan limits. We don't sell your data or
        use it for advertising.
      </p>
      <h4 className="font-semibold">3. Third-party processors</h4>
      <p>
        Wardrobe photos are processed by Anthropic (Claude) for tagging; your coordinates are
        sent to OpenWeather for forecasts; shopping queries (never your identity) go to
        SerpAPI; payments are handled by Stripe. Each processes data under its own privacy
        policy.
      </p>
      <h4 className="font-semibold">4. Storage & security</h4>
      <p>
        Data is stored in our database and image storage; passwords are hashed with bcrypt
        and sessions use signed tokens. No method of storage is 100% secure, but we follow
        standard practices.
      </p>
      <h4 className="font-semibold">5. Your rights</h4>
      <p>
        You can edit or delete wardrobe items and calendar events in the app. To delete your
        account and all associated data, email us and we'll action it within 30 days.
      </p>
      <h4 className="font-semibold">6. Cookies</h4>
      <p>
        We use only a local session token to keep you signed in — no tracking or advertising
        cookies.
      </p>
      <h4 className="font-semibold">7. Contact</h4>
      <p>Privacy questions? Email iyengar.anirud@gmail.com.</p>
    </div>
  );
}

export default function LegalFooter() {
  const [open, setOpen] = useState<Doc>(null);

  useEffect(() => {
    if (open) {
      const el = document.getElementById("legal-modal-card");
      fadeRise(el);
    }
  }, [open]);

  return (
    <>
      <footer className="mt-16 pb-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="clay-card px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-brand text-xl">BetterDresser</p>
            <div className="flex items-center gap-4 text-sm">
              <button
                onClick={() => setOpen("terms")}
                className="underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep transition-colors"
              >
                Terms of Service
              </button>
              <button
                onClick={() => setOpen("privacy")}
                className="underline decoration-blush decoration-2 underline-offset-4 hover:text-blush-deep transition-colors"
              >
                Privacy & Legal
              </button>
            </div>
            <p className="text-xs text-navy/50">© 2026 BetterDresser</p>
          </div>
        </div>
      </footer>

      {open && (
        <div
          className="fixed inset-0 z-[9000] bg-navy/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <div
            id="legal-modal-card"
            onClick={(e) => e.stopPropagation()}
            className="clay-card max-w-lg w-full max-h-[80vh] overflow-y-auto p-7"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-brand text-2xl">
                {open === "terms" ? "Terms of Service" : "Privacy & Legal"}
              </h3>
              <button
                onClick={() => setOpen(null)}
                className="clay-btn-blush px-3 py-1 text-sm"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            {open === "terms" ? <Terms /> : <Privacy />}
          </div>
        </div>
      )}
    </>
  );
}
