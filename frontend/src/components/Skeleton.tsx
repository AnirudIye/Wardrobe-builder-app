// Clay-styled skeleton placeholders shown while data loads.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** A grid of garment-card-shaped skeletons (Wardrobe / Today). */
export function CardGridSkeleton({ count = 4, cols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" }) {
  return (
    <div className={`grid ${cols} gap-5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="clay-card overflow-hidden">
          <Skeleton className="w-full aspect-square rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A stack of wide card skeletons (Buy Next suggestions / Calendar events). */
export function ListSkeleton({ count = 3, height = "h-20" }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`clay-card ${height} p-5 space-y-2`}>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
