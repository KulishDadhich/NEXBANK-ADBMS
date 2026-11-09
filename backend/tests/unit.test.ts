import { describe, it, expect } from "vitest";
import { parseMoney, csvCell } from "../src/utilities/money.js";
import { retryDeadlock } from "../src/services/banking.js";
import { registerSchema, transferSchema } from "../src/validation/schemas.js";
describe("money boundaries", () => {
  it("converts decimal strings to exact paise", () => {
    expect(parseMoney("0.01")).toBe("1");
    expect(parseMoney("10000000000.00")).toBe("1000000000000");
    expect(parseMoney("13.2")).toBe("1320");
  });
  it.each(["0", "-1", "1.001", "1e3", "NaN", "01", "10000000000.01"])(
    "rejects %s",
    (value) => expect(() => parseMoney(value)).toThrow(),
  );
  it("neutralizes spreadsheet formulas", () =>
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"'));
});
describe("retry semantics", () => {
  it("retries a deadlock and returns the result", async () => {
    let calls = 0;
    const result = await retryDeadlock(async () => {
      if (++calls < 3) throw { errno: 1213 };
      return 42;
    });
    expect(result).toBe(42);
    expect(calls).toBe(3);
  });
  it("does not retry business rejections", async () => {
    let calls = 0;
    await expect(
      retryDeadlock(async () => {
        calls++;
        throw { errno: 1644 };
      }),
    ).rejects.toEqual({ errno: 1644 });
    expect(calls).toBe(1);
  });
  it("bounds retries", async () => {
    let calls = 0;
    await expect(
      retryDeadlock(async () => {
        calls++;
        throw { errno: 1205 };
      }),
    ).rejects.toBeDefined();
    expect(calls).toBe(3);
  });
});
it("rejects weak registration and malformed transfers", () => {
  expect(
    registerSchema.safeParse({ fullName: "A", email: "bad", password: "123" })
      .success,
  ).toBe(false);
  expect(
    transferSchema.safeParse({
      senderId: "other",
      recipient: "bad",
      amount: "1",
    }).success,
  ).toBe(false);
});
