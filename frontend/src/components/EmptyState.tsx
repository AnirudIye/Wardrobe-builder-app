// Designed empty state: brand illustration, one clear line, one action.
// Empty screens are a first impression, not an afterthought.
import { ReactNode } from "react";

type Ill = (props: { className?: string }) => React.ReactElement;

export default function EmptyState({
  Ill,
  title,
  body,
  action,
}: {
  Ill: Ill;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="clay-card blob-card-b px-8 py-12 text-center max-w-md mx-auto">
      <div className="w-24 h-24 mx-auto blob-b bg-cream grid place-items-center p-4 shadow-clay-sm">
        <Ill className="w-full h-full" />
      </div>
      <h3 className="font-brand text-2xl mt-6">{title}</h3>
      <p className="text-sm text-navy/60 mt-2 leading-relaxed">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
