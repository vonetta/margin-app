import { renderHook, act } from "@testing-library/react";
import { useUndoableDelete } from "./useUndoableDelete";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("marks a key as pending immediately and calls deleteFn once the window elapses", () => {
  const deleteFn = jest.fn();
  const { result } = renderHook(() => useUndoableDelete(6000));

  act(() => {
    result.current.scheduleDelete("t1", "Water the plants", deleteFn);
  });

  expect(result.current.isPending("t1")).toBe(true);
  expect(deleteFn).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(6000);
  });

  expect(deleteFn).toHaveBeenCalledTimes(1);
  expect(result.current.isPending("t1")).toBe(false);
});

test("undo cancels the timer and never calls deleteFn", () => {
  const deleteFn = jest.fn();
  const { result } = renderHook(() => useUndoableDelete(6000));

  act(() => {
    result.current.scheduleDelete("t1", "Water the plants", deleteFn);
  });
  act(() => {
    result.current.undo("t1");
  });

  expect(result.current.isPending("t1")).toBe(false);

  act(() => {
    jest.advanceTimersByTime(10000);
  });

  expect(deleteFn).not.toHaveBeenCalled();
});

test("scheduling a second delete for the same key replaces the first timer instead of double-firing", () => {
  const firstDeleteFn = jest.fn();
  const secondDeleteFn = jest.fn();
  const { result } = renderHook(() => useUndoableDelete(6000));

  act(() => {
    result.current.scheduleDelete("t1", "First", firstDeleteFn);
  });
  act(() => {
    result.current.scheduleDelete("t1", "Second", secondDeleteFn);
  });
  act(() => {
    jest.advanceTimersByTime(6000);
  });

  expect(firstDeleteFn).not.toHaveBeenCalled();
  expect(secondDeleteFn).toHaveBeenCalledTimes(1);
});

test("unmounting the component finalizes any pending deletes immediately", () => {
  const deleteFn = jest.fn();
  const { result, unmount } = renderHook(() => useUndoableDelete(6000));

  act(() => {
    result.current.scheduleDelete("t1", "Water the plants", deleteFn);
  });
  expect(deleteFn).not.toHaveBeenCalled();

  unmount();

  expect(deleteFn).toHaveBeenCalledTimes(1);
});

test("tracks multiple pending deletions independently", () => {
  const { result } = renderHook(() => useUndoableDelete(6000));

  act(() => {
    result.current.scheduleDelete("t1", "First", jest.fn());
    result.current.scheduleDelete("t2", "Second", jest.fn());
  });

  expect(result.current.pending.map((p) => p.key).sort()).toEqual(["t1", "t2"]);

  act(() => {
    result.current.undo("t1");
  });

  expect(result.current.pending.map((p) => p.key)).toEqual(["t2"]);
});
