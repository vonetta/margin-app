import { render } from "@testing-library/react";
import { SkeletonRows } from "./Skeleton";

test("renders the requested number of pulsing placeholder rows", () => {
  const { container } = render(<SkeletonRows count={4} />);
  expect(container.querySelectorAll(".skeleton").length).toBe(4);
});
