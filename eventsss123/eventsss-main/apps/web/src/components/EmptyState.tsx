export function Skeleton({
  height = 16,
  width = "100%",
  radius = 8,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
}) {
  return (
    <div
      className="ess-skeleton"
      style={{
        height,
        width,
        borderRadius: radius,
      }}
      aria-hidden
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="ess-skeleton-card">
      <Skeleton height={120} radius={12} />
      <div style={{ padding: "14px 0 0", display: "grid", gap: 8 }}>
        <Skeleton height={14} width="40%" />
        <Skeleton height={18} width="75%" />
        <Skeleton height={14} width="55%" />
        <Skeleton height={36} width="45%" radius={8} />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = "◈",
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}) {
  return (
    <div className="ess-empty-state">
      <div className="ess-empty-icon" aria-hidden>
        {icon}
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button className="ess-primary" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="ess-loading-block" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={14} width={`${70 + (i % 3) * 10}%`} />
      ))}
    </div>
  );
}
