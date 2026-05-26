export default function PanelLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded-md bg-navy-100" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-navy-50" />
      </div>
      {/* Stats row skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel-card h-20 animate-pulse bg-navy-50/30" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="panel-card h-96 animate-pulse bg-navy-50/30" />
    </div>
  );
}
