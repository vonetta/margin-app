import { clickableDivProps } from "./a11y";

test("returns role/tabIndex/onClick/onKeyDown for an enabled click handler", () => {
  const onClick = jest.fn();
  const props = clickableDivProps(onClick);

  expect(props.role).toBe("button");
  expect(props.tabIndex).toBe(0);
  expect(props.onClick).toBe(onClick);
});

test("Enter and Space both trigger the click handler", () => {
  const onClick = jest.fn();
  const { onKeyDown } = clickableDivProps(onClick);
  const preventDefault = jest.fn();

  onKeyDown({ key: "Enter", preventDefault });
  onKeyDown({ key: " ", preventDefault });
  onKeyDown({ key: "Tab", preventDefault });

  expect(onClick).toHaveBeenCalledTimes(2);
  expect(preventDefault).toHaveBeenCalledTimes(2);
});

test("returns an empty object when disabled", () => {
  const onClick = jest.fn();
  expect(clickableDivProps(onClick, { disabled: true })).toEqual({});
});
