// On-brand error message: a soft blush clay note with an alert icon, replacing
// bare red text everywhere. Renders nothing when there's no message, so call
// sites can stay one-liners: <ErrorNote message={error} className="mt-2" />.
export default function ErrorNote({
  message,
  className = "",
  onDismiss,
}: {
  message?: string | null;
  className?: string;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 bg-blush-soft text-navy text-sm rounded-2xl px-4 py-2.5 shadow-clay-sm ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4 shrink-0 mt-0.5 text-blush-deep"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="7.5" x2="12" y2="13" />
        <circle cx="12" cy="16.5" r="0.7" fill="currentColor" stroke="none" />
      </svg>
      <span className="min-w-0">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-1 -mr-1 shrink-0 text-navy/40 hover:text-navy transition-colors leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}
