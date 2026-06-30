import { deriveColorVariants } from "./colorVariants";

const colors = { primary: "#03293F", accent: "#EA8A8B", gold: "#DAAE4F" };

test("brand variant matches the input colors exactly", () => {
  expect(deriveColorVariants(colors).brand).toEqual(colors);
});

test("accent_swap never changes primary, only reassigns accent/gold", () => {
  const variants = deriveColorVariants(colors);
  expect(variants.accent_swap.primary).toBe(colors.primary);
  expect(variants.accent_swap.accent).toBe(colors.gold);
  expect(variants.accent_swap.gold).toBe(colors.accent);
});

test("triad and complementary produce different hex values than brand, primary stays fixed", () => {
  const variants = deriveColorVariants(colors);
  expect(variants.triad.accent).not.toBe(colors.accent);
  expect(variants.triad.primary).toBe(colors.primary);
  expect(variants.complementary.accent).not.toBe(colors.accent);
  expect(variants.complementary.primary).toBe(colors.primary);
});
