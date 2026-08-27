import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  secondary,
}: {
  title: string;
  description: string;
  action: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <section className="ev-empty">
      <h2 className="ev-empty__title">{title}</h2>
      <p className="ev-empty__description">{description}</p>
      <div className="ev-empty__action">{action}</div>
      {secondary ? <div className="ev-empty__secondary">{secondary}</div> : null}
    </section>
  );
}
