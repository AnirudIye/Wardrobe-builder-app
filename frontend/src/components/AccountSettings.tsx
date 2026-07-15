import { useRef, useState } from "react";
import { api, User } from "../api";

interface Props {
  profile: User | null;
  email: string;
  onProfileChange: (u: User) => void;
}

export default function AccountSettings({ profile, email, onProfileChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [city, setCity] = useState(profile?.city ?? "");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    wrap(async () => {
      onProfileChange(await api.uploadAvatar(f));
      setMsg("Photo updated.");
    }).finally(() => {
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const removeAvatar = () =>
    wrap(async () => {
      onProfileChange(await api.removeAvatar());
    });

  const saveLocation = () => {
    if (city.trim().length < 2) return;
    wrap(async () => {
      onProfileChange(await api.setLocation(city.trim()));
      setMsg("Location saved.");
    });
  };

  const savePassword = () =>
    wrap(async () => {
      await api.changePassword(curPw, newPw);
      setCurPw("");
      setNewPw("");
      setMsg("Password updated.");
    });

  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className="text-navy/50 mb-1">Email</p>
        <p className="font-medium break-all">{email}</p>
      </div>

      <div>
        <p className="text-navy/50 mb-2">Profile photo</p>
        <div className="flex gap-2 items-center">
          {profile?.avatar_url && (
            <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          )}
          <label className="clay-btn px-4 py-2 cursor-pointer">
            {busy ? "…" : "Upload"}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
          </label>
          {profile?.avatar_url && (
            <button onClick={removeAvatar} disabled={busy} className="clay-btn-blush px-4 py-2">
              Remove
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="text-navy/50 mb-2">Location</p>
        <div className="flex gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="flex-1 clay-input"
          />
          <button onClick={saveLocation} disabled={busy} className="clay-btn px-4 py-2">
            Save
          </button>
        </div>
      </div>

      <div>
        <p className="text-navy/50 mb-2">Change password</p>
        <div className="space-y-2">
          <input
            type="password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            placeholder="Current password"
            className="w-full clay-input"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password (min 8)"
            className="w-full clay-input"
          />
          <button
            onClick={savePassword}
            disabled={busy || curPw.length < 1 || newPw.length < 8}
            className="clay-btn px-4 py-2"
          >
            Update password
          </button>
        </div>
      </div>

      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-500">{err}</p>}
    </div>
  );
}
