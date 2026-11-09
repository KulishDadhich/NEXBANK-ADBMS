import { writeFile } from "node:fs/promises";
const revision = process.env.EXPECTED_REVISION;
if (!/^[0-9a-f]{40}$/.test(revision || ""))
  throw Error("Expected a full verified Git commit SHA");
await writeFile(
  new URL("../backend/src/build-revision.ts", import.meta.url),
  `export const buildRevision = '${revision}';\n`,
);
