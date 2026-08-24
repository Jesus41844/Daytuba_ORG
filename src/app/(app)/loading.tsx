export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl ring-1 ring-border/50 p-4">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
