export type DeadlineTone = "neutral" | "warning" | "danger";

function formatRelativeDay(daysRemaining: number) {
  if (daysRemaining > 0) return `D-${daysRemaining}`;
  if (daysRemaining === 0) return "D-DAY";
  return `D+${Math.abs(daysRemaining)}`;
}

export function DeadlineIndicator({
  daysRemaining,
  label,
  tone,
}: {
  daysRemaining: number;
  label: string;
  tone: DeadlineTone;
}) {
  return (
    <div className={`ev-deadline ev-deadline--${tone}`}>
      <span className="ev-deadline__value">{formatRelativeDay(daysRemaining)}</span>
      <span className="ev-deadline__label">{label}</span>
    </div>
  );
}
