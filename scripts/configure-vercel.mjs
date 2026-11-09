import { readFile, writeFile } from "node:fs/promises";
const origin = new URL(process.env.BACKEND_URL || "");
if (
  origin.protocol !== "https:" ||
  origin.pathname !== "/" ||
  origin.username ||
  origin.password ||
  origin.search ||
  !origin.hostname.endsWith(".up.railway.app")
)
  throw Error("BACKEND_URL must be an HTTPS Railway service origin");
const path = new URL("../frontend/vercel.json", import.meta.url),
  config = JSON.parse(await readFile(path, "utf8"));
config.rewrites[0].destination = origin.origin + "/api/:path*";
await writeFile(path, JSON.stringify(config, null, 2) + "\n");
console.log(
  "Configured frontend API proxy. No database variables are exposed.",
);
