export default function OwnerLoading() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-surface-muted rounded-control" />
          <div className="h-4 w-72 bg-surface-muted rounded-control" />
        </div>
        <div className="h-9 w-32 bg-surface-muted rounded-control" />
      </div>

      {/* Grid Baris 1: Hero & Accent */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 h-48 bg-surface rounded-card border border-line p-6 space-y-4">
          <div className="h-5 w-40 bg-surface-muted rounded-control" />
          <div className="h-9 w-64 bg-surface-muted rounded-control" />
          <div className="h-3.5 w-full bg-surface-muted rounded-pill mt-4" />
        </div>
        <div className="lg:col-span-4 h-48 bg-surface rounded-card border border-line p-6 space-y-4">
          <div className="h-5 w-32 bg-surface-muted rounded-control" />
          <div className="h-10 w-24 bg-surface-muted rounded-control" />
          <div className="h-9 w-full bg-surface-muted rounded-control mt-4" />
        </div>
      </div>

      {/* Grid Baris 2: 3 Kartu Metrik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-64 bg-surface rounded-card border border-line p-6 space-y-4">
          <div className="h-5 w-36 bg-surface-muted rounded-control" />
          <div className="w-28 h-28 rounded-full bg-surface-muted mx-auto" />
        </div>
        <div className="h-64 bg-surface rounded-card border border-line p-6 space-y-3">
          <div className="h-5 w-36 bg-surface-muted rounded-control" />
          <div className="h-8 w-full bg-surface-muted rounded-control" />
          <div className="h-8 w-full bg-surface-muted rounded-control" />
          <div className="h-8 w-full bg-surface-muted rounded-control" />
        </div>
        <div className="h-64 bg-surface rounded-card border border-line p-6 space-y-3">
          <div className="h-5 w-36 bg-surface-muted rounded-control" />
          <div className="h-10 w-full bg-surface-muted rounded-control" />
          <div className="h-10 w-full bg-surface-muted rounded-control" />
        </div>
      </div>

      {/* Baris 3: Tabel Skeleton */}
      <div className="h-72 bg-surface rounded-card border border-line p-6 space-y-4">
        <div className="h-6 w-48 bg-surface-muted rounded-control" />
        <div className="h-10 w-full bg-surface-muted rounded-control" />
        <div className="h-10 w-full bg-surface-muted rounded-control" />
        <div className="h-10 w-full bg-surface-muted rounded-control" />
      </div>
    </div>
  );
}
