import { memo } from "react";

export const ContentSkeleton = memo(function ContentSkeleton() {
  const widths = [75, 90, 60, 85, 45, 80, 70, 55];
  return (
    <div className="py-6 pr-6 pl-16" style={{ maxWidth: "72ch" }}>
      <div className="skeleton-line" style={{ width: "40%", height: "24px", marginBottom: "24px" }} />
      {widths.map((w, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
});
