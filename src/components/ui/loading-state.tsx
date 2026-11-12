export type LoadingStateProps = {
  label: string;
  rows?: number;
};

export function LoadingState({ label, rows = 3 }: LoadingStateProps) {
  return (
    <div className="ui-loading-state" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <span className="ui-loading-row" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}
