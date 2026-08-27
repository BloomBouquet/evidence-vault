import type { ReactNode } from "react";

export type NoticeVariant = "info" | "warning" | "danger" | "privacy";

export function Notice({
  variant = "info",
  title,
  children,
}: {
  variant?: NoticeVariant;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className={`ev-notice ev-notice--${variant}`} aria-label={title}>
      <strong className="ev-notice__title">{title}</strong>
      <div className="ev-notice__body">{children}</div>
    </aside>
  );
}
