// "Continue with Google" via Google Identity Services. Renders nothing until
// the backend reports a configured OAuth client id (GOOGLE_OAUTH_CLIENT_ID),
// so the login page is unchanged on zero-config installs. The GIS script is
// loaded once on demand; its button hands us a signed ID token that
// POST /auth/google verifies server-side.
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

interface GisCredentialResponse {
  credential?: string;
}
interface GisApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GisCredentialResponse) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GisApi;
  }
}

let gisScript: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (!gisScript) {
    gisScript = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisScript = null; // allow a retry on the next mount
        reject(new Error("Google sign-in couldn't load"));
      };
      document.head.appendChild(s);
    });
  }
  return gisScript;
}

export default function GoogleSignInButton({
  onError,
}: {
  onError?: (message: string) => void;
}) {
  const { googleSignIn } = useAuth();
  const slotRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { client_id } = await api.googleConfig();
        if (!client_id || cancelled) return;
        await loadGis();
        if (cancelled || !slotRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id,
          callback: (response) => {
            if (!response.credential) return;
            googleSignIn(response.credential).catch((err) =>
              onError?.((err as Error).message)
            );
          },
        });
        window.google.accounts.id.renderButton(slotRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 280,
        });
        setVisible(true);
      } catch {
        // Best-effort: no config or blocked script simply means no button.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={visible ? "space-y-3" : "hidden"}>
      <div className="flex items-center gap-3 text-xs text-navy/40">
        <span className="flex-1 h-px bg-cream-deep" />
        or
        <span className="flex-1 h-px bg-cream-deep" />
      </div>
      <div ref={slotRef} className="flex justify-center" />
      <p className="text-center text-[11px] text-navy/40">
        Continuing with Google means you agree to the terms of service and privacy policy.
      </p>
    </div>
  );
}
