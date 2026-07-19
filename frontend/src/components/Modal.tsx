import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  // Portaled to <body>: same containing-block trap as ConfirmDialog - the
  // sticky header's backdrop-filter would otherwise pin this to the header
  // when opened from the account menu.
  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-navy/40 backdrop-blur-sm px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="clay-card w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-navy/40 hover:text-navy text-2xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
