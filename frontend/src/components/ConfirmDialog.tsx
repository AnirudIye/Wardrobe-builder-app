import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When set, the user must type this exact string to enable Confirm. */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const confirmDisabled = requireText ? typed !== requireText : false;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-navy/40 backdrop-blur-sm px-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="clay-card w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-navy/60">{message}</p>
        {requireText && (
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Type ${requireText} to confirm`}
            className="w-full clay-input"
          />
        )}
        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onCancel} className="clay-btn-blush px-4 py-2 text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-2xl bg-red-500 text-white font-medium px-4 py-2 text-sm shadow-clay-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-600 active:translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
