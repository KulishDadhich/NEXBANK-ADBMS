import { execFileSync } from "node:child_process";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const forbidden = files.filter(
  (p) =>
    (/(^|\/)\.env($|\.)/.test(p) && !p.endsWith(".env.example")) ||
    /\.(pem|key)$/.test(p) ||
    p.includes(".vercel/"),
);
if (forbidden.length)
  throw Error("Sensitive paths tracked: " + forbidden.join(", "));
console.log(
  "No environment, private-key or local Vercel credential files tracked. This path check is not a full secret scanner.",
);
