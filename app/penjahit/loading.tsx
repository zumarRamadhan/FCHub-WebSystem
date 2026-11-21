export default function PenjahitLoading() {
  return (
    <div className="space-y-5 max-w-lg mx-auto animate-pulse">
      {/* Kartu Hero Skeleton */}
      <div className="h-44 bg-surface rounded-card border border-line p-5 space-y-3">
        <div className="h-4 w-32 bg-surface-muted rounded-control" />
        <div className="h-9 w-48 bg-surface-muted rounded-control" />
        <div className="h-6 w-36 bg-surface-muted rounded-control" />
      </div>

      {/* Kartu Ring Target Skeleton */}
      <div className="h-36 bg-surface rounded-card border border-line p-5 flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-surface-muted shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-28 bg-surface-muted rounded-control" />
          <div className="h-6 w-36 bg-surface-muted rounded-control" />
          <div className="h-3 w-44 bg-surface-muted rounded-control" />
        </div>
      </div>

      {/* Kartu Riwayat Skeleton */}
      <div className="h-56 bg-surface rounded-card border border-line p-5 space-y-3">
        <div className="h-5 w-32 bg-surface-muted rounded-control" />
        <div className="h-8 w-full bg-surface-muted rounded-control" />
        <div className="h-8 w-full bg-surface-muted rounded-control" />
        <div className="h-8 w-full bg-surface-muted rounded-control" />
      </div>
    </div>
  );
}
