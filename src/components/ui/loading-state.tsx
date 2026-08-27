export function LoadingState({ label = "불러오는 중" }: { label?: string }) {
  return (
    <div className="ev-loading" role="status" aria-busy="true">
      <span>{label}</span>
    </div>
  );
}
