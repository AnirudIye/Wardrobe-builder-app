// Shared page header for the logged-in app: Ramaraja display title, an
// optional context line (counts, status), and an action slot. Replaces the
// bare text-xl h2s so every page opens with the same typographic confidence.
import { ReactNode } from "react";

export default function PageHeader({
  title,
  context,
  action,
}: {
  title: string;
  context?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h2 className="font-brand text-3xl sm:text-4xl tracking-tight leading-none">{title}</h2>
        {context && <p className="text-sm text-navy/50 mt-2">{context}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
