import React from "react";

const Skeleton = ({ width = "100%", height = "14px", style = {} }) => (
  <div className="skeleton" style={{ width, height, ...style }} />
);

// A handful of pulsing rows shaped like a list item — used wherever a
// section would otherwise render nothing while its first fetch is in
// flight (list-y data: tasks, upcoming events, drafts).
export const SkeletonRows = ({ count = 3, rowHeight = "14px", gap = "10px" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap }}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} height={rowHeight} width={i % 2 === 0 ? "100%" : "70%"} />
    ))}
  </div>
);

export default Skeleton;
