import "dotenv/config";
import { runLab } from "./lab.js";
console.log(
  JSON.stringify(await runLab(process.argv[2] || "rollback"), null, 2),
);
process.exit(0);
