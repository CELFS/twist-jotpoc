export type LoadingStateProps = {
  label: string;
  rows?: number;
  compact?: boolean;
};

export function LoadingState({ label, rows = 3, compact = false }: LoadingStateProps) {
  return (
    <div className="ui-loading-state" data-compact={compact || undefined} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <span className="ui-loading-row" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}
