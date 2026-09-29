/** Satchel's bag mark (header brand, first-run). Inherits color from `currentColor`. */
export function BagMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={className}>
      <rect x="9" y="24" width="46" height="34" rx="8" fill="currentColor" />
      <path
        d="M14 26C14 20.4772 18.4772 16 24 16H40C45.5228 16 50 20.4772 50 26V27H14V26Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}
