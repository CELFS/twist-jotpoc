import type { ReactNode } from "react";

export type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title?: string;
};

export function EmptyState({
  action,
  description,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <section className="ui-empty-state">
      {icon ? (
        <div className="ui-empty-state-icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      {title ? <h2 className="ui-empty-state-title">{title}</h2> : null}
      <p className="ui-empty-state-description">{description}</p>
      {action ? <div className="ui-empty-state-action">{action}</div> : null}
    </section>
  );
}
