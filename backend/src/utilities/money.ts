export function parseMoney(value: string): string {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(value))
    throw Error("Enter a positive amount with up to two decimals");
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (amount <= 0n || amount > 1000000000000n)
    throw Error("Amount must be between ₹0.01 and ₹10,000,000,000");
  return amount.toString();
}
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
