import { useEffect, useRef, useState } from "react";
import { api, User } from "../api";
import { useAuth } from "../auth";
import { profileCache } from "../store";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import AccountSettings from "./AccountSettings";
import Customization from "./Customization";
import ErrorNote from "./ErrorNote";

type Panel = "settings" | "customize" | "delete" | null;

export default function AccountMenu({ onUpgrade }: { onUpgrade: () => void }) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<User | null>(profileCache.peek());
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    profileCache.get().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const plan = profile?.plan ?? user?.plan ?? "free";
  const isPaid = plan === "paid";
  const email = user?.email ?? "";
  const avatarUrl = profile?.avatar_url ?? null;
  const initial = email ? email[0].toUpperCase() : "?";

  const refreshProfile = (u: User) => {
    profileCache.set(u);
    setProfile(u);
  };

  const del = async () => {
    setDeleteErr(null);
    try {
      await api.deleteAccount();
      logout();
    } catch (e) {
      setDeleteErr((e as Error).message || "Couldn't delete your account. Please try again.");
      setPanel(null); // close the confirm dialog so the error banner is visible
    }
  };

  // GDPR data portability, self-serve: download everything as one JSON file.
  const exportData = async () => {
    setOpen(false);
    setDeleteErr(null);
    try {
      const blob = await api.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "betterdresser-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDeleteErr((e as Error).message);
    }
  };

  return (
    <div className="relative" ref={ref}>
      {deleteErr && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9995]">
          <ErrorNote message={deleteErr} onDismiss={() => setDeleteErr(null)} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={onUpgrade}
          className={`clay-chip ${isPaid ? "" : "hover:bg-blush"}`}
          title={isPaid ? "You're on Plus" : "Upgrade to Plus"}
        >
          {isPaid ? "Plus" : "Free · Upgrade"}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-10 h-10 rounded-full overflow-hidden shadow-clay-sm bg-navy text-cream flex items-center justify-center font-semibold"
          aria-label="Account menu"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </button>
      </div>

      {open && (
        <div className="absolute right-0 mt-2 w-56 clay-card p-2 z-[9991]">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{email}</p>
            <p className="text-xs text-navy/50">{isPaid ? "Plus plan" : "Free plan"}</p>
          </div>
          <div className="h-px bg-cream-deep my-1" />
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-cream-deep/50"
            onClick={() => {
              setPanel("settings");
              setOpen(false);
            }}
          >
            Account settings
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-cream-deep/50"
            onClick={() => {
              setPanel("customize");
              setOpen(false);
            }}
          >
            Customization
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-cream-deep/50"
            onClick={exportData}
          >
            Export my data
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50"
            onClick={() => {
              setPanel("delete");
              setOpen(false);
            }}
          >
            Delete account
          </button>
          <div className="h-px bg-cream-deep my-1" />
          <button
            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-cream-deep/50"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      )}

      <Modal open={panel === "settings"} title="Account settings" onClose={() => setPanel(null)}>
        <AccountSettings profile={profile} email={email} onProfileChange={refreshProfile} />
      </Modal>
      <Modal open={panel === "customize"} title="Customization" onClose={() => setPanel(null)}>
        <Customization profile={profile} onProfileChange={refreshProfile} />
      </Modal>
      <ConfirmDialog
        open={panel === "delete"}
        title="Delete your account?"
        message="This permanently deletes your account and everything in it: wardrobe, calendar, and usage history. This cannot be undone."
        confirmLabel="Delete forever"
        requireText="DELETE"
        onConfirm={del}
        onCancel={() => setPanel(null)}
      />
    </div>
  );
}
