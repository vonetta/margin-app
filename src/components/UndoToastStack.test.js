import { render, screen, fireEvent } from "@testing-library/react";
import UndoToastStack from "./UndoToastStack";

test("renders nothing when there is nothing pending", () => {
  const { container } = render(<UndoToastStack pending={[]} onUndo={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

test("renders a toast per pending item and calls onUndo with its key", () => {
  const onUndo = jest.fn();
  render(
    <UndoToastStack
      pending={[
        { key: "t1", label: "Water the plants" },
        { key: "t2", label: "Sunday Setup" },
      ]}
      onUndo={onUndo}
    />,
  );

  expect(screen.getByText("Water the plants deleted")).toBeInTheDocument();
  expect(screen.getByText("Sunday Setup deleted")).toBeInTheDocument();

  const undoButtons = screen.getAllByText("Undo");
  fireEvent.click(undoButtons[0]);
  expect(onUndo).toHaveBeenCalledWith("t1");
});
