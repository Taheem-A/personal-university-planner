import type { ReactNode } from "react";

export function RoutePlaceholder({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="route-content">
      <header className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="route-empty" role="status">
        <p>This view is being connected to your planner.</p>
        {children}
      </div>
    </div>
  );
}
