import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, LockKeyhole, TriangleAlert } from "lucide-react";

export type CourseColor =
  "blue" | "teal" | "green" | "amber" | "orange" | "rose" | "violet" | "slate";
export type StatusTone = "success" | "warning" | "danger" | "info";

export function CourseIdentity({ code, color }: { code: string; color: CourseColor }) {
  return (
    <span className={`course-identity course-${color}`}>
      <span className="course-swatch" aria-hidden="true" />
      {code}
    </span>
  );
}

const statusIcons = {
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
  info: Info,
};
export function StatusIndicator({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const Icon = statusIcons[tone];
  return (
    <span className={`status-indicator status-${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
}

export function WorkSessionBlock({
  title,
  courseCode,
  color,
  time,
  locked = false,
  manual = false,
}: {
  title: string;
  courseCode: string;
  color: CourseColor;
  time: string;
  locked?: boolean;
  manual?: boolean;
}) {
  return (
    <div
      className={`time-object work-session course-${color}`}
      role="group"
      aria-label={`${courseCode}, ${title}, ${time}${locked ? ", locked" : ""}`}
    >
      <CourseIdentity code={courseCode} color={color} />
      <span className="time-object-title">{title}</span>
      {manual && <span className="time-object-meta">Manual</span>}
      {locked && <LockKeyhole size={14} aria-hidden="true" />}
      <time>{time}</time>
    </div>
  );
}

export function FixedEventBlock({
  title,
  time,
  courseCode,
  color = "slate",
}: {
  title: string;
  time: string;
  courseCode?: string;
  color?: CourseColor;
}) {
  return (
    <div
      className={`time-object fixed-event course-${color}`}
      role="group"
      aria-label={`${courseCode ? courseCode + ", " : ""}${title}, ${time}, fixed commitment`}
    >
      {courseCode && <CourseIdentity code={courseCode} color={color} />}
      <span className="time-object-title">{title}</span>
      <time>{time}</time>
    </div>
  );
}

export function InlineState({
  kind,
  title,
  children,
  ...props
}: {
  kind: "empty" | "error" | "loading";
  title: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`inline-state inline-state-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className="skeleton-line" style={{ width }} aria-hidden="true" />;
}
